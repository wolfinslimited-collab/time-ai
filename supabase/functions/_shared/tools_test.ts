import {
  parseStudioTool,
  resolveToolRequest,
  toPublicStudioTool,
} from "./tools.ts";
import type { GenerationRequest } from "./regulation.ts";
import { StudioError } from "./studio.ts";

const availableTool = parseStudioTool({
  key: "edit-image",
  media_type: "image",
  name: "Edit with a prompt",
  description: "Upload an image and describe the change.",
  badge: null,
  icon_key: "layers-3",
  is_available: true,
  sort_order: 10,
  default_model_key: "nano-banana-2-1k",
  is_active: true,
  usage: {
    howTo: "Upload a reference, then describe the edit.",
    steps: ["Add a reference image", "Describe the change", "Generate"],
    requireReference: true,
    promptPrefix: "Edit the reference image: ",
    minInputs: 1,
    allowModelPicker: true,
    promptEnhanceDefault: true,
  },
});

function baseRequest(
  overrides: Partial<GenerationRequest> = {},
): GenerationRequest {
  return {
    projectId: "00000000-0000-4000-8000-000000000001",
    modelKey: "nano-banana-2-1k",
    toolKey: "edit-image",
    promptEnhance: true,
    prompt: "make it warmer",
    negativePrompt: null,
    idempotencyKey: "idempotency-key-1",
    parameters: {},
    referenceRequests: [],
    inputAssetIds: [],
    shots: undefined,
    ...overrides,
  };
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

Deno.test("parseStudioTool keeps usage recipe fields for the UI and create path", () => {
  assertEquals(availableTool.key, "edit-image");
  assertEquals(availableTool.defaultModelKey, "nano-banana-2-1k");
  assertEquals(availableTool.usage.requireReference, true);
  assertEquals(availableTool.usage.promptPrefix, "Edit the reference image: ");
  const publicTool = toPublicStudioTool(availableTool);
  assertEquals(publicTool.icon_key, "layers-3");
  assertEquals(publicTool.is_available, true);
  assertEquals(publicTool.usage.steps.length, 3);
});

Deno.test("resolveToolRequest rejects unavailable tools", () => {
  const paused = parseStudioTool({
    key: "voiceover",
    media_type: "audio",
    name: "Voiceover",
    description: "Turn a script into speech.",
    badge: "Provider paused",
    icon_key: "mic-2",
    is_available: false,
    sort_order: 1,
    default_model_key: null,
    is_active: true,
    usage: { howTo: "Paused", steps: [], requireReference: false },
  });
  assertStudioError(
    () => resolveToolRequest({ tool: paused, request: baseRequest({ toolKey: "voiceover", modelKey: "nano-banana-2-1k" }) }),
    "tool_not_available",
  );
});

Deno.test("resolveToolRequest enforces requireReference and applies prompt prefixes", () => {
  assertStudioError(
    () => resolveToolRequest({ tool: availableTool, request: baseRequest() }),
    "reference_required",
  );

  const resolved = resolveToolRequest({
    tool: availableTool,
    request: baseRequest({
      inputAssetIds: ["00000000-0000-4000-8000-000000000099"],
      referenceRequests: [{ id: "00000000-0000-4000-8000-000000000099" }],
      modelKey: "",
    }),
  });
  assertEquals(resolved.modelKey, "nano-banana-2-1k");
  assertEquals(
    resolved.request.prompt,
    "Edit the reference image: make it warmer",
  );
});

Deno.test("resolveToolRequest fills the default model when the client omits modelKey", () => {
  const resolved = resolveToolRequest({
    tool: availableTool,
    request: baseRequest({
      modelKey: "",
      inputAssetIds: ["00000000-0000-4000-8000-000000000099"],
    }),
  });
  assertEquals(resolved.modelKey, "nano-banana-2-1k");
  assertEquals(resolved.request.toolKey, "edit-image");
});
