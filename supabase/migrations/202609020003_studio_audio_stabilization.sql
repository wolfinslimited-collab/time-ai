-- Move the live Studio voice workflow to Kie's lower-latency ElevenLabs
-- Turbo 2.5 route after the Multilingual v2 route repeatedly returned a
-- provider-side internal error. The public price remains eight Studio credits.

insert into public.studio_models
  (key, name, provider, provider_model_id, media_type, credit_cost,
   provider_credit_cost, description, badge, parameter_schema,
   provider_config, is_active, sort_order)
values
  (
    'elevenlabs-turbo-2-5',
    'ElevenLabs Turbo 2.5',
    'kie',
    'elevenlabs/text-to-speech-turbo-2-5',
    'audio',
    8,
    7,
    'Fast, natural multilingual voiceover with adjustable pace and delivery.',
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

update public.studio_models
set is_active = false,
    sort_order = 31
where key = 'elevenlabs-multilingual-v2';
