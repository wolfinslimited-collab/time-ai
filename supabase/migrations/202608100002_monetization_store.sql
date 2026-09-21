-- Timeless production monetization model.
-- Paid coins never expire. Reward coins are granted in expiring lots and are
-- always consumed before paid coins. Store receipts are applied only after a
-- trusted server has verified them with Apple or Google.

alter table public.wallets
  add column if not exists paid_balance integer not null default 0 check (paid_balance >= 0),
  add column if not exists reward_balance integer not null default 0 check (reward_balance >= 0);

update public.wallets
set paid_balance = balance
where paid_balance = 0 and reward_balance = 0 and balance > 0;

alter table public.coin_transactions
  add column if not exists coin_type text not null default 'paid';

alter table public.coin_transactions
  drop constraint if exists coin_transactions_coin_type_check;
alter table public.coin_transactions
  add constraint coin_transactions_coin_type_check
  check (coin_type in ('paid', 'reward', 'mixed'));

create table if not exists public.store_products (
  product_id text primary key,
  kind text not null check (kind in ('subscription', 'coins')),
  title text not null,
  billing_period text check (billing_period in ('week', 'month', 'year')),
  paid_coins integer not null default 0 check (paid_coins >= 0),
  bonus_coins integer not null default 0 check (bonus_coins >= 0),
  daily_reward_coins integer not null default 0 check (daily_reward_coins >= 0),
  is_featured boolean not null default false,
  badge text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (
    (kind = 'subscription' and billing_period is not null and paid_coins = 0 and bonus_coins = 0)
    or (kind = 'coins' and billing_period is null and paid_coins > 0)
  )
);

create table if not exists public.reward_coin_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount > 0),
  remaining integer not null check (remaining >= 0 and remaining <= amount),
  reason text not null check (reason in ('purchase_bonus', 'daily_vip', 'promotion', 'admin')),
  reference_id text,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists reward_coin_grants_spend_idx
  on public.reward_coin_grants(user_id, expires_at, created_at)
  where remaining > 0;

create table if not exists public.store_purchase_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('apple', 'google')),
  product_id text not null references public.store_products(product_id),
  provider_transaction_id text not null,
  original_transaction_id text,
  environment text check (environment in ('sandbox', 'production')),
  purchased_at timestamptz not null,
  expires_at timestamptz,
  status text not null default 'verified' check (status in ('verified', 'revoked', 'refunded')),
  created_at timestamptz not null default timezone('utc', now()),
  unique (provider, provider_transaction_id)
);

create table if not exists public.daily_vip_reward_claims (
  user_id uuid not null references auth.users(id) on delete cascade,
  reward_date date not null default (timezone('utc', now()))::date,
  amount integer not null check (amount > 0),
  grant_id uuid not null references public.reward_coin_grants(id) on delete restrict,
  claimed_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, reward_date)
);

create trigger store_products_set_updated_at before update on public.store_products
for each row execute function public.set_updated_at();

alter table public.store_products enable row level security;
alter table public.reward_coin_grants enable row level security;
alter table public.store_purchase_receipts enable row level security;
alter table public.daily_vip_reward_claims enable row level security;

create policy "Active store products are readable" on public.store_products
for select using (is_active);
create policy "Users read their reward grants" on public.reward_coin_grants
for select using (auth.uid() = user_id);
create policy "Users read their store receipts" on public.store_purchase_receipts
for select using (auth.uid() = user_id);
create policy "Users read their daily VIP rewards" on public.daily_vip_reward_claims
for select using (auth.uid() = user_id);

insert into public.store_products (
  product_id, kind, title, billing_period, paid_coins, bonus_coins,
  daily_reward_coins, is_featured, badge, sort_order
) values
  ('timeless.vip.weekly', 'subscription', 'Weekly VIP', 'week', 0, 0, 10, true, 'POPULAR', 10),
  ('timeless.vip.monthly', 'subscription', 'Monthly VIP', 'month', 0, 0, 10, false, null, 20),
  ('timeless.vip.yearly', 'subscription', 'Yearly VIP', 'year', 0, 0, 10, true, 'BEST VALUE', 30),
  ('timeless.coins.500', 'coins', '500 Coins', null, 500, 200, 0, false, null, 100),
  ('timeless.coins.1000', 'coins', '1,000 Coins', null, 1000, 100, 0, false, null, 110),
  ('timeless.coins.2000', 'coins', '2,000 Coins', null, 2000, 400, 0, false, null, 120),
  ('timeless.coins.3000', 'coins', '3,000 Coins', null, 3000, 900, 0, false, null, 130),
  ('timeless.coins.5000', 'coins', '5,000 Coins', null, 5000, 2500, 0, false, null, 140),
  ('timeless.coins.10000', 'coins', '10,000 Coins', null, 10000, 10000, 0, true, 'BEST VALUE', 150)
on conflict (product_id) do update set
  title = excluded.title,
  billing_period = excluded.billing_period,
  paid_coins = excluded.paid_coins,
  bonus_coins = excluded.bonus_coins,
  daily_reward_coins = excluded.daily_reward_coins,
  is_featured = excluded.is_featured,
  badge = excluded.badge,
  sort_order = excluded.sort_order,
  is_active = true;

create or replace function public.refresh_reward_balance(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  refreshed integer;
begin
  update public.reward_coin_grants
  set remaining = 0
  where user_id = p_user_id and remaining > 0
    and expires_at <= timezone('utc', now());

  select coalesce(sum(remaining), 0)::integer into refreshed
  from public.reward_coin_grants
  where user_id = p_user_id and remaining > 0
    and expires_at > timezone('utc', now());

  update public.wallets
  set reward_balance = refreshed,
      balance = paid_balance + refreshed
  where user_id = p_user_id;
  return refreshed;
end;
$$;

create or replace function public.unlock_episode(p_episode_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  price integer;
  free_episode boolean;
  paid_available integer;
  reward_available integer;
  reward_to_spend integer;
  paid_to_spend integer;
  remaining_to_spend integer;
  reward_grant record;
  grant_spend integer;
  new_balance integer;
  spent_type text;
begin
  if current_user_id is null then raise exception 'authentication_required'; end if;

  select e.coin_price, e.is_free into price, free_episode
  from public.episodes e
  where e.id = p_episode_id and e.status = 'published';
  if not found then raise exception 'episode_not_found'; end if;

  select w.paid_balance into paid_available
  from public.wallets w where w.user_id = current_user_id for update;
  reward_available := public.refresh_reward_balance(current_user_id);

  if free_episode or public.has_active_vip(current_user_id) or exists (
    select 1 from public.episode_unlocks u
    where u.user_id = current_user_id and u.episode_id = p_episode_id
  ) then
    select balance into new_balance from public.wallets where user_id = current_user_id;
    return coalesce(new_balance, 0);
  end if;

  if coalesce(paid_available, 0) + reward_available < price then
    raise exception 'insufficient_coins';
  end if;

  reward_to_spend := least(price, reward_available);
  paid_to_spend := price - reward_to_spend;
  remaining_to_spend := reward_to_spend;

  for reward_grant in
    select id, remaining from public.reward_coin_grants
    where user_id = current_user_id and remaining > 0
      and expires_at > timezone('utc', now())
    order by expires_at, created_at
    for update
  loop
    exit when remaining_to_spend = 0;
    grant_spend := least(reward_grant.remaining, remaining_to_spend);
    update public.reward_coin_grants
    set remaining = remaining - grant_spend where id = reward_grant.id;
    remaining_to_spend := remaining_to_spend - grant_spend;
  end loop;

  update public.wallets
  set reward_balance = reward_available - reward_to_spend,
      paid_balance = paid_balance - paid_to_spend,
      balance = (reward_available - reward_to_spend) + (paid_balance - paid_to_spend)
  where user_id = current_user_id
  returning balance into new_balance;

  insert into public.episode_unlocks (user_id, episode_id, coins_paid)
  values (current_user_id, p_episode_id, price);
  spent_type := case
    when reward_to_spend = price then 'reward'
    when paid_to_spend = price then 'paid'
    else 'mixed'
  end;
  insert into public.coin_transactions (user_id, amount, reason, reference_id, coin_type)
  values (current_user_id, -price, 'episode_unlock', p_episode_id::text, spent_type);
  return new_balance;
end;
$$;

create or replace function public.claim_daily_vip_reward()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  reward_amount integer := 10;
  new_grant_id uuid;
  was_claimed boolean := false;
  wallet_row public.wallets%rowtype;
begin
  if current_user_id is null then raise exception 'authentication_required'; end if;
  select * into wallet_row from public.wallets
  where user_id = current_user_id for update;
  if not public.has_active_vip(current_user_id) then raise exception 'vip_required'; end if;

  if not exists (
    select 1 from public.daily_vip_reward_claims
    where user_id = current_user_id
      and reward_date = (timezone('utc', now()))::date
  ) then
    insert into public.reward_coin_grants (
      user_id, amount, remaining, reason, reference_id, expires_at
    ) values (
      current_user_id, reward_amount, reward_amount, 'daily_vip',
      (timezone('utc', now()))::date::text,
      timezone('utc', now()) + interval '30 days'
    ) returning id into new_grant_id;

    insert into public.daily_vip_reward_claims (user_id, reward_date, amount, grant_id)
    values (current_user_id, (timezone('utc', now()))::date, reward_amount, new_grant_id);
    update public.wallets
    set reward_balance = reward_balance + reward_amount,
        balance = balance + reward_amount
    where user_id = current_user_id;
    insert into public.coin_transactions (user_id, amount, reason, reference_id, coin_type)
    values (current_user_id, reward_amount, 'reward', new_grant_id::text, 'reward');
    was_claimed := true;
  end if;

  perform public.refresh_reward_balance(current_user_id);
  select * into wallet_row from public.wallets where user_id = current_user_id;
  return jsonb_build_object(
    'claimed', was_claimed,
    'paidCoins', wallet_row.paid_balance,
    'rewardCoins', wallet_row.reward_balance,
    'coins', wallet_row.balance
  );
end;
$$;

create or replace function public.apply_verified_store_purchase(
  p_user_id uuid,
  p_provider text,
  p_product_id text,
  p_transaction_id text,
  p_original_transaction_id text,
  p_environment text,
  p_purchased_at timestamptz,
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  product public.store_products%rowtype;
  existing_user_id uuid;
  bonus_grant_id uuid;
  wallet_row public.wallets%rowtype;
begin
  if p_provider not in ('apple', 'google') then raise exception 'invalid_provider'; end if;
  select * into product from public.store_products
  where product_id = p_product_id and is_active;
  if not found then raise exception 'unknown_product'; end if;

  select user_id into existing_user_id from public.store_purchase_receipts
  where provider = p_provider and provider_transaction_id = p_transaction_id;
  if found then
    if existing_user_id <> p_user_id then raise exception 'transaction_owner_mismatch'; end if;
    perform public.refresh_reward_balance(p_user_id);
    select * into wallet_row from public.wallets where user_id = p_user_id;
    return jsonb_build_object(
      'applied', false,
      'kind', product.kind,
      'paidCoins', wallet_row.paid_balance,
      'rewardCoins', wallet_row.reward_balance,
      'coins', wallet_row.balance,
      'isVip', public.has_active_vip(p_user_id)
    );
  end if;

  insert into public.store_purchase_receipts (
    user_id, provider, product_id, provider_transaction_id,
    original_transaction_id, environment, purchased_at, expires_at
  ) values (
    p_user_id, p_provider, p_product_id, p_transaction_id,
    p_original_transaction_id, p_environment, p_purchased_at, p_expires_at
  );

  if product.kind = 'subscription' then
    if p_expires_at is null then raise exception 'subscription_expiry_required'; end if;
    insert into public.entitlements (
      user_id, provider, product_id, provider_transaction_id, status,
      starts_at, expires_at, raw_environment
    ) values (
      p_user_id, p_provider, p_product_id, p_transaction_id, 'active',
      p_purchased_at, p_expires_at, p_environment
    ) on conflict (provider_transaction_id) do update set
      status = 'active', expires_at = excluded.expires_at,
      raw_environment = excluded.raw_environment;
  else
    update public.wallets
    set paid_balance = paid_balance + product.paid_coins,
        reward_balance = reward_balance + product.bonus_coins,
        balance = balance + product.paid_coins + product.bonus_coins
    where user_id = p_user_id;
    insert into public.coin_transactions (user_id, amount, reason, reference_id, coin_type)
    values (p_user_id, product.paid_coins, 'purchase', p_transaction_id, 'paid');
    if product.bonus_coins > 0 then
      insert into public.reward_coin_grants (
        user_id, amount, remaining, reason, reference_id, expires_at
      ) values (
        p_user_id, product.bonus_coins, product.bonus_coins,
        'purchase_bonus', p_transaction_id, timezone('utc', now()) + interval '30 days'
      ) returning id into bonus_grant_id;
      insert into public.coin_transactions (user_id, amount, reason, reference_id, coin_type)
      values (p_user_id, product.bonus_coins, 'reward', p_transaction_id, 'reward');
    end if;
  end if;

  select * into wallet_row from public.wallets where user_id = p_user_id;
  return jsonb_build_object(
    'applied', true,
    'kind', product.kind,
    'paidCoins', wallet_row.paid_balance,
    'rewardCoins', wallet_row.reward_balance,
    'coins', wallet_row.balance,
    'isVip', public.has_active_vip(p_user_id)
  );
end;
$$;

revoke all on function public.refresh_reward_balance(uuid) from public, anon, authenticated;
grant execute on function public.refresh_reward_balance(uuid) to service_role;
revoke all on function public.apply_verified_store_purchase(uuid, text, text, text, text, text, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.apply_verified_store_purchase(uuid, text, text, text, text, text, timestamptz, timestamptz)
  to service_role;
revoke all on function public.claim_daily_vip_reward() from public, anon;
grant execute on function public.claim_daily_vip_reward() to authenticated;
revoke all on function public.unlock_episode(uuid) from public;
grant execute on function public.unlock_episode(uuid) to authenticated;
