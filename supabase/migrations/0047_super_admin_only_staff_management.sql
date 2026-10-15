-- Inviting staff, deleting accounts, and changing someone's role/casual
-- status move from "any admin" to super-admin only (see 0042's comment on
-- the super-admin tier) — regular admins keep every other admin
-- capability; Manage Staff itself is now hidden from them entirely (see
-- src/app/(app)/admin/staff/page.tsx and the invite/delete-staff routes).
drop policy "admin_update_profiles" on profiles;
create policy "super_admin_update_profiles" on profiles for update to authenticated
  using (is_super_admin()) with check (is_super_admin());
