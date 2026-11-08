-- Owner-only colour scheme preference (see theme-scheme-toggle.tsx) — null
-- means the standard black & white look everyone else always sees.
-- update_own_profile already lets a user write any column but role on
-- their own row, so only the new column (and its SELECT grant, same
-- allowlist rule as 0019/0042/0044/0052) is needed here.
alter table profiles add column theme_scheme text;
grant select (theme_scheme) on profiles to authenticated;

-- Same column-order-append-only rule as every prior addition to this view.
create or replace view profiles_directory as
select
  id, name, role, avatar_url, contract_hours, created_at,
  case when id = auth.uid() or is_super_admin() then email else null end as email,
  is_super_admin,
  task_bar,
  is_casual,
  is_supervisor,
  theme_scheme
from profiles;
