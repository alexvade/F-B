-- Staff could previously read every other staff member's email directly
-- (read_all_profiles, 0001_init.sql, is a row-level policy — it can't hide
-- one column while allowing the rest of the row, so name/avatar/role stay
-- readable but email needs a different mechanism).
--
-- Revoke column-level access to email from the shared `authenticated`
-- Postgres role entirely, so no direct query against the base table can
-- ever return it for anyone. Then expose a view that re-adds email back
-- only for a viewer's own row or for admins — views run with their
-- owner's privileges by default, so it can still read the real column
-- internally while auth.uid()/is_admin() correctly reflect the actual
-- calling user.
revoke select on profiles from authenticated;
grant select (id, name, role, avatar_url, contract_hours, created_at) on profiles to authenticated;

create view profiles_directory as
select
  id,
  name,
  role,
  avatar_url,
  contract_hours,
  created_at,
  case when id = auth.uid() or is_admin() then email else null end as email
from profiles;

grant select on profiles_directory to authenticated;
