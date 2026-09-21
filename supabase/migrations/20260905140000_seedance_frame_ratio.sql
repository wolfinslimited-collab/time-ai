update public.studio_models set provider_config = provider_config || '{"frameAspectRatio":"adaptive"}'::jsonb where key='seedance-2-5';
