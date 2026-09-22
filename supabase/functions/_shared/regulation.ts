// Studio regulation: interpret the model catalog, preflight a user
// requirement (parameters, references, prices, limits), and produce a
// provider-neutral job. Adapters are resolved separately in providers.ts.
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mediaMetadata } from "./media_metadata.ts";
import { calculateStudioCredits, type StudioCreditRules } from "./pricing.ts";
import {
  resolveProvider,
  type ProviderRoute,
} from "./providers.ts";
import {
  referenceError,
  referencePricing,
  shotSequenceError,
  type ReferenceAsset,
  type ReferenceConfig,
} from "./references.ts";
import {
  StudioError,
  validateStudioModelInputs,
  validateStudioParameters,
  verifyStoredObject,
} from "./studio.ts";

export type MediaType = "image" | "video" | "audio";

export type CatalogModel = {
  key: string;
  name: string;
  description: string;
  badge: string | null;
  provider: string;
  providerModelId: string;
  mediaType: MediaType;
  creditCost: number;
  providerCreditCost: number | null;
  parameterSchema: Record<string, unknown>;
  providerConfig: ReferenceConfig & Record<string, unknown>;
  creditRules: StudioCreditRules | null;
  isActive: boolean;
  sortOrder: number;
};

export type ReferenceRequest = {
  id: string;
  slot?: string;
  start?: number;
  end?: number;
};

export type GenerationRequest = {
  projectId: string;
  modelKey: string;
  toolKey: string | null;
  promptEnhance: boolean;
  prompt: string;
  negativePrompt: string | null;
  idempotencyKey: string;
  parameters: Record<string, unknown>;
  referenceRequests: ReferenceRequest[];
  inputAssetIds: string[];
  shots: unknown;
};

export type InputAsset = {
  id: string;
  bucket_id: string;
  object_path: string;
  mime_type: string;
  size_bytes: number;
  status: string;
  expires_at: string | null;
  retained_at: string | null;
};

export type RegulatedJob = {
  model: CatalogModel;
  provider: ProviderRoute;
  prompt: string;
  negativePrompt: string | null;
  parameters: Record<string, unknown>;
  credits: number;
  references: ReferenceAsset[];
  inputAssetIds: string[];
};

export const STUDIO_PLATFORM_LIMITS = {
  maxActiveGenerations: 3,
  maxCreatesPerMinute: 10,
  createWindowMs: 60_000,
  maxInputAssets: 40,
  minPromptLength: 1,
  maxPromptLength: 10_000,
  maxNegativePromptLength: 5_000,
  maxParameterJsonLength: 20_000,
  minIdempotencyKeyLength: 8,
  maxIdempotencyKeyLength: 128,
  providerSubmitTimeoutMs: 20_000,
  providerRefreshTimeoutMs: 130_000,
} as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;
const MODEL_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{1,63}$/;

export const isStudioUuid = (value: string) => UUID_PATTERN.test(value);

export const parseCatalogModel = (row: Record<string, unknown>): CatalogModel => {
  const key = String(row.key ?? "").trim();
  const provider = String(row.provider ?? "").trim().toLowerCase();
  const providerModelId = String(row.provider_model_id ?? "").trim();
  const mediaType = String(row.media_type ?? "").trim();
  if (!key || !provider || !providerModelId) {
    throw new StudioError("model_not_available", 404);
  }
  if (mediaType !== "image" && mediaType !== "video" && mediaType !== "audio") {
    throw new StudioError("model_not_available", 404);
  }
  return {
    key,
    name: String(row.name ?? key),
    description: String(row.description ?? ""),
    badge: row.badge == null || row.badge === ""
      ? null
      : String(row.badge),
    provider,
    providerModelId,
    mediaType,
    creditCost: Number(row.credit_cost ?? 1),
    providerCreditCost: row.provider_credit_cost == null
      ? null
      : Number(row.provider_credit_cost),
    parameterSchema: isPlainObject(row.parameter_schema)
      ? row.parameter_schema
      : {},
    providerConfig: (isPlainObject(row.provider_config)
      ? row.provider_config
      : {}) as CatalogModel["providerConfig"],
    creditRules: isPlainObject(row.credit_rules)
      ? row.credit_rules as StudioCreditRules
      : null,
    isActive: row.is_active !== false,
    sortOrder: Number(row.sort_order ?? 0),
  };
};

export const parseGenerationRequest = (
  body: unknown,
  mode: "create" | "preflight" = "create",
): GenerationRequest => {
  const raw = isPlainObject(body) ? body : {};
  const referenceRequests = parseReferenceRequests(raw.references);
  const inputAssetIds = uniqueIds(
    referenceRequests.length
      ? referenceRequests.map((reference) => reference.id)
      : Array.isArray(raw.inputAssetIds)
      ? raw.inputAssetIds.map((value) => String(value).trim())
      : [],
  );
  const prompt = String(raw.prompt ?? "").trim();
  const negativePrompt = String(raw.negativePrompt ?? "").trim() || null;
  const parameters = isPlainObject(raw.parameters) ? raw.parameters : {};
  const projectId = String(raw.projectId ?? "").trim();
  const modelKey = String(raw.modelKey ?? "").trim();
  const toolKey = String(raw.toolKey ?? "").trim() || null;
  const promptEnhance = raw.promptEnhance !== false;
  const idempotencyKey = String(raw.idempotencyKey ?? "").trim();

  if (modelKey && !MODEL_KEY_PATTERN.test(modelKey)) {
    throw new StudioError("invalid_model_key");
  }
  if (toolKey && !MODEL_KEY_PATTERN.test(toolKey)) {
    throw new StudioError("invalid_tool_key");
  }
  if (!modelKey && !toolKey) {
    throw new StudioError("invalid_model_key");
  }
  if (mode === "create" || projectId || inputAssetIds.length > 0) {
    if (!isStudioUuid(projectId)) throw new StudioError("invalid_project_id");
  }
  if (mode === "create" || prompt) {
    if (
      prompt.length < STUDIO_PLATFORM_LIMITS.minPromptLength ||
      prompt.length > STUDIO_PLATFORM_LIMITS.maxPromptLength
    ) {
      throw new StudioError("invalid_prompt");
    }
  }
  if (
    negativePrompt &&
    negativePrompt.length > STUDIO_PLATFORM_LIMITS.maxNegativePromptLength
  ) {
    throw new StudioError("invalid_negative_prompt");
  }
  if (mode === "create") {
    if (
      idempotencyKey.length < STUDIO_PLATFORM_LIMITS.minIdempotencyKeyLength ||
      idempotencyKey.length > STUDIO_PLATFORM_LIMITS.maxIdempotencyKeyLength
    ) {
      throw new StudioError("invalid_idempotency_key");
    }
  }
  if (inputAssetIds.length > STUDIO_PLATFORM_LIMITS.maxInputAssets) {
    throw new StudioError("too_many_input_assets");
  }
  if (
    JSON.stringify(parameters).length >
      STUDIO_PLATFORM_LIMITS.maxParameterJsonLength
  ) {
    throw new StudioError("parameters_too_large");
  }

  return {
    projectId,
    modelKey,
    toolKey,
    promptEnhance,
    prompt,
    negativePrompt,
    idempotencyKey,
    parameters,
    referenceRequests,
    inputAssetIds,
    shots: raw.shots,
  };
};

export const assertUserGenerationCapacity = (
  activeCount: number,
  recentCount: number,
) => {
  if (activeCount >= STUDIO_PLATFORM_LIMITS.maxActiveGenerations) {
    throw new StudioError("too_many_active_generations", 429);
  }
  if (recentCount >= STUDIO_PLATFORM_LIMITS.maxCreatesPerMinute) {
    throw new StudioError("generation_rate_limited", 429);
  }
};

export const modelCapabilities = (model: CatalogModel) => {
  const slots = Array.isArray(model.providerConfig.referenceSlots)
    ? model.providerConfig.referenceSlots
    : [];
  return {
    minInputs: Number(model.providerConfig.minInputs ?? 0),
    maxInputs: typeof model.providerConfig.maxInputs === "number"
      ? model.providerConfig.maxInputs
      : null,
    allowNegativePrompt: model.providerConfig.allowNegativePrompt !== false,
    omitPrompt: Boolean(model.providerConfig.omitPrompt),
    supportsShots: Boolean(model.providerConfig.supportsShots),
    referenceSlots: slots.map((slot) => ({
      key: slot.key,
      label: slot.label,
      min: slot.min ?? 0,
      max: slot.max,
      mimeTypes: slot.mimeTypes,
    })),
  };
};

export type PublicCatalogModel = {
  key: string;
  name: string;
  description: string;
  media_type: MediaType;
  credit_cost: number;
  credit_rules: StudioCreditRules | null;
  badge: string | null;
  parameter_schema: Record<string, unknown>;
  provider_config: CatalogModel["providerConfig"];
  capabilities: ReturnType<typeof modelCapabilities>;
};

export type PublicCreditPack = {
  key: string;
  name: string;
  description: string;
  credits: number;
  price_cents: number;
  currency: string;
  badge: string | null;
};

export const toPublicCatalogModel = (model: CatalogModel): PublicCatalogModel => ({
  key: model.key,
  name: model.name,
  description: model.description,
  media_type: model.mediaType,
  credit_cost: model.creditCost,
  credit_rules: model.creditRules,
  badge: model.badge,
  parameter_schema: model.parameterSchema,
  provider_config: model.providerConfig,
  capabilities: modelCapabilities(model),
});

export const loadActiveCatalogModels = async (
  admin: SupabaseClient,
): Promise<CatalogModel[]> => {
  const { data, error } = await admin
    .from("studio_models")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((row) =>
    parseCatalogModel(row)
  );
};

export const loadActiveCreditPacks = async (
  admin: SupabaseClient,
): Promise<PublicCreditPack[]> => {
  const { data, error } = await admin
    .from("studio_credit_packs")
    .select("key, name, description, credits, price_cents, currency, badge")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    key: String(row.key),
    name: String(row.name),
    description: String(row.description ?? ""),
    credits: Number(row.credits),
    price_cents: Number(row.price_cents),
    currency: String(row.currency ?? "usd"),
    badge: row.badge == null || row.badge === "" ? null : String(row.badge),
  }));
};

export const preflightGeneration = (options: {
  model: CatalogModel;
  request: GenerationRequest;
  inputAssets?: InputAsset[];
  verifiedReferences?: ReferenceAsset[];
  complete?: boolean;
}): RegulatedJob => {
  const {
    model,
    request,
    inputAssets = [],
    complete = false,
  } = options;
  if (!model.isActive) throw new StudioError("model_not_available", 404);

  const defaults = isPlainObject(model.providerConfig.defaultInput)
    ? model.providerConfig.defaultInput
    : {};
  const parameters = { ...defaults, ...request.parameters };
  validateStudioParameters(parameters, model.parameterSchema);

  if (complete || inputAssets.length > 0) {
    validateStudioModelInputs(
      model.providerConfig,
      request.prompt,
      request.negativePrompt,
      inputAssets,
    );
  }

  let references = options.verifiedReferences ?? [];
  const referenceConfig = model.providerConfig;
  if (referenceConfig.referenceSlots) {
    if (
      request.referenceRequests.length &&
      new Set(request.referenceRequests.map((item) => item.id)).size !==
        request.referenceRequests.length
    ) {
      throw new StudioError("duplicate_reference", 400);
    }
    if (
      referenceConfig.frameAspectRatio &&
      references.some((item) => item.slot === "first")
    ) {
      parameters.aspect_ratio = referenceConfig.frameAspectRatio;
    }
    const invalid = referenceError(
      referenceConfig,
      references,
      complete,
      parameters,
    );
    if (invalid) throw new StudioError(invalid, 400);
  } else if (request.referenceRequests.length) {
    throw new StudioError("references_not_supported", 400);
  }

  if (request.shots !== undefined) {
    const invalidShots = shotSequenceError(
      Boolean(model.providerConfig.supportsShots),
      request.shots,
      references.length,
    );
    if (invalidShots) throw new StudioError(invalidShots, 400);
    const shots = (request.shots as Array<{ prompt: string; duration: number }>)
      .map((shot) => ({ prompt: shot.prompt.trim(), duration: shot.duration }));
    const total = shots.reduce((sum, shot) => sum + shot.duration, 0);
    parameters.duration = String(total);
    parameters.multi_shots = true;
    parameters.multi_prompt = shots;
  }

  const credits = quoteCredits(model, parameters, references);
  return {
    model,
    provider: resolveProvider(model.provider),
    prompt: request.prompt,
    negativePrompt: request.negativePrompt,
    parameters,
    credits,
    references,
    inputAssetIds: request.inputAssetIds,
  };
};

export const loadStudioInputAssets = async (
  admin: SupabaseClient,
  userId: string,
  projectId: string,
  inputAssetIds: string[],
): Promise<InputAsset[]> => {
  if (inputAssetIds.length === 0) return [];
  const { data, error } = await admin
    .from("studio_assets")
    .select(
      "id, bucket_id, object_path, mime_type, size_bytes, status, expires_at, retained_at",
    )
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .eq("role", "input")
    .in("id", inputAssetIds);
  if (error) throw error;
  const rows = (data ?? []) as InputAsset[];
  const inputAssets = inputAssetIds
    .map((id) => rows.find((asset) => asset.id === id))
    .filter(Boolean) as InputAsset[];
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
  return inputAssets;
};

export const hydrateReferenceAssets = async (
  admin: SupabaseClient,
  model: CatalogModel,
  inputAssets: InputAsset[],
  referenceRequests: ReferenceRequest[],
): Promise<ReferenceAsset[]> => {
  const slots = model.providerConfig.referenceSlots;
  if (!slots) return [];
  const verified: ReferenceAsset[] = [];
  for (const asset of inputAssets) {
    const requested = referenceRequests.find((item) => item.id === asset.id);
    const slot = requested?.slot ??
      slots.find((item) => item.field === model.providerConfig.inputField)
        ?.key ??
      slots[0]?.key;
    const rule = slots.find((item) => item.key === slot);
    if (!rule || !rule.mimeTypes.includes(asset.mime_type)) {
      throw new StudioError("unsupported_reference_type", 400);
    }
    if (asset.size_bytes > (rule.maxBytes || 10 * 1024 * 1024)) {
      throw new StudioError("reference_file_too_large", 400);
    }
    const { data: file, error: fileError } = await admin.storage
      .from(asset.bucket_id)
      .download(asset.object_path);
    if (
      fileError || !file || file.size > (rule.maxBytes || 10 * 1024 * 1024)
    ) {
      throw new StudioError("invalid_reference_media", 400);
    }
    let metadata;
    try {
      metadata = mediaMetadata(
        new Uint8Array(await file.arrayBuffer()),
        asset.mime_type,
      );
    } catch {
      throw new StudioError("invalid_reference_media", 400);
    }
    verified.push({
      id: asset.id,
      slot,
      mimeType: asset.mime_type,
      sizeBytes: file.size,
      ...metadata,
      ...(requested?.start !== undefined ? { start: requested.start } : {}),
      ...(requested?.end !== undefined ? { end: requested.end } : {}),
    });
  }
  return verified;
};

export const loadUserGenerationUsage = async (
  admin: SupabaseClient,
  userId: string,
) => {
  const [{ count: activeCount, error: activeError }, {
    count: recentCount,
    error: recentError,
  }] = await Promise.all([
    admin.from("studio_generations").select("id", {
      count: "exact",
      head: true,
    }).eq("user_id", userId).in("status", ["created", "queued", "processing"]),
    admin.from("studio_generations").select("id", {
      count: "exact",
      head: true,
    }).eq("user_id", userId).gte(
      "created_at",
      new Date(Date.now() - STUDIO_PLATFORM_LIMITS.createWindowMs).toISOString(),
    ),
  ]);
  if (activeError) throw activeError;
  if (recentError) throw recentError;
  return {
    activeCount: activeCount ?? 0,
    recentCount: recentCount ?? 0,
  };
};

function quoteCredits(
  model: CatalogModel,
  parameters: Record<string, unknown>,
  references: ReferenceAsset[],
) {
  try {
    return calculateStudioCredits(
      model.creditCost,
      { ...parameters, ...referencePricing(references) },
      model.creditRules,
    );
  } catch (error) {
    if (
      error instanceof Error && error.message === "reference_price_unavailable"
    ) {
      throw new StudioError("reference_price_unavailable", 400);
    }
    throw error;
  }
}

function parseReferenceRequests(raw: unknown): ReferenceRequest[] {
  if (!Array.isArray(raw)) return [];
  if (raw.length > STUDIO_PLATFORM_LIMITS.maxInputAssets) {
    throw new StudioError("too_many_input_assets");
  }
  return raw.map((item) => {
    const record = isPlainObject(item) ? item : {};
    const parsed: ReferenceRequest = { id: String(record.id ?? "").trim() };
    if (typeof record.slot === "string" && record.slot.trim()) {
      parsed.slot = record.slot.trim();
    }
    if (record.start !== undefined) parsed.start = Number(record.start);
    if (record.end !== undefined) parsed.end = Number(record.end);
    return parsed;
  });
}

function uniqueIds(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
