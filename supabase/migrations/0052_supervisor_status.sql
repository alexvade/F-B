-- "Supervisor" is a label only, same spirit as is_casual (0046) rather than
-- a third `role` value — supervisors keep exactly the same permissions as
-- a regular team member everywhere else in the app (every role==='admin'
-- gate is unaffected); this just lets Manage Staff show and set a more
-- specific status than "Staff" for senior-but-non-admin team members.
alter table profiles add column is_supervisor boolean not null default false;
grant select (is_supervisor) on profiles to authenticated;

-- Same column-order-append-only rule as every prior addition to this view.
create or replace view profiles_directory as
select
  id, name, role, avatar_url, contract_hours, created_at,
  case when id = auth.uid() or is_super_admin() then email else null end as email,
  is_super_admin,
  task_bar,
  is_casual,
  is_supervisor
from profiles;
