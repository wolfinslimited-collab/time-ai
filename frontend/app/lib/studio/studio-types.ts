import type { LucideIcon } from "lucide-react";
import {
  AudioLines,
  BadgePlus,
  BookOpenText,
  Camera,
  Clapperboard,
  Eraser,
  ImageIcon,
  Layers3,
  Maximize2,
  MessageSquareText,
  Mic2,
  Music2,
  Palette,
  Plus,
  RefreshCw,
  ScanFace,
  Shirt,
  Sparkles,
  SunMedium,
  WandSparkles,
  Waves,
} from "lucide-react";
import type { ReferenceConfig } from "./references";
import type { StudioCreditRules } from "./pricing";

export type MediaType = "image" | "video" | "audio" | "chat";
export type GenerativeMediaType = Exclude<MediaType, "chat">;

export type StudioModel = {
  key: string;
  name: string;
  description: string;
  media_type: GenerativeMediaType;
  credit_cost: number;
  credit_rules?: StudioCreditRules | null;
  badge: string | null;
  parameter_schema: {
    forbiddenCombinations?: Record<string, string | number | boolean>[];
    properties?: Record<string, { type?: string; enum?: Array<string | number | boolean> }>;
  };
  provider_config: ReferenceConfig & {
    minInputs?: number;
    maxInputs?: number;
    inputMimeTypes?: string[];
    allowNegativePrompt?: boolean;
    maxPromptLength?: number;
    inputField?: string;
    defaultInput?: Record<string, string | number | boolean>;
  };
};

export type StudioProject = { id: string; name: string };
export type StudioGeneration = {
  id: string;
  project_id: string;
  model_key: string;
  media_type: GenerativeMediaType;
  status: "created" | "queued" | "processing" | "succeeded" | "failed" | "canceled";
  prompt: string;
  progress: number;
  credits_charged: number;
  error_message: string | null;
  created_at: string;
};
export type StudioOutputAsset = {
  id: string;
  generation_id: string;
  status: "pending_upload" | "ready" | "failed" | "deleted";
  expires_at: string | null;
  retained_at: string | null;
};
export type CheckoutConfirmation = { creditsAdded: number; balance: number };
export type StudioToolUsage = {
  howTo?: string;
  steps?: string[];
  requireReference?: boolean;
  promptPrefix?: string | null;
  forcePrefix?: boolean;
  omitPrompt?: boolean;
  defaultParameters?: Record<string, string | number | boolean>;
  minInputs?: number | null;
  maxInputs?: number | null;
  referenceHints?: string[];
  allowModelPicker?: boolean;
  promptEnhanceDefault?: boolean;
};

export type StudioTool = {
  key: string;
  mediaType: GenerativeMediaType;
  name: string;
  description: string;
  icon: LucideIcon;
  badge?: string | null;
  available?: boolean;
  reference?: boolean;
  modelKey?: string | null;
  promptPrefix?: string | null;
  usage: StudioToolUsage;
};

export type CatalogToolRow = {
  key: string;
  media_type: GenerativeMediaType;
  name: string;
  description: string;
  badge: string | null;
  icon_key: string;
  is_available: boolean;
  sort_order: number;
  default_model_key: string | null;
  usage?: StudioToolUsage;
};

export type ChatThread = { id: string; title: string; project_id: string; model_key: string; updated_at: string };
export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  credits_charged: number;
  provider_tokens: number | null;
  created_at: string;
};

export const TOOL_ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  "wand-sparkles": WandSparkles,
  camera: Camera,
  palette: Palette,
  "scan-face": ScanFace,
  image: ImageIcon,
  "sun-medium": SunMedium,
  eraser: Eraser,
  "maximize-2": Maximize2,
  "refresh-cw": RefreshCw,
  shirt: Shirt,
  "layers-3": Layers3,
  clapperboard: Clapperboard,
  "badge-plus": BadgePlus,
  "mic-2": Mic2,
  "book-open-text": BookOpenText,
  "message-square-text": MessageSquareText,
  waves: Waves,
  "music-2": Music2,
  "audio-lines": AudioLines,
  plus: Plus,
};

export function hydrateTool(row: CatalogToolRow): StudioTool {
  const usage = row.usage || {};
  return {
    key: row.key,
    mediaType: row.media_type,
    name: row.name,
    description: row.description,
    icon: TOOL_ICONS[row.icon_key] || Sparkles,
    badge: row.badge,
    available: row.is_available,
    reference: Boolean(usage.requireReference),
    modelKey: row.default_model_key,
    promptPrefix: usage.promptPrefix || null,
    usage,
  };
}

export const activeStatuses = new Set<StudioGeneration["status"]>(["created", "queued", "processing"]);

export function isActiveGeneration(status: StudioGeneration["status"]) {
  return activeStatuses.has(status);
}

export function emptyStudioModel(mediaType: GenerativeMediaType, name = "Loading…"): StudioModel {
  return {
    key: "",
    name,
    description: "",
    media_type: mediaType,
    credit_cost: 0,
    badge: null,
    parameter_schema: {},
    provider_config: { defaultInput: {} },
  };
}

export const EMPTY_STUDIO_MODELS: Record<GenerativeMediaType, StudioModel> = {
  image: emptyStudioModel("image"),
  video: emptyStudioModel("video"),
  audio: emptyStudioModel("audio"),
};

export const UNAVAILABLE_STUDIO_MODELS: Record<GenerativeMediaType, StudioModel> = {
  image: emptyStudioModel("image", "Unavailable"),
  video: emptyStudioModel("video", "Unavailable"),
  audio: emptyStudioModel("audio", "Unavailable"),
};

export function retentionLabel(asset: StudioOutputAsset | undefined) {
  if (!asset) return null;
  if (asset.retained_at) return "Kept";
  if (asset.status === "deleted") return "Expired";
  if (!asset.expires_at) return null;
  const remaining = new Date(asset.expires_at).getTime() - Date.now();
  if (remaining <= 0) return "Expired";
  const days = Math.ceil(remaining / 86_400_000);
  return days === 1 ? "Expires today" : `Expires in ${days} days`;
}

export function modeLabel(mode: MediaType) {
  return mode === "audio" ? "Sound" : mode.charAt(0).toUpperCase() + mode.slice(1);
}

export function readableParam(key: string) {
  const labels: Record<string, string> = {
    generate_audio_switch: "Audio",
    generate_multi_clip_switch: "Multi-shot",
    ratio: "Ratio",
    aspect_ratio: "Ratio",
    resolution: "Quality",
    quality: "Quality",
    duration: "Duration",
    mode: "Mode",
    output_format: "Format",
    similarity_boost: "Clarity",
    stability: "Stability",
    speed: "Speed",
    fixed_lens: "Fixed lens",
    nsfw_checker: "Safety",
    generate_audio: "Audio",
    audio: "Audio",
    sound: "Sound",
    multi_shots: "Multi-shot",
  };
  return labels[key] || key.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function displayParamValue(key: string, value: string | number | boolean) {
  if (key === "duration") return `${value}s`;
  if (key === "mode" && value === "std") return "Standard";
  if (key === "mode" && value === "pro") return "Pro";
  if (["generate_audio", "audio", "sound", "multi_shots", "fixed_lens", "nsfw_checker"].includes(key)) {
    return value ? "On" : "Off";
  }
  return String(value);
}

export function modelVariantLabel(model: StudioModel, parameters: Record<string, string | number | boolean>) {
  const details = ["duration", "resolution", "quality", "mode"]
    .filter((key) => parameters[key] !== undefined)
    .map((key) => displayParamValue(key, parameters[key]));
  return [model.name, ...details].join(" · ");
}
