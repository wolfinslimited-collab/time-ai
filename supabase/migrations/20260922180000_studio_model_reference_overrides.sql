-- Sync FE reference-override schema/provider_config into studio_models.
-- Preserves credit_cost / credit_rules / provider_credit_cost from prior pricing migrations.

update public.studio_models
set
  description = 'Fast image creation and editing from 1K drafts to 4K finals. Combine up to 14 reference images.',
  badge = 'Popular',
  parameter_schema = '{"type":"object","properties":{"resolution":{"enum":["1K","2K","4K"],"type":"string"},"aspect_ratio":{"enum":["auto","1:1","3:2","2:3","4:3","3:4","16:9","9:16"],"type":"string"},"output_format":{"enum":["png","jpg"],"type":"string"}},"additionalProperties":false}'::jsonb,
  provider_config = '{"inputField":"image_input","defaultInput":{"resolution":"1K","aspect_ratio":"auto","output_format":"png"},"referenceSlots":[{"key":"images","label":"Images","field":"image_input","mimeTypes":["image/jpeg","image/png","image/webp"],"max":14,"encoding":"urls","maxBytes":10485760}],"maxInputs":14,"inputMimeTypes":["image/jpeg","image/png","image/webp"],"allowNegativePrompt":false,"imageModel":"nano-banana-2","minInputs":0}'::jsonb
where key = 'nano-banana-2-1k';

update public.studio_models
set
  description = 'Detailed cinematic image generation with 1K and 2K output. Combine up to 8 reference images.',
  badge = null,
  parameter_schema = '{"type":"object","properties":{"resolution":{"enum":["1K","2K"],"type":"string"},"aspect_ratio":{"enum":["1:1","3:2","2:3","4:3","3:4","16:9","9:16"],"type":"string"}},"additionalProperties":false}'::jsonb,
  provider_config = '{"defaultInput":{"resolution":"1K","aspect_ratio":"1:1"},"referenceSlots":[{"key":"images","label":"Images","field":"input_urls","mimeTypes":["image/jpeg","image/png","image/webp"],"max":8,"encoding":"urls","maxBytes":10485760}],"maxInputs":8,"inputMimeTypes":["image/jpeg","image/png","image/webp"],"allowNegativePrompt":false,"imageModel":"flux-2/flex-image-to-image","inputField":"input_urls","minInputs":0}'::jsonb
where key = 'flux-2-flex-1k';

update public.studio_models
set
  description = 'Premium image rendering with precise text and 1K, 2K, or 4K output. Combine up to 16 reference images.',
  badge = 'New',
  parameter_schema = '{"type":"object","properties":{"resolution":{"enum":["1K","2K","4K"],"type":"string"},"aspect_ratio":{"enum":["3:2","2:3","4:3","3:4","16:9","9:16"],"type":"string"}},"additionalProperties":false}'::jsonb,
  provider_config = '{"defaultInput":{"resolution":"1K","aspect_ratio":"16:9"},"referenceSlots":[{"key":"images","label":"Images","field":"input_urls","mimeTypes":["image/jpeg","image/png","image/webp"],"max":16,"encoding":"urls","maxBytes":10485760}],"maxInputs":16,"inputMimeTypes":["image/jpeg","image/png","image/webp"],"allowNegativePrompt":false,"imageModel":"gpt-image-2-image-to-image","inputField":"input_urls","minInputs":0}'::jsonb
where key = 'gpt-image-2';

update public.studio_models
set
  description = 'Creative image generation with medium or high quality output. Combine up to 16 reference images.',
  badge = null,
  parameter_schema = '{"type":"object","properties":{"quality":{"enum":["medium","high"],"type":"string"},"aspect_ratio":{"enum":["1:1","2:3","3:2"],"type":"string"}},"additionalProperties":false}'::jsonb,
  provider_config = '{"defaultInput":{"quality":"medium","aspect_ratio":"1:1"},"referenceSlots":[{"key":"images","label":"Images","field":"input_urls","mimeTypes":["image/jpeg","image/png","image/webp"],"max":16,"encoding":"urls","maxBytes":10485760}],"maxInputs":16,"inputMimeTypes":["image/jpeg","image/png","image/webp"],"allowNegativePrompt":false,"imageModel":"gpt-image/1.5-image-to-image","inputField":"input_urls","minInputs":0}'::jsonb
where key = 'gpt-image-1-5';

update public.studio_models
set
  description = 'Efficient photorealistic image generation for rapid exploration. Combine up to 14 reference images.',
  badge = 'New',
  parameter_schema = '{"type":"object","properties":{"quality":{"enum":["basic"],"type":"string"},"aspect_ratio":{"enum":["1:1","3:2","2:3","4:3","3:4","16:9","9:16"],"type":"string"},"output_format":{"enum":["png","jpeg"],"type":"string"}},"additionalProperties":false}'::jsonb,
  provider_config = '{"defaultInput":{"quality":"basic","aspect_ratio":"1:1","output_format":"png"},"referenceSlots":[{"key":"images","label":"Images","field":"image_urls","mimeTypes":["image/jpeg","image/png","image/webp"],"max":14,"encoding":"urls","maxBytes":10485760}],"maxInputs":14,"inputMimeTypes":["image/jpeg","image/png","image/webp"],"allowNegativePrompt":false,"imageModel":"seedream/5-lite-image-to-image","inputField":"image_urls","minInputs":0}'::jsonb
where key = 'seedream-5-lite';

update public.studio_models
set
  description = 'Art-directed photorealistic imagery in 1K basic or 2K high quality. Combine up to 10 reference images.',
  badge = 'Pro',
  parameter_schema = '{"type":"object","properties":{"quality":{"enum":["basic","high"],"type":"string"},"aspect_ratio":{"enum":["1:1","3:2","2:3","4:3","3:4","16:9","9:16"],"type":"string"},"output_format":{"enum":["png","jpeg"],"type":"string"}},"additionalProperties":false}'::jsonb,
  provider_config = '{"defaultInput":{"quality":"basic","aspect_ratio":"1:1","output_format":"png"},"referenceSlots":[{"key":"images","label":"Images","field":"image_urls","mimeTypes":["image/jpeg","image/png","image/webp"],"max":10,"encoding":"urls","maxBytes":10485760}],"maxInputs":10,"inputMimeTypes":["image/jpeg","image/png","image/webp"],"allowNegativePrompt":false,"imageModel":"seedream/5-pro-image-to-image","inputField":"image_urls","minInputs":0}'::jsonb
where key = 'seedream-5-pro';

update public.studio_models
set
  description = 'Expressive 3–15 second video with standard, pro, and 4K modes.',
  badge = 'New',
  parameter_schema = '{"type":"object","properties":{"mode":{"enum":["std","pro","4K"],"type":"string"},"sound":{"type":"boolean"},"duration":{"enum":["3","4","5","6","7","8","9","10","11","12","13","14","15"],"type":"string"},"multi_shots":{"enum":[false],"type":"boolean"},"aspect_ratio":{"enum":["16:9","9:16","1:1"],"type":"string"}},"additionalProperties":false}'::jsonb,
  provider_config = '{"maxInputs":2,"minInputs":0,"inputField":"image_urls","defaultInput":{"mode":"std","sound":false,"duration":"5","multi_shots":false,"aspect_ratio":"16:9"},"inputMimeTypes":["image/jpeg","image/png","image/webp"],"referenceSlots":[{"key":"images","label":"Images","field":"image_urls","mimeTypes":["image/jpeg","image/png","image/webp"],"max":2,"encoding":"urls","maxBytes":10485760}],"allowNegativePrompt":false,"supportsShots":true}'::jsonb
where key = 'kling-3-video';

update public.studio_models
set
  description = 'Combine up to 10 images and 5 video references, or use first and last frames.',
  badge = 'New',
  parameter_schema = '{"type":"object","properties":{"audio":{"type":"boolean"},"duration":{"enum":[5,10,15,30],"type":"integer"},"resolution":{"enum":["480P","720P","1080P"],"type":"string"},"aspect_ratio":{"enum":["adaptive","16:9","9:16","1:1","4:3","3:4"],"type":"string"}},"additionalProperties":false}'::jsonb,
  provider_config = '{"maxInputs":17,"minInputs":0,"inputField":"first_frame_url","defaultInput":{"audio":true,"duration":5,"resolution":"480P","aspect_ratio":"adaptive"},"inputMimeTypes":["image/jpeg","image/png","image/webp","video/mp4"],"referenceSlots":[{"key":"images","label":"Images","field":"reference_image_urls","mimeTypes":["image/jpeg","image/png","image/webp"],"max":10,"encoding":"urls","maxBytes":10485760,"group":"references","minSide":240,"maxSide":8000,"minRatio":0.125,"maxRatio":8},{"key":"videos","label":"Videos","field":"reference_video_urls","mimeTypes":["video/mp4"],"max":5,"encoding":"urls","maxBytes":52428800,"minDuration":1,"maxDuration":15,"totalDuration":15,"group":"references","minSide":240,"maxSide":4096,"minRatio":0.125,"maxRatio":8},{"key":"first","label":"First frame","field":"first_frame_url","mimeTypes":["image/jpeg","image/png","image/webp"],"max":1,"encoding":"url","maxBytes":10485760,"group":"frames"},{"key":"last","label":"Last frame","field":"last_frame_url","mimeTypes":["image/jpeg","image/png","image/webp"],"max":1,"encoding":"url","maxBytes":10485760,"group":"frames"}],"allowNegativePrompt":false,"maxCombinedDuration":30}'::jsonb
where key = 'wan-3-video';
