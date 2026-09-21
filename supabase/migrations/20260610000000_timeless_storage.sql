insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'timeless-intake-photos',
    'timeless-intake-photos',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'timeless-generated-previews',
    'timeless-generated-previews',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp']
  )
on conflict (id) do update
set
  allowed_mime_types = excluded.allowed_mime_types,
  file_size_limit = excluded.file_size_limit,
  public = excluded.public;
