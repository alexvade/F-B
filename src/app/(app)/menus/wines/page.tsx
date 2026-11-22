"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
import { useFeatureFlag } from "@/lib/feature-flags-context";
import { bg, border, fill, ink, inkSoft, navy, navyText, orange } from "@/lib/design-tokens";

type Wine = {
  id: number;
  section: string;
  name: string;
  region: string | null;
  vintage: string | null;
  tasting_note: string | null;
  delisted: boolean;
  bottles: number | null;
  stock_checked_on: string | null;
  cellar_code: string | null;
};

// Lower-case, accents stripped, so "panoramico" finds "Panorámico".
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

// Every word typed must appear somewhere in the wine's name, section,
// region or vintage — so "Panoramico White Rioja" matches the white
// Panorámico even though "White" is only in its section.
function matchesSearch(w: Wine, query: string) {
  const words = fold(query).split(/[\s,]+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = fold([w.name, w.section, w.region ?? "", w.vintage ?? "", w.cellar_code ?? ""].join(" "));
  return words.every((word) => hay.includes(word));
}

const isOutOfStock = (w: Wine) => w.bottles === 0;

const checkedOn = (iso: string | null) =>
  iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;

function StatusBadges({ w }: { w: Wine }) {
  if (!isOutOfStock(w) && !w.delisted) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {isOutOfStock(w) && (
        <span
          className="text-[11px] font-bold tracking-wide px-2 py-0.5 rounded-full"
          style={{ background: "#B42318", color: "#FFFFFF" }}
        >
          OUT OF STOCK
        </span>
      )}
      {w.delisted && (
        <span
          className="text-[11px] font-bold tracking-wide px-2 py-0.5 rounded-full"
          style={{ background: ink, color: bg }}
        >
          DELISTED
        </span>
      )}
      {w.delisted && !isOutOfStock(w) && w.bottles != null && (
        <span
          className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
          style={{ border: `1px solid ${border}`, color: ink }}
        >
          {w.bottles} left — no more once gone
        </span>
      )}
    </div>
  );
}

const EMPTY_FORM = {
  id: null as number | null,
  section: "",
  name: "",
  region: "",
  vintage: "",
  tasting_note: "",
  delisted: false,
  bottles: "",
  cellar_code: "",
};

export default function WinesPage() {
  const profile = useProfile();
  const isAdmin = profile.role === "admin";
  const winesEditEnabled = useFeatureFlag("wines_edit");
  const canEdit = isAdmin || winesEditEnabled;
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
            delisted: w.delisted,
            bottles: w.bottles == null ? "" : String(w.bottles),
            cellar_code: w.cellar_code ?? "",
          }
        : { ...EMPTY_FORM }
    );
  };

  const saveForm = async () => {
    if (!form || !form.section.trim() || !form.name.trim()) return;
    setSaving(true);
    try {
      const bottlesText = form.bottles.trim();
      const bottles = bottlesText === "" ? null : Math.max(0, Math.floor(Number(bottlesText)) || 0);
      const original = form.id ? wines.find((w) => w.id === form.id) : undefined;
      const bottlesChanged = (original?.bottles ?? null) !== bottles;
      const payload = {
        section: form.section.trim(),
        name: form.name.trim(),
        region: form.region.trim() || null,
        vintage: form.vintage.trim() || null,
        tasting_note: form.tasting_note.trim() || null,
        delisted: form.delisted,
        cellar_code: form.cellar_code.trim() || null,
        bottles,
        ...(bottlesChanged ? { stock_checked_on: bottles == null ? null : new Date().toISOString().slice(0, 10) } : {}),
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
            style={{ border: `1px solid ${border}`, background: fill, color: ink }}
          />
          <input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="text-sm px-4 py-2 rounded-full outline-none"
            style={{ border: `1px solid ${border}`, background: fill, color: ink }}
          />
          <input
            placeholder="Cellar code (e.g. 101)"
            value={form.cellar_code}
            onChange={(e) => setForm({ ...form, cellar_code: e.target.value })}
            className="text-sm px-4 py-2 rounded-full outline-none w-48"
            style={{ border: `1px solid ${border}`, background: fill, color: ink }}
          />
          <div className="flex gap-2">
            <input
              placeholder="Region"
              value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value })}
              className="text-sm px-4 py-2 rounded-full outline-none flex-1"
              style={{ border: `1px solid ${border}`, background: fill, color: ink }}
            />
            <input
              placeholder="Vintage"
              value={form.vintage}
              onChange={(e) => setForm({ ...form, vintage: e.target.value })}
              className="text-sm px-4 py-2 rounded-full outline-none w-28"
              style={{ border: `1px solid ${border}`, background: fill, color: ink }}
            />
          </div>
          <textarea
            placeholder="Tasting note"
            value={form.tasting_note}
            onChange={(e) => setForm({ ...form, tasting_note: e.target.value })}
            rows={4}
            className="text-sm px-4 py-3 rounded-2xl outline-none"
            style={{ border: `1px solid ${border}`, background: fill, color: ink }}
          />
          <label className="flex items-center gap-2 text-sm px-1" style={{ color: ink }}>
            <input
              type="checkbox"
              checked={form.delisted}
              onChange={(e) => setForm({ ...form, delisted: e.target.checked })}
            />
            Delisted by supplier
          </label>
          <label className="flex items-center gap-3 text-sm px-1" style={{ color: ink }}>
            Bottles in stock
            <input
              inputMode="numeric"
              placeholder="—"
              value={form.bottles}
              onChange={(e) => setForm({ ...form, bottles: e.target.value.replace(/[^0-9]/g, "") })}
              className="text-sm px-4 py-2 rounded-full outline-none w-24"
              style={{ border: `1px solid ${border}`, background: fill, color: ink }}
            />
            <span className="text-xs" style={{ color: inkSoft }}>
              0 = out of stock
            </span>
          </label>
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
          {canEdit && (
            <div className="flex gap-2">
              <button onClick={() => openEdit(active)} style={{ color: navyText }}>
                <Pencil size={15} />
              </button>
              <button onClick={() => deleteWine(active.id)} style={{ color: "#000000" }}>
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
        <StatusBadges w={active} />
        <p className="text-sm font-semibold mt-2" style={{ color: ink }}>
          {active.cellar_code ? `Cellar code ${active.cellar_code}` : "No cellar code"}
        </p>
        <p className="text-sm mt-1" style={{ color: inkSoft }}>
          {active.region}
          {active.vintage ? ` · ${active.vintage}` : ""}
        </p>
        {active.bottles != null && (
          <p className="text-xs mt-1" style={{ color: inkSoft }}>
            {active.bottles === 0 ? "None in the cellar" : `${active.bottles} bottle${active.bottles === 1 ? "" : "s"} in the cellar`}
            {active.stock_checked_on ? ` · stock take ${checkedOn(active.stock_checked_on)}` : ""}
          </p>
        )}
        <div className="mb-4" />
        <div className="text-sm font-semibold mb-2" style={{ color: navyText }}>
          Tasting note
        </div>
        <p className="text-sm leading-relaxed" style={{ color: ink }}>
          {active.tasting_note}
        </p>
      </div>
    );
  }

  const filtered = wines.filter((w) => matchesSearch(w, search));
  const latestCheck = wines.reduce<string | null>(
    (max, w) => (w.stock_checked_on && (!max || w.stock_checked_on > max) ? w.stock_checked_on : max),
    null
  );

  return (
    <div>
      <Link href="/menus" className="text-xs mb-4 inline-block" style={{ color: navyText }}>
        ← Back to Menus
      </Link>
      <div className="flex items-center justify-between">
        <h1
          className="text-lg font-semibold mb-1 inline-block pb-1"
          style={{ color: navyText, borderBottom: `3px solid ${orange}` }}
        >
          Wines
        </h1>
        {canEdit && (
          <button
            onClick={() => openEdit()}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-2xl"
            style={{ background: "#FFFFFF", color: navy }}
          >
            <Plus size={13} /> Add
          </button>
        )}
      </div>
      <p className="text-sm mb-4 mt-2" style={{ color: inkSoft }}>
        Grouped as on the wine list — tap a wine for full details
        {latestCheck ? `. Stock as of ${checkedOn(latestCheck)}.` : ""}
      </p>

      <div className="relative mb-6">
        <Search size={16} style={{ color: inkSoft, position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)" }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search wines or cellar code…"
          className="w-full text-sm pl-10 pr-4 py-2.5 rounded-full outline-none"
          style={{ border: `1px solid ${border}`, color: ink, background: fill }}
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
                  style={{ background: bg, border: `1px solid ${border}` }}
                >
                  <div style={{ opacity: isOutOfStock(w) ? 0.75 : 1 }}>
                    <div className="text-sm font-medium" style={{ color: ink }}>
                      {w.name}
                    </div>
                    <div className="text-xs" style={{ color: inkSoft }}>
                      {w.cellar_code ? `Cellar code ${w.cellar_code}` : "No cellar code"}
                    </div>
                    <StatusBadges w={w} />
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
