-- Lets admins pin a noticeboard post so it stays at the top of the feed.
alter table posts add column pinned boolean not null default false;

create policy "admin_update_post" on posts for update to authenticated
  using (is_admin())
  with check (is_admin());
