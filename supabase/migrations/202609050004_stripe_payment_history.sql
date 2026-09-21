-- Account-wide paid Checkout history, independent of Studio credit fulfillment.
create table if not exists public.stripe_payment_history (
 id text primary key,
 customer_name text,
 customer_email text,
 stripe_customer_id text,
 payment_intent_id text,
 amount_total bigint not null,
 currency text not null,
 status text not null,
 amount_refunded bigint not null default 0,
 created_at timestamptz not null,
 balance_amount numeric,
 balance_fee numeric,
 balance_net numeric,
 balance_currency text,
 description text,
 legacy_user_id text,
 studio_user_id text
);
alter table public.stripe_payment_history enable row level security;
revoke all on public.stripe_payment_history from anon, authenticated;
grant all on public.stripe_payment_history to service_role;
