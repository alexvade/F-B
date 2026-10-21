-- Splits the single "staff can" switch on each page-access flag into three
-- independent ones — Casual / Supervisor / Team member — so a super admin
-- can grant different statuses access to different pages (see Manage
-- Staff's status picker, 0052_supervisor_status.sql). Admins/super admins
-- are unaffected either way, same as before.
--
-- `enabled` keeps its existing meaning for the *other* feature_flags rows
-- (checklists_edit, sops_edit, etc. — write-permission toggles, not page
-- visibility, out of scope here) and now doubles as "at least one non-admin
-- status can see this page", kept in sync by the app whenever any of the
-- three columns below changes — so nothing that reads `enabled` elsewhere
-- (e.g. stock_orders_edit's RLS policy) needs to change.
alter table feature_flags add column casual_enabled boolean not null default false;
alter table feature_flags add column supervisor_enabled boolean not null default false;
alter table feature_flags add column team_member_enabled boolean not null default false;

-- Backfill: preserve today's behaviour exactly — a flag that was already
-- "staff can" stays on for all three statuses until a super admin narrows
-- it down; one that was "admins only" stays off for all three.
update feature_flags set
  casual_enabled = enabled,
  supervisor_enabled = enabled,
  team_member_enabled = enabled;
