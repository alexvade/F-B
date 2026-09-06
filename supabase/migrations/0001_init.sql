-- Team Ops App — initial schema
-- Run against a fresh Supabase project (SQL Editor, or `supabase db push`).

-- ---------------------------------------------------------------------
-- checklist_day(): the "5am–5am day" used everywhere a checklist/todo
-- needs to know which business-day it belongs to. Centralising this in
-- Postgres means every client (and every timezone the app is opened
-- from) agrees on the same boundary — no cron job resets anything, rows
-- are just tagged with the day they belong to.
-- ---------------------------------------------------------------------
create or replace function checklist_day(ts timestamptz default now())
returns date
language sql stable
as $$
  select ((ts at time zone 'Europe/London') - interval '5 hours')::date;
$$;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text,
  role text not null default 'staff' check (role in ('admin', 'staff')),
  avatar_url text,
  contract_hours int,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever an admin invites a new auth user.
-- Expects `raw_user_meta_data` to carry `name`, `role`, `contract_hours`.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role, contract_hours)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'staff'),
    nullif(new.raw_user_meta_data->>'contract_hours', '')::int
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------
-- Rota
-- ---------------------------------------------------------------------
create table rota_shifts (
  id bigint generated always as identity primary key,
  staff_id uuid not null references profiles(id) on delete cascade,
  date date not null,
  status text not null check (status in ('work', 'off', 'holiday')),
  start_time time,
  end_time time,
  unique (staff_id, date)
);

create table daily_covers (
  date date primary key,
  gih_count int,
  breakfast_count int
);

create table daily_events (
  id bigint generated always as identity primary key,
  date date not null,
  room text,
  title text not null,
  details text
);

-- ---------------------------------------------------------------------
-- Checklists
-- ---------------------------------------------------------------------
create table checklists (
  id bigint generated always as identity primary key,
  title text not null,
  sort_order int not null default 0
);

create table checklist_items (
  id bigint generated always as identity primary key,
  checklist_id bigint not null references checklists(id) on delete cascade,
  text text not null,
  sort_order int not null default 0
);

create table checklist_completions (
  id bigint generated always as identity primary key,
  item_id bigint not null references checklist_items(id) on delete cascade,
  checklist_day date not null,
  completed_by uuid references profiles(id),
  completed_at timestamptz not null default now(),
  unique (item_id, checklist_day)
);

-- ---------------------------------------------------------------------
-- To-dos (dashboard "To do today" / "Outstanding")
-- ---------------------------------------------------------------------
create table todos (
  id bigint generated always as identity primary key,
  text text not null,
  added_by uuid references profiles(id),
  checklist_day date not null,
  done boolean not null default false,
  completed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Updates feed
-- ---------------------------------------------------------------------
create table posts (
  id bigint generated always as identity primary key,
  author_id uuid references profiles(id),
  text text,
  photo_url text,
  file_url text,
  file_name text,
  created_at timestamptz not null default now()
);

create table comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references posts(id) on delete cascade,
  author_id uuid references profiles(id),
  text text,
  photo_url text,
  file_url text,
  file_name text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- SOPs
-- ---------------------------------------------------------------------
create table sops (
  id bigint generated always as identity primary key,
  category text not null,
  title text not null,
  steps text[] not null default '{}',
  photo_url text,
  sort_order int not null default 0
);

-- ---------------------------------------------------------------------
-- Colleague of the Month
-- ---------------------------------------------------------------------
create table nominations (
  id bigint generated always as identity primary key,
  nominee_name text not null,
  reason text not null,
  nominated_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table nomination_votes (
  nomination_id bigint not null references nominations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  primary key (nomination_id, user_id)
);

-- ---------------------------------------------------------------------
-- Drinks
-- ---------------------------------------------------------------------
create table cocktails (
  id bigint generated always as identity primary key,
  name text not null,
  category text not null,
  glass_shape text,
  colour text,
  garnish text,
  ingredients text[] not null default '{}',
  method text[] not null default '{}',
  sort_order int not null default 0
);

create table wines (
  id bigint generated always as identity primary key,
  section text not null,
  name text not null,
  region text,
  vintage text,
  price text,
  glass_note text,
  tasting_note text,
  sort_order int not null default 0
);

-- ---------------------------------------------------------------------
-- Function sheets
-- ---------------------------------------------------------------------
create table function_sheets (
  id bigint generated always as identity primary key,
  title text not null,
  file_url text not null,
  file_name text,
  uploaded_by uuid references profiles(id),
  uploaded_at timestamptz not null default now()
);

-- =======================================================================
-- Row Level Security
-- =======================================================================
alter table profiles enable row level security;
alter table rota_shifts enable row level security;
alter table daily_covers enable row level security;
alter table daily_events enable row level security;
alter table checklists enable row level security;
alter table checklist_items enable row level security;
alter table checklist_completions enable row level security;
alter table todos enable row level security;
alter table posts enable row level security;
alter table comments enable row level security;
alter table sops enable row level security;
alter table nominations enable row level security;
alter table nomination_votes enable row level security;
alter table cocktails enable row level security;
alter table wines enable row level security;
alter table function_sheets enable row level security;

create or replace function is_admin()
returns boolean
language sql stable
security definer set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- Everyone signed in can read everything.
create policy "read_all_profiles" on profiles for select to authenticated using (true);
create policy "read_all_rota_shifts" on rota_shifts for select to authenticated using (true);
create policy "read_all_daily_covers" on daily_covers for select to authenticated using (true);
create policy "read_all_daily_events" on daily_events for select to authenticated using (true);
create policy "read_all_checklists" on checklists for select to authenticated using (true);
create policy "read_all_checklist_items" on checklist_items for select to authenticated using (true);
create policy "read_all_checklist_completions" on checklist_completions for select to authenticated using (true);
create policy "read_all_todos" on todos for select to authenticated using (true);
create policy "read_all_posts" on posts for select to authenticated using (true);
create policy "read_all_comments" on comments for select to authenticated using (true);
create policy "read_all_sops" on sops for select to authenticated using (true);
create policy "read_all_nominations" on nominations for select to authenticated using (true);
create policy "read_all_nomination_votes" on nomination_votes for select to authenticated using (true);
create policy "read_all_cocktails" on cocktails for select to authenticated using (true);
create policy "read_all_wines" on wines for select to authenticated using (true);
create policy "read_all_function_sheets" on function_sheets for select to authenticated using (true);

-- Own-profile update (name/avatar only in the app layer; role changes are admin-only in practice
-- since the UI never exposes it to staff, but we still block it here for defense in depth).
create policy "update_own_profile" on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and role = (select role from profiles where id = auth.uid()));

-- Admins can change anyone's role/contract hours (e.g. promoting a manager).
create policy "admin_update_profiles" on profiles for update to authenticated
  using (is_admin()) with check (is_admin());

-- Staff-writable content: users write their own rows.
create policy "insert_own_todo" on todos for insert to authenticated with check (added_by = auth.uid());
create policy "update_todo_toggle" on todos for update to authenticated using (true) with check (true);

create policy "insert_own_checklist_completion" on checklist_completions for insert to authenticated
  with check (completed_by = auth.uid());
create policy "delete_own_checklist_completion" on checklist_completions for delete to authenticated
  using (completed_by = auth.uid());

create policy "insert_own_post" on posts for insert to authenticated with check (author_id = auth.uid());
create policy "insert_own_comment" on comments for insert to authenticated with check (author_id = auth.uid());

create policy "insert_own_nomination" on nominations for insert to authenticated with check (nominated_by = auth.uid());
create policy "insert_own_vote" on nomination_votes for insert to authenticated with check (user_id = auth.uid());
create policy "delete_own_vote" on nomination_votes for delete to authenticated using (user_id = auth.uid());

-- Admin-only content management.
create policy "admin_write_rota_shifts" on rota_shifts for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin_write_daily_covers" on daily_covers for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin_write_daily_events" on daily_events for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin_write_checklists" on checklists for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin_write_checklist_items" on checklist_items for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin_write_sops" on sops for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin_write_cocktails" on cocktails for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin_write_wines" on wines for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin_write_function_sheets" on function_sheets for all to authenticated using (is_admin()) with check (is_admin());
