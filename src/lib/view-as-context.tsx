"use client";

import { createContext, useContext, useEffect, useState } from "react";

// Lets a super admin preview the app as another status, entirely client-side
// — no profile row is touched, so there's no risk of locking themselves out
// (Alex is currently the only super admin; a real role change that required
// super-admin access to undo would be a trap). This only changes what
// renders: RLS and every API route still check the real, signed-in account,
// so it's a UI preview, not a security sandbox. See profile-context.tsx
// (useProfile applies this) and view-as-toggle.tsx (the on/off control,
// gated on useRealProfile so it never disappears mid-preview).
export type ViewAsStatus = "super_admin" | "admin" | "supervisor" | "team_member" | "casual" | null;

const STORAGE_KEY = "team-ops-view-as";

const ViewAsContext = createContext<{ status: ViewAsStatus; setStatus: (s: ViewAsStatus) => void }>({
  status: null,
  setStatus: () => {},
});

export function ViewAsProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatusState] = useState<ViewAsStatus>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ViewAsStatus | null;
      if (stored) setStatusState(stored);
    } catch {
      // private browsing / storage blocked — preview just won't persist across reloads
    }
  }, []);

  const setStatus = (next: ViewAsStatus) => {
    setStatusState(next);
    try {
      if (next) localStorage.setItem(STORAGE_KEY, next);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  return <ViewAsContext.Provider value={{ status, setStatus }}>{children}</ViewAsContext.Provider>;
}

export function useViewAs() {
  return useContext(ViewAsContext);
}

type StatusFields = { role: string; is_casual: boolean; is_supervisor: boolean; is_super_admin: boolean };

/** Swaps a profile's status fields for the previewed status; returns it unchanged if no preview is active. */
export function applyViewAs<T extends StatusFields>(profile: T, status: ViewAsStatus): T {
  switch (status) {
    case "super_admin":
      return { ...profile, role: "admin", is_super_admin: true, is_casual: false, is_supervisor: false };
    case "admin":
      return { ...profile, role: "admin", is_super_admin: false, is_casual: false, is_supervisor: false };
    case "supervisor":
      return { ...profile, role: "staff", is_super_admin: false, is_casual: false, is_supervisor: true };
    case "team_member":
      return { ...profile, role: "staff", is_super_admin: false, is_casual: false, is_supervisor: false };
    case "casual":
      return { ...profile, role: "staff", is_super_admin: false, is_casual: true, is_supervisor: false };
    default:
      return profile;
  }
}
