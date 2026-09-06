-- Groups checklists into venue areas (Bar, Still Room, Restaurant, Vav Bar,
-- Cellars) shown as pills on the Checklists screen. Existing checklists are
-- all Bar-related, hence the default.
alter table checklists add column if not exists section text not null default 'Bar';
