-- Preserves the staff row order from the Google Sheet, so the Rota screen
-- lists people the same way the venue's own sheet does instead of A-Z.
create table rota_staff_order (
  staff_name text primary key,
  sort_order int not null
);

alter table rota_staff_order enable row level security;

create policy "read_all_rota_staff_order" on rota_staff_order for select to authenticated using (true);
create policy "admin_write_rota_staff_order" on rota_staff_order for all to authenticated
  using (is_admin()) with check (is_admin());
