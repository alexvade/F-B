"use client";

import { useCallback, useEffect, useState } from "react";
import { Cake, Pencil, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
import { Section } from "@/components/section";
import { bg, border, fill, ink, inkSoft, navy, navyText, orange } from "@/lib/design-tokens";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type Birthday = { id: number; name: string; day: number; month: number };

const EMPTY_FORM = { id: null as number | null, name: "", day: "", month: "" };

export default function BirthdaysPage() {
  const profile = useProfile();
  const isAdmin = profile.role === "admin";
  const supabase = createClient();

  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  const [form, setForm] = useState<typeof EMPTY_FORM | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    const { data } = await supabase.from("birthdays").select("*").order("month").order("day");
    setBirthdays(data ?? []);
  }, [supabase]);

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel("birthdays-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "birthdays" }, loadData)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData, supabase]);

  const openEdit = (b?: Birthday) => {
    setForm(b ? { id: b.id, name: b.name, day: String(b.day), month: String(b.month) } : { ...EMPTY_FORM });
  };

  const saveForm = async () => {
    if (!form || !form.name.trim()) return;
    const day = Number(form.day);
    const month = Number(form.month);
    if (!day || day < 1 || day > 31 || !month || month < 1 || month > 12) return;
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), day, month };
      if (form.id) {
        await supabase.from("birthdays").update(payload).eq("id", form.id);
      } else {
        await supabase.from("birthdays").insert(payload);
      }
      setForm(null);
      loadData();
    } finally {
      setSaving(false);
    }
  };

  const deleteBirthday = async (id: number) => {
    if (!confirm("Delete this birthday?")) return;
    await supabase.from("birthdays").delete().eq("id", id);
    loadData();
  };

  if (!isAdmin) {
    return (
      <Section title="Birthdays">
        <p className="text-sm" style={{ color: inkSoft }}>
          Admins only.
        </p>
      </Section>
    );
  }

  if (form) {
    return (
      <div>
        <button onClick={() => setForm(null)} className="text-xs mb-4" style={{ color: navyText }}>
          ← Cancel
        </button>
        <h2 className="text-lg font-semibold mb-4" style={{ color: navyText }}>
          {form.id ? "Edit birthday" : "New birthday"}
        </h2>
        <div className="flex flex-col gap-3 max-w-md">
          <input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="text-sm px-4 py-2 rounded-full outline-none"
            style={{ border: `1px solid ${border}`, background: fill, color: ink }}
          />
          <div className="flex gap-2">
            <input
              placeholder="Day (1–31)"
              type="number"
              min={1}
              max={31}
              value={form.day}
              onChange={(e) => setForm({ ...form, day: e.target.value })}
              className="text-sm px-4 py-2 rounded-full outline-none flex-1"
              style={{ border: `1px solid ${border}`, background: fill, color: ink }}
            />
            <select
              value={form.month}
              onChange={(e) => setForm({ ...form, month: e.target.value })}
              className="text-sm px-4 py-2 rounded-full outline-none flex-1"
              style={{ border: `1px solid ${border}`, background: fill, color: ink }}
            >
              <option value="">Month</option>
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={saveForm}
            disabled={saving}
            className="text-sm font-medium py-2.5 rounded-full disabled:opacity-60"
            style={{ background: navy, color: "#FFFFFF" }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <Section title="Birthdays" subtitle="The team's birthdays — posted to the Noticeboard automatically on the day">
      <button
        onClick={() => openEdit()}
        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-2xl mb-4"
        style={{ background: "#FFFFFF", color: navy, border: `1px solid ${border}` }}
      >
        <Plus size={13} /> Add birthday
      </button>

      {birthdays.length === 0 ? (
        <p className="text-sm" style={{ color: inkSoft }}>
          No birthdays added yet.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {birthdays.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between p-3 rounded-3xl"
              style={{ background: bg, border: `1px solid ${border}` }}
            >
              <div className="flex items-center gap-3">
                <Cake size={18} style={{ color: orange }} />
                <div className="text-sm font-medium" style={{ color: ink }}>
                  {b.name}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs" style={{ color: inkSoft }}>
                  {b.day} {MONTH_NAMES[b.month - 1]}
                </span>
                <button onClick={() => openEdit(b)} style={{ color: navyText }}>
                  <Pencil size={14} />
                </button>
                <button onClick={() => deleteBirthday(b.id)} style={{ color: ink }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
