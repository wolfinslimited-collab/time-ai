import Stripe from "npm:stripe@^22";
import {
  authenticateStudioRequest,
  handleStudioError,
  jsonResponse,
  requiredEnv,
  studioCorsHeaders,
  StudioError,
} from "../_shared/studio.ts";
import {
  normalizeMetaBrowserIdentifier,
  normalizeMetaEventId,
  requestClientIp,
  sendAuditedMetaConversion,
} from "../_shared/meta-conversions.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: studioCorsHeaders(request) });
  }
  if (request.method !== "POST") {
    return jsonResponse(request, { error: "method_not_allowed" }, 405);
  }
  try {
    const { admin, user } = await authenticateStudioRequest(request);
    const body = await request.json().catch(() => ({}));
    const packKey = String(body?.packKey ?? "").trim();
    if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(packKey)) {
      throw new StudioError("invalid_pack_key");
    }
    const initiateCheckoutEventId = normalizeMetaEventId(
      body?.metaInitiateCheckoutEventId,
    );
    const purchaseEventId = normalizeMetaEventId(body?.metaPurchaseEventId);
    if (!initiateCheckoutEventId || !purchaseEventId) {
      throw new StudioError("invalid_meta_event_id");
    }
    const fbp = normalizeMetaBrowserIdentifier(body?.metaBrowserIdentifiers?.fbp);
    const fbc = normalizeMetaBrowserIdentifier(body?.metaBrowserIdentifiers?.fbc);
    const { data: pack, error: packError } = await admin
      .from("studio_credit_packs")
      .select("key,name,description,credits,price_cents,currency")
      .eq("key", packKey)
      .eq("is_active", true)
      .maybeSingle();
    if (packError) throw packError;
    if (!pack) throw new StudioError("pack_not_available", 404);

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY")?.trim();
    if (!stripeSecretKey) {
      throw new StudioError("stripe_not_configured", 503);
    }
    const stripe = new Stripe(stripeSecretKey);
    const returnUrl = requiredEnv("STUDIO_WEB_URL");
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      client_reference_id: user.id,
      customer_email: user.email || undefined,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      line_items: [{
        quantity: 1,
        price_data: {
          currency: pack.currency,
          unit_amount: pack.price_cents,
          product_data: {
            name: `${pack.credits.toLocaleString()} Timeless Studio credits`,
            description: pack.description || pack.name,
          },
        },
      }],
      metadata: {
        timeless_user_id: user.id,
        studio_pack_key: pack.key,
        studio_credits: String(pack.credits),
        meta_purchase_event_id: purchaseEventId,
      },
      payment_intent_data: {
        metadata: {
          timeless_user_id: user.id,
          studio_pack_key: pack.key,
        },
      },
      success_url:
        `${returnUrl}?checkout=success&session_id={CHECKOUT_SESSION_ID}` +
        `&meta_purchase_event_id=${encodeURIComponent(purchaseEventId)}`,
      cancel_url: `${returnUrl}?checkout=canceled`,
    });
    if (!session.url) throw new StudioError("stripe_checkout_url_missing", 502);

    const { data: checkoutRecord, error: insertError } = await admin
      .from("studio_stripe_checkouts")
      .insert({
        user_id: user.id,
        pack_key: pack.key,
        stripe_session_id: session.id,
        credits: pack.credits,
        amount_total: pack.price_cents,
        currency: pack.currency,
      })
      .select("id")
      .single();
    if (insertError) {
      await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
      throw insertError;
    }
    const metaResult = await sendAuditedMetaConversion(admin, {
      eventName: "InitiateCheckout",
      eventId: initiateCheckoutEventId,
      eventSourceUrl: returnUrl,
      email: user.email,
      externalId: user.id,
      fbp,
      fbc,
      clientIpAddress: requestClientIp(request),
      clientUserAgent: request.headers.get("user-agent"),
      customData: {
        content_ids: [pack.key],
        contents: [{ id: pack.key, quantity: 1 }],
        content_name: `${pack.name} Studio credits`,
        content_type: "product",
        credits: pack.credits,
        currency: String(pack.currency).toUpperCase(),
        num_items: 1,
        value: pack.price_cents / 100,
      },
    }, {
      source: "studio-stripe-checkout",
      relatedCheckoutId: checkoutRecord.id,
    });
    if (metaResult !== "delivered") {
      console.warn("Meta InitiateCheckout delivery pending or unavailable", metaResult);
    }
    return jsonResponse(
      request,
      { sessionId: session.id, url: session.url },
      201,
    );
  } catch (error) {
    return handleStudioError(request, error);
  }
});
