-- Narrows 0054's "anyone can delete any comment" down to the comment's own
-- author or a super admin (not even a regular admin) — same tier as
-- Manage Staff, per correction right after 0054 shipped.
drop policy "delete_any_comment" on comments;
create policy "delete_own_or_super_admin_comment" on comments for delete to authenticated
  using (author_id = auth.uid() or is_super_admin());
