import { calculateStudioCredits } from "./pricing.ts";

Deno.test("Studio pricing selects a matrix rate and multiplies video duration", () => {
  assertEquals(
    calculateStudioCredits(42, {
      resolution: "1080p",
      generate_audio: true,
      duration: 8,
    }, {
      strategy: "matrix",
      keys: ["resolution", "generate_audio"],
      rates: { "1080p|true": 22.5 },
      multiplierKey: "duration",
    }),
    180,
  );
});

Deno.test("Studio pricing rounds fractional request totals up once", () => {
  assertEquals(
    calculateStudioCredits(42, { resolution: "480p", duration: 5 }, {
      strategy: "matrix",
      keys: ["resolution"],
      rates: { "480p": 2.625 },
      multiplierKey: "duration",
    }),
    14,
  );
});

Deno.test("Studio pricing falls back safely when a variant is unknown", () => {
  assertEquals(
    calculateStudioCredits(12, { resolution: "8K" }, {
      strategy: "matrix",
      keys: ["resolution"],
      rates: { "1K": 12 },
    }),
    12,
  );
});

function assertEquals(actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new Error(`Expected ${expected}, got ${actual}`);
  }
}
