-- Support is independent of paid creative chat. Clients can only read their own
-- conversations; all customer writes go through the authenticated edge function.
create table public.studio_support_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  transcript jsonb not null default '[]',
  ticket_number bigint generated always as identity unique,
  status text not null default 'chat' check (status in ('chat', 'open', 'resolved')),
  staff_reply text,
  request_count integer not null default 0,
  window_started_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index studio_support_one_conversation_per_user
  on public.studio_support_conversations(user_id);
alter table public.studio_support_conversations enable row level security;
revoke all on public.studio_support_conversations from anon, authenticated;
grant select on public.studio_support_conversations to authenticated;
grant update(status, staff_reply, updated_at) on public.studio_support_conversations to authenticated;
grant all on public.studio_support_conversations to service_role;
grant usage, select on sequence public.studio_support_conversations_ticket_number_seq to service_role;
create policy support_read on public.studio_support_conversations for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy support_staff_update on public.studio_support_conversations for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- A row lock makes the per-account rate limit atomic across tabs/requests.
create function public.studio_support_reserve(p_user_id uuid, p_email text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.studio_support_conversations;
begin
  insert into studio_support_conversations(user_id, email) values(p_user_id, p_email)
    on conflict(user_id) do nothing;
  select * into c from studio_support_conversations where user_id = p_user_id for update;
  if c.window_started_at < now() - interval '1 hour' then
    c.request_count := 0;
    c.window_started_at := now();
  end if;
  if c.request_count >= 30 then raise exception 'support_rate_limited'; end if;
  update studio_support_conversations set request_count = c.request_count + 1,
    window_started_at = c.window_started_at, email = p_email
    where id = c.id returning * into c;
  return to_jsonb(c);
end;
$$;
revoke all on function public.studio_support_reserve(uuid, text) from public, anon, authenticated;
grant execute on function public.studio_support_reserve(uuid, text) to service_role;

-- Append atomically so simultaneous messages cannot overwrite one another.
create function public.studio_support_append(p_id uuid, p_messages jsonb, p_escalate boolean)
returns jsonb
language sql security definer set search_path = public as $$
  with updated as (
  update studio_support_conversations set
    transcript = transcript || p_messages,
    status = case when p_escalate then 'open' else status end,
    updated_at = now()
  where id = p_id returning *
  ) select to_jsonb(updated) from updated;
$$;
revoke all on function public.studio_support_append(uuid, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.studio_support_append(uuid, jsonb, boolean) to service_role;
