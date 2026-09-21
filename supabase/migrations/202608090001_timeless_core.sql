-- Timeless 3.0 core backend.
-- Apply with `supabase db push` after linking the production project.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  preferred_language text not null default 'en',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.series (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  short_title text not null,
  tagline text not null default '',
  description text not null default '',
  poster_path text,
  trailer_path text,
  accent_hex text not null default '#9F203E',
  secondary_accent_hex text not null default '#E4A86C',
  rating numeric(3, 1) not null default 0 check (rating between 0 and 10),
  view_count bigint not null default 0 check (view_count >= 0),
  is_original boolean not null default false,
  is_featured boolean not null default false,
  is_new boolean not null default false,
  sort_order integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.genres (
  slug text primary key,
  label text not null unique,
  sort_order integer not null default 0
);

create table public.series_genres (
  series_id uuid not null references public.series(id) on delete cascade,
  genre_slug text not null references public.genres(slug) on delete cascade,
  primary key (series_id, genre_slug)
);

create table public.episodes (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.series(id) on delete cascade,
  episode_number integer not null check (episode_number > 0),
  title text not null,
  synopsis text not null default '',
  duration_seconds integer not null check (duration_seconds > 0),
  thumbnail_path text,
  is_free boolean not null default false,
  coin_price integer not null default 10 check (coin_price >= 0),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published', 'archived')),
  release_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (series_id, episode_number),
  check (is_free or coin_price > 0)
);

-- Media paths are deliberately isolated from public episode metadata. A trusted
-- Edge Function verifies access and returns a short-lived signed playback URL.
create table public.episode_media (
  episode_id uuid primary key references public.episodes(id) on delete cascade,
  video_path text not null,
  captions jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.saved_series (
  user_id uuid not null references auth.users(id) on delete cascade,
  series_id uuid not null references public.series(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, series_id)
);

create table public.viewing_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  series_id uuid not null references public.series(id) on delete cascade,
  episode_id uuid not null references public.episodes(id) on delete cascade,
  position_seconds integer not null default 0 check (position_seconds >= 0),
  completed boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, series_id)
);

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('apple', 'google', 'manual')),
  product_id text not null,
  provider_transaction_id text not null unique,
  status text not null check (status in ('active', 'grace_period', 'expired', 'revoked', 'refunded')),
  starts_at timestamptz not null,
  expires_at timestamptz,
  raw_environment text check (raw_environment in ('sandbox', 'production')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.coin_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount <> 0),
  reason text not null check (reason in ('purchase', 'episode_unlock', 'reward', 'refund', 'admin')),
  reference_id text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.episode_unlocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  episode_id uuid not null references public.episodes(id) on delete cascade,
  coins_paid integer not null check (coins_paid >= 0),
  unlocked_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, episode_id)
);

create index series_status_sort_idx on public.series(status, sort_order);
create index episodes_series_number_idx on public.episodes(series_id, episode_number);
create index entitlements_user_status_idx on public.entitlements(user_id, status, expires_at);
create index coin_transactions_user_created_idx on public.coin_transactions(user_id, created_at desc);

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger series_set_updated_at before update on public.series
for each row execute function public.set_updated_at();
create trigger episodes_set_updated_at before update on public.episodes
for each row execute function public.set_updated_at();
create trigger entitlements_set_updated_at before update on public.entitlements
for each row execute function public.set_updated_at();
create trigger wallets_set_updated_at before update on public.wallets
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'));
  insert into public.wallets (user_id, balance) values (new.id, 0);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.has_active_vip(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.entitlements e
    where e.user_id = p_user_id
      and e.status in ('active', 'grace_period')
      and (e.expires_at is null or e.expires_at > timezone('utc', now()))
  );
$$;

create or replace function public.can_watch_episode(p_episode_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.episodes e
    where e.id = p_episode_id
      and e.status = 'published'
      and (
        e.is_free
        or public.has_active_vip(auth.uid())
        or exists (
          select 1 from public.episode_unlocks u
          where u.user_id = auth.uid() and u.episode_id = e.id
        )
      )
  );
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
  new_balance integer;
begin
  if current_user_id is null then
    raise exception 'authentication_required';
  end if;

  select e.coin_price, e.is_free into price, free_episode
  from public.episodes e
  where e.id = p_episode_id and e.status = 'published';

  if not found then raise exception 'episode_not_found'; end if;

  select w.balance into new_balance from public.wallets w
  where w.user_id = current_user_id;

  if free_episode or public.has_active_vip(current_user_id) or exists (
    select 1 from public.episode_unlocks u
    where u.user_id = current_user_id and u.episode_id = p_episode_id
  ) then
    return coalesce(new_balance, 0);
  end if;

  update public.wallets
  set balance = balance - price
  where user_id = current_user_id and balance >= price
  returning balance into new_balance;

  if not found then raise exception 'insufficient_coins'; end if;

  insert into public.episode_unlocks (user_id, episode_id, coins_paid)
  values (current_user_id, p_episode_id, price);
  insert into public.coin_transactions (user_id, amount, reason, reference_id)
  values (current_user_id, -price, 'episode_unlock', p_episode_id::text);

  return new_balance;
end;
$$;

alter table public.profiles enable row level security;
alter table public.series enable row level security;
alter table public.genres enable row level security;
alter table public.series_genres enable row level security;
alter table public.episodes enable row level security;
alter table public.episode_media enable row level security;
alter table public.saved_series enable row level security;
alter table public.viewing_progress enable row level security;
alter table public.entitlements enable row level security;
alter table public.wallets enable row level security;
alter table public.coin_transactions enable row level security;
alter table public.episode_unlocks enable row level security;

create policy "Published series are readable" on public.series for select
using (status = 'published' and (published_at is null or published_at <= timezone('utc', now())));
create policy "Genres are readable" on public.genres for select using (true);
create policy "Published series genres are readable" on public.series_genres for select
using (exists (select 1 from public.series s where s.id = series_id and s.status = 'published'));
create policy "Published episode metadata is readable" on public.episodes for select
using (status = 'published' and (release_at is null or release_at <= timezone('utc', now())));

create policy "Users read their profile" on public.profiles for select using (auth.uid() = id);
create policy "Users update their profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "Users manage saved series" on public.saved_series for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage viewing progress" on public.viewing_progress for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users read their entitlements" on public.entitlements for select using (auth.uid() = user_id);
create policy "Users read their wallet" on public.wallets for select using (auth.uid() = user_id);
create policy "Users read their coin history" on public.coin_transactions for select using (auth.uid() = user_id);
create policy "Users read their episode unlocks" on public.episode_unlocks for select using (auth.uid() = user_id);

revoke all on function public.unlock_episode(uuid) from public;
grant execute on function public.unlock_episode(uuid) to authenticated;
revoke all on function public.can_watch_episode(uuid) from public;
grant execute on function public.can_watch_episode(uuid) to authenticated;

insert into public.genres (slug, label, sort_order) values
  ('romance', 'Romance', 10),
  ('revenge', 'Revenge', 20),
  ('mystery', 'Mystery', 30),
  ('royalty', 'Royalty', 40),
  ('fantasy', 'Fantasy', 50)
on conflict (slug) do update set label = excluded.label, sort_order = excluded.sort_order;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('series-posters', 'series-posters', true, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('episode-video', 'episode-video', false, 2147483648, array['video/mp4', 'application/vnd.apple.mpegurl', 'video/MP2T']),
  ('episode-captions', 'episode-captions', false, 5242880, array['text/vtt', 'application/x-subrip'])
on conflict (id) do nothing;

create policy "Public poster reads" on storage.objects for select
using (bucket_id = 'series-posters');

-- No client write policy is created for catalog or media. Uploads and purchase
-- validation must run through the Supabase dashboard or trusted server functions.
