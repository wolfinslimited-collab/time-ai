import {
  authenticateStudioRequest,
  handleStudioError,
  jsonResponse,
  requiredEnv,
  studioCorsHeaders,
  StudioError,
  validateStudioParameters,
  validateStudioModelInputs,
  verifyStoredObject,
} from "../_shared/studio.ts";
import { referenceError, referencePricing, shotSequenceError, type ReferenceAsset, type ReferenceConfig } from "../_shared/references.ts";
import { mediaMetadata } from "../_shared/media_metadata.ts";
import { calculateStudioCredits } from "../_shared/pricing.ts";

type InputAsset = {
  id: string;
  bucket_id: string;
  object_path: string;
  mime_type: string;
  size_bytes: number;
  status: string;
  expires_at: string | null;
  retained_at: string | null;
};

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
    const body = await request.json().catch(() => ({}));
    const projectId = String(body?.projectId ?? "").trim();
    const modelKey = String(body?.modelKey ?? "").trim();
    const prompt = String(body?.prompt ?? "").trim();
    const negativePrompt = String(body?.negativePrompt ?? "").trim() || null;
    const idempotencyKey = String(body?.idempotencyKey ?? "").trim();
    const parameters = isPlainObject(body?.parameters) ? body.parameters : {};
    const referenceRequests = Array.isArray(body?.references) ? body.references : [];
    if (referenceRequests.length > 40) throw new StudioError("too_many_input_assets");
    if (referenceRequests.length) body.inputAssetIds = referenceRequests.map((r: {id?: string}) => r.id);
    const inputAssetIds = Array.isArray(body?.inputAssetIds)
      ? [
        ...new Set(
          body.inputAssetIds.map((value: unknown) => String(value).trim()),
        ),
      ]
      : [];

    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(projectId)) {
      throw new StudioError("invalid_project_id");
    }
    if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(modelKey)) {
      throw new StudioError("invalid_model_key");
    }
    if (prompt.length < 1 || prompt.length > 10000) {
      throw new StudioError("invalid_prompt");
    }
    if (negativePrompt && negativePrompt.length > 5000) {
      throw new StudioError("invalid_negative_prompt");
    }
    if (idempotencyKey.length < 8 || idempotencyKey.length > 128) {
      throw new StudioError("invalid_idempotency_key");
    }
    if (inputAssetIds.length > 40) {
      throw new StudioError("too_many_input_assets");
    }
    if (JSON.stringify(parameters).length > 20000) {
      throw new StudioError("parameters_too_large");
    }

    const { data: existing, error: existingError } = await admin
      .from("studio_generations")
      .select("*")
      .eq("user_id", user.id)
      .eq("idempotency_key", idempotencyKey)
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
      { data: model, error: modelError },
      { count: activeCount, error: activeCountError },
      { count: recentCount, error: recentCountError },
    ] = await Promise.all([
      admin.from("studio_projects").select("id").eq("id", projectId).eq(
        "user_id",
        user.id,
      ).maybeSingle(),
      admin.from("studio_models").select("*").eq("key", modelKey).eq(
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
        new Date(Date.now() - 60_000).toISOString(),
      ),
    ]);
    if (projectError) throw projectError;
    if (modelError) throw modelError;
    if (activeCountError) throw activeCountError;
    if (recentCountError) throw recentCountError;
    if (!project) throw new StudioError("project_not_found", 404);
    if (!model) throw new StudioError("model_not_available", 404);
    if ((activeCount ?? 0) >= 3) {
      throw new StudioError("too_many_active_generations", 429);
    }
    if ((recentCount ?? 0) >= 10) {
      throw new StudioError("generation_rate_limited", 429);
    }
    const defaultParameters = isPlainObject(model.provider_config?.defaultInput)
      ? model.provider_config.defaultInput
      : {};
    const pricedParameters = { ...defaultParameters, ...parameters };
    validateStudioParameters(pricedParameters, model.parameter_schema);
    let creditCost = 0;
    let verifiedReferences: ReferenceAsset[] = [];

    let inputAssets: InputAsset[] = [];
    if (inputAssetIds.length > 0) {
      const { data, error } = await admin
        .from("studio_assets")
        .select(
          "id, bucket_id, object_path, mime_type, size_bytes, status, expires_at, retained_at",
        )
        .eq("user_id", user.id)
        .eq("project_id", projectId)
        .eq("role", "input")
        .in("id", inputAssetIds);
      if (error) throw error;
      inputAssets = inputAssetIds.map(id => (data as InputAsset[]).find(a => a.id === id)).filter(Boolean) as InputAsset[];
      if (inputAssets.length !== inputAssetIds.length) {
        throw new StudioError("input_asset_not_found", 404);
      }

      for (const asset of inputAssets) {
        if (asset.status === "deleted" || asset.status === "failed") {
          throw new StudioError("input_asset_unavailable", 409, {
            assetId: asset.id,
          });
        }
        if (
          !asset.retained_at && asset.expires_at &&
          new Date(asset.expires_at).getTime() <= Date.now()
        ) {
          throw new StudioError("input_asset_expired", 410, {
            assetId: asset.id,
          });
        }
        if (asset.status === "pending_upload") {
          const exists = await verifyStoredObject(
            admin,
            asset.bucket_id,
            asset.object_path,
          );
          if (!exists) {
            throw new StudioError("input_upload_incomplete", 409, {
              assetId: asset.id,
            });
          }
          const { error: readyError } = await admin
            .from("studio_assets")
            .update({ status: "ready" })
            .eq("id", asset.id);
          if (readyError) throw readyError;
          asset.status = "ready";
        }
      }
    }

    validateStudioModelInputs(model.provider_config ?? {}, prompt, negativePrompt, inputAssets);
    const referenceConfig = model.provider_config as ReferenceConfig;
    if (referenceConfig.referenceSlots) {
      if (referenceRequests.length && new Set(referenceRequests.map((r: {id:string}) => r.id)).size !== referenceRequests.length) throw new StudioError("duplicate_reference", 400);
      for (const asset of inputAssets) {
        const requested = referenceRequests.find((r: {id:string}) => r.id === asset.id);
        const slot = requested?.slot ?? referenceConfig.referenceSlots.find(s => s.field === model.provider_config.inputField)?.key ?? referenceConfig.referenceSlots[0]?.key;
        const rule = referenceConfig.referenceSlots.find(s => s.key === slot);
        if (!rule || !rule.mimeTypes.includes(asset.mime_type)) throw new StudioError("unsupported_reference_type", 400);
        if (asset.size_bytes > (rule.maxBytes || 10*1024*1024)) throw new StudioError("reference_file_too_large", 400);
        const {data: file, error: fileError} = await admin.storage.from(asset.bucket_id).download(asset.object_path);
        if (fileError || !file || file.size > (rule.maxBytes || 10*1024*1024)) throw new StudioError("invalid_reference_media", 400);
        let metadata;
        try { metadata = mediaMetadata(new Uint8Array(await file.arrayBuffer()), asset.mime_type); }
        catch { throw new StudioError("invalid_reference_media", 400); }
        verifiedReferences.push({id:asset.id,slot,mimeType:asset.mime_type,sizeBytes:file.size,...metadata,
          ...(requested?.start !== undefined ? {start:requested.start} : {}), ...(requested?.end !== undefined ? {end:requested.end} : {})});
      }
      if (referenceConfig.frameAspectRatio && verifiedReferences.some(r => r.slot === "first")) pricedParameters.aspect_ratio = referenceConfig.frameAspectRatio;
      const invalid = referenceError(referenceConfig, verifiedReferences, true, pricedParameters);
      if (invalid) throw new StudioError(invalid, 400);
    } else if (referenceRequests.length) throw new StudioError("references_not_supported",400);
    if (body.shots !== undefined) {
      const invalidShots = shotSequenceError(Boolean(model.provider_config?.supportsShots), body.shots, verifiedReferences.length);
      if (invalidShots) throw new StudioError(invalidShots,400);
      const shots = body.shots.map((s: {prompt:string;duration:number}) => ({prompt:s.prompt.trim(),duration:s.duration}));
      const total = shots.reduce((sum:number,s:{duration:number}) => sum + s.duration,0);
      pricedParameters.duration=String(total);pricedParameters.multi_shots=true;pricedParameters.multi_prompt=shots;
    }
    creditCost = calculateStudioCredits(model.credit_cost, {...pricedParameters,...referencePricing(verifiedReferences)},model.credit_rules);
    generationId = crypto.randomUUID();
    const { data: generation, error: generationError } = await admin
      .from("studio_generations")
      .insert({
        id: generationId,
        user_id: user.id,
        project_id: projectId,
        model_key: model.key,
        media_type: model.media_type,
        prompt,
        negative_prompt: negativePrompt,
        parameters: pricedParameters,
        credits_charged: creditCost,
        provider: model.provider,
        idempotency_key: idempotencyKey,
      })
      .select("*")
      .single();
    if (generationError) {
      if (generationError.code === "23505") {
        const { data: raced } = await admin
          .from("studio_generations")
          .select("*")
          .eq("user_id", user.id)
          .eq("idempotency_key", idempotencyKey)
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
      p_amount: creditCost,
    });
    if (reserveError) {
      await admin.from("studio_generations").delete().eq("id", generationId);
      generationId = undefined;
      if (reserveError.message.includes("insufficient_studio_credits")) {
        throw new StudioError("insufficient_credits", 402, {
          required: creditCost,
        });
      }
      throw reserveError;
    }
    creditsReserved = true;

    if (inputAssets.length > 0) {
      const inputRows = inputAssetIds.map((assetId, index) => ({
        generation_id: generationId,
        asset_id: assetId,
        sort_order: index,
      }));
      const { error: linkError } = await admin.from("studio_generation_inputs")
        .insert(inputRows);
      if (linkError) throw linkError;
    }

    const imageFormat = String(pricedParameters.output_format ?? "png")
      .toLowerCase();
    const extension = model.media_type === "video"
      ? "mp4"
      : model.media_type === "audio"
      ? "mp3"
      : imageFormat === "jpg" || imageFormat === "jpeg"
      ? "jpg"
      : "png";
    const outputMime = model.media_type === "video"
      ? "video/mp4"
      : model.media_type === "audio"
      ? "audio/mpeg"
      : extension === "jpg"
      ? "image/jpeg"
      : "image/png";
    const outputAssetId = crypto.randomUUID();
    const outputPath =
      `${user.id}/${projectId}/${generationId}/result-0.${extension}`;
    const { error: outputAssetError } = await admin.from("studio_assets")
      .insert({
        id: outputAssetId,
        user_id: user.id,
        project_id: projectId,
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
        inputAssetIds.indexOf(a.id) - inputAssetIds.indexOf(b.id)
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
        ...verifiedReferences.find(r => r.id === asset.id),
      });
    }
    const { data: outputUpload, error: outputUploadError } = await admin.storage
      .from("studio-outputs")
      .createSignedUploadUrl(outputPath, { upsert: true });
    if (outputUploadError || !outputUpload) {
      throw outputUploadError ?? new Error("output_signing_failed");
    }

    const providerResponse = await fetch(
      requiredEnv("STUDIO_PROVIDER_SUBMIT_URL"),
      {
        method: "POST",
        signal: AbortSignal.timeout(20_000),
        headers: {
          "Authorization": `Bearer ${requiredEnv("STUDIO_PROVIDER_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientJobId: generationId,
          provider: model.provider,
          model: model.provider_model_id,
          config: model.provider_config ?? {},
          mediaType: model.media_type,
          prompt,
          negativePrompt,
          parameters: pricedParameters,
          inputs: inputPayload,
          output: {
            assetId: outputAssetId,
            method: "PUT",
            url: outputUpload.signedUrl,
            token: outputUpload.token,
            headers: { "Content-Type": outputMime },
          },
          webhookUrl: `${
            requiredEnv("SUPABASE_URL")
          }/functions/v1/studio-provider-webhook`,
        }),
      },
    );
    const providerBody = await providerResponse.json().catch(() => ({}));
    if (!providerResponse.ok) {
      throw new StudioError("provider_submission_failed", 502, {
        providerStatus: providerResponse.status,
        providerError: providerBody?.error,
        providerDetails: providerBody?.details,
      });
    }
    const providerJobId = String(providerBody?.jobId ?? providerBody?.id ?? "")
      .trim();
    if (!providerJobId) throw new StudioError("provider_invalid_response", 502);

    const { data: queued, error: queuedError } = await admin
      .from("studio_generations")
      .update({ status: "queued", provider_job_id: providerJobId })
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
