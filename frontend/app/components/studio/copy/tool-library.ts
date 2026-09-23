import type { GenerativeMediaType } from "../../../lib/studio/studio-types";

export const mediaTypeHeadings: Record<GenerativeMediaType, [string, string]> = {
  image: ["What should we create?", "Generate, transform, and finish campaign-ready imagery."],
  video: ["Bring an idea to life", "Create, animate, direct, and finish cinematic video."],
  audio: ["Make it heard", "Voice, music, dialogue, and clean sound in one studio."],
};

export const exploreCopy = {
  eyebrow: "TRENDING RECREATIONS",
  title: "Steal the shot. Make it yours.",
  description: "Start from a finished look, then change the subject, product, world, or motion.",
  liveRecreations: "live recreations",
  createFromScratch: "Create from scratch",
  showcaseTitle: "Trending creations to recreate",
  allImageTools: "All image tools",
  allToolsSubtitle: (count: number) =>
    `Explore ${count} creation, editing, and finishing workflows`,
  recreate: "Recreate",
  defaultModel: "Timeless Studio",
  switcher: {
    image: "Image",
    video: "Video",
    sound: "Sound",
  },
} as const;

export const showcaseFilters = [
  "All",
  "Viral",
  "Camera",
  "VFX",
  "Fashion",
  "Product",
  "Cinematic",
  "Editorial",
  "Surreal",
  "Character",
  "Fantasy",
] as const;

export const trendingKeys = [
  "wind-sculpt",
  "reality-door",
  "chrome-impact",
  "glass-bullet-time",
  "paparazzi-burst",
  "fabric-freeze",
] as const;

export const libraryNotes = {
  image: "Live tools generate now. Upcoming tools show what is coming next.",
  media: "Live tools generate now. Upcoming tools are visible so the studio roadmap stays clear.",
  soonBadge: "SOON",
} as const;

export const videoRecipeToolKeys = [
  "camera-motion",
  "motion-presets",
  "video-effects",
  "image-to-video",
] as const;
