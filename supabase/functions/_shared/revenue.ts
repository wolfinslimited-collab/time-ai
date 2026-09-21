export function appleRevenue(transaction: Record<string, any>) {
  if (typeof transaction.price !== 'number' || !transaction.currency) return null;
  return { revenue_amount: transaction.price / 1000, revenue_currency: transaction.currency,
    revenue_source: 'apple_transaction', revenue_tax: null, developer_proceeds: null };
}
export function googleRevenue(order: Record<string, any>) {
  const money = (v: any) => v ? Number(v.units || 0) + Number(v.nanos || 0) / 1e9 : null;
  if (!order.total?.currencyCode) return null;
  return { revenue_amount: money(order.total), revenue_currency: order.total.currencyCode,
    revenue_source: 'google_order', revenue_tax: money(order.tax),
    developer_proceeds: order.developerRevenueInBuyerCurrency?.currencyCode === order.total.currencyCode
      ? money(order.developerRevenueInBuyerCurrency) : null };
}
export async function saveRevenue(admin: any, provider: string, transactionId: string, revenue: any) {
  if (!revenue) return;
  const { error } = await admin.from('store_purchase_receipts').update(revenue)
    .eq('provider', provider).eq('provider_transaction_id', transactionId);
  if (error) throw new Error('revenue_persistence_failed');
}
export async function googleOrderRevenue(packageName: string, transactionId: string, token: string) {
  const response = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/orders/${encodeURIComponent(transactionId)}`,
    { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
  // Revenue availability must not prevent a verified buyer from getting access.
  if (!response.ok) return null;
  return googleRevenue(await response.json());
}
