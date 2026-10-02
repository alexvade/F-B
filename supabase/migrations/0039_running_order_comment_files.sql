-- Lets a Running Order comment carry a general file attachment (a PDF,
-- a document, a photo picked from the library) alongside or instead of
-- the existing quick-snap photo — same shape as the Noticeboard's
-- `comments.file_url`/`file_name`.
alter table running_order_comments add column file_url text;
alter table running_order_comments add column file_name text;
