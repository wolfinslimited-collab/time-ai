import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildKieCreateBody,
  fetchKieTask,
  KieSubmission,
  settleKieTask,
} from "../_shared/kie.ts";
import {
  hmacSha256Hex,
  jsonResponse,
  requiredEnv,
  secureEquals,
  StudioError,
} from "../_shared/studio.ts";

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse(request, { error: "method_not_allowed" }, 405);
  }
  try {
    const url = new URL(request.url);
    if (url.searchParams.get("callback") === "1") {
      return await handleCallback(request, url);
    }
    assertAdapterAuthorization(request);
    const body = await request.json().catch(() => ({}));
    if (body?.action === "refresh") {
      return await handleRefresh(request, String(body?.clientJobId ?? ""));
    }
    return await handleSubmission(request, body as KieSubmission);
  } catch (error) {
    if (error instanceof StudioError) {
      return jsonResponse(request, {
        error: error.message,
        details: error.details,
      }, error.status);
    }
    console.error("Studio Kie adapter failed", error);
    return jsonResponse(request, { error: "internal_error" }, 500);
  }
});

async function handleSubmission(request: Request, body: KieSubmission) {
  const clientJobId = String(body?.clientJobId ?? "").trim();
  const model = String(body?.model ?? "").trim();
  const prompt = String(body?.prompt ?? "").trim();
  if (!isUuid(clientJobId) || !model || !prompt) {
    throw new StudioError("invalid_adapter_request");
  }
  const admin = adminClient();
  const callbackToken = crypto.randomUUID() + crypto.randomUUID();
  const callbackTokenHash = await hmacSha256Hex(
    requiredEnv("STUDIO_PROVIDER_API_KEY"),
    callbackToken,
  );
  const { error: jobError } = await admin.from("studio_provider_jobs").upsert({
    generation_id: clientJobId,
    provider: "kie",
    callback_token_hash: callbackTokenHash,
  }, { onConflict: "generation_id" });
  if (jobError) throw jobError;

  const callbackUrl = new URL(
    `${requiredEnv("SUPABASE_URL")}/functions/v1/studio-kie-adapter`,
  );
  callbackUrl.searchParams.set("callback", "1");
  callbackUrl.searchParams.set("job", clientJobId);
  callbackUrl.searchParams.set("token", callbackToken);
  const kieResponse = await fetch(
    "https://api.kie.ai/api/v1/jobs/createTask",
    {
      method: "POST",
      signal: AbortSignal.timeout(20_000),
      headers: {
        "Authorization": `Bearer ${requiredEnv("KIE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildKieCreateBody(body, callbackUrl.toString())),
    },
  );
  const kieBody = await kieResponse.json().catch(() => ({}));
  const taskId = String(kieBody?.data?.taskId ?? "").trim();
  if (!kieResponse.ok || Number(kieBody?.code ?? 500) !== 200 || !taskId) {
    throw new StudioError("kie_submission_failed", 502, {
      providerStatus: kieResponse.status,
      providerCode: kieBody?.code,
      providerMessage: String(kieBody?.msg ?? "").slice(0, 500),
    });
  }
  const { error: taskError } = await admin.from("studio_provider_jobs").update({
    provider_job_id: taskId,
    last_state: "waiting",
    last_checked_at: new Date().toISOString(),
  }).eq("generation_id", clientJobId);
  if (taskError) throw taskError;
  return jsonResponse(request, { jobId: taskId });
}

async function handleCallback(request: Request, url: URL) {
  const clientJobId = url.searchParams.get("job")?.trim() || "";
  const callbackToken = url.searchParams.get("token") || "";
  if (!isUuid(clientJobId) || callbackToken.length < 32) {
    throw new StudioError("invalid_callback", 401);
  }
  const admin = adminClient();
  const { data: providerJob, error } = await admin
    .from("studio_provider_jobs")
    .select("provider_job_id,callback_token_hash")
    .eq("generation_id", clientJobId)
    .maybeSingle();
  if (error) throw error;
  const suppliedHash = await hmacSha256Hex(
    requiredEnv("STUDIO_PROVIDER_API_KEY"),
    callbackToken,
  );
  if (
    !providerJob || !secureEquals(suppliedHash, providerJob.callback_token_hash)
  ) {
    throw new StudioError("invalid_callback", 401);
  }
  const callbackBody = await request.json().catch(() => ({}));
  const callbackTaskId = String(
    callbackBody?.data?.taskId ?? callbackBody?.taskId ?? "",
  ).trim();
  const taskId = String(providerJob.provider_job_id ?? callbackTaskId).trim();
  if (!taskId || (callbackTaskId && callbackTaskId !== taskId)) {
    throw new StudioError("kie_task_mismatch", 409);
  }
  if (!providerJob.provider_job_id) {
    await admin.from("studio_provider_jobs").update({ provider_job_id: taskId })
      .eq("generation_id", clientJobId);
  }
  schedule(async () => {
    const task = await fetchKieTask(taskId);
    await settleKieTask(admin, clientJobId, task);
  });
  return jsonResponse(request, { accepted: true });
}

async function handleRefresh(request: Request, rawClientJobId: string) {
  const clientJobId = rawClientJobId.trim();
  if (!isUuid(clientJobId)) throw new StudioError("invalid_job_id");
  const admin = adminClient();
  const { data, error } = await admin.from("studio_provider_jobs")
    .select("provider_job_id")
    .eq("generation_id", clientJobId)
    .maybeSingle();
  if (error) throw error;
  const taskId = String(data?.provider_job_id ?? "").trim();
  if (!taskId) throw new StudioError("provider_job_not_ready", 409);
  const task = await fetchKieTask(taskId);
  const settlement = await settleKieTask(admin, clientJobId, task);
  return jsonResponse(request, { task, settlement });
}

function assertAdapterAuthorization(request: Request) {
  const expected = `Bearer ${requiredEnv("STUDIO_PROVIDER_API_KEY")}`;
  const received = request.headers.get("Authorization")?.trim() || "";
  if (!secureEquals(received, expected)) {
    throw new StudioError("invalid_adapter_authorization", 401);
  }
}

function adminClient() {
  return createClient(
    requiredEnv("SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value);
}

function schedule(task: () => Promise<void>) {
  const promise = task().catch((error) =>
    console.error("Studio Kie callback settlement failed", error)
  );
  const runtime = (globalThis as unknown as {
    EdgeRuntime?: { waitUntil: (promise: Promise<void>) => void };
  }).EdgeRuntime;
  if (runtime) runtime.waitUntil(promise);
}
