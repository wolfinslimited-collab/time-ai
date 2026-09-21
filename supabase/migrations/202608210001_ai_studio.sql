-- Timeless AI Studio backend.
-- Adds isolated projects, generation jobs, assets, model pricing and credits.

create table if not exists public.studio_models (
  key text primary key check (key ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  name text not null,
  provider text not null,
  provider_model_id text not null,
  media_type text not null check (media_type in ('image', 'video')),
  credit_cost integer not null check (credit_cost > 0),
  parameter_schema jsonb not null default '{}'::jsonb,
  is_active boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.studio_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, user_id)
);

create table if not exists public.studio_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null,
  model_key text not null references public.studio_models(key),
  media_type text not null check (media_type in ('image', 'video')),
  status text not null default 'created'
    check (status in ('created', 'queued', 'processing', 'succeeded', 'failed', 'canceled')),
  prompt text not null check (char_length(prompt) between 1 and 10000),
  negative_prompt text,
  parameters jsonb not null default '{}'::jsonb,
  progress smallint not null default 0 check (progress between 0 and 100),
  credits_charged integer not null check (credits_charged > 0),
  provider text not null,
  provider_job_id text,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 128),
  error_code text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, idempotency_key),
  unique (provider, provider_job_id),
  unique (id, user_id, project_id),
  constraint studio_generations_project_owner_fk
    foreign key (project_id, user_id)
    references public.studio_projects(id, user_id) on delete cascade
);

create table if not exists public.studio_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null,
  generation_id uuid,
  role text not null check (role in ('input', 'output', 'thumbnail')),
  bucket_id text not null check (bucket_id in ('studio-inputs', 'studio-outputs', 'studio-thumbnails')),
  object_path text not null,
  original_filename text,
  mime_type text not null,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  duration_seconds numeric(10, 3) check (duration_seconds is null or duration_seconds >= 0),
  status text not null default 'pending_upload'
    check (status in ('pending_upload', 'ready', 'failed', 'deleted')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (bucket_id, object_path),
  constraint studio_assets_project_owner_fk
    foreign key (project_id, user_id)
    references public.studio_projects(id, user_id) on delete cascade,
  constraint studio_assets_generation_owner_fk
    foreign key (generation_id, user_id, project_id)
    references public.studio_generations(id, user_id, project_id) on delete cascade
);

create table if not exists public.studio_generation_inputs (
  generation_id uuid not null references public.studio_generations(id) on delete cascade,
  asset_id uuid not null references public.studio_assets(id) on delete restrict,
  sort_order integer not null default 0,
  primary key (generation_id, asset_id)
);

create or replace function public.validate_studio_generation_input()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.studio_generations g
    join public.studio_assets a
      on a.id = new.asset_id
     and a.user_id = g.user_id
     and a.project_id = g.project_id
     and a.role = 'input'
    where g.id = new.generation_id
  ) then
    raise exception 'studio_generation_input_mismatch';
  end if;
  return new;
end;
$$;

drop trigger if exists studio_generation_inputs_validate on public.studio_generation_inputs;
create trigger studio_generation_inputs_validate
before insert or update on public.studio_generation_inputs
for each row execute function public.validate_studio_generation_input();

create table if not exists public.studio_credit_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.studio_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  generation_id uuid references public.studio_generations(id) on delete set null,
  amount integer not null check (amount <> 0),
  entry_type text not null check (entry_type in ('purchase', 'grant', 'generation', 'refund', 'adjustment')),
  reference_id text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (generation_id, entry_type)
);

create index if not exists studio_projects_user_created_idx
  on public.studio_projects(user_id, created_at desc);
create index if not exists studio_generations_project_created_idx
  on public.studio_generations(project_id, created_at desc);
create index if not exists studio_generations_user_status_idx
  on public.studio_generations(user_id, status, created_at desc);
create index if not exists studio_assets_project_created_idx
  on public.studio_assets(project_id, created_at desc);
create index if not exists studio_assets_generation_idx
  on public.studio_assets(generation_id);
create index if not exists studio_credit_ledger_user_created_idx
  on public.studio_credit_ledger(user_id, created_at desc);
create unique index if not exists studio_credit_ledger_external_reference_idx
  on public.studio_credit_ledger(entry_type, reference_id)
  where reference_id is not null and entry_type in ('purchase', 'grant');

drop trigger if exists studio_models_set_updated_at on public.studio_models;
create trigger studio_models_set_updated_at before update on public.studio_models
for each row execute function public.set_updated_at();
drop trigger if exists studio_projects_set_updated_at on public.studio_projects;
create trigger studio_projects_set_updated_at before update on public.studio_projects
for each row execute function public.set_updated_at();
drop trigger if exists studio_generations_set_updated_at on public.studio_generations;
create trigger studio_generations_set_updated_at before update on public.studio_generations
for each row execute function public.set_updated_at();
drop trigger if exists studio_assets_set_updated_at on public.studio_assets;
create trigger studio_assets_set_updated_at before update on public.studio_assets
for each row execute function public.set_updated_at();
drop trigger if exists studio_credit_wallets_set_updated_at on public.studio_credit_wallets;
create trigger studio_credit_wallets_set_updated_at before update on public.studio_credit_wallets
for each row execute function public.set_updated_at();

create or replace function public.create_studio_wallet()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.studio_credit_wallets (user_id, balance)
  values (new.id, 0)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_studio_wallet on auth.users;
create trigger on_auth_user_created_studio_wallet
after insert on auth.users
for each row execute function public.create_studio_wallet();

insert into public.studio_credit_wallets (user_id, balance)
select id, 0 from auth.users
on conflict (user_id) do nothing;

create or replace function public.studio_reserve_credits(
  p_user_id uuid,
  p_generation_id uuid,
  p_amount integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_balance integer;
begin
  if p_amount <= 0 then raise exception 'invalid_credit_amount'; end if;
  if not exists (
    select 1 from public.studio_generations g
    where g.id = p_generation_id and g.user_id = p_user_id
  ) then
    raise exception 'generation_not_found';
  end if;

  if exists (
    select 1 from public.studio_credit_ledger l
    where l.generation_id = p_generation_id and l.entry_type = 'generation'
  ) then
    select balance into new_balance
    from public.studio_credit_wallets where user_id = p_user_id;
    return new_balance;
  end if;

  update public.studio_credit_wallets
  set balance = balance - p_amount
  where user_id = p_user_id and balance >= p_amount
  returning balance into new_balance;

  if not found then raise exception 'insufficient_studio_credits'; end if;

  insert into public.studio_credit_ledger
    (user_id, generation_id, amount, entry_type, reference_id)
  values
    (p_user_id, p_generation_id, -p_amount, 'generation', p_generation_id::text);

  return new_balance;
end;
$$;

create or replace function public.studio_refund_generation(p_generation_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  generation_user_id uuid;
  reserved_amount integer;
  new_balance integer;
begin
  select g.user_id into generation_user_id
  from public.studio_generations g where g.id = p_generation_id;
  if generation_user_id is null then raise exception 'generation_not_found'; end if;

  select abs(l.amount) into reserved_amount
  from public.studio_credit_ledger l
  where l.generation_id = p_generation_id and l.entry_type = 'generation';
  if reserved_amount is null then raise exception 'generation_charge_not_found'; end if;

  if exists (
    select 1 from public.studio_credit_ledger l
    where l.generation_id = p_generation_id and l.entry_type = 'refund'
  ) then
    select balance into new_balance
    from public.studio_credit_wallets where user_id = generation_user_id;
    return new_balance;
  end if;

  update public.studio_credit_wallets
  set balance = balance + reserved_amount
  where user_id = generation_user_id
  returning balance into new_balance;

  insert into public.studio_credit_ledger
    (user_id, generation_id, amount, entry_type, reference_id)
  values
    (generation_user_id, p_generation_id, reserved_amount, 'refund', p_generation_id::text);

  return new_balance;
end;
$$;

create or replace function public.studio_add_credits(
  p_user_id uuid,
  p_amount integer,
  p_entry_type text,
  p_reference_id text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_balance integer;
  normalized_reference text := trim(p_reference_id);
  reference_user_id uuid;
begin
  if p_amount <= 0 then raise exception 'invalid_credit_amount'; end if;
  if p_entry_type not in ('purchase', 'grant') then raise exception 'invalid_credit_entry_type'; end if;
  if normalized_reference is null or char_length(normalized_reference) < 3 then
    raise exception 'credit_reference_required';
  end if;

  select l.user_id into reference_user_id
    from public.studio_credit_ledger l
    where l.entry_type = p_entry_type and l.reference_id = normalized_reference
    limit 1;
  if reference_user_id is not null then
    if reference_user_id <> p_user_id then raise exception 'credit_reference_owner_mismatch'; end if;
    select balance into new_balance
    from public.studio_credit_wallets where user_id = p_user_id;
    return new_balance;
  end if;

  insert into public.studio_credit_wallets (user_id, balance)
  values (p_user_id, 0)
  on conflict (user_id) do nothing;

  update public.studio_credit_wallets
  set balance = balance + p_amount
  where user_id = p_user_id
  returning balance into new_balance;

  insert into public.studio_credit_ledger
    (user_id, amount, entry_type, reference_id)
  values
    (p_user_id, p_amount, p_entry_type, normalized_reference);

  return new_balance;
end;
$$;

alter table public.studio_models enable row level security;
alter table public.studio_projects enable row level security;
alter table public.studio_generations enable row level security;
alter table public.studio_assets enable row level security;
alter table public.studio_generation_inputs enable row level security;
alter table public.studio_credit_wallets enable row level security;
alter table public.studio_credit_ledger enable row level security;

create policy "Active studio models are readable"
on public.studio_models for select
using (is_active = true);

create policy "Users read studio projects"
on public.studio_projects for select
using (auth.uid() = user_id);
create policy "Users create studio projects"
on public.studio_projects for insert
with check (auth.uid() = user_id);
create policy "Users update studio projects"
on public.studio_projects for update
using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users read studio generations"
on public.studio_generations for select
using (auth.uid() = user_id);
create policy "Users read studio assets"
on public.studio_assets for select
using (auth.uid() = user_id);
create policy "Users read studio generation inputs"
on public.studio_generation_inputs for select
using (
  exists (
    select 1 from public.studio_generations g
    where g.id = generation_id and g.user_id = auth.uid()
  )
);
create policy "Users read studio wallet"
on public.studio_credit_wallets for select
using (auth.uid() = user_id);
create policy "Users read studio credit ledger"
on public.studio_credit_ledger for select
using (auth.uid() = user_id);

revoke all on table public.studio_models from anon, authenticated;
revoke all on table public.studio_projects from anon, authenticated;
revoke all on table public.studio_generations from anon, authenticated;
revoke all on table public.studio_assets from anon, authenticated;
revoke all on table public.studio_generation_inputs from anon, authenticated;
revoke all on table public.studio_credit_wallets from anon, authenticated;
revoke all on table public.studio_credit_ledger from anon, authenticated;
grant select on table public.studio_models to authenticated;
grant select, insert, update on table public.studio_projects to authenticated;
grant select on table public.studio_generations to authenticated;
grant select on table public.studio_assets to authenticated;
grant select on table public.studio_generation_inputs to authenticated;
grant select on table public.studio_credit_wallets to authenticated;
grant select on table public.studio_credit_ledger to authenticated;
grant all on table public.studio_models to service_role;
grant all on table public.studio_projects to service_role;
grant all on table public.studio_generations to service_role;
grant all on table public.studio_assets to service_role;
grant all on table public.studio_generation_inputs to service_role;
grant all on table public.studio_credit_wallets to service_role;
grant all on table public.studio_credit_ledger to service_role;

revoke all on function public.validate_studio_generation_input() from public;
grant execute on function public.validate_studio_generation_input() to service_role;
revoke all on function public.studio_reserve_credits(uuid, uuid, integer) from public;
revoke all on function public.studio_refund_generation(uuid) from public;
revoke all on function public.studio_add_credits(uuid, integer, text, text) from public;
grant execute on function public.studio_reserve_credits(uuid, uuid, integer) to service_role;
grant execute on function public.studio_refund_generation(uuid) to service_role;
grant execute on function public.studio_add_credits(uuid, integer, text, text) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'studio-inputs', 'studio-inputs', false, 104857600,
    array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']
  ),
  (
    'studio-outputs', 'studio-outputs', false, 2147483648,
    array['image/jpeg', 'image/png', 'image/webp', 'video/mp4']
  ),
  (
    'studio-thumbnails', 'studio-thumbnails', false, 10485760,
    array['image/jpeg', 'image/png', 'image/webp']
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Deliberately no client storage policies. The Studio API issues short-lived,
-- user-scoped upload and download URLs after checking ownership.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'studio_generations'
  ) then
    alter publication supabase_realtime add table public.studio_generations;
  end if;
end;
$$;

comment on table public.studio_models is
  'Server-controlled model catalog and credit prices. Add provider models only after their adapter is configured.';
comment on table public.studio_generations is
  'Provider-neutral AI generation jobs exposed to the owner through RLS and Realtime.';
comment on table public.studio_assets is
  'Private Studio input/output metadata. Binary data lives in private Storage buckets.';
