-- Stock Orders: product list synced (read) from the "Stock Orders" Google
-- Sheet, with an app-native "quantity to order" field that staff fill in —
-- which then gets written back into the same sheet cell it came from.
create table stock_products (
  id bigint generated always as identity primary key,
  tab_gid text not null,
  tab_label text not null,
  category text not null,
  row_number int not null,
  order_col_letter text not null,
  code text,
  product text not null,
  cellar_code text,
  supplier text,
  sort_order int not null,
  quantity int,
  updated_by uuid references profiles(id),
  updated_at timestamptz,
  unique (tab_gid, row_number)
);

alter table stock_products enable row level security;

create policy "read_all_stock_products" on stock_products for select to authenticated using (true);

-- Anyone can update quantities (same trust model as todos/checklist ticks —
-- this is an internal staff tool, not adversarial). The product-list fields
-- themselves are only ever touched by the sync webhook (service role,
-- bypasses RLS), never by a client update.
create policy "update_stock_quantity" on stock_products for update to authenticated using (true) with check (true);
