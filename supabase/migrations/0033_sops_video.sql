-- Lets an SOP carry a training video (e.g. the Barista tab's milk-steaming
-- and latte-art clips) alongside, or instead of, its photo.
alter table sops add column video_url text;
