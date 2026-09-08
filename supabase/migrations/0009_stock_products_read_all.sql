-- Reading the stock list needs to be available to all staff again (not just
-- admins) so the Cocktails screen can cross-reference ingredient
-- availability. Editing quantities (the actual "Stock Orders" ordering
-- workflow) stays admin-only — this only changes who can SELECT.
drop policy if exists "admin_read_stock_products" on stock_products;
create policy "read_all_stock_products" on stock_products for select to authenticated using (true);
