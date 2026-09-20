-- Lets admins pin a cocktail/mocktail as a "Most Popular" pick, shown at the
-- top of the Cocktails page. Writing it is already covered by the existing
-- admin_write_cocktails policy (0001_init.sql, `for all` using is_admin()).
alter table cocktails add column pinned boolean not null default false;
