import {
  authenticateStudioRequest,
  handleStudioError,
  jsonResponse,
  requiredEnv,
  studioCorsHeaders,
  StudioError,
} from "../_shared/studio.ts";
import { submitProviderJob, type ProviderSubmission } from "../_shared/providers.ts";
import {
  assertUserGenerationCapacity,
  hydrateReferenceAssets,
  loadStudioInputAssets,
  parseCatalogModel,
  parseGenerationRequest,
  preflightGeneration,
  STUDIO_PLATFORM_LIMITS,
} from "../_shared/regulation.ts";
import { loadStudioTool, resolveToolRequest } from "../_shared/tools.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: studioCorsHeaders(request) });
  }
  if (request.method !== "POST") {
    return jsonResponse(request, { error: "method_not_allowed" }, 405);
  }

  let generationId: string | undefined;
  let creditsReserved = false;
  try {
    const { admin, user } = await authenticateStudioRequest(request);
    const rawParsed = parseGenerationRequest(
      await request.json().catch(() => ({})),
      "create",
    );
    const tool = rawParsed.toolKey
      ? await loadStudioTool(admin, rawParsed.toolKey)
      : null;
    const resolved = resolveToolRequest({ tool, request: rawParsed });
    const parsed = resolved.request;

    const { data: existing, error: existingError } = await admin
      .from("studio_generations")
      .select("*")
      .eq("user_id", user.id)
      .eq("idempotency_key", parsed.idempotencyKey)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      return jsonResponse(request, {
        generation: toGeneration(existing),
        reused: true,
      });
    }

    const [
      { data: project, error: projectError },
      { data: modelRow, error: modelError },
      { count: activeCount, error: activeCountError },
      { count: recentCount, error: recentCountError },
    ] = await Promise.all([
      admin.from("studio_projects").select("id").eq("id", parsed.projectId).eq(
        "user_id",
        user.id,
      ).maybeSingle(),
      admin.from("studio_models").select("*").eq("key", resolved.modelKey).eq(
        "is_active",
        true,
      ).maybeSingle(),
      admin.from("studio_generations").select("id", {
        count: "exact",
        head: true,
      }).eq("user_id", user.id).in("status", [
        "created",
        "queued",
        "processing",
      ]),
      admin.from("studio_generations").select("id", {
        count: "exact",
        head: true,
      }).eq("user_id", user.id).gte(
        "created_at",
        new Date(Date.now() - STUDIO_PLATFORM_LIMITS.createWindowMs)
          .toISOString(),
      ),
    ]);
    if (projectError) throw projectError;
    if (modelError) throw modelError;
    if (activeCountError) throw activeCountError;
    if (recentCountError) throw recentCountError;
    if (!project) throw new StudioError("project_not_found", 404);
    if (!modelRow) throw new StudioError("model_not_available", 404);
    assertUserGenerationCapacity(activeCount ?? 0, recentCount ?? 0);

    let model = parseCatalogModel(modelRow);
    const aligned = resolveToolRequest({
      tool,
      request: parsed,
      modelMediaType: model.mediaType,
    });
    const jobRequest = aligned.request;
    if (aligned.modelKey !== model.key) {
      const { data: remapped, error: remapError } = await admin
        .from("studio_models")
        .select("*")
        .eq("key", aligned.modelKey)
        .eq("is_active", true)
        .maybeSingle();
      if (remapError) throw remapError;
      if (!remapped) throw new StudioError("model_not_available", 404);
      model = parseCatalogModel(remapped);
    }
    const inputAssets = await loadStudioInputAssets(
      admin,
      user.id,
      jobRequest.projectId,
      jobRequest.inputAssetIds,
    );
    const verifiedReferences = model.providerConfig.referenceSlots
      ? await hydrateReferenceAssets(
        admin,
        model,
        inputAssets,
        jobRequest.referenceRequests,
      )
      : [];
    const job = preflightGeneration({
      model,
      request: jobRequest,
      inputAssets,
      verifiedReferences,
      complete: true,
    });

    generationId = crypto.randomUUID();
    const { data: generation, error: generationError } = await admin
      .from("studio_generations")
      .insert({
        id: generationId,
        user_id: user.id,
        project_id: jobRequest.projectId,
        model_key: job.model.key,
        tool_key: tool?.key ?? null,
        media_type: job.model.mediaType,
        prompt: job.prompt,
        negative_prompt: job.negativePrompt,
        parameters: job.parameters,
        credits_charged: job.credits,
        provider: job.provider.id,
        idempotency_key: jobRequest.idempotencyKey,
      })
      .select("*")
      .single();
    if (generationError) {
      if (generationError.code === "23505") {
        const { data: raced } = await admin
          .from("studio_generations")
          .select("*")
          .eq("user_id", user.id)
          .eq("idempotency_key", jobRequest.idempotencyKey)
          .single();
        if (raced) {
          return jsonResponse(request, {
            generation: toGeneration(raced),
            reused: true,
          });
        }
      }
      throw generationError;
    }

    const { error: reserveError } = await admin.rpc("studio_reserve_credits", {
      p_user_id: user.id,
      p_generation_id: generationId,
      p_amount: job.credits,
    });
    if (reserveError) {
      await admin.from("studio_generations").delete().eq("id", generationId);
      generationId = undefined;
      if (reserveError.message.includes("insufficient_studio_credits")) {
        throw new StudioError("insufficient_credits", 402, {
          required: job.credits,
        });
      }
      throw reserveError;
    }
    creditsReserved = true;

    if (inputAssets.length > 0) {
      const inputRows = jobRequest.inputAssetIds.map((assetId, index) => ({
        generation_id: generationId,
        asset_id: assetId,
        sort_order: index,
      }));
      const { error: linkError } = await admin.from("studio_generation_inputs")
        .insert(inputRows);
      if (linkError) throw linkError;
    }

    const imageFormat = String(job.parameters.output_format ?? "png")
      .toLowerCase();
    const extension = job.model.mediaType === "video"
      ? "mp4"
      : job.model.mediaType === "audio"
      ? "mp3"
      : imageFormat === "jpg" || imageFormat === "jpeg"
      ? "jpg"
      : "png";
    const outputMime = job.model.mediaType === "video"
      ? "video/mp4"
      : job.model.mediaType === "audio"
      ? "audio/mpeg"
      : extension === "jpg"
      ? "image/jpeg"
      : "image/png";
    const outputAssetId = crypto.randomUUID();
    const outputPath =
      `${user.id}/${jobRequest.projectId}/${generationId}/result-0.${extension}`;
    const { error: outputAssetError } = await admin.from("studio_assets")
      .insert({
        id: outputAssetId,
        user_id: user.id,
        project_id: jobRequest.projectId,
        generation_id: generationId,
        role: "output",
        bucket_id: "studio-outputs",
        object_path: outputPath,
        mime_type: outputMime,
        status: "pending_upload",
      });
    if (outputAssetError) throw outputAssetError;

    const inputPayload = [];
    for (
      const asset of inputAssets.sort((a, b) =>
        jobRequest.inputAssetIds.indexOf(a.id) - jobRequest.inputAssetIds.indexOf(b.id)
      )
    ) {
      const { data: signed, error: signedError } = await admin.storage
        .from(asset.bucket_id)
        .createSignedUrl(asset.object_path, 3600);
      if (signedError || !signed) {
        throw signedError ?? new Error("input_signing_failed");
      }
      inputPayload.push({
        id: asset.id,
        url: signed.signedUrl,
        mimeType: asset.mime_type,
        ...verifiedReferences.find((item) => item.id === asset.id),
      });
    }
    const { data: outputUpload, error: outputUploadError } = await admin.storage
      .from("studio-outputs")
      .createSignedUploadUrl(outputPath, { upsert: true });
    if (outputUploadError || !outputUpload) {
      throw outputUploadError ?? new Error("output_signing_failed");
    }

    const submission: ProviderSubmission = {
      clientJobId: generationId,
      provider: job.provider.id,
      model: job.model.providerModelId,
      config: job.model.providerConfig,
      mediaType: job.model.mediaType,
      prompt: job.prompt,
      negativePrompt: job.negativePrompt,
      parameters: job.parameters,
      inputs: inputPayload,
      output: {
        assetId: outputAssetId,
        method: "PUT",
        url: outputUpload.signedUrl,
        token: outputUpload.token,
        headers: { "Content-Type": outputMime },
      },
      webhookUrl: `${requiredEnv("SUPABASE_URL")}/functions/v1/studio-provider-webhook`,
    };
    const submitted = await submitProviderJob(
      job.provider,
      submission,
      STUDIO_PLATFORM_LIMITS.providerSubmitTimeoutMs,
    );

    const { data: queued, error: queuedError } = await admin
      .from("studio_generations")
      .update({ status: "queued", provider_job_id: submitted.jobId })
      .eq("id", generationId)
      .select("*")
      .single();
    if (queuedError) throw queuedError;

    return jsonResponse(request, {
      generation: toGeneration(queued),
      outputAssetId,
      reused: false,
    }, 202);
  } catch (error) {
    if (generationId && creditsReserved) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (supabaseUrl && serviceRoleKey) {
          const { createClient } = await import(
            "https://esm.sh/@supabase/supabase-js@2"
          );
          const admin = createClient(supabaseUrl, serviceRoleKey);
          await admin.rpc("studio_refund_generation", {
            p_generation_id: generationId,
          });
          await admin.from("studio_generations").update({
            status: "failed",
            error_code: error instanceof StudioError
              ? error.message
              : "submission_failed",
            error_message: "The generation could not be submitted.",
            completed_at: new Date().toISOString(),
          }).eq("id", generationId);
        }
      } catch (cleanupError) {
        console.error("Studio generation cleanup failed", cleanupError);
      }
    }
    return handleStudioError(request, error);
  }
});

function toGeneration(row: Record<string, unknown>) {
  return {
    id: row.id,
    projectId: row.project_id,
    modelKey: row.model_key,
    mediaType: row.media_type,
    status: row.status,
    prompt: row.prompt,
    negativePrompt: row.negative_prompt,
    parameters: row.parameters,
    progress: row.progress,
    creditsCharged: row.credits_charged,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}
