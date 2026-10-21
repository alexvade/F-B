// Page-access flags (see 0053_page_access_by_status.sql) let a super admin
// grant Casual/Supervisor/Team member each a different set of pages,
// instead of one "staff can" switch covering every non-admin status.
// Admins and super admins always pass before any of this is consulted.
export type StatusTier = "casual" | "supervisor" | "team_member";

export function statusTierOf(profile: { is_casual: boolean; is_supervisor: boolean }): StatusTier {
  if (profile.is_casual) return "casual";
  if (profile.is_supervisor) return "supervisor";
  return "team_member";
}

export type PageAccessRow = {
  casual_enabled: boolean;
  supervisor_enabled: boolean;
  team_member_enabled: boolean;
};

// The single effective boolean a non-admin viewer gets for one flag —
// what every `useFeatureFlag`/direct page-access check ultimately reads.
export function effectivePageAccess(row: PageAccessRow | null | undefined, tier: StatusTier): boolean {
  if (!row) return false;
  if (tier === "casual") return row.casual_enabled;
  if (tier === "supervisor") return row.supervisor_enabled;
  return row.team_member_enabled;
}
