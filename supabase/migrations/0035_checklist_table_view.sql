-- Lets a checklist render as an editable day-by-day table (e.g. the
-- Barista section's Brew Log) instead of a plain tick-off list — every
-- item becomes a column, every day in the selected week becomes a row.
alter table checklists add column table_view boolean not null default false;

-- A shared log table needs a manager to be able to correct or sign off on
-- an entry someone else made that day (e.g. a barista's reading), which
-- insert_own/delete_own_checklist_completion (both scoped to your own rows)
-- don't allow. Admins — or anyone the checklists_edit flag covers — get a
-- second, more permissive policy on top of those (RLS policies for the same
-- command are OR'd, so this only adds capability, never removes it from the
-- existing own-row policies regular staff already have).
create policy "admin_write_checklist_completions" on checklist_completions for all to authenticated
  using (is_admin() or feature_enabled('checklists_edit'))
  with check (is_admin() or feature_enabled('checklists_edit'));
