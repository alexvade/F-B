-- The cellar code from the bin labels / wine stock sheet (e.g. "101"),
-- shown on the Wines page so staff can find the bottle. Null = no code
-- assigned (mostly wines no longer in the cellar).
alter table wines add column cellar_code text;
