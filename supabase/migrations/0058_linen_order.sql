-- Daily linen hire order sent to Fisher Services (hdnewc@fisherservices.co.uk)
-- — see src/app/(app)/linen-order/page.tsx. Super-admin only, same as Manage
-- Staff (0047's comment): Alex is currently the only super admin, so this is
-- effectively private to him, same mechanism as everywhere else in the app
-- that's gated this way rather than a one-off user-id check.
create table linen_order_items (
  article text primary key,
  category text not null,
  sort_order int not null,
  total_sent int,
  colour text,
  increase_required int,
  decrease_required int,
  reject int,
  updated_at timestamptz not null default now()
);

create table linen_order_meta (
  id int primary key default 1 check (id = 1),
  your_name text,
  labels_colour text,
  empty_bags_cages int,
  updated_at timestamptz not null default now()
);

alter table linen_order_items enable row level security;
alter table linen_order_meta enable row level security;

create policy "super_admin_all_linen_order_items" on linen_order_items for all to authenticated
  using (is_super_admin()) with check (is_super_admin());
create policy "super_admin_all_linen_order_meta" on linen_order_meta for all to authenticated
  using (is_super_admin()) with check (is_super_admin());

-- Article list and category grouping/order straight off Fisher Services'
-- own blank order form — quantities start blank, filled in fresh each day.
insert into linen_order_items (article, category, sort_order) values
  ('Sheets Single', 'Bed Linen', 1),
  ('Sheets King', 'Bed Linen', 2),
  ('Pillow Cases', 'Bed Linen', 3),
  ('Hand Towels', 'Bed Linen', 4),
  ('Bath Sheets', 'Bed Linen', 5),
  ('Bath Mats', 'Bed Linen', 6),
  ('Glass Cloths', 'Cloths', 7),
  ('Kitchen Cloths', 'Cloths', 8),
  ('Oven Cloths', 'Cloths', 9),
  ('Table Napkins', 'Table Linen', 10),
  ('Table Cloths (54 x 54)', 'Table Linen', 11),
  ('Table Cloths (70 x 70)', 'Table Linen', 12),
  ('Table Cloths (90 x 90)', 'Table Linen', 13),
  ('Table Cloths (70 x 144)', 'Table Linen', 14),
  ('Duvet Covers Single', 'Duvet Covers', 15),
  ('Duvet Covers King', 'Duvet Covers', 16),
  ('Duvet Covers Superking', 'Duvet Covers', 17),
  ('Premier Hand Towels', 'Specialty Towels', 18),
  ('Leisure Towels', 'Specialty Towels', 19),
  ('Hand Towels Slate Grey', 'Specialty Towels', 20),
  ('Bath Sheets Slate Grey', 'Specialty Towels', 21),
  ('Spa Jumbo Sheets', 'Specialty Towels', 22);

insert into linen_order_meta (id) values (1);
