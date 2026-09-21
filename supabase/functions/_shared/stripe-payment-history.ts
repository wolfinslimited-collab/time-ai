import Stripe from "npm:stripe@^22";
export async function recordStripePayment(admin: any, stripe: Stripe, sessionId: string) {
 const v = await stripe.checkout.sessions.retrieve(sessionId, {expand:['payment_intent.latest_charge.balance_transaction','customer']});
 if (v.payment_status !== 'paid') return;
 const intent = v.payment_intent as Stripe.PaymentIntent;
 const charge = intent?.latest_charge as Stripe.Charge;
 const b = charge?.balance_transaction as Stripe.BalanceTransaction;
 const customer = typeof v.customer === 'object' && v.customer && !v.customer.deleted ? v.customer as Stripe.Customer : null;
 const { error } = await admin.from('stripe_payment_history').upsert({
  id:v.id, customer_name:v.customer_details?.name || customer?.name || charge?.billing_details?.name || null,
  customer_email:v.customer_details?.email || customer?.email || charge?.billing_details?.email || null,
  country_code:v.customer_details?.address?.country || customer?.address?.country || charge?.billing_details?.address?.country || null,
  stripe_customer_id:typeof v.customer==='string'?v.customer:customer?.id||null,
  payment_intent_id:intent?.id || null, amount_total:v.amount_total, currency:v.currency,
  status:'paid', amount_refunded:charge?.amount_refunded||0, created_at:new Date(v.created*1000).toISOString(),
  balance_amount:b?.amount == null ? null : b.amount/100, balance_fee:b?.fee == null ? null : b.fee/100,
  balance_net:b?.net == null ? null : b.net/100, balance_currency:b?.currency||null,
  description:v.metadata?.studio_pack_key ? 'Studio '+v.metadata.studio_pack_key : 'Legacy web purchase',
  legacy_user_id:v.metadata?.userId||null, studio_user_id:v.metadata?.timeless_user_id||null,
 });
 if(error)throw new Error('stripe_history_sync_failed');
}
