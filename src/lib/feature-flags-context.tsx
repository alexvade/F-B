"use client";

import { createContext, useContext } from "react";

export type FeatureFlags = Record<string, boolean>;

const FeatureFlagsContext = createContext<FeatureFlags>({});

export function FeatureFlagsProvider({
  flags,
  children,
}: {
  flags: FeatureFlags;
  children: React.ReactNode;
}) {
  return <FeatureFlagsContext.Provider value={flags}>{children}</FeatureFlagsContext.Provider>;
}

// Reads a per-role feature toggle set on the Settings page. Admins already
// have access to everything these flags gate, regardless of this value.
export function useFeatureFlag(key: string): boolean {
  return useContext(FeatureFlagsContext)[key] ?? false;
}
