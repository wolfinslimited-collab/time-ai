import {
  assertUserGenerationCapacity,
  modelCapabilities,
  parseCatalogModel,
  parseGenerationRequest,
  preflightGeneration,
  STUDIO_PLATFORM_LIMITS,
  toPublicCatalogModel,
  type CatalogModel,
} from "./regulation.ts";
import { StudioError } from "./studio.ts";

const seedance = parseCatalogModel({
  key: "seedance-2-5",
  name: "Seedance 2.5",
  provider: "kie",
  provider_model_id: "bytedance/seedance-2-5",
  media_type: "video",
  credit_cost: 101,
  provider_credit_cost: 112,
  is_active: true,
  parameter_schema: {
    required: [
      "generate_audio",
      "resolution",
      "aspect_ratio",
      "duration",
      "nsfw_checker",
    ],
    properties: {
      duration: { type: "integer", enum: [4, 8] },
      resolution: { type: "string", enum: ["480p", "1080p"] },
      aspect_ratio: { type: "string", enum: ["16:9", "9:16"] },
      nsfw_checker: { type: "boolean" },
      generate_audio: { type: "boolean" },
    },
    forbiddenCombinations: [{ resolution: "1080p", duration: 4 }],
  },
  provider_config: {
    defaultInput: {
      generate_audio: true,
      resolution: "480p",
      aspect_ratio: "16:9",
      duration: 4,
      nsfw_checker: false,
    },
    minInputs: 0,
    supportsShots: true,
  },
  credit_rules: {
    strategy: "matrix",
    keys: ["resolution"],
    rates: { "480p": 25.25, "1080p": 101.875 },
    multiplierKey: "duration",
  },
});

function request(
  overrides: Record<string, unknown> = {},
  mode: "create" | "preflight" = "create",
) {
  return parseGenerationRequest({
    projectId: "00000000-0000-4000-8000-000000000001",
    modelKey: "seedance-2-5",
    prompt: "A cinematic establishing shot",
    idempotencyKey: "idempotency-key-1",
    parameters: { resolution: "480p", duration: 4 },
    ...overrides,
  }, mode);
}

Deno.test("regulation catalog parsing keeps provider routing separate from the Studio model key", () => {
  assertEquals(seedance.key, "seedance-2-5");
  assertEquals(seedance.provider, "kie");
  assertEquals(seedance.providerModelId, "bytedance/seedance-2-5");
  assertEquals(seedance.mediaType, "video");
  assertEquals(seedance.description, "");
  assertEquals(seedance.badge, null);
  assertEquals(modelCapabilities(seedance).supportsShots, true);
});

Deno.test("public catalog DTO exposes snake_case fields and derived capabilities for the UI", () => {
  const model = parseCatalogModel({
    key: "nano-banana-2-1k",
    name: "Nano Banana 2",
    description: "Fast image creation and editing.",
    badge: "Popular",
    provider: "kie",
    provider_model_id: "nano-banana-2",
    media_type: "image",
    credit_cost: 12,
    is_active: true,
    sort_order: 10,
    parameter_schema: {
      properties: { resolution: { type: "string", enum: ["1K", "2K"] } },
    },
    provider_config: {
      defaultInput: { resolution: "1K" },
      minInputs: 0,
      maxInputs: 14,
      referenceSlots: [{
        key: "images",
        label: "Images",
        field: "image_input",
        mimeTypes: ["image/jpeg"],
        max: 14,
      }],
    },
    credit_rules: { strategy: "fixed" },
  });
  const publicModel = toPublicCatalogModel(model);
  assertEquals(publicModel.key, "nano-banana-2-1k");
  assertEquals(publicModel.media_type, "image");
  assertEquals(publicModel.credit_cost, 12);
  assertEquals(publicModel.badge, "Popular");
  assertEquals(publicModel.description, "Fast image creation and editing.");
  assertEquals(publicModel.capabilities.maxInputs, 14);
  assertEquals(publicModel.capabilities.referenceSlots.length, 1);
  assertEquals(publicModel.capabilities.referenceSlots[0].key, "images");
});

Deno.test("preflight merges catalog defaults, validates parameters, quotes credits, and routes Kie as an adapter", () => {
  withEnv({
    STUDIO_PROVIDER_SUBMIT_URL: "https://example.test/studio-kie-adapter",
  }, () => {
    const job = preflightGeneration({
      model: seedance,
      request: request({ parameters: { resolution: "1080p", duration: 8 } }),
      complete: true,
    });
    assertEquals(job.credits, 815);
    assertEquals(job.parameters.generate_audio, true);
    assertEquals(job.parameters.nsfw_checker, false);
    assertEquals(job.provider.id, "kie");
    assertEquals(job.model.providerModelId, "bytedance/seedance-2-5");
  });
});

Deno.test("preflight can quote a model without a prompt so the UI can dry-run settings", () => {
  withEnv({
    STUDIO_PROVIDER_SUBMIT_URL: "https://example.test/studio-kie-adapter",
  }, () => {
    const job = preflightGeneration({
      model: seedance,
      request: request({ prompt: "" }, "preflight"),
      complete: false,
    });
    assertEquals(job.credits, 101);
    assertEquals(job.prompt, "");
  });
});

Deno.test("preflight rejects catalog-forbidden combinations and unknown providers", () => {
  withEnv({
    STUDIO_PROVIDER_SUBMIT_URL: "https://example.test/studio-kie-adapter",
  }, () => {
    assertStudioError(
      () =>
        preflightGeneration({
          model: seedance,
          request: request({
            parameters: { resolution: "1080p", duration: 4 },
          }),
        }),
      "unsupported_parameter_combination",
    );
  });
  const orphan = parseCatalogModel({
    ...catalogRow(seedance),
    provider: "missing-vendor",
  });
  assertStudioError(
    () =>
      preflightGeneration({
        model: orphan,
        request: request(),
      }),
    "unsupported_provider",
  );
});

Deno.test("preflight quotes reference add-ons from verified media, not browser-supplied prices", () => {
  withEnv({
    STUDIO_PROVIDER_SUBMIT_URL: "https://example.test/studio-kie-adapter",
  }, () => {
    const model = parseCatalogModel({
      ...catalogRow(seedance),
      credit_rules: {
        ...seedance.creditRules,
        inputVideoRates: { "480p": 15.25 },
        inputVideoKeys: ["resolution"],
        inputVideoMultiplier: "duration",
      },
      provider_config: {
        ...seedance.providerConfig,
        referenceSlots: [{
          key: "videos",
          label: "Video",
          field: "reference_video_urls",
          mimeTypes: ["video/mp4"],
          max: 3,
          maxBytes: 50_000_000,
          maxDuration: 30,
        }],
      },
    });
    const job = preflightGeneration({
      model,
      request: request({
        references: [{ id: "00000000-0000-4000-8000-000000000010", slot: "videos" }],
      }),
      verifiedReferences: [{
        id: "00000000-0000-4000-8000-000000000010",
        slot: "videos",
        mimeType: "video/mp4",
        sizeBytes: 12_000,
        width: 720,
        height: 1280,
        fps: 30,
        duration: 4,
      }],
      complete: true,
    });
    assertEquals(job.credits, 61);
  });
});

Deno.test("preflight rejects references on models that do not advertise slots", () => {
  assertStudioError(
    () =>
      preflightGeneration({
        model: seedance,
        request: request({
          references: [{ id: "00000000-0000-4000-8000-000000000010" }],
        }),
        complete: true,
      }),
    "references_not_supported",
  );
});

Deno.test("platform limits stay in regulation instead of being hardcoded at the HTTP boundary", () => {
  assertEquals(STUDIO_PLATFORM_LIMITS.maxActiveGenerations, 3);
  assertEquals(STUDIO_PLATFORM_LIMITS.maxCreatesPerMinute, 10);
  assertUserGenerationCapacity(2, 9);
  assertStudioError(
    () => assertUserGenerationCapacity(3, 0),
    "too_many_active_generations",
  );
  assertStudioError(
    () => assertUserGenerationCapacity(0, 10),
    "generation_rate_limited",
  );
});

Deno.test("create requests still require a project, prompt and idempotency key", () => {
  assertStudioError(
    () => parseGenerationRequest({ modelKey: "seedance-2-5" }),
    "invalid_project_id",
  );
  assertStudioError(
    () =>
      parseGenerationRequest({
        projectId: "00000000-0000-4000-8000-000000000001",
        modelKey: "seedance-2-5",
        prompt: "",
        idempotencyKey: "idempotency-key-1",
      }),
    "invalid_prompt",
  );
});

function catalogRow(model: CatalogModel) {
  return {
    key: model.key,
    name: model.name,
    provider: model.provider,
    provider_model_id: model.providerModelId,
    media_type: model.mediaType,
    credit_cost: model.creditCost,
    provider_credit_cost: model.providerCreditCost,
    is_active: model.isActive,
    parameter_schema: model.parameterSchema,
    provider_config: model.providerConfig,
    credit_rules: model.creditRules,
  };
}

function withEnv(entries: Record<string, string>, fn: () => void) {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(entries)) {
    previous.set(key, Deno.env.get(key));
    Deno.env.set(key, value);
  }
  try {
    fn();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) Deno.env.delete(key);
      else Deno.env.set(key, value);
    }
  }
}

function assertEquals(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

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
