-- Stock Orders becomes admin-only: replace the "any authenticated user"
-- read/update policies with admin-gated ones, matching the tab now being
-- hidden from staff in the UI. Otherwise the tab would be hidden but the
-- data still reachable by anyone signed in.
drop policy if exists "read_all_stock_products" on stock_products;
drop policy if exists "update_stock_quantity" on stock_products;

create policy "admin_read_stock_products" on stock_products for select to authenticated
  using (is_admin());
create policy "admin_update_stock_quantity" on stock_products for update to authenticated
  using (is_admin()) with check (is_admin());
