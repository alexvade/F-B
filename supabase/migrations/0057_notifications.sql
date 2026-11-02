-- In-app Notification Centre. Mirrors every push sent via sendPushToStaff /
-- sendPushToAll (src/lib/push.ts) — same payload shape (title/body/url) —
-- so what's currently a one-shot OS-level push (birthdays, Noticeboard
-- posts/mentions, guest surveys, shout-outs, checklist reminders) also
-- lands somewhere reviewable in-app, independent of whether web push
-- itself is configured or the device accepted the OS notification.
create table notifications (
  id bigint generated always as identity primary key,
  staff_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  body text not null,
  url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_staff_id_created_at_idx on notifications (staff_id, created_at desc);

alter table notifications enable row level security;

-- No insert policy — these are only ever written server-side (the admin
-- client in push.ts bypasses RLS), same trust model as every other
-- system-generated row in this app.
create policy "read_own_notifications" on notifications for select to authenticated
  using (staff_id = auth.uid());
create policy "update_own_notifications" on notifications for update to authenticated
  using (staff_id = auth.uid()) with check (staff_id = auth.uid());
create policy "delete_own_notifications" on notifications for delete to authenticated
  using (staff_id = auth.uid());
