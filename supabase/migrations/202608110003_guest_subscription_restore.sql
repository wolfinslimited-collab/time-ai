-- Allow a verified App Store or Google Play subscription to move from an
-- anonymous guest identity after reinstall/restore. The store transaction is
-- reverified before this function is called, so the receipt remains the proof
-- of ownership and no email account is required.

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
  existing_receipt boolean := false;
  wallet_row public.wallets%rowtype;
  transferred boolean := false;
begin
  if p_provider not in ('apple', 'google') then raise exception 'invalid_provider'; end if;
  select * into product from public.store_products
  where product_id = p_product_id and is_active;
  if not found then raise exception 'unknown_product'; end if;

  select user_id into existing_user_id
  from public.store_purchase_receipts
  where provider = p_provider
    and (
      provider_transaction_id = p_transaction_id
      or (
        p_original_transaction_id is not null
        and coalesce(original_transaction_id, provider_transaction_id) =
          p_original_transaction_id
      )
    )
  order by (provider_transaction_id = p_transaction_id) desc
  limit 1
  for update;
  existing_receipt := found;

  if existing_receipt and product.kind <> 'subscription' then
    if existing_user_id <> p_user_id then
      raise exception 'transaction_owner_mismatch';
    end if;
    perform public.refresh_reward_balance(p_user_id);
    select * into wallet_row from public.wallets where user_id = p_user_id;
    return jsonb_build_object(
      'applied', false,
      'transferred', false,
      'kind', product.kind,
      'paidCoins', wallet_row.paid_balance,
      'rewardCoins', wallet_row.reward_balance,
      'coins', wallet_row.balance,
      'isVip', public.has_active_vip(p_user_id)
    );
  end if;

  if existing_receipt and existing_user_id <> p_user_id then
    update public.store_purchase_receipts
    set user_id = p_user_id
    where provider = p_provider
      and (
        provider_transaction_id = p_transaction_id
        or (
          p_original_transaction_id is not null
          and coalesce(original_transaction_id, provider_transaction_id) =
            p_original_transaction_id
        )
      );
    update public.entitlements
    set user_id = p_user_id
    where provider = p_provider
      and (
        provider_transaction_id = p_transaction_id
        or (
          p_original_transaction_id is not null
          and original_transaction_id = p_original_transaction_id
        )
      );
    transferred := true;
  end if;

  if existing_receipt then
    update public.store_purchase_receipts
    set user_id = p_user_id,
        product_id = p_product_id,
        original_transaction_id = p_original_transaction_id,
        environment = p_environment,
        purchased_at = p_purchased_at,
        expires_at = p_expires_at,
        status = 'verified'
    where provider = p_provider and provider_transaction_id = p_transaction_id;

    if not found then
      insert into public.store_purchase_receipts (
        user_id, provider, product_id, provider_transaction_id,
        original_transaction_id, environment, purchased_at, expires_at
      ) values (
        p_user_id, p_provider, p_product_id, p_transaction_id,
        p_original_transaction_id, p_environment, p_purchased_at, p_expires_at
      );
    end if;

    if p_expires_at is null then raise exception 'subscription_expiry_required'; end if;
    insert into public.entitlements (
      user_id, provider, product_id, provider_transaction_id,
      original_transaction_id, status, starts_at, expires_at, raw_environment
    ) values (
      p_user_id, p_provider, p_product_id, p_transaction_id,
      p_original_transaction_id, 'active', p_purchased_at, p_expires_at,
      p_environment
    ) on conflict (provider_transaction_id) do update set
      user_id = excluded.user_id,
      product_id = excluded.product_id,
      original_transaction_id = excluded.original_transaction_id,
      status = 'active',
      expires_at = excluded.expires_at,
      raw_environment = excluded.raw_environment;

    perform public.refresh_reward_balance(p_user_id);
    select * into wallet_row from public.wallets where user_id = p_user_id;
    return jsonb_build_object(
      'applied', transferred,
      'transferred', transferred,
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
      user_id, provider, product_id, provider_transaction_id,
      original_transaction_id, status, starts_at, expires_at, raw_environment
    ) values (
      p_user_id, p_provider, p_product_id, p_transaction_id,
      p_original_transaction_id, 'active', p_purchased_at, p_expires_at,
      p_environment
    ) on conflict (provider_transaction_id) do update set
      user_id = excluded.user_id,
      product_id = excluded.product_id,
      original_transaction_id = excluded.original_transaction_id,
      status = 'active',
      expires_at = excluded.expires_at,
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
      );
      insert into public.coin_transactions (user_id, amount, reason, reference_id, coin_type)
      values (p_user_id, product.bonus_coins, 'reward', p_transaction_id, 'reward');
    end if;
  end if;

  select * into wallet_row from public.wallets where user_id = p_user_id;
  return jsonb_build_object(
    'applied', true,
    'transferred', false,
    'kind', product.kind,
    'paidCoins', wallet_row.paid_balance,
    'rewardCoins', wallet_row.reward_balance,
    'coins', wallet_row.balance,
    'isVip', public.has_active_vip(p_user_id)
  );
end;
$$;

revoke all on function public.apply_verified_store_purchase(
  uuid, text, text, text, text, text, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function public.apply_verified_store_purchase(
  uuid, text, text, text, text, text, timestamptz, timestamptz
) to service_role;
