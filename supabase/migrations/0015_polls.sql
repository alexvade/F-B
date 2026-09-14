-- Polls on Noticeboard posts. The post's own `text` doubles as the poll
-- question; `poll_options` holds the choices. Votes live in their own table
-- (not a vote-count column) so concurrent voters don't race each other, and
-- so each voter can change their pick later (unique per post+voter, upsert).
alter table posts add column poll_options jsonb;

create table poll_votes (
  id bigint generated always as identity primary key,
  post_id bigint not null references posts(id) on delete cascade,
  voter_id uuid not null references profiles(id),
  option_index int not null,
  created_at timestamptz not null default now(),
  unique (post_id, voter_id)
);

alter table poll_votes enable row level security;

create policy "read_all_poll_votes" on poll_votes for select to authenticated using (true);
create policy "insert_own_poll_vote" on poll_votes for insert to authenticated
  with check (voter_id = auth.uid());
create policy "update_own_poll_vote" on poll_votes for update to authenticated
  using (voter_id = auth.uid()) with check (voter_id = auth.uid());
create policy "delete_own_poll_vote" on poll_votes for delete to authenticated
  using (voter_id = auth.uid());
