-- Adds the rest of the "WHH Daily Overview" spreadsheet's per-day figures
-- to daily_covers, alongside the existing gih_count/breakfast_count (which
-- stay exactly as they are — the rota-sheet sync and the Rota page's manual
-- edit both still only ever touch those two columns). These new ones are
-- populated by scripts/import-daily-overview.mjs whenever that spreadsheet
-- comes in — there's no live sync for it, it's a manual daily hand-off.
alter table daily_covers
  add column rooms_in_house int,
  add column arrival_rooms int,
  add column departure_rooms int,
  add column afternoon_tea int,
  add column dinner_covers int,
  add column confirmed_events int,
  add column non_resident_dinners int,
  add column floaters int;
