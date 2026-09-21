-- Production smoke tests across four independent Kie audio routes either
-- failed upstream or remained queued/processing for ten minutes. Keep Sound
-- visible in the Studio roadmap, but prevent charges until the provider is
-- healthy enough to pass an end-to-end output test.

update public.studio_models
set is_active = false
where media_type = 'audio';
