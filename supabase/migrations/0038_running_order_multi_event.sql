-- Running Order becomes one page holding many event-specific timelines
-- (one per wedding/event) instead of a single template that resets by
-- day — each running order is its own persistent list, selected via a
-- pill strip like the Rota week-picker, with a "+" to start a new one by
-- duplicating whichever list is currently open (so "Bride"/"Groom" style
-- placeholders can be renamed to the real names for that day).
create table running_orders (
  id bigint generated always as identity primary key,
  title text not null,
  event_date date,
  sort_order int not null default 0,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table running_order_items add column running_order_id bigint references running_orders(id) on delete cascade;

insert into running_orders (title, sort_order) values ('Wedding Running Order', 0);
update running_order_items set running_order_id = (select id from running_orders order by id limit 1);

alter table running_order_items alter column running_order_id set not null;

-- Completions/comments no longer reset by day — each running order is a
-- standalone list, so "done" and its comments just belong to that item
-- for good (until someone untoggles it or deletes the running order).
-- Dropping checklist_day also drops the old unique(item_id, checklist_day)
-- constraint automatically, since it can't exist without that column.
alter table running_order_completions drop column checklist_day;
alter table running_order_completions add constraint running_order_completions_item_id_key unique (item_id);

alter table running_order_comments drop column checklist_day;

alter table running_orders enable row level security;
create policy "read_all_running_orders" on running_orders for select to authenticated using (true);
create policy "write_running_orders" on running_orders for all to authenticated
  using (is_admin() or feature_enabled('running_order_edit'))
  with check (is_admin() or feature_enabled('running_order_edit'));
