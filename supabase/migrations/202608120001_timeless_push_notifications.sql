-- User-facing push notifications for Timeless mobile apps.

create table if not exists public.timeless_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  locale text,
  enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now())
);

create index if not exists timeless_push_tokens_user_idx
  on public.timeless_push_tokens(user_id) where enabled;

create table if not exists public.timeless_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  new_episodes boolean not null default true,
  saved_series_updates boolean not null default true,
  continue_watching boolean not null default true,
  subscription_updates boolean not null default true,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.timeless_push_delivery_events (
  id uuid primary key default gen_random_uuid(),
  notification_type text not null,
  title text not null,
  body text not null,
  series_id uuid references public.series(id) on delete set null,
  episode_number integer,
  target_user_id uuid references auth.users(id) on delete set null,
  target_platform text,
  attempted integer not null default 0,
  delivered integer not null default 0,
  failed integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.timeless_push_tokens enable row level security;
alter table public.timeless_notification_preferences enable row level security;
alter table public.timeless_push_delivery_events enable row level security;

drop policy if exists "Users read own Timeless push tokens"
  on public.timeless_push_tokens;
create policy "Users read own Timeless push tokens"
  on public.timeless_push_tokens for select
  using (auth.uid() = user_id);

drop policy if exists "Users delete own Timeless push tokens"
  on public.timeless_push_tokens;
create policy "Users delete own Timeless push tokens"
  on public.timeless_push_tokens for delete
  using (auth.uid() = user_id);

drop policy if exists "Users read own Timeless notification preferences"
  on public.timeless_notification_preferences;
create policy "Users read own Timeless notification preferences"
  on public.timeless_notification_preferences for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own Timeless notification preferences"
  on public.timeless_notification_preferences;
create policy "Users insert own Timeless notification preferences"
  on public.timeless_notification_preferences for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own Timeless notification preferences"
  on public.timeless_notification_preferences;
create policy "Users update own Timeless notification preferences"
  on public.timeless_notification_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Admins read Timeless push delivery events"
  on public.timeless_push_delivery_events;
create policy "Admins read Timeless push delivery events"
  on public.timeless_push_delivery_events for select
  using (public.is_admin());

create or replace function public.register_timeless_push_token(
  p_token text,
  p_platform text,
  p_locale text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'authentication_required';
  end if;
  if nullif(trim(p_token), '') is null then
    raise exception 'token_required';
  end if;
  if p_platform not in ('ios', 'android') then
    raise exception 'invalid_platform';
  end if;

  insert into public.timeless_push_tokens (
    user_id, token, platform, locale, enabled, last_seen_at
  ) values (
    current_user_id, trim(p_token), p_platform, nullif(trim(p_locale), ''),
    true, timezone('utc', now())
  )
  on conflict (token) do update set
    user_id = excluded.user_id,
    platform = excluded.platform,
    locale = excluded.locale,
    enabled = true,
    last_seen_at = timezone('utc', now()),
    updated_at = timezone('utc', now());

  insert into public.timeless_notification_preferences (user_id)
  values (current_user_id)
  on conflict (user_id) do nothing;
end;
$$;

revoke all on function public.register_timeless_push_token(text, text, text)
  from public;
grant execute on function public.register_timeless_push_token(text, text, text)
  to authenticated;

create or replace function public.disable_timeless_push_token(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.timeless_push_tokens
  set enabled = false, updated_at = timezone('utc', now())
  where user_id = auth.uid() and token = p_token;
$$;

revoke all on function public.disable_timeless_push_token(text) from public;
grant execute on function public.disable_timeless_push_token(text)
  to authenticated;

grant all on table public.timeless_push_tokens to service_role;
grant all on table public.timeless_notification_preferences to service_role;
grant all on table public.timeless_push_delivery_events to service_role;
