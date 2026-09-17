-- Lets admins add manual stock items (e.g. a new "Breakfast" tab that
-- doesn't exist in the synced Google Sheet) and delete items outright.
-- Deleting a sheet-synced item is only permanent until that tab's next
-- edit-triggered resync, which re-upserts every row still present in the
-- sheet — same trade-off as any other sync-vs-manual-edit conflict here.
create policy "admin_insert_stock_products" on stock_products for insert to authenticated
  with check (is_admin());

create policy "admin_delete_stock_products" on stock_products for delete to authenticated
  using (is_admin());
