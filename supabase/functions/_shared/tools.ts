// Studio tools: capability recipes that cowork with regulation.
// Tools pick a default model, prompt prefix, and reference rules; regulation
// still owns parameter validation, credits, and provider routing.
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { GenerationRequest, MediaType } from "./regulation.ts";
import { StudioError } from "./studio.ts";

export type StudioToolUsage = {
  howTo: string;
  steps: string[];
  requireReference: boolean;
  promptPrefix: string | null;
  forcePrefix: boolean;
  omitPrompt: boolean;
  defaultParameters: Record<string, unknown>;
  minInputs: number | null;
  maxInputs: number | null;
  referenceHints: string[];
  allowModelPicker: boolean;
  promptEnhanceDefault: boolean;
};

export type StudioToolRecipe = {
  key: string;
  mediaType: MediaType;
  name: string;
  description: string;
  badge: string | null;
  iconKey: string;
  isAvailable: boolean;
  sortOrder: number;
  defaultModelKey: string | null;
  usage: StudioToolUsage;
  isActive: boolean;
};

export type PublicStudioTool = {
  key: string;
  media_type: MediaType;
  name: string;
  description: string;
  badge: string | null;
  icon_key: string;
  is_available: boolean;
  sort_order: number;
  default_model_key: string | null;
  usage: StudioToolUsage;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const parseStudioTool = (
  row: Record<string, unknown>,
): StudioToolRecipe => {
  const key = String(row.key ?? "").trim();
  const mediaType = String(row.media_type ?? "").trim();
  const iconKey = String(row.icon_key ?? "").trim();
  if (!key || !iconKey) throw new StudioError("tool_not_available", 404);
  if (mediaType !== "image" && mediaType !== "video" && mediaType !== "audio") {
    throw new StudioError("tool_not_available", 404);
  }
  const rawUsage = isPlainObject(row.usage) ? row.usage : {};
  const steps = Array.isArray(rawUsage.steps)
    ? rawUsage.steps.map((step) => String(step))
    : [];
  const referenceHints = Array.isArray(rawUsage.referenceHints)
    ? rawUsage.referenceHints.map((hint) => String(hint))
    : [];
  return {
    key,
    mediaType,
    name: String(row.name ?? key),
    description: String(row.description ?? ""),
    badge: row.badge == null || row.badge === "" ? null : String(row.badge),
    iconKey,
    isAvailable: row.is_available === true,
    sortOrder: Number(row.sort_order ?? 0),
    defaultModelKey: row.default_model_key == null || row.default_model_key === ""
      ? null
      : String(row.default_model_key),
    usage: {
      howTo: String(rawUsage.howTo ?? ""),
      steps,
      requireReference: Boolean(rawUsage.requireReference),
      promptPrefix: typeof rawUsage.promptPrefix === "string" &&
          rawUsage.promptPrefix.trim()
        ? rawUsage.promptPrefix
        : null,
      forcePrefix: Boolean(rawUsage.forcePrefix),
      omitPrompt: Boolean(rawUsage.omitPrompt),
      defaultParameters: isPlainObject(rawUsage.defaultParameters)
        ? rawUsage.defaultParameters
        : {},
      minInputs: typeof rawUsage.minInputs === "number"
        ? rawUsage.minInputs
        : null,
      maxInputs: typeof rawUsage.maxInputs === "number"
        ? rawUsage.maxInputs
        : null,
      referenceHints,
      allowModelPicker: rawUsage.allowModelPicker !== false,
      promptEnhanceDefault: rawUsage.promptEnhanceDefault !== false,
    },
    isActive: row.is_active !== false,
  };
};

export const toPublicStudioTool = (
  tool: StudioToolRecipe,
): PublicStudioTool => ({
  key: tool.key,
  media_type: tool.mediaType,
  name: tool.name,
  description: tool.description,
  badge: tool.badge,
  icon_key: tool.iconKey,
  is_available: tool.isAvailable,
  sort_order: tool.sortOrder,
  default_model_key: tool.defaultModelKey,
  usage: tool.usage,
});

export const loadActiveStudioTools = async (
  admin: SupabaseClient,
): Promise<StudioToolRecipe[]> => {
  const { data, error } = await admin
    .from("studio_tools")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(parseStudioTool);
};

export const loadStudioTool = async (
  admin: SupabaseClient,
  toolKey: string,
): Promise<StudioToolRecipe> => {
  const { data, error } = await admin
    .from("studio_tools")
    .select("*")
    .eq("key", toolKey)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new StudioError("tool_not_available", 404);
  const tool = parseStudioTool(data as Record<string, unknown>);
  if (!tool.isAvailable) throw new StudioError("tool_not_available", 404);
  return tool;
};

export const resolveToolRequest = (options: {
  tool: StudioToolRecipe | null;
  request: GenerationRequest;
  modelMediaType?: MediaType;
}): {
  tool: StudioToolRecipe | null;
  modelKey: string;
  request: GenerationRequest;
} => {
  const { tool } = options;
  let request = { ...options.request };
  let modelKey = request.modelKey;

  if (tool) {
    if (!tool.isActive || !tool.isAvailable) {
      throw new StudioError("tool_not_available", 404);
    }
    if (!modelKey && tool.defaultModelKey) {
      modelKey = tool.defaultModelKey;
    }
    if (
      options.modelMediaType &&
      tool.mediaType !== options.modelMediaType &&
      tool.defaultModelKey
    ) {
      modelKey = tool.defaultModelKey;
    }

    const minInputs = tool.usage.minInputs ??
      (tool.usage.requireReference ? 1 : 0);
    if (tool.usage.requireReference || minInputs > 0) {
      if (request.inputAssetIds.length < minInputs) {
        throw new StudioError("reference_required", 400);
      }
    }
    if (
      tool.usage.maxInputs != null &&
      request.inputAssetIds.length > tool.usage.maxInputs
    ) {
      throw new StudioError("too_many_input_assets", 400);
    }

    const applyPrefix = tool.usage.forcePrefix ||
      (request.promptEnhance && Boolean(tool.usage.promptPrefix));
    if (applyPrefix && tool.usage.promptPrefix) {
      const prefix = tool.usage.promptPrefix;
      if (!request.prompt.startsWith(prefix)) {
        request = {
          ...request,
          prompt: `${prefix}${request.prompt}`.trim(),
        };
      }
    }

    if (Object.keys(tool.usage.defaultParameters).length) {
      request = {
        ...request,
        parameters: {
          ...tool.usage.defaultParameters,
          ...request.parameters,
        },
      };
    }

    if (tool.usage.omitPrompt && !request.prompt) {
      request = { ...request, prompt: " " };
    }
  }

  if (!modelKey) throw new StudioError("invalid_model_key");
  return {
    tool,
    modelKey,
    request: { ...request, modelKey, toolKey: tool?.key ?? request.toolKey },
  };
};
