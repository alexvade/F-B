-- Lets the Dashboard show when the "Guests" card's figures were last
-- refreshed — this data has no live sync, it's a manual spreadsheet
-- import (scripts/import-daily-overview.mjs), so staff have no other way
-- to tell how stale it might be.
alter table daily_covers add column updated_at timestamptz;
