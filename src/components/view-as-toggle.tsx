"use client";

import { useState } from "react";
import { Eye, X } from "lucide-react";
import { useRealProfile } from "@/lib/profile-context";
import { useViewAs, type ViewAsStatus } from "@/lib/view-as-context";
import { bg, border, ink, inkSoft, navy, surface } from "@/lib/design-tokens";

const OPTIONS: { value: Exclude<ViewAsStatus, null>; label: string }[] = [
  { value: "super_admin", label: "Super admin" },
  { value: "admin", label: "Admin" },
  { value: "supervisor", label: "Supervisor" },
  { value: "team_member", label: "Team member" },
  { value: "casual", label: "Casual" },
];

// Lets a super admin preview the app as another status — purely client-side
// (see view-as-context.tsx), so it's gated on the REAL status via
// useRealProfile, never the one currently being previewed. Without that,
// previewing "Casual" would hide this control along with everything else
// gated on is_super_admin, with no way back short of clearing storage by hand.
export function ViewAsToggle({ dark }: { dark: boolean }) {
  const real = useRealProfile();
  const { status, setStatus } = useViewAs();
  const [open, setOpen] = useState(false);

  if (!real.is_super_admin) return null;

  const effective = status ?? "super_admin";
  const activeLabel = OPTIONS.find((o) => o.value === effective)?.label;

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`fixed top-4 z-20 flex items-center gap-1.5 px-3 py-2 rounded-full${dark ? " dark-mode" : ""}`}
        style={{
          right: 64,
          background: status ? navy : bg,
          color: status ? "#FFFFFF" : ink,
          border: `1px solid ${border}`,
          boxShadow: "0 2px 10px rgba(0,0,0,0.10)",
        }}
        aria-label="Preview as a different status"
      >
        <Eye size={15} />
        {status && <span className="text-xs font-medium hidden sm:inline">{activeLabel}</span>}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div
            className={`fixed top-16 z-30 rounded-2xl overflow-hidden${dark ? " dark-mode" : ""}`}
            style={{
              right: 16,
              width: "min(280px, calc(100vw - 32px))",
              background: surface,
              border: `1px solid ${border}`,
              boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
            }}
          >
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${border}` }}>
              <span className="text-sm font-semibold" style={{ color: ink }}>
                View as
              </span>
              <button onClick={() => setOpen(false)} aria-label="Close" style={{ color: inkSoft }}>
                <X size={15} />
              </button>
            </div>
            <p className="text-xs px-4 pt-3" style={{ color: inkSoft }}>
              Changes what you see, not what anyone else sees — and not what you&apos;re actually allowed to do.
            </p>
            <div className="flex flex-col p-2">
              {OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => {
                    // "Super admin" is just the real status — selecting it is the same as exiting preview.
                    setStatus(o.value === "super_admin" ? null : o.value);
                    setOpen(false);
                  }}
                  className="flex items-center justify-between text-left px-3 py-2 rounded-xl text-sm"
                  style={{
                    background: effective === o.value ? navy : "transparent",
                    color: effective === o.value ? "#FFFFFF" : ink,
                    fontWeight: effective === o.value ? 600 : 400,
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {status && (
              <div className="p-2" style={{ borderTop: `1px solid ${border}` }}>
                <button
                  onClick={() => {
                    setStatus(null);
                    setOpen(false);
                  }}
                  className="w-full text-center text-xs font-medium py-2 rounded-xl"
                  style={{ background: bg, color: ink, border: `1px solid ${border}` }}
                >
                  Exit preview
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
