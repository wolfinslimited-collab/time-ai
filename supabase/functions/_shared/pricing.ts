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

export const calculateStudioCredits = (
  fallbackCredits: number,
  parameters: Record<string, unknown>,
  rawRules: unknown,
) => {
  const base = positiveNumber(fallbackCredits) ?? 1;
  const rules = isPlainObject(rawRules) ? rawRules : {};
  if (parameters._hasVideo && rules?.inputVideoRates) {
    const keys = (rules.inputVideoKeys || ["resolution"]) as string[];
    const rates = rules.inputVideoRates as Record<string, number>;
    const rate = positiveNumber(rates[keys.map(k => String(parameters[k] ?? "")).join("|")]);
    if (!rate) throw Error("reference_price_unavailable");
    const multiplier = rules.inputVideoMultiplier === "fixed" ? 1 : Number(parameters.duration || 0) + (rules.inputVideoMultiplier === "duration-plus-input" ? Number(parameters._videoSeconds || 0) : 0);
    return Math.max(1, Math.ceil(rate * multiplier + Number(rules.imageRate || 0) * Math.max(0, Number(parameters._imageCount || 0) - Number(rules.freeImages || 0))));
  }
  const extra = Number(rules?.imageRate || 0) * Math.max(0, Number(parameters._imageCount || 0) - Number(rules.freeImages || 0)) + Number(rules?.inputVideoSecondRate || 0) * Number(parameters._videoSeconds || 0) + Number(rules?.inputAudioSecondRate || 0) * Number(parameters._audioSeconds || 0);
  if (rules.strategy !== "matrix") return Math.max(1, Math.ceil(base + extra));

  const keys = Array.isArray(rules.keys)
    ? rules.keys.filter((key): key is string => typeof key === "string")
    : [];
  const rates = isPlainObject(rules.rates) ? rules.rates : {};
  if (!keys.length) return Math.max(1, Math.ceil(base + extra));

  const lookup = keys.map((key) => String(parameters[key] ?? "")).join("|");
  const rate = positiveNumber(rates[lookup]);
  if (rate === null) return Math.max(1, Math.ceil(base + extra));

  const multiplierKey = typeof rules.multiplierKey === "string"
    ? rules.multiplierKey
    : "";
  const multiplier = multiplierKey
    ? positiveNumber(parameters[multiplierKey]) ?? 1
    : 1;
  return Math.max(1, Math.ceil(rate * multiplier + extra));
};

function positiveNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
