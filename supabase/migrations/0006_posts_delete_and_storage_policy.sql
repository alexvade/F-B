-- Storage RLS: the "attachments" bucket was created public (readable by
-- anyone with the URL) but never got an INSERT policy, so every upload from
-- the app has been silently rejected. Buckets need their own RLS on
-- storage.objects, separate from the app's own tables.
create policy "authenticated_upload_attachments" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments');

-- Let people delete their own Updates posts, and admins delete any.
create policy "delete_own_post" on posts for delete to authenticated
  using (author_id = auth.uid());
create policy "admin_delete_any_post" on posts for delete to authenticated
  using (is_admin());
