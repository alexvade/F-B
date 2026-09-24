-- Comments on a Running Order moment turn out to need multiple people
-- weighing in (not just the one person who ticked it off), so they move
-- out of running_order_completions into their own table — same shape as
-- the Noticeboard's `comments`, scoped by checklist_day so a comment left
-- during one event doesn't linger into the next one reusing this list.
alter table running_order_completions drop column comment;
alter table running_order_completions drop column photo_url;

create table running_order_comments (
  id bigint generated always as identity primary key,
  item_id bigint not null references running_order_items(id) on delete cascade,
  checklist_day date not null,
  author_id uuid references profiles(id),
  text text,
  photo_url text,
  created_at timestamptz not null default now()
);

alter table running_order_comments enable row level security;

create policy "read_all_running_order_comments" on running_order_comments for select to authenticated using (true);
create policy "insert_own_running_order_comment" on running_order_comments for insert to authenticated
  with check (author_id = auth.uid());
create policy "delete_own_running_order_comment" on running_order_comments for delete to authenticated
  using (author_id = auth.uid());
create policy "admin_delete_any_running_order_comment" on running_order_comments for delete to authenticated
  using (is_admin());
