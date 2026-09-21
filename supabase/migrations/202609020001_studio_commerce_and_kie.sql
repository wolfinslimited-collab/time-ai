-- Timeless Studio launch catalog, Kie adapter state, Stripe credit packs,
-- pricing audit fields, and admin access. Provider and payment secrets remain
-- in Supabase Function secrets and are never stored in these tables.

alter table public.studio_models
  add column if not exists description text not null default '',
  add column if not exists badge text,
  add column if not exists provider_credit_cost numeric(12, 3),
  add column if not exists provider_config jsonb not null default '{}'::jsonb;

alter table public.studio_generations
  add column if not exists provider_credits_consumed numeric(12, 3),
  add column if not exists result_count integer not null default 1
    check (result_count between 1 and 8);

create table if not exists public.studio_credit_packs (
  key text primary key check (key ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  name text not null,
  description text not null default '',
  credits integer not null check (credits > 0),
  price_cents integer not null check (price_cents >= 50),
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  badge text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.studio_stripe_checkouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pack_key text not null references public.studio_credit_packs(key),
  stripe_session_id text not null unique,
  stripe_customer_id text,
  payment_intent_id text,
  credits integer not null check (credits > 0),
  amount_total integer not null check (amount_total >= 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  status text not null default 'open'
    check (status in ('open', 'paid', 'expired', 'failed')),
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);

-- Private orchestration state used to authenticate Kie callbacks and recover
-- jobs if a provider callback is delayed or missed.
create table if not exists public.studio_provider_jobs (
  generation_id uuid primary key references public.studio_generations(id)
    on delete cascade,
  provider text not null check (provider = 'kie'),
  provider_job_id text unique,
  callback_token_hash text not null,
  last_state text,
  last_checked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists studio_stripe_checkouts_user_created_idx
  on public.studio_stripe_checkouts(user_id, created_at desc);
create index if not exists studio_stripe_checkouts_status_idx
  on public.studio_stripe_checkouts(status, created_at desc);

drop trigger if exists studio_credit_packs_set_updated_at
  on public.studio_credit_packs;
create trigger studio_credit_packs_set_updated_at
before update on public.studio_credit_packs
for each row execute function public.set_updated_at();

drop trigger if exists studio_provider_jobs_set_updated_at
  on public.studio_provider_jobs;
create trigger studio_provider_jobs_set_updated_at
before update on public.studio_provider_jobs
for each row execute function public.set_updated_at();

alter table public.studio_credit_packs enable row level security;
alter table public.studio_stripe_checkouts enable row level security;
alter table public.studio_provider_jobs enable row level security;

create policy "Active Studio credit packs are readable"
on public.studio_credit_packs for select
using (is_active = true or public.is_admin());

create policy "Users read their Studio checkouts"
on public.studio_stripe_checkouts for select
using (auth.uid() = user_id);

-- The existing admin identity and UI administer Studio without a second auth
-- system. Provider job state remains service-role only.
create policy "Admins manage Studio models"
on public.studio_models for all
using (public.is_admin()) with check (public.is_admin());
create policy "Admins read Studio projects"
on public.studio_projects for select
using (public.is_admin());
create policy "Admins read Studio generations"
on public.studio_generations for select
using (public.is_admin());
create policy "Admins read Studio assets"
on public.studio_assets for select
using (public.is_admin());
create policy "Admins read Studio wallets"
on public.studio_credit_wallets for select
using (public.is_admin());
create policy "Admins read Studio ledger"
on public.studio_credit_ledger for select
using (public.is_admin());
create policy "Admins manage Studio credit packs"
on public.studio_credit_packs for all
using (public.is_admin()) with check (public.is_admin());
create policy "Admins read Studio checkouts"
on public.studio_stripe_checkouts for select
using (public.is_admin());

grant select, insert, update, delete on public.studio_models to authenticated;
grant select on public.studio_projects to authenticated;
grant select on public.studio_generations to authenticated;
grant select on public.studio_assets to authenticated;
grant select on public.studio_credit_wallets to authenticated;
grant select on public.studio_credit_ledger to authenticated;
grant select, insert, update, delete on public.studio_credit_packs
  to authenticated;
grant select on public.studio_stripe_checkouts to authenticated;
grant all on public.studio_credit_packs to service_role;
grant all on public.studio_stripe_checkouts to service_role;
grant all on public.studio_provider_jobs to service_role;

-- Conservative launch packs: one credit has a transparent list value of one
-- US cent, with volume discounts that preserve room for provider and Stripe
-- costs. Admins can tune these without a deploy.
insert into public.studio_credit_packs
  (key, name, description, credits, price_cents, currency, badge, sort_order)
values
  ('spark', 'Spark', 'For trying ideas and quick image concepts.', 1000, 999, 'usd', null, 10),
  ('creator', 'Creator', 'The best starting balance for weekly creation.', 3500, 2999, 'usd', 'Most popular', 20),
  ('production', 'Production', 'For high-volume image and video workflows.', 10000, 7999, 'usd', 'Best value', 30)
on conflict (key) do nothing;

-- Current Kie Market models with narrowly allow-listed inputs. Each duration
-- or quality tier is a separate row so a browser parameter can never increase
-- upstream cost beyond the displayed quote. Provider costs are audit hints;
-- the user-visible credit_cost remains the billing authority.
insert into public.studio_models
  (key, name, provider, provider_model_id, media_type, credit_cost,
   provider_credit_cost, description, badge, parameter_schema,
   provider_config, is_active, sort_order)
values
  (
    'nano-banana-2-1k', 'Nano Banana 2', 'kie', 'nano-banana-2', 'image', 12,
    8, 'Fast, polished image generation with strong prompt understanding.',
    'Popular',
    '{"type":"object","additionalProperties":false,"properties":{"aspect_ratio":{"type":"string","enum":["auto","1:1","3:2","2:3","16:9","9:16"]},"resolution":{"type":"string","enum":["1K"]},"output_format":{"type":"string","enum":["png"]}}}'::jsonb,
    '{"inputField":"image_input","defaultInput":{"aspect_ratio":"auto","resolution":"1K","output_format":"png"}}'::jsonb,
    true, 10
  ),
  (
    'flux-2-flex-1k', 'FLUX.2 Flex', 'kie', 'flux-2/flex-text-to-image', 'image', 20,
    14, 'Detailed cinematic images with excellent photographic control.',
    null,
    '{"type":"object","additionalProperties":false,"properties":{"aspect_ratio":{"type":"string","enum":["1:1","3:2","2:3","16:9","9:16"]},"resolution":{"type":"string","enum":["1K"]},"nsfw_checker":{"type":"boolean"}}}'::jsonb,
    '{"defaultInput":{"aspect_ratio":"1:1","resolution":"1K","nsfw_checker":true}}'::jsonb,
    true, 20
  ),
  (
    'seedance-1-5-pro-720p-8s', 'Seedance 1.5 Pro · 8s', 'kie',
    'bytedance/seedance-1.5-pro', 'video', 450, null,
    'Cinematic text-to-video or image-to-video with optional native audio.',
    'Video',
    '{"type":"object","additionalProperties":false,"properties":{"aspect_ratio":{"type":"string","enum":["16:9","9:16","1:1"]},"resolution":{"type":"string","enum":["720p"]},"duration":{"type":"integer","enum":[8]},"fixed_lens":{"type":"boolean"},"generate_audio":{"type":"boolean","enum":[false]},"nsfw_checker":{"type":"boolean"}}}'::jsonb,
    '{"inputField":"input_urls","defaultInput":{"aspect_ratio":"16:9","resolution":"720p","duration":8,"fixed_lens":false,"generate_audio":false,"nsfw_checker":true}}'::jsonb,
    true, 30
  )
on conflict (key) do nothing;

comment on column public.studio_models.provider_credit_cost is
  'Observed or quoted Kie cost used for margin review; never trusted from the client.';
comment on table public.studio_provider_jobs is
  'Service-only Kie orchestration state. No anon/authenticated grants or policies.';
