-- Guest satisfaction surveys (ReviewPro "Post Stay Survey" alerts),
-- forwarded by an admin from the work inbox as they arrive. There's no
-- live inbox integration — deliberately, same reasoning as Events
-- (docs/events-extraction.md) — an admin asks Claude in a chat session to
-- check for new survey emails and import them; `gmail_message_id` dedupes
-- so re-running the import never double-inserts the same response.
-- `answers` is a flexible JSONB list of {question, answer} pairs rather
-- than one column per question, since ReviewPro's question set varies
-- survey to survey and guest to guest (skipped questions, different forms).
create table guest_surveys (
  id bigint generated always as identity primary key,
  gmail_message_id text not null unique,
  survey_name text,
  guest_name text not null,
  response_url text,
  language text,
  response_date date,
  overall_score numeric,
  nps_category text,
  establishment text,
  room text,
  check_in date,
  check_out date,
  answers jsonb not null default '[]',
  received_at timestamptz,
  created_at timestamptz not null default now()
);

alter table guest_surveys enable row level security;

create policy "read_all_guest_surveys" on guest_surveys for select to authenticated using (true);
create policy "admin_write_guest_surveys" on guest_surveys for all to authenticated
  using (is_admin()) with check (is_admin());

insert into feature_flags (key, enabled) values ('page_access_guest_surveys', true);
