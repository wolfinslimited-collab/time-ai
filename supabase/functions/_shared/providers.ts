// Provider aggregator: maps a catalog `provider` id onto an adapter URL.
// Kie is the first registered adapter, not a hard dependency of Studio jobs.
import { requiredEnv, StudioError } from "./studio.ts";

export type ProviderAdapter = {
  id: string;
  supportsRefresh: boolean;
  defaultFunction?: string;
};

export type ProviderRoute = {
  id: string;
  submitUrl: string;
  supportsRefresh: boolean;
};

export type ProviderInput = {
  id: string;
  url: string;
  mimeType: string;
  [key: string]: unknown;
};

export type ProviderOutput = {
  assetId: string;
  method: "PUT";
  url: string;
  token: string;
  headers: Record<string, string>;
};

export type ProviderSubmission = {
  clientJobId: string;
  provider: string;
  model: string;
  config: Record<string, unknown>;
  mediaType: "image" | "video" | "audio";
  prompt: string;
  negativePrompt?: string | null;
  parameters: Record<string, unknown>;
  inputs: ProviderInput[];
  output: ProviderOutput;
  webhookUrl: string;
};

const PROVIDER_ID_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/;

export const PROVIDER_ADAPTERS: Record<string, ProviderAdapter> = {
  kie: {
    id: "kie",
    supportsRefresh: true,
    defaultFunction: "studio-kie-adapter",
  },
};

export const providerEnvKey = (providerId: string) =>
  `STUDIO_PROVIDER_${
    providerId.toUpperCase().replace(/[^A-Z0-9]+/g, "_")
  }_URL`;

export const normalizeProviderId = (value: unknown) => {
  const id = String(value ?? "").trim().toLowerCase();
  if (!PROVIDER_ID_PATTERN.test(id)) {
    throw new StudioError("unsupported_provider", 400, { provider: value });
  }
  return id;
};

export const resolveProvider = (providerId: unknown): ProviderRoute => {
  const id = normalizeProviderId(providerId);
  const adapter = PROVIDER_ADAPTERS[id];
  const submitUrl = Deno.env.get(providerEnvKey(id))?.trim() ||
    (adapter?.id === "kie"
      ? Deno.env.get("STUDIO_PROVIDER_SUBMIT_URL")?.trim()
      : "") ||
    (adapter?.defaultFunction ? studioFunctionUrl(adapter.defaultFunction) : "");
  if (!submitUrl) {
    throw new StudioError("unsupported_provider", 400, { provider: id });
  }
  return {
    id,
    submitUrl,
    supportsRefresh: adapter?.supportsRefresh ?? true,
  };
};

export const readProviderJobId = (body: unknown) => {
  const record = isPlainObject(body) ? body : {};
  return String(record.jobId ?? record.id ?? "").trim();
};

export const submitProviderJob = async (
  route: ProviderRoute,
  submission: ProviderSubmission,
  timeoutMs = 20_000,
) => {
  const body = await callProvider(route.submitUrl, submission, timeoutMs);
  if (!body.ok) {
    throw new StudioError("provider_submission_failed", 502, {
      provider: route.id,
      providerStatus: body.status,
      providerError: body.json?.error,
      providerDetails: body.json?.details,
    });
  }
  const jobId = readProviderJobId(body.json);
  if (!jobId) throw new StudioError("provider_invalid_response", 502);
  return { jobId, body: body.json };
};

export const refreshProviderJob = async (
  route: ProviderRoute,
  clientJobId: string,
  timeoutMs = 130_000,
) => {
  if (!route.supportsRefresh) {
    throw new StudioError("provider_refresh_unsupported", 409, {
      provider: route.id,
    });
  }
  const body = await callProvider(route.submitUrl, {
    action: "refresh",
    clientJobId,
  }, timeoutMs);
  if (!body.ok) {
    throw new StudioError("provider_refresh_failed", 502, {
      provider: route.id,
      providerStatus: body.status,
    });
  }
  return body.json;
};

function studioFunctionUrl(name: string) {
  const base = Deno.env.get("SUPABASE_URL")?.trim().replace(/\/$/, "");
  if (!base) throw new StudioError("unsupported_provider", 500);
  return `${base}/functions/v1/${name}`;
}

async function callProvider(
  url: string,
  payload: unknown,
  timeoutMs: number,
) {
  const response = await fetch(url, {
    method: "POST",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      "Authorization": `Bearer ${requiredEnv("STUDIO_PROVIDER_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const json = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, json };
}

function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
