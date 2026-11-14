-- Private storage buckets and owner-scoped upload policies.
-- Artifacts are served only through server-generated signed URLs; there are no
-- browser policies on the artifacts bucket.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('uploads', 'uploads', false, 52428800, array['image/png','image/jpeg','image/webp']),
  ('artifacts', 'artifacts', false, 536870912, null)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "uploads_owner_select" on storage.objects;
create policy "uploads_owner_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "uploads_owner_insert" on storage.objects;
create policy "uploads_owner_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "uploads_owner_update" on storage.objects;
create policy "uploads_owner_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "uploads_owner_delete" on storage.objects;
create policy "uploads_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);

-- No policies for the artifacts bucket: only the service role (server) can
-- read or write build outputs. Downloads always go through an ownership check
-- and a short-lived signed URL.
