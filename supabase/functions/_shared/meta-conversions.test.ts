import {
  assertEquals,
  assertMatch,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildMetaUserData,
  buildMetaConversionPayload,
  normalizeMetaBrowserIdentifier,
  normalizeMetaEventId,
} from "./meta-conversions.ts";

Deno.test("Meta identifiers are validated before transmission", () => {
  assertEquals(normalizeMetaEventId("42e93b0e-f289-46d1-a720-26804bb6cc94"), "42e93b0e-f289-46d1-a720-26804bb6cc94");
  assertEquals(normalizeMetaEventId("bad id"), null);
  assertEquals(normalizeMetaBrowserIdentifier("fb.1.1700000000000.Abc_123"), "fb.1.1700000000000.Abc_123");
  assertEquals(normalizeMetaBrowserIdentifier("cookie with spaces"), null);
});

Deno.test("Meta payload uses a stable event id for browser/server deduplication", async () => {
  const payload = await buildMetaConversionPayload({
    eventName: "InitiateCheckout",
    eventId: "42e93b0e-f289-46d1-a720-26804bb6cc94",
    eventSourceUrl: "https://timelessapp.ai/studio/compare/higgsfield",
    externalId: "user-123",
    customData: { currency: "USD", value: 9.99 },
  });
  assertEquals(payload.event_id, "42e93b0e-f289-46d1-a720-26804bb6cc94");
  assertEquals(payload.event_name, "InitiateCheckout");
  assertEquals(payload.action_source, "website");
  assertEquals(payload.custom_data.value, 9.99);
});

Deno.test("Meta user data hashes normalized identifiers", async () => {
  const userData = await buildMetaUserData({
    eventName: "Purchase",
    eventId: "42e93b0e-f289-46d1-a720-26804bb6cc94",
    eventSourceUrl: "https://timelessapp.ai/studio",
    email: "  PERSON@Example.COM ",
    externalId: "user-123",
    fbp: "fb.1.1700000000000.Abc_123",
    customData: {},
  });
  assertMatch(String(userData.em?.[0]), /^[a-f0-9]{64}$/);
  assertMatch(String(userData.external_id?.[0]), /^[a-f0-9]{64}$/);
  assertEquals(userData.fbp, "fb.1.1700000000000.Abc_123");
});
