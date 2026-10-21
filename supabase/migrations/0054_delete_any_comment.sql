-- Noticeboard comments had no delete policy at all until now (only
-- read_all_comments / insert_own_comment from 0001_init.sql) — deleting
-- was impossible for anyone. Per request, comment deletion is
-- deliberately open to every authenticated user, not just the comment's
-- own author or an admin (unlike deletePost, which stays author-or-admin
-- — see src/app/(app)/updates/page.tsx).
create policy "delete_any_comment" on comments for delete to authenticated using (true);
