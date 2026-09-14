-- Todos had select/insert/update policies but no delete policy, so deletes
-- silently no-op under RLS. Matches the existing "any staff member can
-- toggle any todo" policy (update_todo_toggle) — same openness for delete.
create policy "delete_todo" on todos for delete to authenticated using (true);
