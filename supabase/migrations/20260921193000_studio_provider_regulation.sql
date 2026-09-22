-- Allow Studio provider jobs to record any registered adapter, not only Kie.
-- Regulation routes each catalog model to its adapter; Kie remains the first
-- implementation but is no longer a database-level exclusive.

alter table public.studio_provider_jobs
  drop constraint if exists studio_provider_jobs_provider_check;

alter table public.studio_provider_jobs
  add constraint studio_provider_jobs_provider_check
  check (provider ~ '^[a-z][a-z0-9_-]{0,31}$');

comment on table public.studio_provider_jobs is
  'Private orchestration state for provider adapters. Used to authenticate callbacks and recover jobs if a provider callback is delayed or missed.';
