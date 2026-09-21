-- Subscription-only catalog and auditable Apple/Google lifecycle processing.

update public.store_products
set is_active = false
where product_id = 'timeless.vip.weekly';

update public.store_products
set is_featured = product_id = 'timeless.vip.yearly',
    badge = case
      when product_id = 'timeless.vip.monthly' then 'POPULAR'
      when product_id = 'timeless.vip.yearly' then 'BEST VALUE'
      else null
    end
where kind = 'subscription';

alter table public.entitlements
  add column if not exists original_transaction_id text;

update public.entitlements e
set original_transaction_id = coalesce(r.original_transaction_id, r.provider_transaction_id)
from public.store_purchase_receipts r
where r.provider = e.provider
  and r.provider_transaction_id = e.provider_transaction_id
  and e.original_transaction_id is null;

create index if not exists entitlements_provider_original_idx
  on public.entitlements(provider, original_transaction_id, status, expires_at);

create or replace function public.set_entitlement_original_transaction_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.original_transaction_id is null and new.provider in ('apple', 'google') then
    select coalesce(r.original_transaction_id, r.provider_transaction_id)
    into new.original_transaction_id
    from public.store_purchase_receipts r
    where r.provider = new.provider
      and r.provider_transaction_id = new.provider_transaction_id;
  end if;
  return new;
end;
$$;

drop trigger if exists entitlements_set_original_transaction_id on public.entitlements;
create trigger entitlements_set_original_transaction_id
before insert or update of provider_transaction_id on public.entitlements
for each row execute function public.set_entitlement_original_transaction_id();

create table if not exists public.subscription_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('apple', 'google')),
  provider_event_id text not null,
  event_type text not null,
  subtype text,
  user_id uuid references auth.users(id) on delete set null,
  product_id text,
  provider_transaction_id text,
  original_transaction_id text,
  resulting_status text check (
    resulting_status in ('active', 'grace_period', 'expired', 'revoked', 'refunded')
  ),
  environment text check (environment in ('sandbox', 'production')),
  expires_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default timezone('utc', now()),
  unique (provider, provider_event_id)
);

alter table public.subscription_lifecycle_events enable row level security;

create or replace function public.apply_subscription_lifecycle(
  p_user_id uuid,
  p_provider text,
  p_event_id text,
  p_event_type text,
  p_subtype text,
  p_product_id text,
  p_transaction_id text,
  p_original_transaction_id text,
  p_status text,
  p_environment text,
  p_purchased_at timestamptz,
  p_expires_at timestamptz,
  p_raw_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row_id uuid;
  receipt_status text;
begin
  if p_provider not in ('apple', 'google') then raise exception 'invalid_provider'; end if;
  if p_status not in ('active', 'grace_period', 'expired', 'revoked', 'refunded') then
    raise exception 'invalid_entitlement_status';
  end if;
  if p_environment not in ('sandbox', 'production') then raise exception 'invalid_environment'; end if;
  if not exists (
    select 1 from public.store_products
    where product_id = p_product_id and kind = 'subscription' and is_active
  ) then raise exception 'unknown_subscription_product'; end if;

  insert into public.subscription_lifecycle_events (
    provider, provider_event_id, event_type, subtype, user_id, product_id,
    provider_transaction_id, original_transaction_id, resulting_status,
    environment, expires_at, raw_payload
  ) values (
    p_provider, p_event_id, p_event_type, p_subtype, p_user_id, p_product_id,
    p_transaction_id, p_original_transaction_id, p_status,
    p_environment, p_expires_at, coalesce(p_raw_payload, '{}'::jsonb)
  ) on conflict (provider, provider_event_id) do nothing
  returning id into event_row_id;

  if event_row_id is null then
    return jsonb_build_object('applied', false, 'duplicate', true);
  end if;

  receipt_status := case
    when p_status = 'refunded' then 'refunded'
    when p_status = 'revoked' then 'revoked'
    else 'verified'
  end;

  insert into public.store_purchase_receipts (
    user_id, provider, product_id, provider_transaction_id,
    original_transaction_id, environment, purchased_at, expires_at, status
  ) values (
    p_user_id, p_provider, p_product_id, p_transaction_id,
    p_original_transaction_id, p_environment, p_purchased_at, p_expires_at,
    receipt_status
  ) on conflict (provider, provider_transaction_id) do update set
    product_id = excluded.product_id,
    original_transaction_id = excluded.original_transaction_id,
    expires_at = excluded.expires_at,
    status = excluded.status;

  update public.entitlements
  set status = 'expired'
  where user_id = p_user_id
    and provider = p_provider
    and original_transaction_id = p_original_transaction_id
    and status in ('active', 'grace_period')
    and expires_at is not null
    and expires_at <= timezone('utc', now());

  insert into public.entitlements (
    user_id, provider, product_id, provider_transaction_id,
    original_transaction_id, status, starts_at, expires_at, raw_environment
  ) values (
    p_user_id, p_provider, p_product_id, p_transaction_id,
    p_original_transaction_id, p_status, p_purchased_at, p_expires_at,
    p_environment
  ) on conflict (provider_transaction_id) do update set
    product_id = excluded.product_id,
    original_transaction_id = excluded.original_transaction_id,
    status = excluded.status,
    starts_at = excluded.starts_at,
    expires_at = excluded.expires_at,
    raw_environment = excluded.raw_environment;

  if p_status in ('revoked', 'refunded') then
    update public.entitlements
    set status = p_status
    where user_id = p_user_id
      and provider = p_provider
      and original_transaction_id = p_original_transaction_id;
  end if;

  return jsonb_build_object(
    'applied', true,
    'status', p_status,
    'isVip', public.has_active_vip(p_user_id)
  );
end;
$$;

revoke all on table public.subscription_lifecycle_events from public, anon, authenticated;
grant all on table public.subscription_lifecycle_events to service_role;
revoke all on function public.set_entitlement_original_transaction_id()
  from public, anon, authenticated;
revoke all on function public.apply_subscription_lifecycle(
  uuid, text, text, text, text, text, text, text, text, text,
  timestamptz, timestamptz, jsonb
) from public, anon, authenticated;
grant execute on function public.apply_subscription_lifecycle(
  uuid, text, text, text, text, text, text, text, text, text,
  timestamptz, timestamptz, jsonb
) to service_role;
