-- Lets a checklist completion show a name that isn't a real staff account —
-- used for historical/demo data where `completed_by` has no matching
-- profile. The grid report prefers this over the joined profile name when
-- it's set; the live Checklists page is unaffected (it only ever reads
-- today/this week, never historical rows like these).
alter table checklist_completions add column completed_by_name text;
