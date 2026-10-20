-- Supports in-app rota editing: a text colour and bold flag alongside the
-- existing background `color`, plus a timestamp marking a shift as
-- manually edited in the app (as opposed to synced from the Google Sheet).
-- The rota-sheet sync route uses `manually_edited_at` to skip overwriting
-- a shift that was recently hand-edited in the app, so the Sheet (still
-- the long-run source of truth) doesn't silently clobber a fresh in-app
-- change — see ROTA_PROTECT_WINDOW_HOURS in
-- src/app/api/sync/rota-sheet/route.ts. No column grant needed: same as
-- `color` in 0045, rota_shifts has no per-column privacy restriction.
alter table rota_shifts add column text_color text;
alter table rota_shifts add column bold boolean not null default false;
alter table rota_shifts add column manually_edited_at timestamptz;
