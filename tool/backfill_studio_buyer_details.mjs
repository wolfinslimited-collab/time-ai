// Run after 202609050002_studio_buyer_details.sql with server-only credentials.
// Updates billing identity only; never changes status, amounts, or credits.
const required = (name) => {
  if (!process.env[name]) throw new Error(`Missing ${name}`);
  return process.env[name];
};
const base = required('SUPABASE_URL').replace(/\/$/, '');
const key = required('SUPABASE_SERVICE_ROLE_KEY');
const stripeKey = required('STRIPE_SECRET_KEY');
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
async function checkedFetch(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response;
}
let updated = 0;
for (let offset = 0; ; offset += 100) {
  const response = await checkedFetch(`${base}/rest/v1/studio_stripe_checkouts?select=id,user_id,stripe_session_id,amount_total,currency,customer_name,customer_email,customer_phone&status=eq.paid&order=id&limit=100&offset=${offset}`, { headers });
  const rows = await response.json();
  if (!rows.length) break;
  for (const row of rows) {
    const session = await (await checkedFetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(row.stripe_session_id)}`, { headers: { Authorization: `Bearer ${stripeKey}` } })).json();
    if (session.client_reference_id !== row.user_id || session.payment_status !== 'paid' || session.amount_total !== row.amount_total || session.currency !== row.currency) throw new Error('Checkout identity or payment mismatch');
    const patch = {
      customer_name: session.customer_details?.name || row.customer_name || null,
      customer_email: session.customer_details?.email || session.customer_email || row.customer_email || null,
      customer_phone: session.customer_details?.phone || row.customer_phone || null,
    };
    await checkedFetch(`${base}/rest/v1/studio_stripe_checkouts?id=eq.${encodeURIComponent(row.id)}&status=eq.paid`, { method: 'PATCH', headers, body: JSON.stringify(patch) });
    updated++;
  }
}
console.log(`Updated billing details for ${updated} paid purchases.`);
