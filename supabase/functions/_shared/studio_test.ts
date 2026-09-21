import {
  hmacSha256Hex,
  resolveStudioCorsOrigin,
  safeFileName,
  StudioError,
  validateStudioParameters,
} from "./studio.ts";

Deno.test("safeFileName removes path and unsafe characters", () => {
  assertEquals(
    safeFileName("../../My reference (final).png"),
    "My-reference-final-.png",
  );
});

Deno.test("validateStudioParameters accepts allow-listed values", () => {
  validateStudioParameters(
    { aspectRatio: "9:16", seed: 42 },
    {
      type: "object",
      additionalProperties: false,
      properties: {
        aspectRatio: { type: "string", enum: ["1:1", "9:16"] },
        seed: { type: "integer", minimum: 0, maximum: 100 },
      },
    },
  );
});

Deno.test("validateStudioParameters rejects unsupported fields", () => {
  assertStudioError(
    () => validateStudioParameters({ hiddenProviderOption: true }, {}),
    "unsupported_parameter",
  );
});

Deno.test("validateStudioParameters enforces ranges", () => {
  assertStudioError(
    () =>
      validateStudioParameters(
        { duration: 60 },
        { properties: { duration: { type: "integer", maximum: 10 } } },
      ),
    "invalid_parameter_value",
  );
});

Deno.test("hmacSha256Hex produces a stable lowercase signature", async () => {
  const signature = await hmacSha256Hex(
    "key",
    "The quick brown fox jumps over the lazy dog",
  );
  assertEquals(
    signature,
    "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8",
  );
});

Deno.test("resolveStudioCorsOrigin accepts only configured origins", () => {
  const configured = "https://timelessapp.ai, https://studio.example.com";
  assertEquals(
    resolveStudioCorsOrigin("https://studio.example.com", configured),
    "https://studio.example.com",
  );
  assertEquals(
    resolveStudioCorsOrigin("https://attacker.example", configured),
    "",
  );
  assertEquals(
    resolveStudioCorsOrigin("", configured),
    "https://timelessapp.ai",
  );
});

function assertStudioError(action: () => void, expectedMessage: string) {
  try {
    action();
  } catch (error) {
    if (error instanceof StudioError && error.message === expectedMessage) {
      return;
    }
    throw error;
  }
  throw new Error(`Expected StudioError: ${expectedMessage}`);
}

function assertEquals(actual: unknown, expected: unknown) {
  if (!Object.is(actual, expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}
