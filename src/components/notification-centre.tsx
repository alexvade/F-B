"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
import { relativeTime } from "@/lib/relative-time";
import { bg, border, ink, inkSoft, navy, navyText, orange, orangeSoft, surface } from "@/lib/design-tokens";

const LOAD_LIMIT = 30;

type Notification = {
  id: number;
  title: string;
  body: string;
  url: string | null;
  read_at: string | null;
  created_at: string;
};

export function NotificationCentre({ dark }: { dark: boolean }) {
  const profile = useProfile();
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("staff_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(LOAD_LIMIT);
    setItems(data ?? []);
  }, [supabase, profile.id]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`notifications-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `staff_id=eq.${profile.id}` },
        load
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, supabase, profile.id]);

  const unreadCount = items.filter((n) => !n.read_at).length;

  const markRead = async (id: number) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n)));
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
  };

  const markAllRead = async () => {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })));
    await supabase.from("notifications").update({ read_at: now }).eq("staff_id", profile.id).is("read_at", null);
  };

  const openNotification = async (n: Notification) => {
    if (!n.read_at) await markRead(n.id);
    setOpen(false);
    if (n.url) router.push(n.url);
  };

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`fixed top-4 right-4 z-20 p-2.5 rounded-full${dark ? " dark-mode" : ""}`}
        style={{ background: bg, border: `1px solid ${border}`, boxShadow: "0 2px 10px rgba(0,0,0,0.10)" }}
        aria-label="Notifications"
      >
        <Bell size={18} style={{ color: orange }} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 flex items-center justify-center rounded-full text-[10px] font-semibold"
            style={{ minWidth: 16, height: 16, padding: "0 3px", background: navy, color: "#FFFFFF" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div
            className={`fixed top-16 right-4 z-30 rounded-2xl overflow-hidden${dark ? " dark-mode" : ""}`}
            style={{
              width: "min(360px, calc(100vw - 32px))",
              maxHeight: "70vh",
              background: surface,
              border: `1px solid ${border}`,
              boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
            }}
          >
            <div
              className="flex items-center justify-between px-4 py-3 shrink-0"
              style={{ borderBottom: `1px solid ${border}` }}
            >
              <span className="text-sm font-semibold" style={{ color: navyText }}>
                Notifications
              </span>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-xs font-medium" style={{ color: orange }}>
                    Mark all read
                  </button>
                )}
                <button onClick={() => setOpen(false)} aria-label="Close" style={{ color: inkSoft }}>
                  <X size={15} />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: "calc(70vh - 48px)" }}>
              {items.length === 0 ? (
                <p className="text-sm p-4" style={{ color: inkSoft }}>
                  No notifications yet.
                </p>
              ) : (
                items.map((n, i) => (
                  <button
                    key={n.id}
                    onClick={() => openNotification(n)}
                    className="flex items-start gap-2.5 w-full text-left px-4 py-3"
                    style={{
                      background: n.read_at ? "transparent" : orangeSoft,
                      borderBottom: i < items.length - 1 ? `1px solid ${border}` : "none",
                    }}
                  >
                    <span
                      className="shrink-0 rounded-full mt-1.5"
                      style={{ width: 6, height: 6, background: n.read_at ? "transparent" : orange }}
                    />
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-sm"
                        style={{ color: ink, fontWeight: n.read_at ? 400 : 600 }}
                      >
                        {n.title}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: inkSoft }}>
                        {n.body}
                      </div>
                      <div className="text-[11px] mt-1" style={{ color: inkSoft }}>
                        {relativeTime(n.created_at)}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
