"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
import { bg, border, ink, inkSoft, navy, navyText, orange, surface } from "@/lib/design-tokens";

type Wine = {
  id: number;
  section: string;
  name: string;
  region: string | null;
  vintage: string | null;
  tasting_note: string | null;
};

const EMPTY_FORM = {
  id: null as number | null,
  section: "",
  name: "",
  region: "",
  vintage: "",
  tasting_note: "",
};

export default function WinesPage() {
  const profile = useProfile();
  const isAdmin = profile.role === "admin";
  const supabase = createClient();

  const [wines, setWines] = useState<Wine[]>([]);
  const [sections, setSections] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<Wine | null>(null);
  const [form, setForm] = useState<typeof EMPTY_FORM | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    const { data } = await supabase.from("wines").select("*").order("sort_order").order("name");
    setWines(data ?? []);
    const order: string[] = [];
    for (const w of data ?? []) if (!order.includes(w.section)) order.push(w.section);
    setSections(order);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openEdit = (w?: Wine) => {
    setForm(
      w
        ? {
            id: w.id,
            section: w.section,
            name: w.name,
            region: w.region ?? "",
            vintage: w.vintage ?? "",
            tasting_note: w.tasting_note ?? "",
          }
        : { ...EMPTY_FORM }
    );
  };

  const saveForm = async () => {
    if (!form || !form.section.trim() || !form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        section: form.section.trim(),
        name: form.name.trim(),
        region: form.region.trim() || null,
        vintage: form.vintage.trim() || null,
        tasting_note: form.tasting_note.trim() || null,
      };
      if (form.id) {
        await supabase.from("wines").update(payload).eq("id", form.id);
      } else {
        await supabase.from("wines").insert(payload);
      }
      setForm(null);
      setActive(null);
      loadData();
    } finally {
      setSaving(false);
    }
  };

  const deleteWine = async (id: number) => {
    await supabase.from("wines").delete().eq("id", id);
    setActive(null);
    loadData();
  };

  if (form) {
    return (
      <div>
        <button onClick={() => setForm(null)} className="text-xs mb-4" style={{ color: navyText }}>
          ← Cancel
        </button>
        <h2 className="text-lg font-semibold mb-4" style={{ color: navyText }}>
          {form.id ? "Edit wine" : "New wine"}
        </h2>
        <div className="flex flex-col gap-3 max-w-md">
          <input
            placeholder="Section (e.g. Red — Bordeaux)"
            value={form.section}
            onChange={(e) => setForm({ ...form, section: e.target.value })}
            className="text-sm px-4 py-2 rounded-full outline-none"
            style={{ border: `1px solid ${border}`, background: bg, color: ink }}
          />
          <input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="text-sm px-4 py-2 rounded-full outline-none"
            style={{ border: `1px solid ${border}`, background: bg, color: ink }}
          />
          <div className="flex gap-2">
            <input
              placeholder="Region"
              value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value })}
              className="text-sm px-4 py-2 rounded-full outline-none flex-1"
              style={{ border: `1px solid ${border}`, background: bg, color: ink }}
            />
            <input
              placeholder="Vintage"
              value={form.vintage}
              onChange={(e) => setForm({ ...form, vintage: e.target.value })}
              className="text-sm px-4 py-2 rounded-full outline-none w-28"
              style={{ border: `1px solid ${border}`, background: bg, color: ink }}
            />
          </div>
          <textarea
            placeholder="Tasting note"
            value={form.tasting_note}
            onChange={(e) => setForm({ ...form, tasting_note: e.target.value })}
            rows={4}
            className="text-sm px-4 py-3 rounded-2xl outline-none"
            style={{ border: `1px solid ${border}`, background: bg, color: ink }}
          />
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

  if (active) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setActive(null)} className="text-xs" style={{ color: navyText }}>
            ← Back to Wines
          </button>
          {isAdmin && (
            <div className="flex gap-2">
              <button onClick={() => openEdit(active)} style={{ color: navyText }}>
                <Pencil size={15} />
              </button>
              <button onClick={() => deleteWine(active.id)} style={{ color: "#C24A3B" }}>
                <Trash2 size={15} />
              </button>
            </div>
          )}
        </div>
        <div className="text-xs font-semibold mb-1" style={{ color: orange }}>
          {active.section.toUpperCase()}
        </div>
        <h2
          className="text-lg font-semibold mb-1 inline-block pb-1"
          style={{ color: navyText, borderBottom: `3px solid ${orange}` }}
        >
          {active.name}
        </h2>
        <p className="text-sm mt-2 mb-4" style={{ color: inkSoft }}>
          {active.region}
          {active.vintage ? ` · ${active.vintage}` : ""}
        </p>
        <div className="text-sm font-semibold mb-2" style={{ color: navyText }}>
          Tasting note
        </div>
        <p className="text-sm leading-relaxed" style={{ color: ink }}>
          {active.tasting_note}
        </p>
      </div>
    );
  }

  const filtered = wines.filter((w) => w.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div>
      <Link href="/drinks" className="text-xs mb-4 inline-block" style={{ color: navyText }}>
        ← Back to Drinks
      </Link>
      <div className="flex items-center justify-between">
        <h1
          className="text-lg font-semibold mb-1 inline-block pb-1"
          style={{ color: navyText, borderBottom: `3px solid ${orange}` }}
        >
          Wines
        </h1>
        {isAdmin && (
          <button
            onClick={() => openEdit()}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-2xl"
            style={{ background: "#FDE3CD", color: navy }}
          >
            <Plus size={13} /> Add
          </button>
        )}
      </div>
      <p className="text-sm mb-4 mt-2" style={{ color: inkSoft }}>
        Grouped as on the wine list — tap a wine for full details
      </p>

      <div className="relative mb-6">
        <Search size={16} style={{ color: inkSoft, position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)" }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search wines…"
          className="w-full text-sm pl-10 pr-4 py-2.5 rounded-full outline-none"
          style={{ border: `1px solid ${border}`, color: ink, background: bg }}
        />
      </div>

      {filtered.length === 0 && (
        <p className="text-sm" style={{ color: inkSoft }}>
          No wines match &quot;{search}&quot;.
        </p>
      )}

      {sections.map((sectionName) => {
        const matches = filtered.filter((w) => w.section === sectionName);
        if (matches.length === 0) return null;
        return (
          <div key={sectionName} className="mb-6">
            <div className="text-xs font-semibold mb-3" style={{ color: orange }}>
              {sectionName.toUpperCase()}
            </div>
            <div className="flex flex-col gap-1">
              {matches.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setActive(w)}
                  className="flex items-center justify-between p-3 rounded-3xl text-left"
                  style={{ background: surface, border: `1px solid ${border}` }}
                >
                  <div>
                    <div className="text-sm font-medium" style={{ color: ink }}>
                      {w.name}
                    </div>
                    <div className="text-xs" style={{ color: inkSoft }}>
                      {w.region}
                      {w.vintage ? ` · ${w.vintage}` : ""}
                    </div>
                  </div>
                  <ChevronRight size={16} style={{ color: inkSoft }} />
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
