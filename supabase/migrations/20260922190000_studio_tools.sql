-- Studio tools catalog: recipes that cowork with regulation/models.
create table if not exists public.studio_tools (
  key text primary key check (key ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  media_type text not null check (media_type in ('image', 'video', 'audio')),
  name text not null,
  description text not null default '',
  badge text,
  icon_key text not null,
  is_available boolean not null default false,
  sort_order integer not null default 0,
  default_model_key text references public.studio_models(key),
  usage jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists studio_tools_set_updated_at on public.studio_tools;
create trigger studio_tools_set_updated_at before update on public.studio_tools
for each row execute function public.set_updated_at();

alter table public.studio_generations
  add column if not exists tool_key text references public.studio_tools(key);

create index if not exists studio_tools_active_sort_idx
  on public.studio_tools (is_active, sort_order);
create index if not exists studio_generations_tool_key_idx
  on public.studio_generations (tool_key);

alter table public.studio_tools enable row level security;

drop policy if exists "Active studio tools are readable" on public.studio_tools;
create policy "Active studio tools are readable"
on public.studio_tools for select
using (is_active = true or public.is_admin());

drop policy if exists "Admins manage Studio tools" on public.studio_tools;
create policy "Admins manage Studio tools"
on public.studio_tools for all
using (public.is_admin()) with check (public.is_admin());

revoke all on table public.studio_tools from anon, authenticated;
grant select on table public.studio_tools to authenticated;
grant select, insert, update, delete on public.studio_tools to authenticated;
grant all on table public.studio_tools to service_role;

insert into public.studio_tools
  (key, media_type, name, description, badge, icon_key, is_available, sort_order, default_model_key, usage, is_active)
values
  ('image-trends', 'image', 'Trends', 'Start from visual formats creators are using now.', 'New', 'sparkles', false, 10, null, '{"howTo":"Trends is next in the Timeless rollout.","steps":["Coming soon"],"requireReference":false,"allowModelPicker":true,"promptEnhanceDefault":true}'::jsonb, true),
  ('create-image', 'image', 'Create image', 'Turn any idea into a polished visual.', 'Popular', 'wand-sparkles', true, 20, (select key from public.studio_models where key = 'nano-banana-2-1k'), '{"howTo":"Describe the image you want, then generate.","steps":["Write a clear prompt","Pick quality settings","Generate"],"requireReference":false,"allowModelPicker":true,"promptEnhanceDefault":true}'::jsonb, true),
  ('cinematic-image', 'image', 'Cinematic camera', 'Direct the lens, framing, and point of view.', 'Pro', 'camera', true, 30, (select key from public.studio_models where key = 'flux-2-flex-1k'), '{"howTo":"Describe the shot, lens, and composition.","steps":["Describe the scene and camera","Adjust aspect ratio","Generate"],"requireReference":false,"allowModelPicker":true,"promptEnhanceDefault":true,"promptPrefix":"Create a cinematic photograph with intentional lens choice and composition. "}'::jsonb, true),
  ('moodboard', 'image', 'Moodboard', 'Turn references into one coherent visual direction.', null, 'palette', false, 40, null, '{"howTo":"Moodboard is next in the Timeless rollout.","steps":["Coming soon"],"requireReference":false,"allowModelPicker":true,"promptEnhanceDefault":true}'::jsonb, true),
  ('consistent-character', 'image', 'Consistent character', 'Keep one identity across a visual series.', null, 'scan-face', false, 50, null, '{"howTo":"Consistent character is next in the Timeless rollout.","steps":["Coming soon"],"requireReference":false,"allowModelPicker":true,"promptEnhanceDefault":true}'::jsonb, true),
  ('virtual-face', 'image', 'Virtual face', 'Build and manage a reusable virtual identity.', null, 'scan-face', false, 60, null, '{"howTo":"Virtual face is next in the Timeless rollout.","steps":["Coming soon"],"requireReference":false,"allowModelPicker":true,"promptEnhanceDefault":true}'::jsonb, true),
  ('moments-album', 'image', 'Moments album', 'Generate a coordinated set with one mood.', 'New', 'image', false, 70, null, '{"howTo":"Moments album is next in the Timeless rollout.","steps":["Coming soon"],"requireReference":false,"allowModelPicker":true,"promptEnhanceDefault":true}'::jsonb, true),
  ('relight', 'image', 'Relight', 'Control the light, mood, and color grade.', null, 'sun-medium', false, 80, null, '{"howTo":"Relight is next in the Timeless rollout.","steps":["Coming soon"],"requireReference":false,"allowModelPicker":true,"promptEnhanceDefault":true}'::jsonb, true),
  ('inpaint', 'image', 'Inpaint', 'Select and replace one area precisely.', null, 'eraser', false, 90, null, '{"howTo":"Inpaint is next in the Timeless rollout.","steps":["Coming soon"],"requireReference":false,"allowModelPicker":true,"promptEnhanceDefault":true}'::jsonb, true),
  ('upscale-image', 'image', 'Image upscale', 'Increase detail and resolution cleanly.', null, 'maximize-2', false, 100, null, '{"howTo":"Image upscale is next in the Timeless rollout.","steps":["Coming soon"],"requireReference":false,"allowModelPicker":true,"promptEnhanceDefault":true}'::jsonb, true),
  ('face-swap', 'image', 'Face swap', 'Replace a face while preserving the scene.', null, 'scan-face', false, 110, null, '{"howTo":"Face swap is next in the Timeless rollout.","steps":["Coming soon"],"requireReference":false,"allowModelPicker":true,"promptEnhanceDefault":true}'::jsonb, true),
  ('character-swap', 'image', 'Character swap', 'Replace the full subject in an existing scene.', null, 'refresh-cw', false, 120, null, '{"howTo":"Character swap is next in the Timeless rollout.","steps":["Coming soon"],"requireReference":false,"allowModelPicker":true,"promptEnhanceDefault":true}'::jsonb, true),
  ('sketch-to-image', 'image', 'Sketch to image', 'Turn a rough drawing into a finished visual.', null, 'wand-sparkles', false, 130, null, '{"howTo":"Sketch to image is next in the Timeless rollout.","steps":["Coming soon"],"requireReference":false,"allowModelPicker":true,"promptEnhanceDefault":true}'::jsonb, true),
  ('virtual-try-on', 'image', 'Virtual try-on', 'Put a garment on a model naturally.', 'New', 'shirt', false, 140, null, '{"howTo":"Virtual try-on is next in the Timeless rollout.","steps":["Coming soon"],"requireReference":false,"allowModelPicker":true,"promptEnhanceDefault":true}'::jsonb, true),
  ('edit-image', 'image', 'Edit with a prompt', 'Upload an image and describe the change.', null, 'layers-3', true, 150, (select key from public.studio_models where key = 'nano-banana-2-1k'), '{"howTo":"Upload a reference, then describe the edit.","steps":["Add a reference image","Describe the change","Generate"],"requireReference":true,"allowModelPicker":true,"promptEnhanceDefault":true,"promptPrefix":"Edit the reference image: ","minInputs":1}'::jsonb, true),
  ('product-shot', 'image', 'Product studio', 'Create clean campaign-ready product imagery.', null, 'camera', true, 160, (select key from public.studio_models where key = 'nano-banana-2-1k'), '{"howTo":"Upload a product photo, then describe the campaign look.","steps":["Add a product reference","Describe the shot","Generate"],"requireReference":true,"allowModelPicker":true,"promptEnhanceDefault":true,"promptPrefix":"Create a premium commercial product photograph from the reference. ","minInputs":1}'::jsonb, true),
  ('style-transfer', 'image', 'Style transfer', 'Reimagine a reference in a new visual language.', null, 'palette', true, 170, (select key from public.studio_models where key = 'nano-banana-2-1k'), '{"howTo":"Upload a reference, then describe the new style.","steps":["Add a reference image","Describe the style","Generate"],"requireReference":true,"allowModelPicker":true,"promptEnhanceDefault":true,"promptPrefix":"Restyle the reference image while preserving its subject. ","minInputs":1}'::jsonb, true),
  ('video-trends', 'video', 'Trends', 'Start from current short-form video formats.', 'New', 'sparkles', false, 180, null, '{"howTo":"Trends is next in the Timeless rollout.","steps":["Coming soon"],"requireReference":false,"allowModelPicker":true,"promptEnhanceDefault":true}'::jsonb, true),
  ('create-video', 'video', 'Create video', 'Generate a cinematic sequence from text.', 'Popular', 'clapperboard', true, 190, (select key from public.studio_models where key = 'seedance-1-5-pro-720p-8s'), '{"howTo":"Describe the motion and scene, then generate.","steps":["Write a motion-aware prompt","Choose duration and resolution","Generate"],"requireReference":false,"allowModelPicker":true,"promptEnhanceDefault":true}'::jsonb, true),
  ('image-to-video', 'video', 'Image to video', 'Animate a still frame with natural motion.', null, 'image', true, 200, (select key from public.studio_models where key = 'seedance-1-5-pro-720p-8s'), '{"howTo":"Upload a still, then describe the motion.","steps":["Add a first-frame image","Describe the motion","Generate"],"requireReference":true,"allowModelPicker":true,"promptEnhanceDefault":true,"promptPrefix":"Animate the reference image with cinematic motion. ","minInputs":1}'::jsonb, true),
  ('camera-motion', 'video', 'Cinematic camera', 'Direct the camera, lens, and movement.', 'Pro', 'camera', true, 210, (select key from public.studio_models where key = 'seedance-1-5-pro-720p-8s'), '{"howTo":"Describe the camera move and scene.","steps":["Describe camera movement","Set duration","Generate"],"requireReference":false,"allowModelPicker":true,"promptEnhanceDefault":true,"promptPrefix":"Use deliberate cinematic camera movement: "}'::jsonb, true),
  ('motion-presets', 'video', 'Motion presets', 'Apply production-ready camera moves in one click.', null, 'wand-sparkles', true, 220, (select key from public.studio_models where key = 'seedance-1-5-pro-720p-8s'), '{"howTo":"Describe the scene; a strong camera move is applied.","steps":["Describe the scene","Generate with preset motion"],"requireReference":false,"allowModelPicker":true,"promptEnhanceDefault":true,"promptPrefix":"Use a bold, production-ready camera move: "}'::jsonb, true),
  ('viral-video', 'video', 'Viral trends', 'Turn an idea into a current social format.', 'New', 'sparkles', false, 230, null, '{"howTo":"Viral trends is next in the Timeless rollout.","steps":["Coming soon"],"requireReference":false,"allowModelPicker":true,"promptEnhanceDefault":true}'::jsonb, true),
  ('sketch-to-video', 'video', 'Sketch to video', 'Develop a hand-drawn idea into a moving scene.', null, 'wand-sparkles', false, 240, null, '{"howTo":"Sketch to video is next in the Timeless rollout.","steps":["Coming soon"],"requireReference":false,"allowModelPicker":true,"promptEnhanceDefault":true}'::jsonb, true),
  ('social-ad', 'video', 'Social ad', 'Build an attention-first vertical campaign clip.', null, 'badge-plus', true, 250, (select key from public.studio_models where key = 'seedance-1-5-pro-720p-8s'), '{"howTo":"Describe the ad concept and hook.","steps":["Describe the hook and offer","Choose vertical framing","Generate"],"requireReference":false,"allowModelPicker":true,"promptEnhanceDefault":true,"promptPrefix":"Create a polished social advertisement with a strong opening beat. "}'::jsonb, true),
  ('first-last', 'video', 'First & last frame', 'Animate smoothly between two images.', null, 'layers-3', true, 260, (select key from public.studio_models where key = 'minimax-h3-image'), '{"howTo":"Add a start frame (and end frame when supported), then describe the transition.","steps":["Add reference frame(s)","Describe the transition","Generate"],"requireReference":true,"allowModelPicker":true,"promptEnhanceDefault":true,"minInputs":1,"referenceHints":["first"]}'::jsonb, true),
  ('lip-sync', 'video', 'Lip sync', 'Match a video to your voice recording.', null, 'mic-2', true, 270, (select key from public.studio_models where key = 'video-lip-sync'), '{"howTo":"Upload video and voice audio references, then generate.","steps":["Add video and audio references","Generate lip sync"],"requireReference":true,"allowModelPicker":true,"promptEnhanceDefault":false,"omitPrompt":true,"minInputs":1}'::jsonb, true),
  ('video-effects', 'video', 'Video effects', 'Transform style, atmosphere, and energy.', null, 'sparkles', false, 280, null, '{"howTo":"Video effects is next in the Timeless rollout.","steps":["Coming soon"],"requireReference":false,"allowModelPicker":true,"promptEnhanceDefault":true}'::jsonb, true),
  ('virtual-character-ad', 'video', 'Virtual character ad', 'Create an ad led by a consistent virtual creator.', 'New', 'badge-plus', false, 290, null, '{"howTo":"Virtual character ad is next in the Timeless rollout.","steps":["Coming soon"],"requireReference":false,"allowModelPicker":true,"promptEnhanceDefault":true}'::jsonb, true),
  ('video-edit', 'video', 'Video edit', 'Upload footage and describe the change.', 'New', 'clapperboard', true, 300, (select key from public.studio_models where key = 'wan-2-7-edit'), '{"howTo":"Upload footage, then describe the edit.","steps":["Add a video reference","Describe the edit","Generate"],"requireReference":true,"allowModelPicker":true,"promptEnhanceDefault":true,"minInputs":1}'::jsonb, true),
  ('character-swap-video', 'video', 'Character swap in video', 'Replace the subject throughout a moving shot.', null, 'refresh-cw', false, 310, null, '{"howTo":"Character swap in video is next in the Timeless rollout.","steps":["Coming soon"],"requireReference":false,"allowModelPicker":true,"promptEnhanceDefault":true}'::jsonb, true),
  ('change-video-speech', 'video', 'Change video speech', 'Replace spoken delivery while preserving timing.', null, 'mic-2', false, 320, null, '{"howTo":"Change video speech is next in the Timeless rollout.","steps":["Coming soon"],"requireReference":false,"allowModelPicker":true,"promptEnhanceDefault":true}'::jsonb, true),
  ('upscale-video', 'video', 'Video upscale', 'Enhance footage toward a 4K finish.', null, 'maximize-2', false, 330, null, '{"howTo":"Video upscale is next in the Timeless rollout.","steps":["Coming soon"],"requireReference":false,"allowModelPicker":true,"promptEnhanceDefault":true}'::jsonb, true),
  ('extend-video', 'video', 'Extend video', 'Continue a clip beyond its current ending.', null, 'plus', false, 340, null, '{"howTo":"Extend video is next in the Timeless rollout.","steps":["Coming soon"],"requireReference":false,"allowModelPicker":true,"promptEnhanceDefault":true}'::jsonb, true),
  ('extend-grok', 'video', 'Extend with Grok', 'Continue the action with a context-aware model.', null, 'plus', false, 350, null, '{"howTo":"Extend with Grok is next in the Timeless rollout.","steps":["Coming soon"],"requireReference":false,"allowModelPicker":true,"promptEnhanceDefault":true}'::jsonb, true),
  ('audio-trends', 'audio', 'Trends', 'Start from audio formats creators are using now.', 'New', 'sparkles', false, 360, null, '{"howTo":"Trends is next in the Timeless rollout.","steps":["Coming soon"],"requireReference":false,"allowModelPicker":true,"promptEnhanceDefault":true}'::jsonb, true),
  ('voiceover', 'audio', 'Voiceover', 'Turn a script into natural multilingual speech.', 'Provider paused', 'mic-2', false, 370, null, '{"howTo":"Voiceover is next in the Timeless rollout.","steps":["Coming soon"],"requireReference":false,"allowModelPicker":true,"promptEnhanceDefault":true}'::jsonb, true),
  ('narration', 'audio', 'Narration', 'Create a paced read for stories and explainers.', 'Provider paused', 'book-open-text', false, 380, null, '{"howTo":"Narration is next in the Timeless rollout.","steps":["Coming soon"],"requireReference":false,"allowModelPicker":true,"promptEnhanceDefault":true}'::jsonb, true),
  ('dialogue', 'audio', 'Multi-voice dialogue', 'Build a conversation with distinct speakers.', 'New', 'message-square-text', false, 390, null, '{"howTo":"Multi-voice dialogue is next in the Timeless rollout.","steps":["Coming soon"],"requireReference":false,"allowModelPicker":true,"promptEnhanceDefault":true}'::jsonb, true),
  ('sound-effects', 'audio', 'Sound effects', 'Describe an effect and generate the sound.', null, 'waves', false, 400, null, '{"howTo":"Sound effects is next in the Timeless rollout.","steps":["Coming soon"],"requireReference":false,"allowModelPicker":true,"promptEnhanceDefault":true}'::jsonb, true),
  ('music', 'audio', 'Music', 'Create an original song or instrumental.', null, 'music-2', false, 410, null, '{"howTo":"Music is next in the Timeless rollout.","steps":["Coming soon"],"requireReference":false,"allowModelPicker":true,"promptEnhanceDefault":true}'::jsonb, true),
  ('audio-isolation', 'audio', 'Audio isolation', 'Remove noise and extract clean speech.', null, 'audio-lines', false, 420, null, '{"howTo":"Audio isolation is next in the Timeless rollout.","steps":["Coming soon"],"requireReference":false,"allowModelPicker":true,"promptEnhanceDefault":true}'::jsonb, true),
  ('song-recreation', 'audio', 'Song recreation', 'Rebuild a song concept in a fresh musical style.', null, 'music-2', false, 430, null, '{"howTo":"Song recreation is next in the Timeless rollout.","steps":["Coming soon"],"requireReference":false,"allowModelPicker":true,"promptEnhanceDefault":true}'::jsonb, true)
on conflict (key) do update set
  media_type = excluded.media_type,
  name = excluded.name,
  description = excluded.description,
  badge = excluded.badge,
  icon_key = excluded.icon_key,
  is_available = excluded.is_available,
  sort_order = excluded.sort_order,
  default_model_key = excluded.default_model_key,
  usage = excluded.usage,
  is_active = excluded.is_active;

comment on table public.studio_tools is
  'Studio capability recipes; usage jsonb coworks with studio_models via regulation.';
comment on column public.studio_tools.usage is
  'howTo, steps, requireReference, promptPrefix, forcePrefix, omitPrompt, defaultParameters, minInputs, maxInputs, referenceHints, allowModelPicker, promptEnhanceDefault';