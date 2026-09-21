-- Provider-neutral video state for the Timeless adaptive AWS pipeline.
-- Existing Supabase-hosted media remains valid and is marked ready.

alter table public.episode_media
  add column if not exists provider text not null default 'supabase',
  add column if not exists source_asset_id text,
  add column if not exists playback_path text,
  add column if not exists transcode_status text not null default 'ready',
  add column if not exists transcode_job_id text,
  add column if not exists source_etag text,
  add column if not exists last_error text;

alter table public.episode_media
  drop constraint if exists episode_media_provider_check;

alter table public.episode_media
  add constraint episode_media_provider_check
  check (provider in ('supabase', 'aws'));

alter table public.episode_media
  drop constraint if exists episode_media_transcode_status_check;

alter table public.episode_media
  add constraint episode_media_transcode_status_check
  check (transcode_status in ('pending', 'processing', 'ready', 'failed'));

create index if not exists episode_media_provider_status_idx
  on public.episode_media(provider, transcode_status);

comment on column public.episode_media.video_path is
  'Supabase object path or AWS original-object key, depending on provider.';

comment on column public.episode_media.playback_path is
  'Provider-relative playback manifest path. AWS values point to the private CloudFront HLS master manifest.';
