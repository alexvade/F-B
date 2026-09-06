-- Same as posts: let people delete their own nomination, admins delete any.
-- Deleting a nomination cascades to its votes (nomination_votes has
-- on delete cascade on nomination_id already).
create policy "delete_own_nomination" on nominations for delete to authenticated
  using (nominated_by = auth.uid());
create policy "admin_delete_any_nomination" on nominations for delete to authenticated
  using (is_admin());
