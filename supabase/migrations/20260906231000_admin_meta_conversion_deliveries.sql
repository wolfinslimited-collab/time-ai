create or replace function public.admin_list_meta_conversion_deliveries(
  p_limit integer default 100
)
returns table (
  event_name text,
  source text,
  status text,
  attempts integer,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  return query
  select
    delivery.event_name,
    delivery.source,
    delivery.status,
    delivery.attempts,
    delivery.last_attempt_at,
    delivery.next_attempt_at,
    delivery.created_at
  from public.meta_conversion_deliveries as delivery
  order by delivery.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

revoke all on function public.admin_list_meta_conversion_deliveries(integer)
  from public, anon;
grant execute on function public.admin_list_meta_conversion_deliveries(integer)
  to authenticated;
