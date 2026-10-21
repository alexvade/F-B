import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileProvider } from "@/lib/profile-context";
import { FeatureFlagsProvider, type FeatureFlags } from "@/lib/feature-flags-context";
import { statusTierOf, effectivePageAccess } from "@/lib/page-access";
import { NavShell } from "@/components/nav-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: flagRows }] = await Promise.all([
    supabase.from("profiles_directory").select("*").eq("id", user.id).single(),
    supabase.from("feature_flags").select("key, enabled, casual_enabled, supervisor_enabled, team_member_enabled"),
  ]);

  if (!profile) {
    redirect("/login");
  }

  // Every flag resolves to the single boolean THIS viewer's status gets —
  // callers (useFeatureFlag, canSeeNavItem) don't need to know there are
  // three different switches behind it, only admins setting them do.
  const tier = statusTierOf(profile);
  const flags: FeatureFlags = Object.fromEntries((flagRows ?? []).map((f) => [f.key, effectivePageAccess(f, tier)]));

  return (
    <ProfileProvider profile={profile}>
      <FeatureFlagsProvider flags={flags}>
        <NavShell
          name={profile.name}
          isAdmin={profile.role === "admin"}
          isSuperAdmin={profile.is_super_admin}
          flags={flags}
        >
          {children}
        </NavShell>
      </FeatureFlagsProvider>
    </ProfileProvider>
  );
}
