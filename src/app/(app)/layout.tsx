import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileProvider } from "@/lib/profile-context";
import { FeatureFlagsProvider, type FeatureFlags } from "@/lib/feature-flags-context";
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
    supabase.from("feature_flags").select("key, enabled"),
  ]);

  if (!profile) {
    redirect("/login");
  }

  const flags: FeatureFlags = Object.fromEntries((flagRows ?? []).map((f) => [f.key, f.enabled]));

  return (
    <ProfileProvider profile={profile}>
      <FeatureFlagsProvider flags={flags}>
        <NavShell name={profile.name} isAdmin={profile.role === "admin"} flags={flags}>
          {children}
        </NavShell>
      </FeatureFlagsProvider>
    </ProfileProvider>
  );
}
