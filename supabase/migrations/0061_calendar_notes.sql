-- Dashboard calendar's "Team notes" — a free-text note anyone can leave on
-- any date, shared across the whole team (not a personal reminder). Same
-- staff-writable + admin-delete shape as todos.
create table calendar_notes (
  id bigint generated always as identity primary key,
  note_date date not null,
  text text not null,
  added_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index calendar_notes_date_idx on calendar_notes (note_date);

alter table calendar_notes enable row level security;

create policy "read_all_calendar_notes" on calendar_notes for select to authenticated using (true);
create policy "insert_own_calendar_note" on calendar_notes for insert to authenticated with check (added_by = auth.uid());
create policy "delete_own_or_admin_calendar_note" on calendar_notes for delete to authenticated
  using (added_by = auth.uid() or is_admin());
