-- Kie's ElevenLabs routes accepted tasks but repeatedly failed downstream with
-- provider code 500 and zero usage. Move the live voice workflow to Kie's
-- independent Google Gemini TTS route while preserving the public price.

insert into public.studio_models
  (key, name, provider, provider_model_id, media_type, credit_cost,
   provider_credit_cost, description, badge, parameter_schema,
   provider_config, is_active, sort_order)
values
  (
    'gemini-2-5-pro-tts',
    'Gemini 2.5 Pro TTS',
    'kie',
    'google/gemini-2-5-pro-tts',
    'audio',
    8,
    7,
    'Expressive creator voiceovers on an independent production-grade TTS route.',
    'Voice',
    '{"type":"object","additionalProperties":false,"properties":{"voice_name":{"type":"string","enum":["Fenrir","Puck"]},"pace":{"type":"string","enum":["Natural","Measured","Staccato"]},"delivery_style":{"type":"string","enum":["Engaging","Warm","Deadpan"]},"accent":{"type":"string","enum":["American (Gen)","British (RP)"]}}}'::jsonb,
    '{"defaultInput":{"temperature":1,"scene":"A premium creator studio voiceover.","sample_context":"Clear, polished narration with natural pacing.","voice_name":"Fenrir","pace":"Natural","delivery_style":"Engaging","accent":"American (Gen)","audio_profile":"A warm, confident creative narrator"}}'::jsonb,
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
    sort_order = case
      when key = 'elevenlabs-turbo-2-5' then 31
      else 32
    end
where key in ('elevenlabs-turbo-2-5', 'elevenlabs-multilingual-v2');
