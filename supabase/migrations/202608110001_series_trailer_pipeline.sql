-- Private, provider-neutral trailer media for published Timeless series.
-- Public catalog rows expose only the safe has_trailer flag.

alter table public.series
  add column if not exists has_trailer boolean not null default false;

create table public.series_trailer_media (
  series_id uuid primary key references public.series(id) on delete cascade,
  provider text not null default 'aws'
    check (provider in ('supabase', 'aws')),
  video_path text not null,
  source_asset_id text,
  playback_path text,
  captions jsonb not null default '[]'::jsonb,
  transcode_status text not null default 'pending'
    check (transcode_status in ('pending', 'processing', 'ready', 'failed')),
  transcode_job_id text,
  source_etag text,
  last_error text,
  updated_at timestamptz not null default timezone('utc', now())
);

create index series_trailer_media_status_idx
  on public.series_trailer_media(provider, transcode_status);

create trigger series_trailer_media_set_updated_at
before update on public.series_trailer_media
for each row execute function public.set_updated_at();

alter table public.series_trailer_media enable row level security;

create policy "Admins manage series trailer media"
on public.series_trailer_media for all
using (public.is_admin()) with check (public.is_admin());

comment on column public.series.has_trailer is
  'Safe public discovery flag. True only after the private trailer transcode is ready.';

comment on table public.series_trailer_media is
  'Private source and playback state for adaptive series trailers.';
