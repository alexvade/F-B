"use client";

import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { usePushNotifications } from "@/lib/use-push-notifications";
import { bg, border, ink, inkSoft, navy, surface } from "@/lib/design-tokens";

const DISMISS_KEY = "notif-prompt-dismissed";

// A one-time nudge on app open, separate from the manual toggle in
// Settings — browsers only honour Notification.requestPermission() from a
// real click, so this still needs a button; it just puts that button in
// front of people instead of waiting for them to find Settings themselves.
// Shown once per browser: only while permission is still unasked
// (Notification.permission === "default") and not previously dismissed.
export function NotificationPrompt({ dark }: { dark: boolean }) {
  const { supported, ready, enabled, busy, error, enable } = usePushNotifications();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ready || !supported || enabled) return;
    if (typeof Notification !== "undefined" && Notification.permission !== "default") return;
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      // Private browsing etc. — just show it; worst case it asks again next visit.
    }
    setVisible(true);
  }, [ready, supported, enabled]);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  };

  const handleEnable = async () => {
    const ok = await enable();
    if (ok) setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className={`fixed left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-40 rounded-2xl p-4${dark ? " dark-mode" : ""}`}
      style={{
        bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))",
        background: surface,
        border: `1px solid ${border}`,
        boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
      }}
      role="dialog"
      aria-label="Turn on notifications"
    >
      <div className="flex items-start gap-3">
        <BellRing size={18} style={{ color: ink, flexShrink: 0, marginTop: 2 }} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium" style={{ color: ink }}>
            Turn on notifications
          </div>
          <p className="text-xs mt-1" style={{ color: inkSoft }}>
            Get notified about rota changes, Noticeboard posts, and shift reminders.
          </p>
          {error && (
            <p className="text-xs mt-1.5" style={{ color: "#B3261E" }}>
              {error}
            </p>
          )}
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleEnable}
              disabled={busy}
              className="text-xs font-medium px-3.5 py-1.5 rounded-2xl disabled:opacity-60"
              style={{ background: navy, color: "#FFFFFF" }}
            >
              {busy ? "Working…" : "Turn on"}
            </button>
            <button
              onClick={dismiss}
              disabled={busy}
              className="text-xs font-medium px-3.5 py-1.5 rounded-2xl disabled:opacity-60"
              style={{ background: bg, color: ink, border: `1px solid ${border}` }}
            >
              Not now
            </button>
          </div>
        </div>
        <button onClick={dismiss} aria-label="Dismiss" className="shrink-0" style={{ color: inkSoft }}>
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
