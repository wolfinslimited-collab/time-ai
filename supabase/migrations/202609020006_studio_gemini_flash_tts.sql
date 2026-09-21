-- Use Kie's newest Gemini Flash TTS route after the older Pro route timed out
-- upstream without consuming provider credits.

insert into public.studio_models
  (key, name, provider, provider_model_id, media_type, credit_cost,
   provider_credit_cost, description, badge, parameter_schema,
   provider_config, is_active, sort_order)
values
  (
    'gemini-3-1-flash-tts',
    'Gemini 3.1 Flash TTS',
    'kie',
    'google/gemini-3-1-flash-tts',
    'audio',
    6,
    2,
    'Fast expressive voiceovers with natural pacing and creator-ready delivery.',
    'Voice',
    '{"type":"object","additionalProperties":false,"properties":{"voice_name":{"type":"string","enum":["Fenrir","Puck"]},"pace":{"type":"string","enum":["Natural","Staccato"]},"delivery_style":{"type":"string","enum":["Deadpan","Empathetic"]},"accent":{"type":"string","enum":["American (Gen)","British (RP)"]}}}'::jsonb,
    '{"defaultInput":{"temperature":1,"scene":"A premium creator studio voiceover.","sample_context":"Clear, polished narration with natural pacing.","voice_name":"Fenrir","pace":"Natural","delivery_style":"Deadpan","accent":"British (RP)","audio_profile":"A warm, confident creative narrator"}}'::jsonb,
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
where key = 'gemini-2-5-pro-tts';
