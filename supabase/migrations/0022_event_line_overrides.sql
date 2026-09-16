-- Generalises 0016's time-only override log to cover the whole agenda
-- line (time, title, location) — the Dashboard's "Events today" edit
-- button now edits all three together. Keyed by item_index (the item's
-- position within that day's events array) rather than item_what, since
-- item_what ("Set up / access") is now itself an editable field and can
-- no longer double as a stable identifier.
drop table if exists event_time_overrides;

create table event_line_overrides (
  id bigint generated always as identity primary key,
  event_id bigint not null references events(id) on delete cascade,
  day_date text not null,
  item_index int not null,
  field text not null check (field in ('time', 'what', 'where')),
  previous_value text not null,
  new_value text not null,
  changed_by uuid references profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);

alter table event_line_overrides enable row level security;

create policy "read_all_event_line_overrides" on event_line_overrides for select to authenticated using (true);
create policy "insert_own_event_line_override" on event_line_overrides for insert to authenticated
  with check (changed_by = auth.uid());
