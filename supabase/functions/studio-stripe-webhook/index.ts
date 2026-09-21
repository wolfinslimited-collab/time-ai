import { recordStripePayment } from "../_shared/stripe-payment-history.ts";
import Stripe from "npm:stripe@^22";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  jsonResponse,
  requiredEnv,
  StudioError,
} from "../_shared/studio.ts";
import {
  normalizeMetaEventId,
  sendAuditedMetaConversion,
} from "../_shared/meta-conversions.ts";

// Signature verification is local and does not call Stripe's API. Keeping the
// webhook bootable without the checkout key lets Stripe verify delivery while
// a live Checkout key is being rotated or provisioned.
const stripe = new Stripe(
  Deno.env.get("STRIPE_SECRET_KEY")?.trim() || "sk_test_webhook_verification_only",
);
const cryptoProvider = Stripe.createSubtleCryptoProvider();

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse(request, { error: "method_not_allowed" }, 405);
  }
  try {
    const signature = request.headers.get("stripe-signature") || "";
    const rawBody = await request.text();
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        rawBody,
        signature,
        requiredEnv("STRIPE_WEBHOOK_SECRET"),
        undefined,
        cryptoProvider,
      );
    } catch {
      throw new StudioError("invalid_stripe_signature", 400);
    }

    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === 'paid') {
        await recordStripePayment(adminClient(), stripe, session.id);
        if (session.metadata?.studio_pack_key) await fulfillCheckout(session);
      }
    } else if (
      event.type === "checkout.session.expired" ||
      event.type === "checkout.session.async_payment_failed"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      const admin = adminClient();
      await admin.from("studio_stripe_checkouts").update({
        status: event.type === "checkout.session.expired" ? "expired" : "failed",
      }).eq("stripe_session_id", session.id).eq("status", "open");
    }
    return jsonResponse(request, { received: true });
  } catch (error) {
    if (error instanceof StudioError) {
      return jsonResponse(request, { error: error.message }, error.status);
    }
    console.error("Studio Stripe webhook failed", error);
    return jsonResponse(request, { error: "internal_error" }, 500);
  }
});

async function fulfillCheckout(session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid") return;
  const admin = adminClient();
  const { data: checkout, error } = await admin
    .from("studio_stripe_checkouts")
    .select("*")
    .eq("stripe_session_id", session.id)
    .maybeSingle();
  if (error) throw error;
  if (!checkout) throw new StudioError("stripe_checkout_not_found", 404);
  if (
    session.client_reference_id !== checkout.user_id ||
    session.amount_total !== checkout.amount_total ||
    session.currency !== checkout.currency ||
    session.metadata?.studio_pack_key !== checkout.pack_key ||
    Number(session.metadata?.studio_credits) !== checkout.credits
  ) {
    throw new StudioError("stripe_checkout_mismatch", 409);
  }
  if (checkout.status !== "paid") {
    const { error: creditError } = await admin.rpc("studio_add_credits", {
      p_user_id: checkout.user_id,
      p_amount: checkout.credits,
      p_entry_type: "purchase",
      p_reference_id: session.id,
  });
  if (creditError) throw creditError;
  }
  const paymentIntent = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id;
  const customer = typeof session.customer === "string"
    ? session.customer
    : session.customer?.id;
  const { error: updateError } = await admin.from("studio_stripe_checkouts")
    .update({
      status: "paid",
      stripe_customer_id: customer ?? null,
      payment_intent_id: paymentIntent ?? null,
      completed_at: checkout.completed_at || new Date().toISOString(),
      customer_name: session.customer_details?.name || checkout.customer_name || null,
      customer_email: session.customer_details?.email || session.customer_email || checkout.customer_email || null,
      customer_phone: session.customer_details?.phone || checkout.customer_phone || null,
    })
    .eq("id", checkout.id);
  if (updateError) throw updateError;
  const purchaseEventId = normalizeMetaEventId(
    session.metadata?.meta_purchase_event_id,
  );
  if (purchaseEventId) {
    const metaResult = await sendAuditedMetaConversion(admin, {
      eventName: "Purchase",
      eventId: purchaseEventId,
      eventSourceUrl: requiredEnv("STUDIO_WEB_URL"),
      email: session.customer_details?.email || session.customer_email,
      externalId: checkout.user_id,
      customData: {
        content_ids: [checkout.pack_key],
        contents: [{ id: checkout.pack_key, quantity: 1 }],
        content_name: `${Number(checkout.credits).toLocaleString("en-US")} Timeless Studio credits`,
        content_type: "product",
        credits: Number(checkout.credits),
        currency: String(checkout.currency).toUpperCase(),
        num_items: 1,
        value: Number(checkout.amount_total) / 100,
      },
    }, {
      source: "studio-stripe-webhook",
      relatedCheckoutId: checkout.id,
    });
    if (metaResult === "retryable_error") {
      throw new StudioError("meta_purchase_sync_pending", 503);
    }
  }
  // Stripe's balance currency can differ from the checkout currency.
  try {
    const expanded = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ['payment_intent.latest_charge.balance_transaction'],
    });
    const intent = expanded.payment_intent as Stripe.PaymentIntent;
    const charge = intent?.latest_charge as Stripe.Charge;
    const balance = charge?.balance_transaction as Stripe.BalanceTransaction;
    if (balance && typeof balance === 'object') {
      const { error } = await admin.from('studio_stripe_checkouts').update({
        balance_amount: balance.amount / 100, balance_fee: balance.fee / 100,
        balance_net: balance.net / 100, balance_currency: balance.currency.toUpperCase(),
      }).eq('id', checkout.id);
      if (error) throw error;
    }
  } catch {
    // Return a retryable response; credits are already idempotently recorded.
    throw new StudioError('stripe_balance_sync_pending', 503);
  }

}

function adminClient() {
  return createClient(
    requiredEnv("SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );
}
