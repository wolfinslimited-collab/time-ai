-- Store only short-lived, hashed request counters, never guest conversations/IPs.
create table public.studio_support_guest_limits (
  bucket text primary key,
  request_count integer not null,
  window_started_at timestamptz not null default now()
);
alter table public.studio_support_guest_limits enable row level security;
revoke all on public.studio_support_guest_limits from public, anon, authenticated;
grant all on public.studio_support_guest_limits to service_role;
create function public.studio_support_guest_reserve(p_fingerprint text)
returns void language plpgsql security definer set search_path = public as $$
declare counter integer;
begin
  -- A global ceiling also bounds requests from clients that rotate addresses.
  insert into studio_support_guest_limits(bucket,request_count) values ('global',1)
  on conflict(bucket) do update set
    request_count = case when studio_support_guest_limits.window_started_at < now()-interval '1 hour' then 1 else studio_support_guest_limits.request_count+1 end,
    window_started_at = case when studio_support_guest_limits.window_started_at < now()-interval '1 hour' then now() else studio_support_guest_limits.window_started_at end
  returning request_count into counter;
  if counter > 300 then raise exception 'support_rate_limited'; end if;
  insert into studio_support_guest_limits(bucket,request_count) values ('ip:'||p_fingerprint,1)
  on conflict(bucket) do update set
    request_count = case when studio_support_guest_limits.window_started_at < now()-interval '1 hour' then 1 else studio_support_guest_limits.request_count+1 end,
    window_started_at = case when studio_support_guest_limits.window_started_at < now()-interval '1 hour' then now() else studio_support_guest_limits.window_started_at end
  returning request_count into counter;
  if counter > 20 then raise exception 'support_rate_limited'; end if;
  delete from studio_support_guest_limits where window_started_at < now()-interval '2 hours';
end;
$$;
revoke all on function public.studio_support_guest_reserve(text) from public, anon, authenticated;
grant execute on function public.studio_support_guest_reserve(text) to service_role;
