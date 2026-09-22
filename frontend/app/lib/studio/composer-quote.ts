import { calculateStudioCredits, type StudioCreditRules } from "./pricing";
import { referencePricing } from "./references";

type QuoteShot = { duration: number };
type QuoteReference = { mimeType: string; duration?: number };

export function shotTotalDuration(shots: QuoteShot[]) {
  return shots.reduce((sum, shot) => sum + shot.duration, 0);
}

export function composerQuote(input: {
  creditCost: number;
  creditRules?: StudioCreditRules | null;
  parameters: Record<string, string | number | boolean>;
  shots: QuoteShot[];
  references: QuoteReference[];
}) {
  const durationSeconds = input.shots.length ? shotTotalDuration(input.shots) : undefined;
  const pricingInput = {
    ...input.parameters,
    ...(durationSeconds !== undefined ? { duration: String(durationSeconds) } : {}),
    ...referencePricing(input.references as Parameters<typeof referencePricing>[0]),
  };
  const credits = calculateStudioCredits(input.creditCost, pricingInput, input.creditRules);
  return { durationSeconds, pricingInput, credits };
}
