-- Admins can now delete a staff member's account (auth.users row, which
-- profiles.id cascades from). Most tables referencing profiles(id) never
-- specified an on-delete action, which defaults to RESTRICT — so deleting
-- anyone who has ever posted an update, added a todo, uploaded a function
-- sheet, voted in a poll, etc. would fail outright. Switch those to
-- SET NULL so the historical record stays (the app already falls back to
-- "Someone" wherever an author/added-by name is missing) instead of
-- blocking deletion or deleting unrelated rows. poll_votes.voter_id is
-- NOT NULL and keyed uniquely per (post_id, voter_id), so its votes
-- cascade-delete instead — matching nomination_votes' existing behaviour.
alter table checklist_completions drop constraint checklist_completions_completed_by_fkey,
  add constraint checklist_completions_completed_by_fkey foreign key (completed_by) references profiles(id) on delete set null;

alter table todos drop constraint todos_added_by_fkey,
  add constraint todos_added_by_fkey foreign key (added_by) references profiles(id) on delete set null;
alter table todos drop constraint todos_completed_by_fkey,
  add constraint todos_completed_by_fkey foreign key (completed_by) references profiles(id) on delete set null;

alter table posts drop constraint posts_author_id_fkey,
  add constraint posts_author_id_fkey foreign key (author_id) references profiles(id) on delete set null;

alter table comments drop constraint comments_author_id_fkey,
  add constraint comments_author_id_fkey foreign key (author_id) references profiles(id) on delete set null;

alter table nominations drop constraint nominations_nominated_by_fkey,
  add constraint nominations_nominated_by_fkey foreign key (nominated_by) references profiles(id) on delete set null;

alter table function_sheets drop constraint function_sheets_uploaded_by_fkey,
  add constraint function_sheets_uploaded_by_fkey foreign key (uploaded_by) references profiles(id) on delete set null;

alter table events drop constraint events_created_by_fkey,
  add constraint events_created_by_fkey foreign key (created_by) references profiles(id) on delete set null;

alter table stock_products drop constraint stock_products_updated_by_fkey,
  add constraint stock_products_updated_by_fkey foreign key (updated_by) references profiles(id) on delete set null;

alter table event_time_overrides drop constraint event_time_overrides_changed_by_fkey,
  add constraint event_time_overrides_changed_by_fkey foreign key (changed_by) references profiles(id) on delete set null;

alter table poll_votes drop constraint poll_votes_voter_id_fkey,
  add constraint poll_votes_voter_id_fkey foreign key (voter_id) references profiles(id) on delete cascade;
