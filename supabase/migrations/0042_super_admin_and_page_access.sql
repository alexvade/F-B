-- Super admin: one tier above admin. Hardcoded to a specific account
-- rather than a third `role` value, since regular admins keep every
-- admin capability they already have — this only adds two extra things
-- on top: Settings access, and seeing other staff's email addresses.
alter table profiles add column is_super_admin boolean not null default false;
grant select (is_super_admin) on profiles to authenticated;

update profiles set is_super_admin = true
where id = (select id from auth.users where email = 'alex.vade@hotmail.com');

create or replace function is_super_admin()
returns boolean
language sql stable
security definer set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and is_super_admin = true
  );
$$;

-- "Personal details" (email) narrows from "any admin" to "super admin only"
-- (plus always your own row) — same column-conditional view pattern as
-- before, just a stricter check function.
-- Column order matters here: CREATE OR REPLACE VIEW can only append new
-- columns at the end, not insert them before existing ones — so
-- is_super_admin goes after email, not before, to keep every pre-existing
-- column in its original position.
create or replace view profiles_directory as
select
  id, name, role, avatar_url, contract_hours, created_at,
  case when id = auth.uid() or is_super_admin() then email else null end as email,
  is_super_admin
from profiles;

create or replace view training_directory as
select
  id, learner_name, identifier,
  case when is_super_admin() then email else null end as email,
  employment_start_date, compliance_item_name, compliance_item_type, status,
  due_date, allocation_date, allocated_by, collection_name, department,
  completed_date, job_title, uploaded_at
from training_records;

-- Settings (i.e. writing feature flags) becomes super-admin only — regular
-- admins can no longer change who has access to what.
drop policy "admin_write_feature_flags" on feature_flags;
create policy "super_admin_write_feature_flags" on feature_flags for all to authenticated
  using (is_super_admin()) with check (is_super_admin());

-- New per-page visibility toggles for every page that didn't already have
-- one, defaulting to enabled (today's "open to all staff" behaviour is
-- preserved until a super admin chooses to restrict one). Birthdays and
-- Stock Orders already have their own equivalent flag and aren't
-- duplicated here.
insert into feature_flags (key, enabled) values
  ('page_access_menus', true),
  ('page_access_updates', true),
  ('page_access_rota', true),
  ('page_access_checklists', true),
  ('page_access_sops', true),
  ('page_access_colleague_of_the_month', true),
  ('page_access_function_sheets', true),
  ('page_access_events', true),
  ('page_access_training', true),
  ('page_access_running_order', true);
