-- Expand Timeless Studio from image/video generation into a four-part creator
-- suite: Image, Video, Sound, and Chat. Kie remains the only model provider and
-- every paid action uses the existing Studio credit wallet.

alter table public.studio_models
  drop constraint if exists studio_models_media_type_check;
alter table public.studio_models
  add constraint studio_models_media_type_check
  check (media_type in ('image', 'video', 'audio'));

alter table public.studio_generations
  drop constraint if exists studio_generations_media_type_check;
alter table public.studio_generations
  add constraint studio_generations_media_type_check
  check (media_type in ('image', 'video', 'audio'));

insert into public.studio_models
  (key, name, provider, provider_model_id, media_type, credit_cost,
   provider_credit_cost, description, badge, parameter_schema,
   provider_config, is_active, sort_order)
values
  (
    'elevenlabs-multilingual-v2',
    'ElevenLabs Multilingual',
    'kie',
    'elevenlabs/text-to-speech-multilingual-v2',
    'audio',
    8,
    7,
    'Natural multilingual voiceover with adjustable voice, pace, and delivery.',
    'Voice',
    '{"type":"object","additionalProperties":false,"properties":{"voice":{"type":"string","enum":["Rachel","Adam","Antoni","Bella"]},"stability":{"type":"number","enum":[0.35,0.5,0.75]},"similarity_boost":{"type":"number","enum":[0.5,0.75,0.9]},"style":{"type":"number","enum":[0]},"speed":{"type":"number","enum":[0.8,1,1.2]},"timestamps":{"type":"boolean","enum":[false]},"language_code":{"type":"string","enum":[""]},"previous_text":{"type":"string","enum":[""]},"next_text":{"type":"string","enum":[""]}}}'::jsonb,
    '{"defaultInput":{"voice":"Rachel","stability":0.5,"similarity_boost":0.75,"style":0,"speed":1,"timestamps":false,"language_code":"","previous_text":"","next_text":""}}'::jsonb,
    true,
    30
  )
on conflict (key) do update set
  name = excluded.name,
  provider_model_id = excluded.provider_model_id,
  media_type = excluded.media_type,
  credit_cost = excluded.credit_cost,
  provider_credit_cost = excluded.provider_credit_cost,
  description = excluded.description,
  badge = excluded.badge,
  parameter_schema = excluded.parameter_schema,
  provider_config = excluded.provider_config,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;

create table if not exists public.studio_chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.studio_projects(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  model_key text not null default 'gpt-5-2',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint studio_chat_threads_project_owner_fk
    foreign key (project_id, user_id)
    references public.studio_projects(id, user_id) on delete cascade
);

create table if not exists public.studio_chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.studio_chat_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 50000),
  credits_charged integer not null default 0 check (credits_charged >= 0),
  provider_tokens integer check (provider_tokens is null or provider_tokens >= 0),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists studio_chat_threads_user_updated_idx
  on public.studio_chat_threads(user_id, updated_at desc);
create index if not exists studio_chat_messages_thread_created_idx
  on public.studio_chat_messages(thread_id, created_at);
create unique index if not exists studio_chat_ledger_reference_idx
  on public.studio_credit_ledger(entry_type, reference_id)
  where entry_type = 'adjustment' and reference_id like 'chat:%';
create unique index if not exists studio_chat_refund_reference_idx
  on public.studio_credit_ledger(entry_type, reference_id)
  where entry_type = 'refund' and reference_id like 'refund:chat:%';

drop trigger if exists studio_chat_threads_set_updated_at on public.studio_chat_threads;
create trigger studio_chat_threads_set_updated_at
before update on public.studio_chat_threads
for each row execute function public.set_updated_at();

alter table public.studio_chat_threads enable row level security;
alter table public.studio_chat_messages enable row level security;

create policy "Users read their Studio chat threads"
on public.studio_chat_threads for select
using (auth.uid() = user_id);

create policy "Users read their Studio chat messages"
on public.studio_chat_messages for select
using (auth.uid() = user_id);

create policy "Admins manage Studio chat threads"
on public.studio_chat_threads for all
using (public.is_admin()) with check (public.is_admin());

create policy "Admins manage Studio chat messages"
on public.studio_chat_messages for all
using (public.is_admin()) with check (public.is_admin());

revoke all on table public.studio_chat_threads from anon, authenticated;
revoke all on table public.studio_chat_messages from anon, authenticated;
grant select on table public.studio_chat_threads to authenticated;
grant select on table public.studio_chat_messages to authenticated;
grant all on table public.studio_chat_threads to service_role;
grant all on table public.studio_chat_messages to service_role;

create or replace function public.studio_spend_chat_credits(
  p_user_id uuid,
  p_reference_id text,
  p_amount integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_balance integer;
  normalized_reference text := trim(p_reference_id);
begin
  if p_amount <= 0 then raise exception 'invalid_credit_amount'; end if;
  if normalized_reference !~ '^chat:[0-9a-f-]{36}$' then
    raise exception 'invalid_chat_reference';
  end if;

  if exists (
    select 1 from public.studio_credit_ledger l
    where l.entry_type = 'adjustment' and l.reference_id = normalized_reference
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
    (p_user_id, null, -p_amount, 'adjustment', normalized_reference);

  return new_balance;
end;
$$;

create or replace function public.studio_refund_chat_credits(
  p_user_id uuid,
  p_reference_id text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_reference text := trim(p_reference_id);
  reserved_amount integer;
  new_balance integer;
  refund_reference text;
begin
  select abs(l.amount) into reserved_amount
  from public.studio_credit_ledger l
  where l.user_id = p_user_id
    and l.entry_type = 'adjustment'
    and l.reference_id = normalized_reference;
  if reserved_amount is null then raise exception 'chat_charge_not_found'; end if;

  refund_reference := 'refund:' || normalized_reference;
  if exists (
    select 1 from public.studio_credit_ledger l
    where l.user_id = p_user_id
      and l.entry_type = 'refund'
      and l.reference_id = refund_reference
  ) then
    select balance into new_balance
    from public.studio_credit_wallets where user_id = p_user_id;
    return new_balance;
  end if;

  update public.studio_credit_wallets
  set balance = balance + reserved_amount
  where user_id = p_user_id
  returning balance into new_balance;

  insert into public.studio_credit_ledger
    (user_id, generation_id, amount, entry_type, reference_id)
  values
    (p_user_id, null, reserved_amount, 'refund', refund_reference);
  return new_balance;
end;
$$;

revoke all on function public.studio_spend_chat_credits(uuid, text, integer) from public;
revoke all on function public.studio_refund_chat_credits(uuid, text) from public;
grant execute on function public.studio_spend_chat_credits(uuid, text, integer) to service_role;
grant execute on function public.studio_refund_chat_credits(uuid, text) to service_role;

comment on table public.studio_chat_threads is
  'User-owned Timeless Studio conversations powered by Kie chat models.';
