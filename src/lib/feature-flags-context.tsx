"use client";

import { createContext, useContext, useMemo } from "react";
import { useProfile } from "@/lib/profile-context";
import { statusTierOf, effectivePageAccess, type PageAccessRow } from "@/lib/page-access";

export type FeatureFlags = Record<string, boolean>;
export type FlagRow = PageAccessRow & { key: string };

const FeatureFlagsContext = createContext<FeatureFlags>({});

// Resolves each row against the CURRENT viewer's tier (profile.is_casual /
// is_supervisor), read fresh on every render — not pre-resolved server-side
// — so a super admin's "view as" preview (see view-as-context.tsx) changes
// which flags are on/off immediately, the same as a real casual/supervisor
// account would see.
export function FeatureFlagsProvider({
  flagRows,
  children,
}: {
  flagRows: FlagRow[];
  children: React.ReactNode;
}) {
  const profile = useProfile();
  const tier = statusTierOf(profile);
  const flags = useMemo(
    () => Object.fromEntries(flagRows.map((row) => [row.key, effectivePageAccess(row, tier)])),
    [flagRows, tier]
  );
  return <FeatureFlagsContext.Provider value={flags}>{children}</FeatureFlagsContext.Provider>;
}

// Reads a per-role feature toggle set on the Settings page. Admins already
// have access to everything these flags gate, regardless of this value.
export function useFeatureFlag(key: string): boolean {
  return useContext(FeatureFlagsContext)[key] ?? false;
}

/** The whole resolved flag set — for call sites that need to look a key up dynamically (e.g. nav filtering by item.staffFlag) rather than a single known key. */
export function useFeatureFlags(): FeatureFlags {
  return useContext(FeatureFlagsContext);
}
