export type StudioNavMode = "studio" | "image" | "video" | "audio";

export function studioExploreHref(mode?: StudioNavMode) {
  if (!mode || mode === "studio") return "/studio";
  return `/studio?mode=${mode}`;
}

export function studioCreateHref(toolKey: string) {
  return `/studio/create?tool=${encodeURIComponent(toolKey)}`;
}

export function parseStudioNavMode(value: string | null): StudioNavMode {
  if (value === "image" || value === "video" || value === "audio") return value;
  return "studio";
}

export function navModeToMediaType(mode: StudioNavMode): "image" | "video" | "audio" {
  return mode === "studio" ? "image" : mode;
}

export const STUDIO_CREATE_SEED_KEY = "timeless.studioCreateSeed";

export type StudioCreateSeed = {
  toolKey: string;
  prompt?: string;
  style?: string;
};

export function writeStudioCreateSeed(seed: StudioCreateSeed) {
  try {
    sessionStorage.setItem(STUDIO_CREATE_SEED_KEY, JSON.stringify(seed));
  } catch {
    // ignore quota / private mode
  }
}

export function readStudioCreateSeed(toolKey: string): StudioCreateSeed | null {
  try {
    const raw = sessionStorage.getItem(STUDIO_CREATE_SEED_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(STUDIO_CREATE_SEED_KEY);
    const seed = JSON.parse(raw) as StudioCreateSeed;
    if (seed.toolKey !== toolKey) return null;
    return seed;
  } catch {
    return null;
  }
}
