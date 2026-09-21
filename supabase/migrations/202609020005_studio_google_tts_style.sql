-- Align the public delivery-style choices with Kie's current Gemini TTS
-- allow-list. Kie rejects free-form style labels at submission time.

update public.studio_models
set parameter_schema =
      '{"type":"object","additionalProperties":false,"properties":{"voice_name":{"type":"string","enum":["Fenrir","Puck"]},"pace":{"type":"string","enum":["Natural","Staccato"]},"delivery_style":{"type":"string","enum":["Deadpan","Empathetic"]},"accent":{"type":"string","enum":["American (Gen)","British (RP)"]}}}'::jsonb,
    provider_config =
      '{"defaultInput":{"temperature":1,"scene":"A premium creator studio voiceover.","sample_context":"Clear, polished narration with natural pacing.","voice_name":"Fenrir","pace":"Natural","delivery_style":"Deadpan","accent":"British (RP)","audio_profile":"A warm, confident creative narrator"}}'::jsonb
where key = 'gemini-2-5-pro-tts';
