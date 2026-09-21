-- Final Timeless VIP catalog. Storefront prices are supplied by Apple/Google.

insert into public.store_products (
  product_id, kind, title, billing_period, paid_coins, bonus_coins,
  daily_reward_coins, is_featured, badge, sort_order, is_active
) values
  (
    'com.timeless.premium.weekly', 'subscription', 'Weekly VIP', 'week',
    0, 0, 0, false, 'FLEXIBLE', 30, true
  )
on conflict (product_id) do update set
  kind = 'subscription',
  title = excluded.title,
  billing_period = excluded.billing_period,
  paid_coins = 0,
  bonus_coins = 0,
  daily_reward_coins = 0,
  is_featured = excluded.is_featured,
  badge = excluded.badge,
  sort_order = excluded.sort_order,
  is_active = true;

update public.store_products
set
  title = case product_id
    when 'com.timeless.premium.yearly' then 'Yearly VIP'
    when 'com.timeless.premium.monthly' then 'Monthly VIP'
    when 'com.timeless.premium.weekly' then 'Weekly VIP'
  end,
  billing_period = case product_id
    when 'com.timeless.premium.yearly' then 'year'
    when 'com.timeless.premium.monthly' then 'month'
    when 'com.timeless.premium.weekly' then 'week'
  end,
  badge = case product_id
    when 'com.timeless.premium.yearly' then 'BEST VALUE'
    when 'com.timeless.premium.monthly' then 'POPULAR'
    when 'com.timeless.premium.weekly' then 'FLEXIBLE'
  end,
  sort_order = case product_id
    when 'com.timeless.premium.yearly' then 10
    when 'com.timeless.premium.monthly' then 20
    when 'com.timeless.premium.weekly' then 30
  end,
  is_featured = product_id = 'com.timeless.premium.yearly',
  is_active = true
where product_id in (
  'com.timeless.premium.yearly',
  'com.timeless.premium.monthly',
  'com.timeless.premium.weekly'
);

update public.store_products
set is_active = false
where product_id in (
  'com.timeless.premium.yearly.plus',
  'com.timeless.premium.monthly.plus',
  'com.timeless.premium.weekly.plus'
);
