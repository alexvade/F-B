-- Web push notifications — see src/lib/push.ts and docs/push-notifications.md.
-- Each browser/device a person enables notifications on gets its own
-- subscription row (the same person on two devices needs two rows); a push
-- goes out to every row for that staff_id.
create table push_subscriptions (
  id bigint generated always as identity primary key,
  staff_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

create policy "manage_own_push_subscriptions" on push_subscriptions for all to authenticated
  using (staff_id = auth.uid()) with check (staff_id = auth.uid());

-- Marks a work shift as already having had its "shift ending soon, finish
-- the checklist" push sent, so the cron job (which runs every 15 minutes)
-- doesn't re-send it on every tick for the rest of the shift. Not reset by
-- the rota sheet sync's upsert, since that only ever writes the columns
-- it knows about (staff_id/date/status/start_time/end_time/color).
alter table rota_shifts add column checklist_reminder_sent_at timestamptz;
