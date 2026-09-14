-- Deliberately not part of the Google Sheet sync payload (see
-- src/app/api/sync/stock-sheet/route.ts), same as `quantity` — so a
-- resync from the sheet never clobbers this.
alter table stock_products add column delisted boolean not null default false;
