"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
import { checklistDayISO } from "@/lib/dates";
import { initials } from "@/lib/shift-status";
import { Section } from "@/components/section";
import { bg, border, ink, inkSoft, navy, navyText, orange, orangeSoft, surface } from "@/lib/design-tokens";

const SECTIONS = ["Bar", "Still Room", "Restaurant", "Vav Bar", "Cellars"];

type Item = {
  id: number;
  text: string;
  sort_order: number;
  done: boolean;
  completedByName: string | null;
};
type Checklist = { id: number; title: string; section: string; items: Item[] };

const EMPTY_FORM = { id: null as number | null, title: "", items: "" };

export default function ChecklistsPage() {
  const profile = useProfile();
  const isAdmin = profile.role === "admin";
  const supabase = createClient();
  const checklistDay = checklistDayISO();

  const [section, setSection] = useState(SECTIONS[0]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [form, setForm] = useState<typeof EMPTY_FORM | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    const [listsRes, itemsRes, completionsRes] = await Promise.all([
      supabase.from("checklists").select("id, title, section").order("sort_order"),
      supabase.from("checklist_items").select("id, checklist_id, text, sort_order").order("sort_order"),
      supabase
        .from("checklist_completions")
        .select("item_id, completed_by")
        .eq("checklist_day", checklistDay),
    ]);

    const completedByItemId = new Map(
      (completionsRes.data ?? []).map((c) => [c.item_id, c.completed_by])
    );
    const completerIds = Array.from(
      new Set((completionsRes.data ?? []).map((c) => c.completed_by).filter(Boolean))
    ) as string[];
    const { data: profiles } = completerIds.length
      ? await supabase.from("profiles").select("id, name").in("id", completerIds)
      : { data: [] };
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]));

    setChecklists(
      (listsRes.data ?? []).map((list) => ({
        id: list.id,
        title: list.title,
        section: list.section,
        items: (itemsRes.data ?? [])
          .filter((i) => i.checklist_id === list.id)
          .map((i) => {
            const completedBy = completedByItemId.get(i.id) ?? null;
            return {
              id: i.id,
              text: i.text,
              sort_order: i.sort_order,
              done: completedByItemId.has(i.id),
              completedByName: completedBy ? nameById.get(completedBy) ?? "Someone" : null,
            };
          }),
      }))
    );
  }, [supabase, checklistDay]);

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel("checklist-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "checklist_completions" },
        loadData
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "checklists" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "checklist_items" }, loadData)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData, supabase]);

  const toggleItem = async (item: Item) => {
    if (item.done) {
      await supabase
        .from("checklist_completions")
        .delete()
        .eq("item_id", item.id)
        .eq("checklist_day", checklistDay);
    } else {
      await supabase
        .from("checklist_completions")
        .insert({ item_id: item.id, checklist_day: checklistDay, completed_by: profile.id });
    }
    loadData();
  };

  const openEdit = (list?: Checklist) => {
    setForm(
      list
        ? { id: list.id, title: list.title, items: list.items.map((i) => i.text).join("\n") }
        : { ...EMPTY_FORM }
    );
  };

  const saveForm = async () => {
    if (!form || !form.title.trim() || !form.items.trim()) return;
    setSaving(true);
    try {
      const itemTexts = form.items.split("\n").map((s) => s.trim()).filter(Boolean);
      let checklistId = form.id;
      if (checklistId) {
        await supabase.from("checklists").update({ title: form.title.trim() }).eq("id", checklistId);
        await supabase.from("checklist_items").delete().eq("checklist_id", checklistId);
      } else {
        const { data, error } = await supabase
          .from("checklists")
          .insert({ title: form.title.trim(), section, sort_order: checklists.length })
          .select()
          .single();
        if (error || !data) throw error;
        checklistId = data.id;
      }
      await supabase.from("checklist_items").insert(
        itemTexts.map((text, i) => ({ checklist_id: checklistId!, text, sort_order: i }))
      );
      setForm(null);
      loadData();
    } finally {
      setSaving(false);
    }
  };

  const deleteChecklist = async (id: number) => {
    if (!confirm("Delete this checklist and all its items? This can't be undone.")) return;
    await supabase.from("checklists").delete().eq("id", id);
    loadData();
  };

  const sectionChecklists = checklists.filter((c) => c.section === section);

  if (form) {
    return (
      <div>
        <button onClick={() => setForm(null)} className="text-xs mb-4" style={{ color: navyText }}>
          ← Cancel
        </button>
        <h2 className="text-lg font-semibold mb-4" style={{ color: navyText }}>
          {form.id ? "Edit checklist" : `New checklist — ${section}`}
        </h2>
        <div className="flex flex-col gap-3 max-w-md">
          <input
            placeholder="Checklist title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="text-sm px-4 py-2 rounded-full outline-none"
            style={{ border: `1px solid ${border}`, background: bg, color: ink }}
          />
          <textarea
            placeholder="Items, one per line"
            value={form.items}
            onChange={(e) => setForm({ ...form, items: e.target.value })}
            rows={10}
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

  return (
    <Section title="Checklists" subtitle="Tap an item to mark it done">
      <div className="flex gap-1.5 overflow-x-auto mb-6 pb-1" style={{ scrollbarWidth: "thin" }}>
        {SECTIONS.map((s) => {
          const active = s === section;
          return (
            <button
              key={s}
              onClick={() => setSection(s)}
              className="text-xs px-3.5 py-1.5 rounded-2xl shrink-0 whitespace-nowrap"
              style={{
                background: active ? navy : surface,
                color: active ? "#FFFFFF" : ink,
                border: `1px solid ${active ? navy : border}`,
                fontWeight: active ? 600 : 400,
              }}
            >
              {s}
            </button>
          );
        })}
      </div>

      {isAdmin && (
        <button
          onClick={() => openEdit()}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-2xl mb-4"
          style={{ background: orangeSoft, color: navy }}
        >
          <Plus size={13} /> Add checklist to {section}
        </button>
      )}

      {sectionChecklists.length === 0 ? (
        <p className="text-sm" style={{ color: inkSoft }}>
          No checklists yet for {section}.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {sectionChecklists.map((list) => {
            const doneCount = list.items.filter((i) => i.done).length;
            return (
              <div key={list.id}>
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-sm font-medium">{list.title}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: inkSoft }}>
                      {doneCount}/{list.items.length}
                    </span>
                    {isAdmin && (
                      <>
                        <button onClick={() => openEdit(list)} style={{ color: navyText }}>
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => deleteChecklist(list.id)} style={{ color: "#C24A3B" }}>
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  {list.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => toggleItem(item)}
                      className="flex items-center gap-3 p-2.5 rounded-2xl text-left"
                      style={{ background: surface, border: `1px solid ${border}` }}
                    >
                      <span
                        className="flex items-center justify-center shrink-0"
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 4,
                          border: `1.5px solid ${item.done ? orange : border}`,
                          background: item.done ? orange : "transparent",
                        }}
                      >
                        {item.done && (
                          <span style={{ color: navy, fontSize: 11, lineHeight: 1, fontWeight: 700 }}>
                            ✓
                          </span>
                        )}
                      </span>
                      <span
                        className="text-sm flex-1"
                        style={{
                          color: item.done ? inkSoft : ink,
                          textDecoration: item.done ? "line-through" : "none",
                        }}
                      >
                        {item.text}
                      </span>
                      {item.done && item.completedByName && (
                        <span className="flex items-center gap-1.5 shrink-0">
                          <span
                            className="flex items-center justify-center rounded-full text-xs font-medium"
                            style={{ width: 20, height: 20, background: "#FDE3CD", color: navy }}
                          >
                            {initials(item.completedByName)}
                          </span>
                          <span className="text-xs" style={{ color: inkSoft }}>
                            {item.completedByName}
                          </span>
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}
