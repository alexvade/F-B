create table birthdays (
  id bigint generated always as identity primary key,
  name text not null,
  day int not null check (day between 1 and 31),
  month int not null check (month between 1 and 12),
  created_at timestamptz not null default now()
);

alter table birthdays enable row level security;

create policy "read_all_birthdays" on birthdays for select to authenticated using (true);
create policy "admin_write_birthdays" on birthdays for all to authenticated
  using (is_admin()) with check (is_admin());
