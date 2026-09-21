-- Try Kie's independent ElevenLabs Dialogue v3 route for single-voice Studio
-- narration after the regular TTS routes proved unavailable in production.

insert into public.studio_models
  (key, name, provider, provider_model_id, media_type, credit_cost,
   provider_credit_cost, description, badge, parameter_schema,
   provider_config, is_active, sort_order)
values
  (
    'elevenlabs-dialogue-v3',
    'ElevenLabs Dialogue v3',
    'kie',
    'elevenlabs/text-to-dialogue-v3',
    'audio',
    10,
    8,
    'Natural creator narration using Kie''s Dialogue v3 voice engine.',
    'Voice',
    '{"type":"object","additionalProperties":false,"properties":{"stability":{"type":"number","enum":[0.35,0.5,0.75]}}}'::jsonb,
    '{"defaultInput":{"voice":"EkK5I93UQWFDigLMpZcX","stability":0.5}}'::jsonb,
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

update public.studio_models
set is_active = false,
    sort_order = 31
where key = 'gemini-3-1-flash-tts';
