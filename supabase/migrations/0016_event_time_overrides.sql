-- Append-only log of time changes made to a function sheet's timeline
-- items from the Dashboard's "Events today" tile. Any staff member can
-- correct a time (e.g. an event running late); each edit inserts a new row
-- rather than updating one, so the full history (who/when/from/to) is
-- always intact — the "original" time for an item is the earliest row's
-- previous_time, the "current" time is the latest row's new_time.
--
-- Timeline items have no stable id (they live inside events.content jsonb),
-- so an item is identified by (event_id, day_date, item_what) — the day's
-- date label plus the item's title, which is unique within a single day's
-- agenda in practice.
create table event_time_overrides (
  id bigint generated always as identity primary key,
  event_id bigint not null references events(id) on delete cascade,
  day_date text not null,
  item_what text not null,
  previous_time text not null,
  new_time text not null,
  changed_by uuid references profiles(id),
  changed_at timestamptz not null default now()
);

alter table event_time_overrides enable row level security;

create policy "read_all_event_time_overrides" on event_time_overrides for select to authenticated using (true);
create policy "insert_own_event_time_override" on event_time_overrides for insert to authenticated
  with check (changed_by = auth.uid());
