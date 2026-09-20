-- Training becomes viewable by all staff — everything except each
-- learner's email, which stays admin-only via the same column-conditional
-- view pattern as profiles_directory (0019_profiles_email_privacy.sql).
-- Uploading/replacing the data stays admin-only, unchanged, via
-- training_records' existing admin_all_training_records policy (0021).
create view training_directory as
select
  id, learner_name, identifier,
  case when is_admin() then email else null end as email,
  employment_start_date, compliance_item_name, compliance_item_type, status,
  due_date, allocation_date, allocated_by, collection_name, department,
  completed_date, job_title, uploaded_at
from training_records;

grant select on training_directory to authenticated;

-- The "last updated by X, N rows" line is safe for everyone to see.
create policy "read_all_training_uploads" on training_uploads for select to authenticated using (true);
