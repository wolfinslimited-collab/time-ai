import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEFAULT_META_DATASET_ID = "1767429987632321";
const DEFAULT_META_GRAPH_VERSION = "v23.0";

export type MetaConversionEvent = {
  eventName: "InitiateCheckout" | "Purchase";
  eventId: string;
  eventSourceUrl: string;
  email?: string | null;
  externalId?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
  customData: Record<string, unknown>;
};

export type MetaConversionResult =
  | "delivered"
  | "disabled"
  | "retryable_error"
  | "permanent_error";

type MetaConversionPayload = {
  event_name: MetaConversionEvent["eventName"];
  event_time: number;
  event_id: string;
  event_source_url: string;
  action_source: "website";
  user_data: Record<string, string | string[]>;
  custom_data: Record<string, unknown>;
};

type MetaDeliveryContext = {
  source: string;
  relatedCheckoutId?: string | null;
};

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function buildMetaUserData(event: MetaConversionEvent) {
  const userData: Record<string, string | string[]> = {};
  const email = event.email?.trim().toLowerCase();
  const externalId = event.externalId?.trim();
  if (email) userData.em = [await sha256(email)];
  if (externalId) userData.external_id = [await sha256(externalId)];
  if (event.fbp) userData.fbp = event.fbp;
  if (event.fbc) userData.fbc = event.fbc;
  if (event.clientIpAddress) userData.client_ip_address = event.clientIpAddress;
  if (event.clientUserAgent) userData.client_user_agent = event.clientUserAgent;
  return userData;
}

export async function buildMetaConversionPayload(
  event: MetaConversionEvent,
): Promise<MetaConversionPayload> {
  return {
    event_name: event.eventName,
    event_time: Math.floor(Date.now() / 1_000),
    event_id: event.eventId,
    event_source_url: event.eventSourceUrl,
    action_source: "website",
    user_data: await buildMetaUserData(event),
    custom_data: event.customData,
  };
}

export async function sendMetaConversionPayload(
  payload: MetaConversionPayload,
): Promise<MetaConversionResult> {
  const accessToken = Deno.env.get("META_CONVERSIONS_API_ACCESS_TOKEN")?.trim();
  if (!accessToken) {
    console.warn("Meta Conversions API is disabled because its access token is missing");
    return "disabled";
  }

  const datasetId = Deno.env.get("META_DATASET_ID")?.trim() || DEFAULT_META_DATASET_ID;
  const graphVersion = Deno.env.get("META_GRAPH_API_VERSION")?.trim() ||
    DEFAULT_META_GRAPH_VERSION;
  const endpoint = new URL(
    `https://graph.facebook.com/${graphVersion}/${datasetId}/events`,
  );
  endpoint.searchParams.set("access_token", accessToken);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data: [payload] }),
      signal: controller.signal,
    });
    if (response.ok) return "delivered";
    const responseText = await response.text().catch(() => "");
    console.error(
      "Meta Conversions API rejected an event",
      response.status,
      responseText.slice(0, 500),
    );
    return response.status >= 500 ? "retryable_error" : "permanent_error";
  } catch (error) {
    console.error("Meta Conversions API request failed", error);
    return "retryable_error";
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendMetaConversion(
  event: MetaConversionEvent,
): Promise<MetaConversionResult> {
  return sendMetaConversionPayload(await buildMetaConversionPayload(event));
}

export async function sendAuditedMetaConversion(
  admin: SupabaseClient,
  event: MetaConversionEvent,
  context: MetaDeliveryContext,
): Promise<MetaConversionResult> {
  const payload = await buildMetaConversionPayload(event);
  const { data: existing, error: readError } = await admin
    .from("meta_conversion_deliveries")
    .select("status,attempts")
    .eq("event_id", event.eventId)
    .maybeSingle();
  if (readError) throw readError;
  if (existing?.status === "delivered") return "delivered";

  const attempts = Number(existing?.attempts ?? 0) + 1;
  const { error: pendingError } = await admin
    .from("meta_conversion_deliveries")
    .upsert({
      event_id: event.eventId,
      event_name: event.eventName,
      source: context.source,
      related_checkout_id: context.relatedCheckoutId ?? null,
      payload,
      status: "pending",
      attempts,
      last_attempt_at: new Date().toISOString(),
      next_attempt_at: null,
    }, { onConflict: "event_id" });
  if (pendingError) throw pendingError;

  const result = await sendMetaConversionPayload(payload);
  const nextAttemptAt = result === "retryable_error"
    ? new Date(Date.now() + Math.min(60, 2 ** Math.min(attempts, 5)) * 60_000).toISOString()
    : null;
  const { error: updateError } = await admin
    .from("meta_conversion_deliveries")
    .update({ status: result, next_attempt_at: nextAttemptAt })
    .eq("event_id", event.eventId);
  if (updateError) throw updateError;
  return result;
}

export function normalizeMetaEventId(value: unknown) {
  const eventId = String(value ?? "").trim();
  return /^[A-Za-z0-9._:-]{8,128}$/.test(eventId) ? eventId : null;
}

export function normalizeMetaBrowserIdentifier(value: unknown) {
  const identifier = String(value ?? "").trim();
  return /^[A-Za-z0-9._:-]{1,255}$/.test(identifier) ? identifier : null;
}

export function requestClientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null
  );
}
