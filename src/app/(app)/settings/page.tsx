"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
import { useFeatureFlag } from "@/lib/feature-flags-context";
import { Section } from "@/components/section";
import { bg, border, ink, inkSoft, navy } from "@/lib/design-tokens";
import { uploadAttachment, getAttachmentUrl } from "@/lib/storage";
import { NAV_ITEMS, DEFAULT_ISLAND_LEFT, DEFAULT_ISLAND_RIGHT } from "@/components/nav-shell";
import { User } from "lucide-react";

type Flag = { key: string; label: string; description: string };

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
    page_access_colleague_of_the_month: colleagueFlag,
    page_access_function_sheets: functionSheetsFlag,
    page_access_events: eventsFlag,
    page_access_running_order: runningOrderFlag,
    page_access_guest_surveys: guestSurveysFlag,
    stock_orders_edit: stockOrdersFlag,
    birthdays_access: birthdaysFlag,
    page_access_training: trainingFlag,
  };
  const availableShortcutPages = SHORTCUT_PAGES.filter(
    (item) => isAdmin || !item.adminOnly || (item.staffFlag && resolvedFlags[item.staffFlag])
  );

  const [flags, setFlags] = useState<Record<string, boolean>>({});
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

  const loadData = useCallback(async () => {
    const { data } = await supabase.from("feature_flags").select("key, enabled");
    setFlags(Object.fromEntries((data ?? []).map((f) => [f.key, f.enabled])));
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

  const toggle = async (key: string) => {
    setSavingKey(key);
    const nextEnabled = !flags[key];
    try {
      const { error } = await supabase
        .from("feature_flags")
        .update({ enabled: nextEnabled, updated_by: profile.id, updated_at: new Date().toISOString() })
        .eq("key", key);
      if (!error) setFlags((prev) => ({ ...prev, [key]: nextEnabled }));
    } finally {
      setSavingKey(null);
    }
  };

  const handleAvatarSelect = async (file: File | null) => {
    if (!file) return;
    setAvatarError(null);
    setUploadingAvatar(true);
    try {
      const path = await uploadAttachment(file, "avatars");
      const { error } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", profile.id);
      if (error) throw error;
      setAvatarUrl(await getAttachmentUrl(path));
    } catch (err) {
      setAvatarError((err as Error).message || "Couldn't upload that photo — try again.");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
                <label
                  htmlFor="avatar-upload"
                  className="text-xs font-medium px-3 py-1.5 rounded-2xl w-fit cursor-pointer"
                  style={{ background: uploadingAvatar ? "#FFFFFF" : navy, color: uploadingAvatar ? "#000000" : "#FFFFFF", border: `1px solid ${border}` }}
                >
                  {uploadingAvatar ? "Uploading…" : avatarUrl ? "Change photo" : "Upload a photo"}
                </label>
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
        <Section title="Page access & permissions" subtitle="Control which pages and features staff can use, beyond admins">
          <div className="flex flex-col gap-6">
            {FLAG_GROUPS.map((g) => (
              <div key={g.group}>
                <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: inkSoft }}>
                  {g.group}
                </div>
                <div className="flex flex-col gap-1">
                  {g.flags.map((f) => {
                    const enabled = flags[f.key] ?? false;
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
