"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
import { uploadAttachment } from "@/lib/storage";
import { Section } from "@/components/section";
import { border, ink, inkSoft, navy, navyText, orange, orangeSoft, surface, bg } from "@/lib/design-tokens";

type Sop = {
  id: number;
  category: string;
  title: string;
  steps: string[];
  photo_url: string | null;
};

const EMPTY_FORM = { id: null as number | null, category: "", title: "", steps: "", photo: null as File | null };

export default function SopsPage() {
  const profile = useProfile();
  const isAdmin = profile.role === "admin";
  const supabase = createClient();

  const [sops, setSops] = useState<Sop[]>([]);
  const [activeSop, setActiveSop] = useState<Sop | null>(null);
  const [form, setForm] = useState<typeof EMPTY_FORM | null>(null);
  const [saving, setSaving] = useState(false);

  const loadSops = useCallback(async () => {
    const { data } = await supabase.from("sops").select("*").order("sort_order").order("id");
    setSops(data ?? []);
  }, [supabase]);

  useEffect(() => {
    loadSops();
  }, [loadSops]);

  const categories = Array.from(new Set(sops.map((s) => s.category)));

  const openEdit = (sop?: Sop) => {
    setForm(
      sop
        ? { id: sop.id, category: sop.category, title: sop.title, steps: sop.steps.join("\n"), photo: null }
        : { ...EMPTY_FORM }
    );
  };

  const saveForm = async () => {
    if (!form || !form.category.trim() || !form.title.trim() || !form.steps.trim()) return;
    setSaving(true);
    try {
      const photo_url = form.photo ? await uploadAttachment(form.photo, "sops") : undefined;
      const steps = form.steps.split("\n").map((s) => s.trim()).filter(Boolean);
      if (form.id) {
        await supabase
          .from("sops")
          .update({ category: form.category.trim(), title: form.title.trim(), steps, ...(photo_url ? { photo_url } : {}) })
          .eq("id", form.id);
      } else {
        await supabase.from("sops").insert({
          category: form.category.trim(),
          title: form.title.trim(),
          steps,
          photo_url: photo_url ?? null,
        });
      }
      setForm(null);
      setActiveSop(null);
      loadSops();
    } finally {
      setSaving(false);
    }
  };

  const deleteSop = async (id: number) => {
    await supabase.from("sops").delete().eq("id", id);
    setActiveSop(null);
    loadSops();
  };

  if (form) {
    return (
      <div>
        <button onClick={() => setForm(null)} className="text-xs mb-4" style={{ color: navyText }}>
          ← Cancel
        </button>
        <h2 className="text-lg font-semibold mb-4" style={{ color: navyText }}>
          {form.id ? "Edit SOP" : "New SOP"}
        </h2>
        <div className="flex flex-col gap-3 max-w-md">
          <input
            placeholder="Category"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="text-sm px-4 py-2 rounded-full outline-none"
            style={{ border: `1px solid ${border}`, background: bg, color: ink }}
          />
          <input
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="text-sm px-4 py-2 rounded-full outline-none"
            style={{ border: `1px solid ${border}`, background: bg, color: ink }}
          />
          <textarea
            placeholder="Steps, one per line"
            value={form.steps}
            onChange={(e) => setForm({ ...form, steps: e.target.value })}
            rows={8}
            className="text-sm px-4 py-3 rounded-2xl outline-none"
            style={{ border: `1px solid ${border}`, background: bg, color: ink }}
          />
          <label className="text-xs" style={{ color: inkSoft }}>
            Photo (optional)
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setForm({ ...form, photo: e.target.files?.[0] ?? null })}
              className="block mt-1 text-xs"
            />
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

  if (activeSop) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setActiveSop(null)} className="text-xs" style={{ color: navyText }}>
            ← Back to SOPs
          </button>
          {isAdmin && (
            <div className="flex gap-2">
              <button onClick={() => openEdit(activeSop)} style={{ color: navyText }}>
                <Pencil size={15} />
              </button>
              <button onClick={() => deleteSop(activeSop.id)} style={{ color: "#C24A3B" }}>
                <Trash2 size={15} />
              </button>
            </div>
          )}
        </div>
        <div className="text-xs mb-1" style={{ color: inkSoft }}>
          {activeSop.category}
        </div>
        <h2
          className="text-lg font-semibold mb-3 inline-block pb-1"
          style={{ color: navyText, borderBottom: `3px solid ${orange}` }}
        >
          {activeSop.title}
        </h2>
        {activeSop.photo_url && (
          <img
            src={activeSop.photo_url}
            alt={activeSop.title}
            className="rounded-2xl mb-4"
            style={{ maxWidth: "100%", maxHeight: 260, border: `1px solid ${border}` }}
          />
        )}
        <ol className="flex flex-col gap-2.5">
          {activeSop.steps.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed" style={{ color: ink }}>
              <span
                className="flex items-center justify-center shrink-0 rounded-full text-xs font-medium"
                style={{ width: 20, height: 20, background: orangeSoft, color: navyText, marginTop: 2 }}
              >
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <Section title="Standard operating procedures" subtitle={`${sops.length} reference guides`}>
      {isAdmin && (
        <button
          onClick={() => openEdit()}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-2xl mb-4"
          style={{ background: orangeSoft, color: navy }}
        >
          <Plus size={13} /> Add SOP
        </button>
      )}
      {categories.map((cat) => (
        <div key={cat} className="mb-5">
          <div className="text-xs font-semibold mb-2" style={{ color: orange }}>
            {cat.toUpperCase()}
          </div>
          <div className="flex flex-col gap-1">
            {sops
              .filter((s) => s.category === cat)
              .map((sop) => (
                <button
                  key={sop.id}
                  onClick={() => setActiveSop(sop)}
                  className="flex items-center justify-between p-3 rounded-2xl text-left"
                  style={{ background: surface, border: `1px solid ${border}` }}
                >
                  <span className="text-sm font-medium">{sop.title}</span>
                  <ChevronRight size={16} style={{ color: inkSoft }} />
                </button>
              ))}
          </div>
        </div>
      ))}
    </Section>
  );
}
