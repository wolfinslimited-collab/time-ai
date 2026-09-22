import type { ReferenceConfig } from "./references";
import type { StudioModel, StudioTool } from "./studio-types";

export type EffectiveComposerConfig = ReferenceConfig & {
  minInputs?: number;
  maxInputs?: number;
  inputMimeTypes?: string[];
  allowNegativePrompt?: boolean;
  maxPromptLength?: number;
  inputField?: string;
  defaultInput?: Record<string, string | number | boolean>;
  omitPrompt: boolean;
  promptPrefix: string | null;
  forcePrefix: boolean;
  requireReference: boolean;
};

export function effectiveComposerConfig(
  model: StudioModel,
  tool: StudioTool | null,
): EffectiveComposerConfig {
  const usage = tool?.usage || {};
  const provider = model.provider_config || {};
  const minFromTool =
    usage.minInputs != null
      ? usage.minInputs
      : usage.requireReference
        ? 1
        : null;
  const minInputs = minFromTool ?? provider.minInputs ?? 0;
  const maxInputs = usage.maxInputs ?? provider.maxInputs;
  const omitPrompt = Boolean(usage.omitPrompt || provider.omitPrompt);
  const promptPrefix = usage.promptPrefix ?? tool?.promptPrefix ?? null;
  const forcePrefix = Boolean(usage.forcePrefix);
  const requireReference = Boolean(usage.requireReference || tool?.reference || minInputs > 0);

  return {
    ...provider,
    minInputs,
    maxInputs,
    omitPrompt,
    promptPrefix,
    forcePrefix,
    requireReference,
  };
}

export function composeStudioPrompt(input: {
  mediaType: string;
  userPrompt: string;
  creativeStyle: string;
  config: EffectiveComposerConfig;
  promptEnhance: boolean;
}) {
  let prompt = input.userPrompt;
  const applyPrefix =
    Boolean(input.config.promptPrefix) &&
    (input.config.forcePrefix || (input.promptEnhance && Boolean(input.config.promptPrefix)));
  if (applyPrefix && input.config.promptPrefix && !prompt.startsWith(input.config.promptPrefix)) {
    prompt = `${input.config.promptPrefix}${prompt}`.trim();
  }
  if (input.config.omitPrompt && !prompt.trim()) return " ";
  if (input.mediaType === "audio" && input.creativeStyle !== "Natural") {
    return `Voice delivery: ${input.creativeStyle}. ${prompt}`;
  }
  if (input.creativeStyle === "None" || input.creativeStyle === "Natural") return prompt;
  return `${input.creativeStyle} style. ${prompt}`;
}
