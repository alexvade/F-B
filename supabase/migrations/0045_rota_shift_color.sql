-- Per-shift colour, pulled from the Google Sheets rota's own cell background
-- (see docs/rota-sheet-sync.md / src/lib/google-sheet-colors.ts) — a hex
-- string like '#FFD966', or null for an uncoloured/default shift. No column
-- grant needed: rota_shifts has no per-column privacy restriction, unlike
-- profiles, so the existing table-level policy already covers this.
alter table rota_shifts add column color text;
