-- Decouple rota_shifts from requiring a linked auth account: the Google
-- Sheet is the source of truth for who's on the rota, and staff accounts
-- lag behind (created only once someone's actually invited). staff_id stays
-- as an optional link (useful once someone has an account); staff_name is
-- now the required, stable identity used for display and upserts.

do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'rota_shifts'::regclass
    and contype = 'u'
    and (
      select array_agg(attname::text order by attnum)
      from pg_attribute
      where attrelid = conrelid and attnum = any(conkey)
    ) = array['staff_id', 'date']::text[];
  if cname is not null then
    execute format('alter table rota_shifts drop constraint %I', cname);
  end if;
end $$;

alter table rota_shifts alter column staff_id drop not null;
alter table rota_shifts add column if not exists staff_name text;

update rota_shifts r
set staff_name = p.name
from profiles p
where p.id = r.staff_id and r.staff_name is null;

alter table rota_shifts alter column staff_name set not null;
alter table rota_shifts add constraint rota_shifts_staff_name_date_key unique (staff_name, date);
