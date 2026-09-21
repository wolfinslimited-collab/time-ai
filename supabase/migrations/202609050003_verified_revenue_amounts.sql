alter table public.store_purchase_receipts
  add column if not exists revenue_amount numeric,
  add column if not exists revenue_currency text,
  add column if not exists revenue_source text,
  add column if not exists revenue_tax numeric,
  add column if not exists developer_proceeds numeric;
alter table public.studio_stripe_checkouts
  add column if not exists balance_amount numeric,
  add column if not exists balance_fee numeric,
  add column if not exists balance_net numeric,
  add column if not exists balance_currency text;
