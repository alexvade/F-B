-- More per-shift formatting, same spirit as 0050: italic, strikethrough,
-- font size, and a short note (shown as a small corner marker, like a
-- Google Sheets cell comment). Like text_color/bold, none of these are
-- ever written by the rota-sheet sync — only the in-app editor sets them.
alter table rota_shifts add column italic boolean not null default false;
alter table rota_shifts add column strikethrough boolean not null default false;
alter table rota_shifts add column font_size int;
alter table rota_shifts add column note text;
