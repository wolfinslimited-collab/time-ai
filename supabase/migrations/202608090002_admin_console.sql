-- Protected Timeless content administration.

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner', 'editor', 'support')),
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.admin_users enable row level security;

create or replace function public.is_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users a
    where a.user_id = p_user_id and a.role in ('owner', 'editor')
  );
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated;

create policy "Admins read their role" on public.admin_users for select
using (auth.uid() = user_id);

create policy "Admins manage series" on public.series for all
using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage genres" on public.genres for all
using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage series genres" on public.series_genres for all
using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage episodes" on public.episodes for all
using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage episode media" on public.episode_media for all
using (public.is_admin()) with check (public.is_admin());

create policy "Admins manage series posters" on storage.objects for all
using (bucket_id = 'series-posters' and public.is_admin())
with check (bucket_id = 'series-posters' and public.is_admin());
create policy "Admins manage episode video" on storage.objects for all
using (bucket_id = 'episode-video' and public.is_admin())
with check (bucket_id = 'episode-video' and public.is_admin());
create policy "Admins manage episode captions" on storage.objects for all
using (bucket_id = 'episode-captions' and public.is_admin())
with check (bucket_id = 'episode-captions' and public.is_admin());

-- Admin membership is intentionally service-role/dashboard managed. No client
-- insert/update/delete policy exists, so a signed-in user cannot promote itself.
