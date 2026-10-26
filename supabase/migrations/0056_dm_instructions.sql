-- DM Instructions: quick how-to reference guides for duty managers (e.g.
-- projector/HDMI setup, the power-cut procedure) — same spirit as SOPs,
-- except a guide can carry several reference photos (not just one) and
-- keeps the original uploaded file (PDF/DOCX) attached so the full
-- annotated source is always one tap away.
create table dm_instructions (
  id bigint generated always as identity primary key,
  title text not null,
  steps text[] not null default '{}',
  photos text[] not null default '{}',
  source_file_url text,
  source_file_name text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table dm_instructions enable row level security;

create policy "read_all_dm_instructions" on dm_instructions for select to authenticated using (true);
create policy "write_dm_instructions" on dm_instructions for all to authenticated
  using (is_admin() or feature_enabled('dm_instructions_edit'))
  with check (is_admin() or feature_enabled('dm_instructions_edit'));

-- Same pattern as every other page (0042) plus the per-status columns
-- (0053) — defaults to "everyone can view" since these are exactly the
-- guides every duty manager needs in the moment, same as SOPs; editing
-- stays admin-only until a super admin opts staff in via Settings.
insert into feature_flags (key, enabled, casual_enabled, supervisor_enabled, team_member_enabled) values
  ('page_access_dm_instructions', true, true, true, true),
  ('dm_instructions_edit', false, false, false, false);
