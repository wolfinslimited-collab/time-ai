-- Reuse the already-approved App Store products from the previous Timeless app.
-- The same identifiers should be used for Google Play when an active developer
-- account is available.

update public.store_products
set is_active = false
where product_id in (
  'timeless.vip.monthly',
  'timeless.vip.yearly'
);

insert into public.store_products (
  product_id, kind, title, billing_period, paid_coins, bonus_coins,
  daily_reward_coins, is_featured, badge, sort_order, is_active
) values
  (
    'com.timeless.premium.monthly', 'subscription', 'Monthly VIP', 'month',
    0, 0, 0, false, 'POPULAR', 10, true
  ),
  (
    'com.timeless.premium.yearly', 'subscription', 'Yearly VIP', 'year',
    0, 0, 0, true, 'BEST VALUE', 20, true
  )
on conflict (product_id) do update set
  title = excluded.title,
  billing_period = excluded.billing_period,
  paid_coins = 0,
  bonus_coins = 0,
  daily_reward_coins = 0,
  is_featured = excluded.is_featured,
  badge = excluded.badge,
  sort_order = excluded.sort_order,
  is_active = true;
