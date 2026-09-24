-- A standalone "Running Order" page: an ordered timeline of moments for an
-- event (ceremony, speeches, courses, first dance, ...), separate from
-- Checklists because each moment can carry a photo/comment alongside its
-- timestamp — Checklists' plain tick doesn't need that. Completions reuse
-- the same "checklist day" (5am-5am) boundary as Checklists, so the same
-- running order resets fresh for the next event day.
create table running_order_items (
  id bigint generated always as identity primary key,
  text text not null,
  sort_order int not null default 0
);

create table running_order_completions (
  id bigint generated always as identity primary key,
  item_id bigint not null references running_order_items(id) on delete cascade,
  checklist_day date not null,
  completed_by uuid references profiles(id),
  completed_at timestamptz not null default now(),
  photo_url text,
  comment text,
  unique (item_id, checklist_day)
);

alter table running_order_items enable row level security;
alter table running_order_completions enable row level security;

create policy "read_all_running_order_items" on running_order_items for select to authenticated using (true);
create policy "read_all_running_order_completions" on running_order_completions for select to authenticated using (true);

-- Adding/reordering/removing moments themselves is gated like every other
-- "structure" edit in the app (admin, or a staff member the flag covers).
create policy "write_running_order_items" on running_order_items for all to authenticated
  using (is_admin() or feature_enabled('running_order_edit'))
  with check (is_admin() or feature_enabled('running_order_edit'));

-- Marking a moment complete (with its timestamp/photo/comment) is open to
-- everyone, same as ticking a checklist item.
create policy "insert_own_running_order_completion" on running_order_completions for insert to authenticated
  with check (completed_by = auth.uid());
create policy "delete_own_running_order_completion" on running_order_completions for delete to authenticated
  using (completed_by = auth.uid());
create policy "admin_delete_any_running_order_completion" on running_order_completions for delete to authenticated
  using (is_admin());

insert into feature_flags (key, enabled) values ('running_order_edit', false);
