-- The "attachments" bucket was created public: any object's URL is
-- fetchable by anyone, forever, with no auth check and no revocation —
-- the only thing protecting function-sheet PDFs (guest names/phone
-- numbers) and post/comment photos was the URL itself never leaking.
-- Make it private; the app now mints short-lived signed URLs instead
-- (see src/lib/storage.ts).
update storage.buckets set public = false where id = 'attachments';

-- Signed URLs still need the requester to have read access under RLS
-- (createSignedUrl checks this), and the app now also deletes the
-- underlying object when its row is deleted — both need a policy, since
-- 0006_posts_delete_and_storage_policy.sql only ever added INSERT.
-- Matches that migration's existing "any authenticated staff member" trust
-- model rather than trying to reconstruct per-owner rules for objects
-- storage itself has no owner column for.
create policy "authenticated_read_attachments" on storage.objects
  for select to authenticated using (bucket_id = 'attachments');
create policy "authenticated_delete_attachments" on storage.objects
  for delete to authenticated using (bucket_id = 'attachments');
