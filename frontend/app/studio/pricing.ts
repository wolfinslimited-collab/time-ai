export type StudioCreditRules = {
  strategy?: "fixed" | "matrix";
  keys?: string[];
  rates?: Record<string, number>;
  multiplierKey?: string;
  inputVideoRates?: Record<string, number>;
  inputVideoKeys?: string[];
  inputVideoMultiplier?: "duration-plus-input" | "duration" | "fixed";
  imageRate?: number;
  freeImages?: number;
  inputVideoSecondRate?: number;
  inputAudioSecondRate?: number;
};

export function calculateStudioCredits(
  fallbackCredits: number,
  parameters: Record<string, unknown>,
  rules?: StudioCreditRules | null,
) {
  const base = positiveNumber(fallbackCredits) ?? 1;
  if (parameters._hasVideo && rules?.inputVideoRates) {
    const keys = (rules.inputVideoKeys || ["resolution"]) as string[];
    const rates = rules.inputVideoRates as Record<string, number>;
    const rate = positiveNumber(rates[keys.map(k => String(parameters[k] ?? "")).join("|")]);
    if (!rate) throw Error("reference_price_unavailable");
    const multiplier = rules.inputVideoMultiplier === "fixed" ? 1 : Number(parameters.duration || 0) + (rules.inputVideoMultiplier === "duration-plus-input" ? Number(parameters._videoSeconds || 0) : 0);
    return Math.max(1, Math.ceil(rate * multiplier + Number(rules.imageRate || 0) * Math.max(0, Number(parameters._imageCount || 0) - Number(rules?.freeImages || 0))));
  }
  const extra = Number(rules?.imageRate || 0) * Math.max(0, Number(parameters._imageCount || 0) - Number(rules?.freeImages || 0)) + Number(rules?.inputVideoSecondRate || 0) * Number(parameters._videoSeconds || 0) + Number(rules?.inputAudioSecondRate || 0) * Number(parameters._audioSeconds || 0);
  if (rules?.strategy !== "matrix" || !rules.keys?.length) {
    return Math.max(1, Math.ceil(base + extra));
  }

  const lookup = rules.keys.map((key) => String(parameters[key] ?? "")).join("|");
  const rate = positiveNumber(rules.rates?.[lookup]);
  if (rate === null) return Math.max(1, Math.ceil(base + extra));

  const multiplier = rules.multiplierKey
    ? positiveNumber(parameters[rules.multiplierKey]) ?? 1
    : 1;
  return Math.max(1, Math.ceil(rate * multiplier + extra));
}

function positiveNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}
