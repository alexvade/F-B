import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileProvider } from "@/lib/profile-context";
import { FeatureFlagsProvider } from "@/lib/feature-flags-context";
import { ViewAsProvider } from "@/lib/view-as-context";
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

  // Flags are resolved client-side now (see FeatureFlagsProvider), not here —
  // a super admin's "view as" preview (view-as-context.tsx) needs the
  // resolution to react to the previewed status, not the real one baked in
  // at this server render.
  return (
    <ViewAsProvider>
      <ProfileProvider profile={profile}>
        <FeatureFlagsProvider flagRows={flagRows ?? []}>
          <NavShell name={profile.name}>{children}</NavShell>
        </FeatureFlagsProvider>
      </ProfileProvider>
    </ViewAsProvider>
  );
}
