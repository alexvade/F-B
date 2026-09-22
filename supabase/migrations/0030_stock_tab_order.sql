-- Lets a Stock Orders tab be reordered by an admin (or anyone with
-- stock_orders_edit) instead of always following the hardcoded default
-- (Breakfast, Beer Cellar, Wine Cellar, Bin End, Miscellaneous, then
-- alphabetical). A tab with no row here falls back to that default order,
-- sorted after any tab that does have one — so this only needs to be
-- populated once someone actually reorders something.
create table stock_tab_order (
  tab_label text primary key,
  sort_order int not null
);

alter table stock_tab_order enable row level security;

create policy "read_all_stock_tab_order" on stock_tab_order for select to authenticated using (true);
create policy "write_stock_tab_order" on stock_tab_order for all to authenticated
  using (is_admin() or feature_enabled('stock_orders_edit'))
  with check (is_admin() or feature_enabled('stock_orders_edit'));
