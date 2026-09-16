-- Weekly training/compliance export (from the LMS), admin-only. Each
-- upload replaces the prior snapshot entirely — the export itself is a
-- current-state report (an item disappearing next week means it's no
-- longer overdue), not an append-only log, so there's nothing to merge.
-- training_uploads keeps a lightweight audit trail of when/who/how many.
create table training_uploads (
  id bigint generated always as identity primary key,
  uploaded_by uuid references profiles(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  row_count int not null
);

create table training_records (
  id bigint generated always as identity primary key,
  learner_name text not null,
  identifier text,
  email text,
  employment_start_date date,
  compliance_item_name text not null,
  compliance_item_type text,
  status text not null,
  due_date date,
  allocation_date date,
  allocated_by text,
  collection_name text,
  department text,
  completed_date date,
  job_title text,
  uploaded_at timestamptz not null default now()
);

alter table training_uploads enable row level security;
alter table training_records enable row level security;

-- Contains real employee emails, employment dates, and compliance
-- status — admin-only for both read and write, unlike most tables here.
create policy "admin_all_training_uploads" on training_uploads for all to authenticated
  using (is_admin()) with check (is_admin());
create policy "admin_all_training_records" on training_records for all to authenticated
  using (is_admin()) with check (is_admin());
