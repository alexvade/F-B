"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
import { Section } from "@/components/section";
import { bg, border, ink, inkSoft } from "@/lib/design-tokens";

const FLAGS: { key: string; label: string; description: string }[] = [
  {
    key: "function_sheets_upload",
    label: "Function Sheets",
    description: "Let staff upload and delete function sheets. Admins can always do this.",
  },
  {
    key: "stock_orders_edit",
    label: "Stock Orders",
    description: "Let staff open Stock Orders and add, delete, and set quantities on items. Admins can always do this.",
  },
];

export default function SettingsPage() {
  const profile = useProfile();
  const supabase = createClient();
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

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

  if (profile.role !== "admin") {
    return (
      <Section title="Settings">
        <p className="text-sm" style={{ color: inkSoft }}>
          Admins only.
        </p>
      </Section>
    );
  }

  return (
    <Section title="Settings" subtitle="Control which features staff can use, beyond admins">
      <div className="flex flex-col gap-1">
        {FLAGS.map((f) => {
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
    </Section>
  );
}
