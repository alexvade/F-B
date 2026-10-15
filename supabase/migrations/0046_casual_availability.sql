-- Casual staff availability — a lightweight "time off" planner: casual
-- staff mark specific dates (optionally just part of the day) they CAN'T
-- work; everything else is assumed available. Admins get a compiled,
-- rota-style view across everyone tagged casual when building the actual
-- rota. See src/app/(app)/availability/page.tsx.

-- Per-profile tag for who counts as "casual" — the rota Google Sheet
-- already has this as a "(C)" suffix on staff names, but that's discarded
-- after name-matching and never stored (see src/lib/rota-sheet.ts); this is
-- the app's own native flag instead, settable in Manage Staff.
alter table profiles add column is_casual boolean not null default false;
grant select (is_casual) on profiles to authenticated;

-- Same column-order-append-only rule as every prior addition to this view.
create or replace view profiles_directory as
select
  id, name, role, avatar_url, contract_hours, created_at,
  case when id = auth.uid() or is_super_admin() then email else null end as email,
  is_super_admin,
  task_bar,
  is_casual
from profiles;

create table casual_unavailability (
  id bigint generated always as identity primary key,
  staff_id uuid not null references profiles(id) on delete cascade,
  date date not null,
  -- Null start/end = unavailable all day; otherwise just that time range.
  start_time time,
  end_time time,
  note text,
  created_at timestamptz not null default now()
);

alter table casual_unavailability enable row level security;

create policy "read_own_or_admin_casual_unavailability" on casual_unavailability
  for select to authenticated using (staff_id = auth.uid() or is_admin());

create policy "insert_own_casual_unavailability" on casual_unavailability
  for insert to authenticated with check (staff_id = auth.uid());

create policy "update_own_casual_unavailability" on casual_unavailability
  for update to authenticated using (staff_id = auth.uid()) with check (staff_id = auth.uid());

-- Admins can delete too (e.g. once a request's been actioned / resolved by
-- conversation), but can't edit the content of someone else's entry.
create policy "delete_own_or_admin_casual_unavailability" on casual_unavailability
  for delete to authenticated using (staff_id = auth.uid() or is_admin());
