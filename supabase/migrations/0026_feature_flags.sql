-- Per-role feature toggles, set from the new Settings page. When a flag is
-- on, staff get the same write access admins already have for that
-- feature; admins are unaffected either way (is_admin() already passes).
create table feature_flags (
  key text primary key,
  enabled boolean not null default false,
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz
);

alter table feature_flags enable row level security;

create policy "read_all_feature_flags" on feature_flags for select to authenticated using (true);
create policy "admin_write_feature_flags" on feature_flags for all to authenticated
  using (is_admin()) with check (is_admin());

create or replace function feature_enabled(flag_key text) returns boolean
language sql stable as $$
  select coalesce((select enabled from feature_flags where key = flag_key), false);
$$;

insert into feature_flags (key, enabled) values
  ('function_sheets_upload', false),
  ('stock_orders_edit', false);

-- Function sheets: staff get write access when function_sheets_upload is on.
drop policy "admin_write_function_sheets" on function_sheets;
create policy "write_function_sheets" on function_sheets for all to authenticated
  using (is_admin() or feature_enabled('function_sheets_upload'))
  with check (is_admin() or feature_enabled('function_sheets_upload'));

-- Stock products: staff get full write access (add/delete/quantity) when
-- stock_orders_edit is on. Read access is unrelated and stays unconditional
-- (read_all_stock_products, from 0009 — Cocktails cross-references stock).
drop policy "admin_insert_stock_products" on stock_products;
drop policy "admin_delete_stock_products" on stock_products;
drop policy "admin_update_stock_quantity" on stock_products;
create policy "write_stock_products" on stock_products for all to authenticated
  using (is_admin() or feature_enabled('stock_orders_edit'))
  with check (is_admin() or feature_enabled('stock_orders_edit'));
