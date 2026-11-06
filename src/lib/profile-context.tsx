"use client";

import { createContext, useContext } from "react";
import type { Database } from "@/lib/supabase/types";
import { useViewAs, applyViewAs } from "@/lib/view-as-context";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const ProfileContext = createContext<Profile | null>(null);

export function ProfileProvider({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  return (
    <ProfileContext.Provider value={profile}>{children}</ProfileContext.Provider>
  );
}

/** The real, signed-in profile — ignores any active "view as" preview (see view-as-context.tsx). Use this only where the true identity matters: the preview toggle's own visibility, and anything attributing a write to who's actually signed in. */
export function useRealProfile(): Profile {
  const profile = useContext(ProfileContext);
  if (!profile) {
    throw new Error("useProfile() must be used within a ProfileProvider");
  }
  return profile;
}

/** The profile to render the app as — the real one, unless a super admin is previewing another status, in which case role/is_casual/is_supervisor/is_super_admin reflect the preview instead. This is what every page and nav check should read. */
export function useProfile(): Profile {
  const real = useRealProfile();
  const { status } = useViewAs();
  return applyViewAs(real, status);
}
