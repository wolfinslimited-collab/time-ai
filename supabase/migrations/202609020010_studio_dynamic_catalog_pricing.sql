-- Model-specific Studio controls and server-authoritative credit quotes.
-- The matrix stores Timeless customer credits, not raw provider prices. The
-- generation function recomputes the total after merging catalog defaults so
-- a client cannot obtain a more expensive variant for the fallback price.

alter table public.studio_models
  add column if not exists credit_rules jsonb not null
    default '{"strategy":"fixed"}'::jsonb;

update public.studio_models
set
  name = 'Nano Banana 2',
  credit_cost = 12,
  provider_credit_cost = 8,
  description = 'Fast image creation and editing from 1K drafts to 4K finals.',
  parameter_schema = '{"type":"object","additionalProperties":false,"properties":{"aspect_ratio":{"type":"string","enum":["auto","1:1","3:2","2:3","4:3","3:4","16:9","9:16"]},"resolution":{"type":"string","enum":["1K","2K","4K"]},"output_format":{"type":"string","enum":["png","jpg"]}}}'::jsonb,
  provider_config = '{"inputField":"image_input","defaultInput":{"aspect_ratio":"auto","resolution":"1K","output_format":"png"}}'::jsonb,
  credit_rules = '{"strategy":"matrix","keys":["resolution"],"rates":{"1K":12,"2K":18,"4K":27}}'::jsonb,
  is_active = true,
  sort_order = 10
where key = 'nano-banana-2-1k';

update public.studio_models
set
  name = 'FLUX.2 Flex',
  credit_cost = 20,
  provider_credit_cost = 14,
  description = 'Detailed cinematic image generation with 1K and 2K output.',
  parameter_schema = '{"type":"object","additionalProperties":false,"properties":{"aspect_ratio":{"type":"string","enum":["1:1","3:2","2:3","4:3","3:4","16:9","9:16"]},"resolution":{"type":"string","enum":["1K","2K"]},"nsfw_checker":{"type":"boolean"}}}'::jsonb,
  provider_config = '{"defaultInput":{"aspect_ratio":"1:1","resolution":"1K","nsfw_checker":true}}'::jsonb,
  credit_rules = '{"strategy":"matrix","keys":["resolution"],"rates":{"1K":20,"2K":36}}'::jsonb,
  is_active = true,
  sort_order = 20
where key = 'flux-2-flex-1k';

update public.studio_models
set
  name = 'Seedance 1.5 Pro',
  credit_cost = 42,
  provider_credit_cost = 28,
  description = 'Cinematic 4–12 second video with 480p–1080p output and optional native audio.',
  parameter_schema = '{"type":"object","additionalProperties":false,"properties":{"aspect_ratio":{"type":"string","enum":["1:1","4:3","3:4","16:9","9:16","21:9"]},"resolution":{"type":"string","enum":["480p","720p","1080p"]},"duration":{"type":"integer","enum":[4,8,12]},"fixed_lens":{"type":"boolean"},"generate_audio":{"type":"boolean"},"nsfw_checker":{"type":"boolean"}}}'::jsonb,
  provider_config = '{"inputField":"input_urls","defaultInput":{"aspect_ratio":"16:9","resolution":"720p","duration":8,"fixed_lens":false,"generate_audio":false,"nsfw_checker":true}}'::jsonb,
  credit_rules = '{"strategy":"matrix","keys":["resolution","generate_audio"],"rates":{"480p|false":2.625,"480p|true":5.25,"720p|false":5.25,"720p|true":10.5,"1080p|false":11.25,"1080p|true":22.5},"multiplierKey":"duration"}'::jsonb,
  is_active = true,
  sort_order = 110
where key = 'seedance-1-5-pro-720p-8s';

insert into public.studio_models
  (key, name, provider, provider_model_id, media_type, credit_cost,
   provider_credit_cost, description, badge, parameter_schema,
   provider_config, credit_rules, is_active, sort_order)
values
  (
    'gpt-image-2', 'GPT Image 2', 'kie', 'gpt-image-2-text-to-image',
    'image', 9, 6,
    'Premium image rendering with precise text and 1K, 2K, or 4K output.',
    'New',
    '{"type":"object","additionalProperties":false,"properties":{"aspect_ratio":{"type":"string","enum":["3:2","2:3","4:3","3:4","16:9","9:16"]},"resolution":{"type":"string","enum":["1K","2K","4K"]}}}'::jsonb,
    '{"defaultInput":{"aspect_ratio":"16:9","resolution":"1K"}}'::jsonb,
    '{"strategy":"matrix","keys":["resolution"],"rates":{"1K":9,"2K":15,"4K":24}}'::jsonb,
    true, 30
  ),
  (
    'gpt-image-1-5', 'GPT Image 1.5', 'kie',
    'gpt-image/1.5-text-to-image', 'image', 6, 4,
    'Creative image generation with medium or high quality output.',
    null,
    '{"type":"object","additionalProperties":false,"properties":{"aspect_ratio":{"type":"string","enum":["1:1","3:2","2:3","4:3","3:4","16:9","9:16"]},"quality":{"type":"string","enum":["medium","high"]}}}'::jsonb,
    '{"defaultInput":{"aspect_ratio":"1:1","quality":"medium"}}'::jsonb,
    '{"strategy":"matrix","keys":["quality"],"rates":{"medium":6,"high":33}}'::jsonb,
    true, 40
  ),
  (
    'seedream-5-lite', 'Seedream 5.0 Lite', 'kie',
    'seedream/5-lite-text-to-image', 'image', 9, 5.5,
    'Efficient photorealistic image generation for rapid exploration.',
    'New',
    '{"type":"object","additionalProperties":false,"properties":{"aspect_ratio":{"type":"string","enum":["1:1","3:2","2:3","4:3","3:4","16:9","9:16"]},"quality":{"type":"string","enum":["basic"]},"output_format":{"type":"string","enum":["png","jpeg"]},"nsfw_checker":{"type":"boolean"}}}'::jsonb,
    '{"defaultInput":{"aspect_ratio":"1:1","quality":"basic","output_format":"png","nsfw_checker":true}}'::jsonb,
    '{"strategy":"fixed"}'::jsonb,
    true, 50
  ),
  (
    'seedream-5-pro', 'Seedream 5.0 Pro', 'kie',
    'seedream/5-pro-text-to-image', 'image', 11, 7,
    'Art-directed photorealistic imagery in 1K basic or 2K high quality.',
    'Pro',
    '{"type":"object","additionalProperties":false,"properties":{"aspect_ratio":{"type":"string","enum":["1:1","3:2","2:3","4:3","3:4","16:9","9:16"]},"quality":{"type":"string","enum":["basic","high"]},"output_format":{"type":"string","enum":["png","jpeg"]},"nsfw_checker":{"type":"boolean"}}}'::jsonb,
    '{"defaultInput":{"aspect_ratio":"1:1","quality":"basic","output_format":"png","nsfw_checker":true}}'::jsonb,
    '{"strategy":"matrix","keys":["quality"],"rates":{"basic":11,"high":21}}'::jsonb,
    true, 60
  ),
  (
    'kling-3-video', 'Kling 3.0', 'kie', 'kling-3.0/video',
    'video', 105, 70,
    'Expressive 3–15 second video with standard, pro, and 4K modes.',
    'New',
    '{"type":"object","additionalProperties":false,"properties":{"aspect_ratio":{"type":"string","enum":["16:9","9:16","1:1"]},"duration":{"type":"string","enum":["3","5","8","10","15"]},"mode":{"type":"string","enum":["std","pro","4K"]},"sound":{"type":"boolean"},"multi_shots":{"type":"boolean"}}}'::jsonb,
    '{"inputField":"image_urls","defaultInput":{"aspect_ratio":"16:9","duration":"5","mode":"std","sound":false,"multi_shots":false}}'::jsonb,
    '{"strategy":"matrix","keys":["mode","sound"],"rates":{"std|false":21,"std|true":30,"pro|false":27,"pro|true":40.5,"4K|false":100.5,"4K|true":100.5},"multiplierKey":"duration"}'::jsonb,
    true, 120
  ),
  (
    'wan-3-video', 'Wan 3.0', 'kie', 'wan/3-0-video',
    'video', 60, 40,
    'Flexible 2–30 second video with 480p, 720p, and 1080p output.',
    'New',
    '{"type":"object","additionalProperties":false,"properties":{"resolution":{"type":"string","enum":["480P","720P","1080P"]},"aspect_ratio":{"type":"string","enum":["adaptive","16:9","9:16","1:1","4:3","3:4"]},"duration":{"type":"integer","enum":[5,10,15,30]},"audio":{"type":"boolean"}}}'::jsonb,
    '{"inputField":"first_frame_url","defaultInput":{"resolution":"480P","aspect_ratio":"adaptive","duration":5,"audio":true}}'::jsonb,
    '{"strategy":"matrix","keys":["resolution"],"rates":{"480P":12,"720P":24,"1080P":48},"multiplierKey":"duration"}'::jsonb,
    true, 130
  )
on conflict (key) do update set
  name = excluded.name,
  provider = excluded.provider,
  provider_model_id = excluded.provider_model_id,
  media_type = excluded.media_type,
  credit_cost = excluded.credit_cost,
  provider_credit_cost = excluded.provider_credit_cost,
  description = excluded.description,
  badge = excluded.badge,
  parameter_schema = excluded.parameter_schema,
  provider_config = excluded.provider_config,
  credit_rules = excluded.credit_rules,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;

comment on column public.studio_models.credit_rules is
  'Server-authoritative Timeless customer credit matrix. Rates may be per request or multiplied by the configured parameter key.';
