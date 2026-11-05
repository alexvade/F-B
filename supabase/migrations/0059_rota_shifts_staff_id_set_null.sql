-- rota_shifts.staff_id has had ON DELETE CASCADE since 0001_init.sql, from
-- back when staff_id was the required identity on the row. 0002's own
-- comment says the Google Sheet is now the source of truth and staff_name
-- is the stable identity — staff_id was made nullable and demoted to "an
-- optional link, useful once someone has an account" — but the FK's delete
-- rule was never updated to match, so deleting a staff account has been
-- silently hard-deleting that person's entire rota history ever since,
-- rather than just detaching the account link the way every other
-- "attribution" FK on profiles(id) behaves (SET NULL).
--
-- Confirmed as the cause of Joel Tanner's missing shifts: his account was
-- deleted and re-invited under a new id on 2026-11-05 (auth logs,
-- 13:02:25Z delete / 13:02:42Z re-invite), cascading away every
-- rota_shifts row tied to the old staff_id. Those specific rows aren't
-- recoverable from the database (hard delete, no soft-delete trail) — the
-- fix is for the Google Sheet sync to re-populate them against his new
-- account, which it will do on its next run since staff_name (not
-- staff_id) is what the sync actually keys on.
alter table rota_shifts drop constraint rota_shifts_staff_id_fkey;
alter table rota_shifts add constraint rota_shifts_staff_id_fkey
  foreign key (staff_id) references profiles(id) on delete set null;
