-- Seven-day lifecycle for private Timeless Studio media.
-- Metadata is retained for history and billing after the underlying object is
-- removed. Users may explicitly retain completed generated outputs.

alter table public.studio_assets
  add column if not exists expires_at timestamptz,
  add column if not exists retained_at timestamptz,
  add column if not exists deleted_at timestamptz;

alter table public.studio_assets
  drop constraint if exists studio_assets_retained_output_check;
alter table public.studio_assets
  add constraint studio_assets_retained_output_check
  check (retained_at is null or role = 'output');

create index if not exists studio_assets_expiry_idx
  on public.studio_assets(expires_at, id)
  where expires_at is not null
    and retained_at is null
    and status <> 'deleted';

create or replace function public.set_studio_asset_retention()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'deleted' then
    new.deleted_at := coalesce(new.deleted_at, timezone('utc', now()));
    new.expires_at := null;
    return new;
  end if;

  if new.retained_at is not null then
    new.expires_at := null;
    return new;
  end if;

  if new.status = 'failed' then
    new.expires_at := coalesce(
      new.expires_at,
      timezone('utc', now()) + interval '1 day'
    );
    return new;
  end if;

  if new.role = 'input' and new.status = 'pending_upload' then
    new.expires_at := coalesce(
      new.expires_at,
      timezone('utc', now()) + interval '1 day'
    );
  elsif new.status = 'ready' and new.expires_at is null
    and (tg_op = 'INSERT' or old.status is distinct from 'ready') then
    new.expires_at := timezone('utc', now()) + interval '7 days';
  end if;

  return new;
end;
$$;

drop trigger if exists studio_assets_set_retention on public.studio_assets;
create trigger studio_assets_set_retention
before insert or update of status, retained_at, deleted_at
on public.studio_assets
for each row execute function public.set_studio_asset_retention();

-- Backfill existing files from their actual completion/upload time. Older
-- objects are eligible for deletion on the first cleanup run.
update public.studio_assets a
set expires_at = case
  when a.status = 'pending_upload' then a.created_at + interval '1 day'
  when a.status = 'failed' then a.updated_at + interval '1 day'
  when a.role = 'output' then
    coalesce(g.completed_at, a.updated_at, a.created_at) + interval '7 days'
  else a.updated_at + interval '7 days'
end
from public.studio_generations g
where a.generation_id = g.id
  and a.status <> 'deleted'
  and a.retained_at is null
  and a.expires_at is null;

update public.studio_assets a
set expires_at = case
  when a.status = 'pending_upload' then a.created_at + interval '1 day'
  when a.status = 'failed' then a.updated_at + interval '1 day'
  else a.updated_at + interval '7 days'
end
where a.generation_id is null
  and a.status <> 'deleted'
  and a.retained_at is null
  and a.expires_at is null;

revoke all on function public.set_studio_asset_retention() from public;
grant execute on function public.set_studio_asset_retention() to service_role;

comment on column public.studio_assets.expires_at is
  'The private Storage object becomes unavailable at this time and is removed by studio-cleanup.';
comment on column public.studio_assets.retained_at is
  'Set when the owner explicitly keeps a generated output; retained assets do not expire.';
comment on column public.studio_assets.deleted_at is
  'When the Storage object was removed while its metadata was retained.';

-- Audio output support is intentionally prepared here for when Sound models
-- are re-enabled. This does not reactivate any paused audio model.
update storage.buckets
set allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'audio/mpeg'
]
where id = 'studio-outputs';

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
begin
  perform cron.unschedule('studio-cleanup-expired-assets');
exception
  when others then null;
end;
$$;

-- The hourly cadence keeps large cleanup queues moving while expiry remains
-- seven days. Configure studio_cleanup_secret in Vault before this runs.
select cron.schedule(
  'studio-cleanup-expired-assets',
  '17 * * * *',
  $schedule$
  select net.http_post(
    url := 'https://xmxsqmxuiksldqhtugvv.supabase.co/functions/v1/studio-cleanup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-studio-cleanup-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'studio_cleanup_secret'
        limit 1
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $schedule$
);
