-- Admin-only Studio web purchase history, including the authenticated email
-- for both historical and future Stripe Checkout sessions.

create or replace function public.admin_list_studio_checkouts(
  p_limit integer default 100
)
returns table (
  checkout_id uuid,
  user_id uuid,
  customer_email text,
  pack_key text,
  pack_name text,
  stripe_session_id text,
  stripe_customer_id text,
  payment_intent_id text,
  credits integer,
  amount_total integer,
  currency text,
  status text,
  created_at timestamptz,
  completed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  return query
  select
    checkout.id,
    checkout.user_id,
    users.email::text,
    checkout.pack_key,
    coalesce(pack.name, checkout.pack_key),
    checkout.stripe_session_id,
    checkout.stripe_customer_id,
    checkout.payment_intent_id,
    checkout.credits,
    checkout.amount_total,
    checkout.currency,
    checkout.status,
    checkout.created_at,
    checkout.completed_at
  from public.studio_stripe_checkouts as checkout
  join auth.users as users on users.id = checkout.user_id
  left join public.studio_credit_packs as pack on pack.key = checkout.pack_key
  order by checkout.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;

revoke all on function public.admin_list_studio_checkouts(integer)
  from public, anon;
grant execute on function public.admin_list_studio_checkouts(integer)
  to authenticated;

comment on function public.admin_list_studio_checkouts(integer) is
  'Returns recent Studio Stripe credit purchases to authenticated Timeless admins.';
