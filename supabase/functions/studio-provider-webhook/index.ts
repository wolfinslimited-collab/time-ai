import {
  hmacSha256Hex,
  jsonResponse,
  requiredEnv,
  secureEquals,
  StudioError,
  verifyStoredObject,
} from "../_shared/studio.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse(request, { error: "method_not_allowed" }, 405);
  }

  try {
    const rawBody = await request.text();
    const receivedSignature =
      request.headers.get("x-studio-signature")?.trim().toLowerCase() || "";
    const expectedSignature = await hmacSha256Hex(
      requiredEnv("STUDIO_PROVIDER_WEBHOOK_SECRET"),
      rawBody,
    );
    if (
      !receivedSignature || !secureEquals(receivedSignature, expectedSignature)
    ) {
      throw new StudioError("invalid_webhook_signature", 401);
    }

    const body = JSON.parse(rawBody);
    const clientJobId = String(body?.clientJobId ?? "").trim();
    const providerJobId = String(body?.providerJobId ?? body?.jobId ?? "")
      .trim();
    const providerStatus = String(body?.status ?? "").trim().toLowerCase();
    const progress = Math.min(Math.max(Number(body?.progress ?? 0), 0), 100);
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(clientJobId)) {
      throw new StudioError("invalid_job_id");
    }

    const admin = createClient(
      requiredEnv("SUPABASE_URL"),
      requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );
    const { data: generation, error: generationError } = await admin
      .from("studio_generations")
      .select("id, status, provider_job_id, started_at")
      .eq("id", clientJobId)
      .maybeSingle();
    if (generationError) throw generationError;
    if (!generation) throw new StudioError("generation_not_found", 404);
    if (
      generation.provider_job_id && providerJobId &&
      generation.provider_job_id !== providerJobId
    ) {
      throw new StudioError("provider_job_mismatch", 409);
    }
    if (
      generation.status === "succeeded" || generation.status === "failed" ||
      generation.status === "canceled"
    ) {
      return jsonResponse(request, { ok: true, duplicate: true });
    }

    if (
      providerStatus === "queued" || providerStatus === "processing" ||
      providerStatus === "running"
    ) {
      const nextStatus = providerStatus === "queued" ? "queued" : "processing";
      const { error } = await admin.from("studio_generations").update({
        status: nextStatus,
        progress: Math.round(progress),
        started_at: nextStatus === "processing"
          ? generation.started_at ?? new Date().toISOString()
          : generation.started_at,
      }).eq("id", clientJobId);
      if (error) throw error;
      return jsonResponse(request, { ok: true });
    }

    if (providerStatus === "succeeded" || providerStatus === "completed") {
      const { data: outputs, error: outputsError } = await admin
        .from("studio_assets")
        .select("id, bucket_id, object_path")
        .eq("generation_id", clientJobId)
        .eq("role", "output");
      if (outputsError) throw outputsError;
      if (!outputs || outputs.length === 0) {
        throw new StudioError("output_asset_missing", 409);
      }
      for (const output of outputs) {
        const exists = await verifyStoredObject(
          admin,
          output.bucket_id,
          output.object_path,
        );
        if (!exists) {
          throw new StudioError("output_upload_incomplete", 409, {
            assetId: output.id,
          });
        }
      }
      const { error: assetError } = await admin
        .from("studio_assets")
        .update({ status: "ready" })
        .eq("generation_id", clientJobId)
        .eq("role", "output");
      if (assetError) throw assetError;
      const { error: completeError } = await admin.from("studio_generations")
        .update({
          status: "succeeded",
          progress: 100,
          completed_at: new Date().toISOString(),
          error_code: null,
          error_message: null,
        }).eq("id", clientJobId);
      if (completeError) throw completeError;
      return jsonResponse(request, { ok: true });
    }

    if (
      providerStatus === "failed" || providerStatus === "canceled" ||
      providerStatus === "cancelled"
    ) {
      const nextStatus = providerStatus === "failed" ? "failed" : "canceled";
      const errorCode = String(
        body?.error?.code ?? body?.errorCode ?? "provider_failed",
      ).slice(0, 100);
      const errorMessage = String(
        body?.error?.message ?? body?.errorMessage ?? "Generation failed.",
      ).slice(0, 1000);
      const { error: refundError } = await admin.rpc(
        "studio_refund_generation",
        {
          p_generation_id: clientJobId,
        },
      );
      if (refundError) throw refundError;
      const { error: failError } = await admin.from("studio_generations")
        .update({
          status: nextStatus,
          error_code: errorCode,
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        }).eq("id", clientJobId);
      if (failError) throw failError;
      return jsonResponse(request, { ok: true, refunded: true });
    }

    throw new StudioError("unknown_provider_status");
  } catch (error) {
    if (error instanceof StudioError) {
      return jsonResponse(request, { error: error.message }, error.status);
    }
    if (error instanceof SyntaxError) {
      return jsonResponse(request, { error: "invalid_json" }, 400);
    }
    console.error("Studio provider webhook failed", error);
    return jsonResponse(request, { error: "internal_error" }, 500);
  }
});
