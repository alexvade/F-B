-- Rich event guides (wedding/function guides) generated from uploaded
-- function sheet PDFs. `content` is a flexible JSONB blob (see
-- src/lib/event-content.ts) — null until processed.
create table events (
  id bigint generated always as identity primary key,
  title text not null,
  function_sheet_id bigint references function_sheets(id) on delete set null,
  event_date date,
  content jsonb,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table events enable row level security;

create policy "read_all_events" on events for select to authenticated using (true);
create policy "admin_write_events" on events for all to authenticated
  using (is_admin()) with check (is_admin());
