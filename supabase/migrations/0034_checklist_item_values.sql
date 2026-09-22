-- Lets a checklist item collect a typed value (e.g. an extraction time or a
-- pressure reading) instead of a plain tick — for logs like the Barista
-- section's Brew Log, where the point is recording *what* was measured, not
-- just that someone checked it. A value item still "completes" for the day
-- the same way a tick does: having a non-null value is what "done" means.
alter table checklist_items add column requires_value boolean not null default false;
alter table checklist_completions add column value text;
