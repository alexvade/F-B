-- Menus (formerly "Drinks"): Afternoon Tea, Dinner, Breakfast, Bar,
-- In-Room Dining. One row per section, keyed by its URL slug, with the
-- rendered content as a single JSONB blob (same "flexible blob, not a
-- normalized schema" choice as events.content — see src/lib/event-content.ts)
-- since menus vary a lot in shape (a wine-style tea list vs. priced dinner
-- courses vs. a cheese board with tasting notes).
create table menus (
  slug text primary key,
  title text not null,
  content jsonb,
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz
);

alter table menus enable row level security;

create policy "read_all_menus" on menus for select to authenticated using (true);
create policy "admin_write_menus" on menus for all to authenticated
  using (is_admin()) with check (is_admin());
