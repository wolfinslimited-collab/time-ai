-- Private delivery ledger for Meta Conversions API events. Payloads contain
-- only the already-normalized event body (including hashed identifiers) and
-- are never exposed to browser roles.
create table if not exists public.meta_conversion_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_name text not null check (event_name in ('InitiateCheckout', 'Purchase')),
  source text not null,
  related_checkout_id uuid references public.studio_stripe_checkouts(id)
    on delete set null,
  payload jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'delivered', 'disabled', 'retryable_error', 'permanent_error')),
  attempts integer not null default 0 check (attempts >= 0),
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists meta_conversion_deliveries_retry_idx
  on public.meta_conversion_deliveries(status, next_attempt_at)
  where status in ('pending', 'retryable_error');

drop trigger if exists meta_conversion_deliveries_set_updated_at
  on public.meta_conversion_deliveries;
create trigger meta_conversion_deliveries_set_updated_at
before update on public.meta_conversion_deliveries
for each row execute function public.set_updated_at();

alter table public.meta_conversion_deliveries enable row level security;
revoke all on public.meta_conversion_deliveries from anon, authenticated;
grant all on public.meta_conversion_deliveries to service_role;

comment on table public.meta_conversion_deliveries is
  'Service-only audit ledger for Meta CAPI delivery and retry visibility.';
