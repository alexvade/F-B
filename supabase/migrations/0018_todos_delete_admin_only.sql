-- Restrict deleting to-do items to admins. Previously any authenticated
-- staff member could delete anyone's todo (0014_todos_delete_policy.sql);
-- narrowing that down per request.
drop policy "delete_todo" on todos;
create policy "delete_todo" on todos for delete to authenticated using (is_admin());
