-- Bottles in the cellar from the latest wine stock take, so the Wines page
-- can show what's out of stock. Null = not on the stock sheet / unknown
-- (shown as no stock badge, rather than guessing). stock_checked_on is the
-- date of the stock sheet the count came from.
alter table wines add column bottles integer;
alter table wines add column stock_checked_on date;
