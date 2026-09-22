export const INSUFFICIENT_CREDITS_MESSAGE = "You need more credits for this action.";

const studioErrorMessages: Array<{ codes: string[]; message: string; match?: "exact" | "includes" }> = [
  { codes: ["reference_image_required"], message: "Add a reference image for this model first." },
  { codes: ["tool_not_available"], message: "That Studio tool is unavailable right now." },
  { codes: ["invalid_tool_key"], message: "Choose a valid Studio tool and try again." },
  { codes: ["unsupported_parameter_combination"], message: "That quality and duration combination is unavailable. Choose another duration." },
  { codes: ["invalid_prompt_length"], message: "The prompt is outside this model’s supported length. Shorten it and try again." },
  { codes: ["insufficient_credits"], message: INSUFFICIENT_CREDITS_MESSAGE },
  { codes: ["too_many_active_generations"], message: "Three creations are already running. Let one finish first." },
  { codes: ["generation_rate_limited"], message: "You are creating very quickly. Wait a moment and try again." },
  {
    codes: ["provider_submission_failed", "kie_submission_failed", "kie_chat_failed"],
    message: "That AI model is temporarily unavailable. Your credits were returned.",
  },
  {
    codes: ["stripe_not_configured", "STRIPE_SECRET_KEY"],
    message: "Payments are being activated. Please try again shortly.",
    match: "includes",
  },
  {
    codes: ["Failed to send", "FunctionsFetchError", "fetch failed"],
    message: "Timeless Studio could not reach the service. Please try again.",
    match: "includes",
  },
];

export function messageForError(error: unknown, referenceFallback?: (raw: string) => string) {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  for (const entry of studioErrorMessages) {
    const mode = entry.match || "exact";
    const hit =
      mode === "exact"
        ? entry.codes.some((code) => raw === code || raw.split(/[\s,:]+/).includes(code))
        : entry.codes.some((code) => raw.includes(code));
    if (hit) return entry.message;
  }
  if (raw.includes("reference") && referenceFallback) return referenceFallback(raw);
  return raw && raw !== "[object Object]" ? raw : "Something went wrong. Please try again.";
}

export function isInsufficientCreditsMessage(message: string) {
  return message === INSUFFICIENT_CREDITS_MESSAGE;
}
