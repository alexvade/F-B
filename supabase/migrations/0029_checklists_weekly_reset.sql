-- Lets a checklist reset weekly (Friday–Thursday, matching the rota week)
-- instead of daily — ticking an item stays ticked all week, not just for
-- today. Only "Bar Weekly Cleaning Checklist" uses this for now; the flag
-- is per-checklist so any other checklist can opt in later via its edit form.
alter table checklists add column weekly boolean not null default false;

update checklists set weekly = true where title = 'Bar Weekly Cleaning Checklist';
