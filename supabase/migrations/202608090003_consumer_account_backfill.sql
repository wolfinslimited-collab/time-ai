-- Ensure accounts created by earlier versions of Timeless can use the new
-- short-series profile and wallet model without registering again.
insert into public.profiles (id, display_name)
select
  users.id,
  coalesce(
    users.raw_user_meta_data ->> 'full_name',
    users.raw_user_meta_data ->> 'name'
  )
from auth.users as users
on conflict (id) do nothing;

insert into public.wallets (user_id, balance)
select users.id, 0
from auth.users as users
on conflict (user_id) do nothing;
