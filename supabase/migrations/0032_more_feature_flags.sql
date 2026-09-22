-- Expands the Settings page with more per-role toggles, following the
-- exact pattern from 0026 (function_sheets_upload / stock_orders_edit).

insert into feature_flags (key, enabled) values
  ('birthdays_access', false),
  ('checklists_edit', false),
  ('sops_edit', false),
  ('noticeboard_pin', false),
  ('wines_edit', false),
  ('cocktails_edit', false),
  ('events_edit', false),
  ('training_upload', false);

-- Birthdays: read access was already open to everyone (read_all_birthdays,
-- 0013) — the "admin only" behaviour is purely the nav item + page-level
-- gate in the app, which birthdays_access now controls instead. Writing
-- (add/edit/delete a birthday) stays admin-only regardless of the flag.

-- Checklists: creating/editing/deleting a checklist or its items.
drop policy "admin_write_checklists" on checklists;
drop policy "admin_write_checklist_items" on checklist_items;
create policy "write_checklists" on checklists for all to authenticated
  using (is_admin() or feature_enabled('checklists_edit'))
  with check (is_admin() or feature_enabled('checklists_edit'));
create policy "write_checklist_items" on checklist_items for all to authenticated
  using (is_admin() or feature_enabled('checklists_edit'))
  with check (is_admin() or feature_enabled('checklists_edit'));

-- SOPs: adding/editing/deleting a procedure.
drop policy "admin_write_sops" on sops;
create policy "write_sops" on sops for all to authenticated
  using (is_admin() or feature_enabled('sops_edit'))
  with check (is_admin() or feature_enabled('sops_edit'));

-- Noticeboard: pinning a post (the only thing admin_update_post ever
-- covers — posting/commenting/deleting-own is already open to everyone).
drop policy "admin_update_post" on posts;
create policy "update_post" on posts for update to authenticated
  using (is_admin() or feature_enabled('noticeboard_pin'))
  with check (is_admin() or feature_enabled('noticeboard_pin'));

-- Wines: adding/editing/deleting a wine.
drop policy "admin_write_wines" on wines;
create policy "write_wines" on wines for all to authenticated
  using (is_admin() or feature_enabled('wines_edit'))
  with check (is_admin() or feature_enabled('wines_edit'));

-- Cocktails: adding/editing/deleting/pinning a cocktail.
drop policy "admin_write_cocktails" on cocktails;
create policy "write_cocktails" on cocktails for all to authenticated
  using (is_admin() or feature_enabled('cocktails_edit'))
  with check (is_admin() or feature_enabled('cocktails_edit'));

-- Events: adding/deleting an event guide (editing its rich content still
-- only ever happens via a service-role script, not through the app).
drop policy "admin_write_events" on events;
create policy "write_events" on events for all to authenticated
  using (is_admin() or feature_enabled('events_edit'))
  with check (is_admin() or feature_enabled('events_edit'));

-- Training: this one's split carefully. training_records holds real
-- employee emails and compliance status — reading it (as opposed to the
-- redacted training_directory view everyone already uses) stays
-- admin-only no matter what. Only the upload's own delete-then-insert
-- (see training/page.tsx) is what training_upload delegates.
drop policy "admin_all_training_records" on training_records;
create policy "admin_select_training_records" on training_records for select to authenticated
  using (is_admin());
create policy "insert_training_records" on training_records for insert to authenticated
  with check (is_admin() or feature_enabled('training_upload'));
create policy "delete_training_records" on training_records for delete to authenticated
  using (is_admin() or feature_enabled('training_upload'));

drop policy "admin_all_training_uploads" on training_uploads;
create policy "admin_select_training_uploads" on training_uploads for select to authenticated
  using (is_admin());
create policy "insert_training_uploads" on training_uploads for insert to authenticated
  with check (is_admin() or feature_enabled('training_upload'));
