import { referenceFields, type ReferenceAsset, type ReferenceConfig } from "./references.ts";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requiredEnv, StudioError } from "./studio.ts";

export type KieSubmission = {
  clientJobId: string;
  model: string;
  mediaType: "image" | "video" | "audio";
  prompt: string;
  negativePrompt?: string | null;
  parameters?: Record<string, unknown>;
  inputs?: Array<{ id: string; url: string; mimeType: string } & Partial<ReferenceAsset>>;
  config?: ReferenceConfig & {
    inputField?: string;
    negativePromptField?: string;
    defaultInput?: Record<string, unknown>;
  };
};

export type KieTask = {
  taskId: string;
  state: string;
  progress: number;
  resultUrls: string[];
  failCode?: string;
  failMessage?: string;
  creditsConsumed?: number;
};

const KIE_TASK_TIMEOUT_MS = 20 * 60 * 1000;

export const hasKieTaskTimedOut = (
  createdAt: string,
  now = Date.now(),
) => {
  const created = Date.parse(createdAt);
  return Number.isFinite(created) && now - created >= KIE_TASK_TIMEOUT_MS;
};

export const buildKieCreateBody = (
  submission: KieSubmission,
  callbackUrl: string,
) => {
  const defaults = isPlainObject(submission.config?.defaultInput)
    ? submission.config!.defaultInput!
    : {};
  const input: Record<string, unknown> = {
    ...defaults,
    ...(isPlainObject(submission.parameters) ? submission.parameters : {}),
    prompt: submission.prompt,
  };
  const inputUrls = (submission.inputs ?? []).map((asset) => asset.url);
  const inputField = submission.config?.inputField?.trim();
  if (submission.config?.referenceSlots) {
    Object.assign(input, referenceFields(submission.config, (submission.inputs ?? []) as ReferenceAsset[]));
  } else if (inputField && inputUrls.length > 0) {
    if (inputField.endsWith("_url") && inputUrls.length > 1) {
      throw new StudioError("too_many_reference_images", 400);
    }
    input[inputField] = inputField.endsWith("_url") ? inputUrls[0] : inputUrls;
  }
  const negativePrompt = submission.negativePrompt?.trim();
  if (negativePrompt) {
    input[submission.config?.negativePromptField?.trim() || "negative_prompt"] =
      negativePrompt;
  }

  // ElevenLabs' Market endpoints use `text` for the script while image and
  // video models use `prompt`. Keep this translation server-side so the web
  // client can use one safe generation contract for every medium.
  if (submission.model.startsWith("elevenlabs/text-to-speech")) {
    input.text = submission.prompt;
    delete input.prompt;
  }
  if (submission.model === "elevenlabs/text-to-dialogue-v3") {
    input.dialogue = [{
      text: submission.prompt,
      voice: String(input.voice ?? "EkK5I93UQWFDigLMpZcX"),
    }];
    delete input.prompt;
    delete input.voice;
  }
  if (
    [
      "google/gemini-2-5-pro-tts",
      "google/gemini-3-1-flash-tts",
    ].includes(submission.model)
  ) {
    const speakerId = "Speaker 1";
    input.speakers = [{
      speaker_id: speakerId,
      voice_name: String(input.voice_name ?? "Fenrir"),
      audio_profile: String(
        input.audio_profile ?? "A warm, confident creative narrator",
      ),
      accent: String(input.accent ?? "American (Gen)"),
      style: String(input.delivery_style ?? "Deadpan"),
      pace: String(input.pace ?? "Natural"),
    }];
    input.dialogue_turns = [{ speaker_id: speakerId, text: submission.prompt }];
    delete input.prompt;
    delete input.voice_name;
    delete input.audio_profile;
    delete input.accent;
    delete input.delivery_style;
    delete input.pace;
  }
  if (submission.config?.omitPrompt) delete input.prompt;
  return {
    model: inputUrls.length && submission.config?.imageModel ? submission.config.imageModel : submission.model,
    callBackUrl: callbackUrl,
    input,
  };
};

export const fetchKieTask = async (taskId: string): Promise<KieTask> => {
  const url = new URL("https://api.kie.ai/api/v1/jobs/recordInfo");
  url.searchParams.set("taskId", taskId);
  const response = await fetch(url, {
    headers: { "Authorization": `Bearer ${requiredEnv("KIE_API_KEY")}` },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || Number(body?.code ?? 500) !== 200) {
    throw new StudioError("kie_status_failed", 502, {
      providerStatus: response.status,
      providerCode: body?.code,
    });
  }
  const data = body?.data ?? {};
  const returnedTaskId = String(data?.taskId ?? "").trim();
  if (!returnedTaskId || returnedTaskId !== taskId) {
    throw new StudioError("kie_task_mismatch", 409);
  }
  return {
    taskId,
    state: String(data?.state ?? "waiting").trim().toLowerCase(),
    progress: clampProgress(data?.progress),
    resultUrls: extractKieResultUrls(data?.resultJson),
    failCode: String(data?.failCode ?? "").trim() || undefined,
    failMessage: String(data?.failMsg ?? "").trim() || undefined,
    creditsConsumed: finiteNumber(data?.creditsConsumed),
  };
};

export const extractKieResultUrls = (rawResult: unknown): string[] => {
  const result = typeof rawResult === "string"
    ? parseJson(rawResult)
    : rawResult;
  if (!isPlainObject(result)) return [];
  const candidates = [
    result.resultUrls,
    result.urls,
    result.outputUrls,
    result.resultUrl,
    result.url,
  ];
  for (const candidate of candidates) {
    const values = Array.isArray(candidate) ? candidate : [candidate];
    const urls = values
      .map((value) => String(value ?? "").trim())
      .filter(isSafeRemoteUrl);
    if (urls.length > 0) return [...new Set(urls)];
  }
  return [];
};

export const settleKieTask = async (
  admin: SupabaseClient,
  clientJobId: string,
  task: KieTask,
) => {
  const { data: generation, error: generationError } = await admin
    .from("studio_generations")
    .select("id,status,started_at,created_at,media_type")
    .eq("id", clientJobId)
    .maybeSingle();
  if (generationError) throw generationError;
  if (!generation) throw new StudioError("generation_not_found", 404);
  if (["succeeded", "failed", "canceled"].includes(generation.status)) {
    return { terminal: true, status: generation.status };
  }

  await admin.from("studio_provider_jobs").update({
    last_state: task.state,
    last_checked_at: new Date().toISOString(),
  }).eq("generation_id", clientJobId);

  if (["waiting", "queuing", "generating"].includes(task.state)) {
    if (hasKieTaskTimedOut(String(generation.created_at ?? ""))) {
      const { error: refundError } = await admin.rpc(
        "studio_refund_generation",
        { p_generation_id: clientJobId },
      );
      if (refundError) throw refundError;
      const { error } = await admin.from("studio_generations").update({
        status: "failed",
        provider_credits_consumed: task.creditsConsumed,
        error_code: "kie_generation_timeout",
        error_message:
          "The provider took too long to finish. Your credits were returned.",
        completed_at: new Date().toISOString(),
      }).eq("id", clientJobId);
      if (error) throw error;
      return { terminal: true, status: "failed", refunded: true };
    }
    const status = task.state === "generating" ? "processing" : "queued";
    const { error } = await admin.from("studio_generations").update({
      status,
      progress: task.progress,
      started_at: status === "processing"
        ? generation.started_at ?? new Date().toISOString()
        : generation.started_at,
    }).eq("id", clientJobId);
    if (error) throw error;
    return { terminal: false, status, progress: task.progress };
  }

  if (task.state === "success") {
    if (task.resultUrls.length === 0) {
      throw new StudioError("kie_result_missing", 502);
    }
    const { data: output, error: outputError } = await admin
      .from("studio_assets")
      .select("id,bucket_id,object_path,mime_type")
      .eq("generation_id", clientJobId)
      .eq("role", "output")
      .limit(1)
      .maybeSingle();
    if (outputError) throw outputError;
    if (!output) throw new StudioError("output_asset_missing", 409);

    await copyRemoteOutput(
      output.bucket_id,
      output.object_path,
      output.mime_type,
      task.resultUrls[0],
    );
    const { error: assetError } = await admin.from("studio_assets").update({
      status: "ready",
    }).eq("id", output.id);
    if (assetError) throw assetError;
    const { error: completeError } = await admin.from("studio_generations")
      .update({
        status: "succeeded",
        progress: 100,
        provider_credits_consumed: task.creditsConsumed,
        result_count: task.resultUrls.length,
        completed_at: new Date().toISOString(),
        error_code: null,
        error_message: null,
      }).eq("id", clientJobId);
    if (completeError) throw completeError;
    return { terminal: true, status: "succeeded" };
  }

  if (task.state === "fail") {
    const { error: refundError } = await admin.rpc(
      "studio_refund_generation",
      { p_generation_id: clientJobId },
    );
    if (refundError) throw refundError;
    const { error } = await admin.from("studio_generations").update({
      status: "failed",
      provider_credits_consumed: task.creditsConsumed,
      error_code: (task.failCode || "kie_generation_failed").slice(0, 100),
      error_message: (task.failMessage || "The generation failed.").slice(
        0,
        1000,
      ),
      completed_at: new Date().toISOString(),
    }).eq("id", clientJobId);
    if (error) throw error;
    return { terminal: true, status: "failed", refunded: true };
  }

  throw new StudioError("unknown_kie_status", 502, { state: task.state });
};

async function copyRemoteOutput(
  bucket: string,
  path: string,
  fallbackMime: string,
  remoteUrl: string,
) {
  if (!isSafeRemoteUrl(remoteUrl)) {
    throw new StudioError("unsafe_result_url", 502);
  }
  const source = await fetch(remoteUrl, {
    redirect: "follow",
    signal: AbortSignal.timeout(120_000),
  });
  if (!source.ok || !source.body) {
    throw new StudioError("kie_result_download_failed", 502, {
      providerStatus: source.status,
    });
  }
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const uploadUrl = `${requiredEnv("SUPABASE_URL")}/storage/v1/object/${
    encodeURIComponent(bucket)
  }/${encodedPath}`;
  const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const uploaded = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${serviceKey}`,
      "apikey": serviceKey,
      "Content-Type": source.headers.get("content-type") || fallbackMime,
      "x-upsert": "true",
    },
    body: source.body,
  });
  if (!uploaded.ok) {
    await uploaded.body?.cancel();
    throw new StudioError("studio_output_upload_failed", 502, {
      storageStatus: uploaded.status,
    });
  }
  await uploaded.body?.cancel();
}

function clampProgress(value: unknown) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  const scaled = numeric > 0 && numeric <= 1 ? numeric * 100 : numeric;
  return Math.round(Math.min(Math.max(scaled, 0), 99));
}

function finiteNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : undefined;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function isSafeRemoteUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
