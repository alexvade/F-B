"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronRight, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
import { useFeatureFlag } from "@/lib/feature-flags-context";
import { uploadAttachment, getAttachmentUrl, deleteAttachment } from "@/lib/storage";
import { Section } from "@/components/section";
import { bg, border, fill, ink, inkSoft, navy, navyText, orange, orangeSoft } from "@/lib/design-tokens";

type Guide = {
  id: number;
  title: string;
  steps: string[];
  photos: string[];
  source_file_url: string | null;
  source_file_name: string | null;
  sort_order: number;
};

const EMPTY_FORM = {
  id: null as number | null,
  title: "",
  steps: "",
  photos: [] as File[],
  sourceFile: null as File | null,
};

export default function DmInstructionsPage() {
  const profile = useProfile();
  const isAdmin = profile.role === "admin";
  const editEnabled = useFeatureFlag("dm_instructions_edit");
  const canEdit = isAdmin || editEnabled;
  const pageAccessEnabled = useFeatureFlag("page_access_dm_instructions");
  const canView = isAdmin || pageAccessEnabled;
  const supabase = createClient();

  const [guides, setGuides] = useState<Guide[]>([]);
  const [activeGuide, setActiveGuide] = useState<Guide | null>(null);
  const [activePhotoUrls, setActivePhotoUrls] = useState<string[]>([]);
  const [activeSourceUrl, setActiveSourceUrl] = useState<string | null>(null);
  const [form, setForm] = useState<typeof EMPTY_FORM | null>(null);
  const [saving, setSaving] = useState(false);

  const loadGuides = useCallback(async () => {
    const { data } = await supabase.from("dm_instructions").select("*").order("sort_order").order("id");
    setGuides(data ?? []);
  }, [supabase]);

  useEffect(() => {
    loadGuides();
  }, [loadGuides]);

  useEffect(() => {
    let cancelled = false;
    setActivePhotoUrls([]);
    setActiveSourceUrl(null);
    if (activeGuide?.photos.length) {
      Promise.all(activeGuide.photos.map((p) => getAttachmentUrl(p))).then((urls) => {
        if (!cancelled) setActivePhotoUrls(urls.filter((u): u is string => !!u));
      });
    }
    if (activeGuide?.source_file_url) {
      getAttachmentUrl(activeGuide.source_file_url).then((url) => {
        if (!cancelled) setActiveSourceUrl(url);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [activeGuide]);

  const openEdit = (guide?: Guide) => {
    setForm(
      guide
        ? { id: guide.id, title: guide.title, steps: guide.steps.join("\n"), photos: [], sourceFile: null }
        : { ...EMPTY_FORM }
    );
  };

  const saveForm = async () => {
    if (!form || !form.title.trim() || !form.steps.trim()) return;
    setSaving(true);
    try {
      const newPhotoUrls = await Promise.all(form.photos.map((f) => uploadAttachment(f, "dm-instructions")));
      const sourceUrl = form.sourceFile ? await uploadAttachment(form.sourceFile, "dm-instructions") : undefined;
      const steps = form.steps.split("\n").map((s) => s.trim()).filter(Boolean);
      if (form.id) {
        const existing = guides.find((g) => g.id === form.id);
        await supabase
          .from("dm_instructions")
          .update({
            title: form.title.trim(),
            steps,
            photos: [...(existing?.photos ?? []), ...newPhotoUrls],
            ...(sourceUrl ? { source_file_url: sourceUrl, source_file_name: form.sourceFile?.name ?? null } : {}),
          })
          .eq("id", form.id);
      } else {
        await supabase.from("dm_instructions").insert({
          title: form.title.trim(),
          steps,
          photos: newPhotoUrls,
          source_file_url: sourceUrl ?? null,
          source_file_name: form.sourceFile?.name ?? null,
        });
      }
      setForm(null);
      setActiveGuide(null);
      loadGuides();
    } finally {
      setSaving(false);
    }
  };

  const deleteGuide = async (guide: Guide) => {
    if (!confirm(`Delete "${guide.title}"? This can't be undone.`)) return;
    await supabase.from("dm_instructions").delete().eq("id", guide.id);
    await Promise.all([...guide.photos.map((p) => deleteAttachment(p)), deleteAttachment(guide.source_file_url)]);
    setActiveGuide(null);
    loadGuides();
  };

  if (!canView) {
    return (
      <Section title="DM Instructions">
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
          {form.id ? "Edit guide" : "New guide"}
        </h2>
        <div className="flex flex-col gap-3 max-w-md">
          <input
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="text-sm px-4 py-2 rounded-full outline-none"
            style={{ border: `1px solid ${border}`, background: fill, color: ink }}
          />
          <textarea
            placeholder="Steps, one per line"
            value={form.steps}
            onChange={(e) => setForm({ ...form, steps: e.target.value })}
            rows={10}
            className="text-sm px-4 py-3 rounded-2xl outline-none"
            style={{ border: `1px solid ${border}`, background: fill, color: ink }}
          />
          <label className="text-xs" style={{ color: inkSoft }}>
            Add reference photo(s) — kept alongside any already on this guide
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setForm({ ...form, photos: Array.from(e.target.files ?? []) })}
              className="block mt-1 text-xs"
            />
          </label>
          <label className="text-xs" style={{ color: inkSoft }}>
            Original file (PDF/Word) — optional, replaces the current one if set
            <input
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => setForm({ ...form, sourceFile: e.target.files?.[0] ?? null })}
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

  if (activeGuide) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setActiveGuide(null)} className="text-xs" style={{ color: navyText }}>
            ← Back to DM Instructions
          </button>
          {canEdit && (
            <div className="flex gap-2">
              <button onClick={() => openEdit(activeGuide)} style={{ color: navyText }}>
                <Pencil size={15} />
              </button>
              <button onClick={() => deleteGuide(activeGuide)} style={{ color: "#000000" }}>
                <Trash2 size={15} />
              </button>
            </div>
          )}
        </div>
        <h2
          className="text-lg font-semibold mb-3 inline-block pb-1"
          style={{ color: navyText, borderBottom: `3px solid ${orange}` }}
        >
          {activeGuide.title}
        </h2>
        <ol className="flex flex-col gap-2.5 mb-4">
          {activeGuide.steps.map((step, i) => (
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
        {activePhotoUrls.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {activePhotoUrls.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={url}
                alt={`${activeGuide.title} reference ${i + 1}`}
                className="rounded-2xl"
                style={{ maxHeight: 220, border: `1px solid ${border}` }}
              />
            ))}
          </div>
        )}
        {activeSourceUrl && (
          <a
            href={activeSourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-2xl"
            style={{ background: "#FFFFFF", color: ink, border: `1px solid ${border}` }}
          >
            <ExternalLink size={13} /> View original {activeGuide.source_file_name ? `(${activeGuide.source_file_name})` : "file"}
          </a>
        )}
      </div>
    );
  }

  return (
    <Section title="DM Instructions" subtitle={`${guides.length} reference guide${guides.length === 1 ? "" : "s"}`}>
      {canEdit && (
        <button
          onClick={() => openEdit()}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-2xl mb-4"
          style={{ background: orangeSoft, color: navy }}
        >
          <Plus size={13} /> Add guide
        </button>
      )}

      {guides.length === 0 ? (
        <p className="text-sm" style={{ color: inkSoft }}>
          No guides yet.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {guides.map((guide) => (
            <button
              key={guide.id}
              onClick={() => setActiveGuide(guide)}
              className="flex items-center justify-between p-3 rounded-2xl text-left"
              style={{ background: bg, border: `1px solid ${border}` }}
            >
              <span className="text-sm font-medium" style={{ color: ink }}>{guide.title}</span>
              <ChevronRight size={16} style={{ color: inkSoft }} />
            </button>
          ))}
        </div>
      )}
    </Section>
  );
}
