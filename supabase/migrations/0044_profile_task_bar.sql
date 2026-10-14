-- Per-user customisable bottom task bar (see NavShell's ISLAND_LEFT/
-- ISLAND_RIGHT) — an ordered list of nav hrefs the user picked in Settings.
-- Null means "use the app default". avatar_url already exists (0001_init.sql)
-- and update_own_profile already lets a user write any column but role on
-- their own row, so only the new column (and its SELECT grant, following
-- the explicit per-column allowlist 0019/0042 set up for this table) is
-- needed here.
alter table profiles add column task_bar jsonb;
grant select (task_bar) on profiles to authenticated;

-- The app layout reads the signed-in user's own profile through this view
-- (not the base table), so task_bar needs to be exposed here too — appended
-- at the end, same column-order rule as 0042's is_super_admin addition.
create or replace view profiles_directory as
select
  id, name, role, avatar_url, contract_hours, created_at,
  case when id = auth.uid() or is_super_admin() then email else null end as email,
  is_super_admin,
  task_bar
from profiles;
