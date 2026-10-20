-- =============================================================================
-- BlueMarket Nigeria — 1100 Supabase Storage buckets and object policies
--
-- Path conventions (first folder decides access; object names are random UUIDs):
--   product-images/<business_id>/<uuid>.<ext>          public read, members write
--   verification-documents/<business_id>/<uuid>.<ext>  private: members + admins
--   dispute-evidence/<dispute_id>/<uuid>.<ext>         private: dispute parties + admins
-- Private files are served with short-lived signed URLs only.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('verification-documents', 'verification-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png']),
  ('dispute-evidence', 'dispute-evidence', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Object name must be <uuid-folder>/<uuid>.<allowed extension>
create function private.storage_name_is_safe(p_name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|pdf)$';
$$;
grant execute on function private.storage_name_is_safe(text) to anon, authenticated;

create function private.storage_folder_id(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select private.try_uuid(split_part(p_name, '/', 1));
$$;
grant execute on function private.storage_folder_id(text) to anon, authenticated;

-- product-images ---------------------------------------------------------------
-- Public bucket: files are served by public URL. We do not grant list/select to
-- anon through the API, which prevents bucket enumeration.
create policy "product images: members read own folder" on storage.objects
  for select to authenticated
  using (bucket_id = 'product-images' and private.is_business_member(private.storage_folder_id(name)));

create policy "product images: members upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and private.storage_name_is_safe(name)
    and private.is_business_member(private.storage_folder_id(name))
  );

create policy "product images: members delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and private.is_business_member(private.storage_folder_id(name)));

-- verification-documents ------------------------------------------------------------
create policy "verification docs: members and admins read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'verification-documents'
    and (private.is_business_member(private.storage_folder_id(name)) or private.is_admin())
  );

create policy "verification docs: managers upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'verification-documents'
    and private.storage_name_is_safe(name)
    and private.is_business_manager(private.storage_folder_id(name))
  );

-- dispute-evidence ------------------------------------------------------------------
create policy "dispute evidence: parties and admins read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'dispute-evidence'
    and (private.is_dispute_participant(private.storage_folder_id(name)) or private.is_admin())
  );

create policy "dispute evidence: parties upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'dispute-evidence'
    and private.storage_name_is_safe(name)
    and (private.is_dispute_participant(private.storage_folder_id(name)) or private.is_admin())
  );
