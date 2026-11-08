"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Palette, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRealProfile } from "@/lib/profile-context";
import { THEME_SCHEMES } from "@/lib/theme-schemes";
import { bg, border, ink, inkSoft, navy, surface } from "@/lib/design-tokens";

// Owner-only colour-scheme picker, same gating pattern as ViewAsToggle:
// the REAL super admin status, never a "view as" preview. Picking a scheme
// writes profiles.theme_scheme (synced to the account, so it follows across
// devices) — NavShell reads it back and sets <html data-scheme>, which is
// what every design token in design-tokens.ts actually resolves through.
// Nobody else's view ever changes; there's exactly one super admin account.
export function ThemeSchemeToggle({ dark }: { dark: boolean }) {
  const real = useRealProfile();
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!real.is_super_admin) return null;

  const apply = async (key: string | null) => {
    if (saving || key === real.theme_scheme) {
      setOpen(false);
      return;
    }
    setSaving(true);
    await supabase.from("profiles").update({ theme_scheme: key }).eq("id", real.id);
    setSaving(false);
    setOpen(false);
    router.refresh();
  };

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`fixed top-4 z-20 p-2.5 rounded-full${dark ? " dark-mode" : ""}`}
        style={{ right: 112, background: bg, border: `1px solid ${border}`, boxShadow: "0 2px 10px rgba(0,0,0,0.10)" }}
        aria-label="Colour scheme"
      >
        <Palette size={18} style={{ color: real.theme_scheme ? navy : ink }} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div
            className={`fixed top-16 z-30 rounded-2xl overflow-hidden${dark ? " dark-mode" : ""}`}
            style={{
              right: 16,
              width: "min(300px, calc(100vw - 32px))",
              background: surface,
              border: `1px solid ${border}`,
              boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
            }}
          >
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${border}` }}>
              <span className="text-sm font-semibold" style={{ color: ink }}>
                Colour scheme
              </span>
              <button onClick={() => setOpen(false)} aria-label="Close" style={{ color: inkSoft }}>
                <X size={15} />
              </button>
            </div>
            <p className="text-xs px-4 pt-3" style={{ color: inkSoft }}>
              Only visible to you — nobody else&apos;s view changes.
            </p>
            <div className="flex flex-col p-2 gap-1">
              <SchemeRow
                active={!real.theme_scheme}
                disabled={saving}
                onClick={() => apply(null)}
                label="Default"
                swatches={["#FFFFFF", "#000000"]}
              />
              {THEME_SCHEMES.map((scheme) => (
                <SchemeRow
                  key={scheme.key}
                  active={real.theme_scheme === scheme.key}
                  disabled={saving}
                  onClick={() => apply(scheme.key)}
                  label={scheme.name}
                  swatches={scheme.swatches.map((s) => s.hex)}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function SchemeRow({
  active,
  disabled,
  onClick,
  label,
  swatches,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  label: string;
  swatches: string[];
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-3 text-left px-3 py-2.5 rounded-xl text-sm disabled:opacity-50"
      style={{
        background: active ? navy : "transparent",
        color: active ? "#FFFFFF" : ink,
        fontWeight: active ? 600 : 400,
      }}
    >
      <span
        className="flex shrink-0 rounded-full overflow-hidden"
        style={{ width: 20, height: 20, border: "1px solid rgba(0,0,0,0.2)" }}
      >
        {swatches.map((hex, i) => (
          <span key={i} style={{ flex: 1, background: hex }} />
        ))}
      </span>
      {label}
    </button>
  );
}
