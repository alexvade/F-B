"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
import { useFeatureFlag } from "@/lib/feature-flags-context";
import { Section } from "@/components/section";
import { bg, border, ink, inkSoft, navy } from "@/lib/design-tokens";
import { uploadAttachment, getAttachmentUrl, deleteAttachment } from "@/lib/storage";
import { NAV_ITEMS, DEFAULT_ISLAND_LEFT, DEFAULT_ISLAND_RIGHT } from "@/components/nav-shell";
import type { StatusTier } from "@/lib/page-access";
import { User, Users, ChevronRight } from "lucide-react";

type Flag = { key: string; label: string; description: string };
type FlagRow = { enabled: boolean; casual_enabled: boolean; supervisor_enabled: boolean; team_member_enabled: boolean };
const STATUS_TIERS: { tier: StatusTier; label: string }[] = [
  { tier: "casual", label: "Casual" },
  { tier: "supervisor", label: "Supervisor" },
  { tier: "team_member", label: "Team member" },
];

const FLAG_GROUPS: { group: string; flags: Flag[] }[] = [
  {
    group: "Page access",
    flags: [
      {
        key: "page_access_menus",
        label: "Drinks",
        description: "Let staff see the Drinks (cocktails/wines) pages.",
      },
      {
        key: "page_access_updates",
        label: "Noticeboard",
        description: "Let staff see the Noticeboard.",
      },
      {
        key: "page_access_rota",
        label: "Rota",
        description: "Let staff see the Rota.",
      },
      {
        key: "page_access_checklists",
        label: "Checklists",
        description: "Let staff see the Checklists page.",
      },
      {
        key: "page_access_sops",
        label: "SOPs",
        description: "Let staff see the SOPs page.",
      },
      {
        key: "page_access_dm_instructions",
        label: "DM Instructions",
        description: "Let staff see the DM Instructions page.",
      },
      {
        key: "page_access_colleague_of_the_month",
        label: "Colleague of the Month",
        description: "Let staff see the Colleague of the Month page.",
      },
      {
        key: "page_access_function_sheets",
        label: "Function Sheets",
        description: "Let staff see the Function Sheets page.",
      },
      {
        key: "page_access_events",
        label: "Events",
        description: "Let staff see the Events page.",
      },
      {
        key: "page_access_training",
        label: "Training",
        description: "Let staff see the Training page.",
      },
      {
        key: "page_access_running_order",
        label: "Running Order",
        description: "Let staff see the Running Order page.",
      },
      {
        key: "page_access_guest_surveys",
        label: "Guest Surveys",
        description: "Let staff see the Guest Surveys page.",
      },
      {
        key: "birthdays_access",
        label: "Birthdays",
        description: "Let staff see the Birthdays page. Adding, editing, and deleting a birthday stays admin-only either way.",
      },
      {
        key: "stock_orders_edit",
        label: "Stock Orders",
        description: "Let staff open Stock Orders and add, delete, and set quantities on items. Admins can always do this.",
      },
    ],
  },
  {
    group: "Content editing",
    flags: [
      {
        key: "function_sheets_upload",
        label: "Function Sheets",
        description: "Let staff upload and delete function sheets. Admins can always do this.",
      },
      {
        key: "checklists_edit",
        label: "Checklists",
        description: "Let staff create, edit, and delete checklists and their items. Ticking items off is already open to everyone.",
      },
      {
        key: "sops_edit",
        label: "SOPs",
        description: "Let staff add, edit, and delete standard operating procedures.",
      },
      {
        key: "dm_instructions_edit",
        label: "DM Instructions",
        description: "Let staff add, edit, and delete DM Instructions guides.",
      },
      {
        key: "wines_edit",
        label: "Wine list",
        description: "Let staff add, edit, and delete wines.",
      },
      {
        key: "cocktails_edit",
        label: "Cocktails",
        description: "Let staff add, edit, delete, and pin cocktails as \"Most Popular\".",
      },
      {
        key: "events_edit",
        label: "Events",
        description: "Let staff add and delete event guides. Editing an event's rich content still only ever happens via a script.",
      },
      {
        key: "training_upload",
        label: "Training",
        description: "Let staff upload the weekly training/compliance export and share overdue reminders. Viewing raw employee records stays admin-only.",
      },
      {
        key: "running_order_edit",
        label: "Running Order",
        description: "Let staff add, reorder, and remove moments on the Running Order timeline. Marking a moment done (with a photo/comment) is already open to everyone.",
      },
    ],
  },
  {
    group: "Noticeboard",
    flags: [
      {
        key: "noticeboard_pin",
        label: "Pin posts",
        description: "Let staff pin and unpin a noticeboard post to keep it at the top of the feed.",
      },
    ],
  },
];

// Pages that can sit in the bottom task bar — Dashboard is excluded, since
// it's always the fixed centre button.
const SHORTCUT_PAGES = NAV_ITEMS.filter((item) => item.href !== "/dashboard");
const SLOT_LABELS = ["Left 1", "Left 2", "Left 3", "Right 1", "Right 2", "Right 3"];

// The Push API needs the VAPID public key as a raw byte array, not the
// base64url string it's stored/shared as everywhere else.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export default function SettingsPage() {
  const profile = useProfile();
  const supabase = createClient();
  const isAdmin = profile.role === "admin";

  // Every flag a staffFlag might reference, read once so the shortcut
  // picker can tell which pages this particular user can actually open.
  const menusFlag = useFeatureFlag("page_access_menus");
  const updatesFlag = useFeatureFlag("page_access_updates");
  const rotaFlag = useFeatureFlag("page_access_rota");
  const checklistsFlag = useFeatureFlag("page_access_checklists");
  const sopsFlag = useFeatureFlag("page_access_sops");
  const dmInstructionsFlag = useFeatureFlag("page_access_dm_instructions");
  const colleagueFlag = useFeatureFlag("page_access_colleague_of_the_month");
  const functionSheetsFlag = useFeatureFlag("page_access_function_sheets");
  const eventsFlag = useFeatureFlag("page_access_events");
  const runningOrderFlag = useFeatureFlag("page_access_running_order");
  const guestSurveysFlag = useFeatureFlag("page_access_guest_surveys");
  const stockOrdersFlag = useFeatureFlag("stock_orders_edit");
  const birthdaysFlag = useFeatureFlag("birthdays_access");
  const trainingFlag = useFeatureFlag("page_access_training");
  const resolvedFlags: Record<string, boolean> = {
    page_access_menus: menusFlag,
    page_access_updates: updatesFlag,
    page_access_rota: rotaFlag,
    page_access_checklists: checklistsFlag,
    page_access_sops: sopsFlag,
    page_access_dm_instructions: dmInstructionsFlag,
    page_access_colleague_of_the_month: colleagueFlag,
    page_access_function_sheets: functionSheetsFlag,
    page_access_events: eventsFlag,
    page_access_running_order: runningOrderFlag,
    page_access_guest_surveys: guestSurveysFlag,
    stock_orders_edit: stockOrdersFlag,
    birthdays_access: birthdaysFlag,
    page_access_training: trainingFlag,
  };
  const availableShortcutPages = SHORTCUT_PAGES.filter((item) => {
    if ("requiresCasual" in item && item.requiresCasual) return isAdmin || profile.is_casual;
    return isAdmin || !item.adminOnly || (item.staffFlag && resolvedFlags[item.staffFlag]);
  });

  const [flags, setFlags] = useState<Record<string, FlagRow>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const defaultTaskBar = [...DEFAULT_ISLAND_LEFT, ...DEFAULT_ISLAND_RIGHT];
  const [taskBar, setTaskBar] = useState<string[]>(profile.task_bar?.length === 6 ? profile.task_bar : defaultTaskBar);
  const [savingTaskBar, setSavingTaskBar] = useState(false);
  const [taskBarSaved, setTaskBarSaved] = useState(false);

  useEffect(() => {
    getAttachmentUrl(profile.avatar_url).then(setAvatarUrl);
  }, [profile.avatar_url]);

  // --- Push notifications ---
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  useEffect(() => {
    const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
    setPushSupported(supported);
    if (!supported) return;
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setPushEnabled(!!sub))
      .catch(() => {});
  }, []);

  const enablePush = async () => {
    setPushBusy(true);
    setPushError(null);
    try {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        setPushError("Notifications aren't set up for this app yet.");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushError("Notifications were blocked — check your browser's site settings.");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      const json = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      if (!res.ok) throw new Error("Couldn't save that subscription.");
      setPushEnabled(true);
    } catch (err) {
      setPushError((err as Error).message || "Couldn't enable notifications.");
    } finally {
      setPushBusy(false);
    }
  };

  const disablePush = async () => {
    setPushBusy(true);
    setPushError(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setPushEnabled(false);
    } catch (err) {
      setPushError((err as Error).message || "Couldn't disable notifications.");
    } finally {
      setPushBusy(false);
    }
  };

  const loadData = useCallback(async () => {
    const { data } = await supabase
      .from("feature_flags")
      .select("key, enabled, casual_enabled, supervisor_enabled, team_member_enabled");
    setFlags(
      Object.fromEntries(
        (data ?? []).map((f) => [
          f.key,
          {
            enabled: f.enabled,
            casual_enabled: f.casual_enabled,
            supervisor_enabled: f.supervisor_enabled,
            team_member_enabled: f.team_member_enabled,
          },
        ])
      )
    );
  }, [supabase]);

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel("feature-flags-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "feature_flags" }, loadData)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData, supabase]);

  // Simple on/off flags (Content editing, Noticeboard) — unchanged, still
  // one switch for every non-admin status.
  const toggle = async (key: string) => {
    setSavingKey(key);
    const nextEnabled = !flags[key]?.enabled;
    try {
      const { error } = await supabase
        .from("feature_flags")
        .update({ enabled: nextEnabled, updated_by: profile.id, updated_at: new Date().toISOString() })
        .eq("key", key);
      if (!error) setFlags((prev) => ({ ...prev, [key]: { ...prev[key], enabled: nextEnabled } }));
    } finally {
      setSavingKey(null);
    }
  };

  const STATUS_COLUMN = {
    casual: "casual_enabled",
    supervisor: "supervisor_enabled",
    team_member: "team_member_enabled",
  } as const;

  // Page-access flags — one independent switch per status. `enabled` is
  // kept as "any of the three" alongside it, since a couple of these keys
  // (stock_orders_edit) double as a write-permission check elsewhere that
  // still reads the single `enabled` column.
  const toggleStatus = async (key: string, tier: StatusTier) => {
    const column = STATUS_COLUMN[tier];
    const current = flags[key] ?? { enabled: false, casual_enabled: false, supervisor_enabled: false, team_member_enabled: false };
    const next: FlagRow = { ...current, [column]: !current[column] };
    next.enabled = next.casual_enabled || next.supervisor_enabled || next.team_member_enabled;
    setSavingKey(`${key}:${tier}`);
    try {
      const { error } = await supabase
        .from("feature_flags")
        .update({
          casual_enabled: next.casual_enabled,
          supervisor_enabled: next.supervisor_enabled,
          team_member_enabled: next.team_member_enabled,
          enabled: next.enabled,
          updated_by: profile.id,
          updated_at: new Date().toISOString(),
        })
        .eq("key", key);
      if (!error) setFlags((prev) => ({ ...prev, [key]: next }));
    } finally {
      setSavingKey(null);
    }
  };

  const handleAvatarSelect = async (file: File | null) => {
    if (!file) return;
    setAvatarError(null);
    setUploadingAvatar(true);
    const previousPath = profile.avatar_url;
    try {
      const path = await uploadAttachment(file, "avatars");
      const { error } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", profile.id);
      if (error) throw error;
      setAvatarUrl(await getAttachmentUrl(path));
      if (previousPath) await deleteAttachment(previousPath);
    } catch (err) {
      setAvatarError((err as Error).message || "Couldn't upload that photo — try again.");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAvatarRemove = async () => {
    setAvatarError(null);
    setUploadingAvatar(true);
    const previousPath = profile.avatar_url;
    try {
      const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", profile.id);
      if (error) throw error;
      setAvatarUrl(null);
      if (previousPath) await deleteAttachment(previousPath);
    } catch (err) {
      setAvatarError((err as Error).message || "Couldn't remove that photo — try again.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const setSlot = (index: number, href: string) => {
    setTaskBar((prev) => {
      const next = [...prev];
      next[index] = href;
      return next;
    });
    setTaskBarSaved(false);
  };

  const saveTaskBar = async () => {
    setSavingTaskBar(true);
    try {
      const { error } = await supabase.from("profiles").update({ task_bar: taskBar }).eq("id", profile.id);
      if (!error) setTaskBarSaved(true);
    } finally {
      setSavingTaskBar(false);
    }
  };

  const resetTaskBar = () => {
    setTaskBar(defaultTaskBar);
    setTaskBarSaved(false);
  };

  return (
    <div className="flex flex-col gap-10">
      <Section title="Settings" subtitle="Your profile, and (for super admins) who can use what">
        <div className="flex flex-col gap-8">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: inkSoft }}>
              Your profile
            </div>
            <div className="p-4 rounded-2xl flex items-center gap-4" style={{ background: bg, border: `1px solid ${border}` }}>
              <div
                className="shrink-0 rounded-full overflow-hidden flex items-center justify-center"
                style={{ width: 64, height: 64, background: "#FFFFFF", border: `1px solid ${border}` }}
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt={profile.name} className="w-full h-full object-cover" />
                ) : (
                  <User size={28} style={{ color: inkSoft }} />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="text-sm font-medium" style={{ color: ink }}>
                  {profile.name}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleAvatarSelect(e.target.files?.[0] ?? null)}
                  className="hidden"
                  id="avatar-upload"
                />
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="avatar-upload"
                    className="text-xs font-medium px-3 py-1.5 rounded-2xl w-fit cursor-pointer"
                    style={{ background: uploadingAvatar ? "#FFFFFF" : navy, color: uploadingAvatar ? "#000000" : "#FFFFFF", border: `1px solid ${border}` }}
                  >
                    {uploadingAvatar ? "Uploading…" : avatarUrl ? "Change photo" : "Upload a photo"}
                  </label>
                  {avatarUrl && (
                    <button
                      onClick={handleAvatarRemove}
                      disabled={uploadingAvatar}
                      className="text-xs font-medium px-3 py-1.5 rounded-2xl disabled:opacity-60"
                      style={{ background: "#FFFFFF", color: ink, border: `1px solid ${border}` }}
                    >
                      Remove
                    </button>
                  )}
                </div>
                {avatarError && (
                  <p className="text-xs" style={{ color: "#B3261E" }}>
                    {avatarError}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: inkSoft }}>
              Notifications
            </div>
            <div className="p-4 rounded-2xl" style={{ background: bg, border: `1px solid ${border}` }}>
              {!pushSupported ? (
                <p className="text-xs" style={{ color: inkSoft }}>
                  Your browser doesn&apos;t support push notifications. On iPhone, add the app to your Home Screen
                  first (iOS 16.4+), then try again from there.
                </p>
              ) : (
                <>
                  <p className="text-xs mb-3" style={{ color: inkSoft }}>
                    Get notified for new Noticeboard posts, guest surveys, rota changes, birthdays, and a reminder
                    to finish your checklist near the end of your shift.
                  </p>
                  <button
                    onClick={pushEnabled ? disablePush : enablePush}
                    disabled={pushBusy}
                    className="text-xs font-medium px-4 py-2 rounded-full disabled:opacity-60"
                    style={{
                      background: pushEnabled ? "#FFFFFF" : navy,
                      color: pushEnabled ? "#000000" : "#FFFFFF",
                      border: `1px solid ${border}`,
                    }}
                  >
                    {pushBusy ? "Working…" : pushEnabled ? "Disable notifications" : "Enable notifications"}
                  </button>
                  {pushError && (
                    <p className="text-xs mt-2" style={{ color: "#B3261E" }}>
                      {pushError}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: inkSoft }}>
              Your task bar
            </div>
            <p className="text-xs mb-3" style={{ color: inkSoft }}>
              Pick your own shortcuts for the bottom bar (on mobile) — three on the left, three on the right of Dashboard.
            </p>
            <div className="p-4 rounded-2xl flex flex-col gap-3" style={{ background: bg, border: `1px solid ${border}` }}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {SLOT_LABELS.map((label, i) => (
                  <label key={label} className="flex flex-col gap-1 text-xs" style={{ color: inkSoft }}>
                    {label}
                    <select
                      value={taskBar[i]}
                      onChange={(e) => setSlot(i, e.target.value)}
                      className="text-sm px-3 py-2 rounded-full outline-none"
                      style={{ border: `1px solid ${border}`, color: ink, background: "#FFFFFF" }}
                    >
                      {availableShortcutPages.map((item) => (
                        <option key={item.href} value={item.href}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={saveTaskBar}
                  disabled={savingTaskBar}
                  className="text-xs font-medium px-3.5 py-1.5 rounded-2xl disabled:opacity-60"
                  style={{ background: navy, color: "#FFFFFF" }}
                >
                  {savingTaskBar ? "Saving…" : "Save task bar"}
                </button>
                <button
                  onClick={resetTaskBar}
                  className="text-xs font-medium px-3.5 py-1.5 rounded-2xl"
                  style={{ background: "#FFFFFF", color: "#000000", border: `1px solid ${border}` }}
                >
                  Reset to default
                </button>
                {taskBarSaved && (
                  <span className="text-xs" style={{ color: inkSoft }}>
                    Saved.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </Section>

      {profile.is_super_admin && (
        <Section title="Manage staff" subtitle="Invite accounts, set status, and remove staff">
          <Link
            href="/admin/staff"
            className="flex items-center justify-between p-4 rounded-2xl"
            style={{ background: bg, border: `1px solid ${border}`, color: ink }}
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <Users size={16} style={{ color: inkSoft }} />
              Manage staff
            </span>
            <ChevronRight size={16} style={{ color: inkSoft }} />
          </Link>
        </Section>
      )}

      {profile.is_super_admin && (
        <Section title="Page access & permissions" subtitle="Control which pages and features staff can use, beyond admins">
          <div className="flex flex-col gap-6">
            {FLAG_GROUPS.map((g) => (
              <div key={g.group}>
                <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: inkSoft }}>
                  {g.group}
                </div>
                <div className="flex flex-col gap-1">
                  {g.flags.map((f) => {
                    const row = flags[f.key];
                    if (g.group === "Page access") {
                      return (
                        <div
                          key={f.key}
                          className="flex items-center justify-between gap-3 p-4 rounded-2xl flex-wrap"
                          style={{ background: bg, border: `1px solid ${border}` }}
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium" style={{ color: ink }}>
                              {f.label}
                            </div>
                            <div className="text-xs mt-0.5" style={{ color: inkSoft }}>
                              {f.description}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {STATUS_TIERS.map(({ tier, label }) => {
                              const on = row?.[STATUS_COLUMN[tier]] ?? false;
                              return (
                                <button
                                  key={tier}
                                  onClick={() => toggleStatus(f.key, tier)}
                                  disabled={savingKey === `${f.key}:${tier}`}
                                  className="text-xs font-semibold px-3 py-1.5 rounded-2xl disabled:opacity-60"
                                  style={{
                                    background: on ? "#000000" : "#FFFFFF",
                                    color: on ? "#FFFFFF" : "#000000",
                                    border: "1px solid #000000",
                                  }}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                    const enabled = row?.enabled ?? false;
                    return (
                      <div
                        key={f.key}
                        className="flex items-center justify-between gap-3 p-4 rounded-2xl"
                        style={{ background: bg, border: `1px solid ${border}` }}
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium" style={{ color: ink }}>
                            {f.label}
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: inkSoft }}>
                            {f.description}
                          </div>
                        </div>
                        <button
                          onClick={() => toggle(f.key)}
                          disabled={savingKey === f.key}
                          className="shrink-0 text-xs font-semibold px-3.5 py-1.5 rounded-2xl disabled:opacity-60"
                          style={{
                            background: enabled ? "#000000" : "#FFFFFF",
                            color: enabled ? "#FFFFFF" : "#000000",
                            border: "1px solid #000000",
                          }}
                        >
                          {enabled ? "Staff can" : "Admins only"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
