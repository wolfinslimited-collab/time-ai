import {
  authenticateStudioRequest,
  handleStudioError,
  jsonResponse,
  studioCorsHeaders,
  StudioError,
} from "../_shared/studio.ts";
import {
  loadStudioInputAssets,
  loadUserGenerationUsage,
  modelCapabilities,
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

  try {
    const { admin, user } = await authenticateStudioRequest(request);
    const requestBody = await request.json().catch(() => ({}));
    const rawParsed = parseGenerationRequest(requestBody, "preflight");
    const tool = rawParsed.toolKey
      ? await loadStudioTool(admin, rawParsed.toolKey)
      : null;
    const resolved = resolveToolRequest({ tool, request: rawParsed });
    const [
      { data: modelRow, error: modelError },
      usage,
      { data: wallet, error: walletError },
    ] = await Promise.all([
      admin.from("studio_models").select("*").eq("key", resolved.modelKey).eq(
        "is_active",
        true,
      ).maybeSingle(),
      loadUserGenerationUsage(admin, user.id),
      admin.from("studio_credit_wallets").select("balance").eq(
        "user_id",
        user.id,
      ).maybeSingle(),
    ]);
    if (modelError) throw modelError;
    if (walletError) throw walletError;
    if (!modelRow) throw new StudioError("model_not_available", 404);

    let model = parseCatalogModel(modelRow);
    const aligned = resolveToolRequest({
      tool,
      request: resolved.request,
      modelMediaType: model.mediaType,
    });
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
    const parsed = aligned.request;
    const inputAssets = parsed.projectId && parsed.inputAssetIds.length
      ? await loadStudioInputAssets(
        admin,
        user.id,
        parsed.projectId,
        parsed.inputAssetIds,
      )
      : [];
    const job = preflightGeneration({
      model,
      request: parsed,
      inputAssets,
      complete: false,
    });
    const balance = Number(wallet?.balance ?? 0);
    return jsonResponse(request, {
      ok: true,
      toolKey: tool?.key ?? null,
      modelKey: job.model.key,
      provider: job.provider.id,
      providerModelId: job.model.providerModelId,
      mediaType: job.model.mediaType,
      parameters: job.parameters,
      credits: job.credits,
      balance,
      affordable: balance >= job.credits,
      limits: {
        maxActiveGenerations: STUDIO_PLATFORM_LIMITS.maxActiveGenerations,
        maxCreatesPerMinute: STUDIO_PLATFORM_LIMITS.maxCreatesPerMinute,
        activeGenerations: usage.activeCount,
        recentCreates: usage.recentCount,
      },
      capabilities: modelCapabilities(job.model),
    });
  } catch (error) {
    return handleStudioError(request, error);
  }
});
