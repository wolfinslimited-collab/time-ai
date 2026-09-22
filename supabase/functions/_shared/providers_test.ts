import {
  normalizeProviderId,
  providerEnvKey,
  readProviderJobId,
  refreshProviderJob,
  resolveProvider,
  submitProviderJob,
} from "./providers.ts";
import { StudioError } from "./studio.ts";

Deno.test("provider env keys map vendor ids onto isolated adapter URLs", () => {
  assertEquals(providerEnvKey("kie"), "STUDIO_PROVIDER_KIE_URL");
  assertEquals(providerEnvKey("fal-ai"), "STUDIO_PROVIDER_FAL_AI_URL");
});

Deno.test("Kie remains the registered default adapter and uses the legacy submit URL", async () => {
  await withEnv({
    STUDIO_PROVIDER_SUBMIT_URL: "https://example.test/functions/v1/studio-kie-adapter",
  }, () => {
    const route = resolveProvider("KIE");
    assertEquals(route.id, "kie");
    assertEquals(route.supportsRefresh, true);
    assertEquals(
      route.submitUrl,
      "https://example.test/functions/v1/studio-kie-adapter",
    );
  });
});

Deno.test("unregistered vendors are accepted only through an explicit adapter URL", async () => {
  await withEnv({
    STUDIO_PROVIDER_FAL_URL: "https://fal.example/adapter",
  }, () => {
    const route = resolveProvider("fal");
    assertEquals(route.id, "fal");
    assertEquals(route.submitUrl, "https://fal.example/adapter");
  });
  assertStudioError(() => resolveProvider("fal"), "unsupported_provider");
});

Deno.test("unknown or malformed provider ids fail closed", () => {
  assertStudioError(() => normalizeProviderId(""), "unsupported_provider");
  assertStudioError(() => resolveProvider("Not A Vendor"), "unsupported_provider");
  assertStudioError(() => resolveProvider("openai"), "unsupported_provider");
});

Deno.test("aggregator submit posts the regulated job and reads a provider job id", async () => {
  await withEnv({
    STUDIO_PROVIDER_API_KEY: "adapter-secret",
    STUDIO_PROVIDER_SUBMIT_URL: "https://example.test/kie",
  }, async () => {
    const originalFetch = globalThis.fetch;
    let posted: { url: string; body: unknown; authorization: string } | undefined;
    globalThis.fetch = ((input, init) => {
      const requestInit = (init ?? {}) as RequestInit;
      posted = {
        url: String(input),
        body: JSON.parse(String(requestInit.body ?? "{}")),
        authorization: String(
          new Headers(requestInit.headers).get("Authorization") ?? "",
        ),
      };
      return Promise.resolve(
        new Response(JSON.stringify({ jobId: "task_123" }), { status: 200 }),
      );
    }) as typeof fetch;
    try {
      const route = resolveProvider("kie");
      const result = await submitProviderJob(route, {
        clientJobId: "00000000-0000-0000-0000-000000000001",
        provider: "kie",
        model: "bytedance/seedance-2-5",
        config: {},
        mediaType: "video",
        prompt: "A studio test",
        parameters: { duration: 4 },
        inputs: [],
        output: {
          assetId: "00000000-0000-0000-0000-000000000002",
          method: "PUT",
          url: "https://example.test/upload",
          token: "token",
          headers: { "Content-Type": "video/mp4" },
        },
        webhookUrl: "https://example.test/webhook",
      });
      assertEquals(result.jobId, "task_123");
      assertEquals(posted?.url, "https://example.test/kie");
      assertEquals(posted?.authorization, "Bearer adapter-secret");
      assertEquals(
        (posted?.body as { provider: string }).provider,
        "kie",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

Deno.test("aggregator refresh rejects adapters that do not poll", async () => {
  await withEnv({
    STUDIO_PROVIDER_API_KEY: "adapter-secret",
    STUDIO_PROVIDER_STATIC_URL: "https://static.example/adapter",
  }, async () => {
    const route = {
      ...resolveProvider("static"),
      supportsRefresh: false,
    };
    await assertStudioErrorAsync(
      () => refreshProviderJob(route, "00000000-0000-0000-0000-000000000001"),
      "provider_refresh_unsupported",
    );
  });
});

Deno.test("provider job ids are read from the documented adapter contract", () => {
  assertEquals(readProviderJobId({ jobId: "abc" }), "abc");
  assertEquals(readProviderJobId({ id: "def" }), "def");
  assertEquals(readProviderJobId({}), "");
});

async function withEnv(
  entries: Record<string, string>,
  fn: () => void | Promise<void>,
) {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(entries)) {
    previous.set(key, Deno.env.get(key));
    Deno.env.set(key, value);
  }
  try {
    await fn();
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

async function assertStudioErrorAsync(
  action: () => Promise<unknown>,
  expectedMessage: string,
) {
  try {
    await action();
  } catch (error) {
    if (error instanceof StudioError && error.message === expectedMessage) {
      return;
    }
    throw error;
  }
  throw new Error(`Expected StudioError: ${expectedMessage}`);
}
