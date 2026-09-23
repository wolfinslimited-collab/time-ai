const referenceMessages: Record<string, string> = {
  duplicate_reference: "This file is already attached.",
  reference_required: "Add the required reference files first.",
  first_frame_required: "Add a first frame before using a last frame.",
  unsupported_reference_type: "Choose a supported file type for this reference.",
  invalid_reference_slot: "This reference is not supported by the selected model.",
  reference_file_too_large: "The reference exceeds this model’s file-size limit.",
  invalid_reference_media: "This file could not be read. Try a PNG, JPG, WebP, or standard MP4 file.",
  invalid_reference_duration: "The video length is outside the limit shown below.",
  invalid_reference_dimensions: "The reference dimensions do not meet this model’s limits.",
  invalid_reference_fps: "Use a reference video with 24–60 frames per second.",
  invalid_reference_trim: "Choose a valid clip within the video and the maximum clip length.",
  conflicting_reference_modes: "Use reference files or first/last frames in one generation.",
  too_many_reference_slots: "There are too many reference slots. A video uses two image slots.",
  too_many_references: "You have reached this model’s reference limit.",
  reference_output_duration_exceeded: "Reference videos plus the output must total 30 seconds or less.",
  reference_total_duration_exceeded: "The combined video duration exceeds this model’s limit.",
};

export function referenceMessage(code: string) {
  return referenceMessages[code] || code;
}

export const referenceCopy = {
  ariaLabel: "Reference files",
  title: "References",
  modes: {
    frames: "First & last frames",
    references: "Images & videos",
  },
  requiredSuffix: " · Required",
  add: "Add",
  addAria: (label: string) => `Add ${label.toLowerCase()}`,
  moveEarlier: (name: string) => `Move ${name} earlier`,
  moveLater: (name: string) => `Move ${name} later`,
  remove: (name: string) => `Remove ${name}`,
  clipStart: "Clip start",
  clipEnd: "Clip end",
  maxClip: (seconds: number | undefined) => `Maximum ${seconds}s clip`,
  videoMeta: (slot: {
    minDuration?: number;
    maxDuration?: number;
    totalDuration?: number;
  }) =>
    `MP4 · ${slot.minDuration ?? 0}–${slot.maxDuration ?? 30}s each${
      slot.totalDuration ? ` · ${slot.totalDuration}s combined` : ""
    }`,
  audioMeta: "WAV · 1–30s",
  imageMeta: "JPG, PNG, WebP",
  maxMb: (mb: number) => ` · Up to ${mb} MB each`,
  sideRange: (min: number, max: number | undefined) => ` · ${min}–${max} px per side`,
  megapixels: " · 0.41–0.93 megapixels",
  videoAutoDuration:
    "With a video reference, the model chooses the output length. The quote switches to the video-reference price.",
  frameAspect: "Output shape follows the first frame.",
  quota: (n: number) => `Up to ${n} slots. Each image uses 1; each video uses 2.`,
} as const;
