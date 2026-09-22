"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2, Download, Send as SendIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
import { useFeatureFlag } from "@/lib/feature-flags-context";
import { checklistDayISO, addDaysISO, weekStartOf } from "@/lib/dates";
import { initials } from "@/lib/shift-status";
import { Section } from "@/components/section";
import { bg, border, fill, ink, inkSoft, navy, navyText, orange, orangeSoft } from "@/lib/design-tokens";

const SECTIONS = ["Bar", "Still Room", "Restaurant", "Vav Bar", "Cellars"];

type Item = {
  id: number;
  text: string;
  sort_order: number;
  done: boolean;
  completedByName: string | null;
};
type Checklist = { id: number; title: string; section: string; weekly: boolean; items: Item[] };

const EMPTY_FORM = { id: null as number | null, title: "", items: "", weekly: false };

export default function ChecklistsPage() {
  const profile = useProfile();
  const isAdmin = profile.role === "admin";
  const checklistsEditEnabled = useFeatureFlag("checklists_edit");
  const supabase = createClient();
  const checklistDay = checklistDayISO();
  const weekStart = weekStartOf(checklistDay);

  const [section, setSection] = useState(SECTIONS[0]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [form, setForm] = useState<typeof EMPTY_FORM | null>(null);
  const [saving, setSaving] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportFrom, setReportFrom] = useState(() => addDaysISO(checklistDay, -6));
  const [reportTo, setReportTo] = useState(checklistDay);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailFormat, setEmailFormat] = useState<"xlsx" | "pdf">("pdf");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ ok: boolean; message: string } | null>(null);

  const loadData = useCallback(async () => {
    const dayKeys = Array.from(new Set([checklistDay, weekStart]));
    const [listsRes, itemsRes, completionsRes] = await Promise.all([
      supabase.from("checklists").select("id, title, section, weekly").order("sort_order"),
      supabase.from("checklist_items").select("id, checklist_id, text, sort_order").order("sort_order"),
      supabase
        .from("checklist_completions")
        .select("item_id, checklist_day, completed_by")
        .in("checklist_day", dayKeys),
    ]);

    // Keyed by "itemId:checklistDay" since a weekly checklist's completion
    // lives under weekStart while a daily one lives under today's checklistDay.
    const completionByKey = new Map(
      (completionsRes.data ?? []).map((c) => [`${c.item_id}:${c.checklist_day}`, c.completed_by])
    );
    const completerIds = Array.from(
      new Set((completionsRes.data ?? []).map((c) => c.completed_by).filter(Boolean))
    ) as string[];
    const { data: profiles } = completerIds.length
      ? await supabase.from("profiles").select("id, name").in("id", completerIds)
      : { data: [] };
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]));

    setChecklists(
      (listsRes.data ?? []).map((list) => {
        const resetKey = list.weekly ? weekStart : checklistDay;
        return {
          id: list.id,
          title: list.title,
          section: list.section,
          weekly: list.weekly,
          items: (itemsRes.data ?? [])
            .filter((i) => i.checklist_id === list.id)
            .map((i) => {
              const completedBy = completionByKey.get(`${i.id}:${resetKey}`) ?? null;
              return {
                id: i.id,
                text: i.text,
                sort_order: i.sort_order,
                done: completionByKey.has(`${i.id}:${resetKey}`),
                completedByName: completedBy ? nameById.get(completedBy) ?? "Someone" : null,
              };
            }),
        };
      })
    );
  }, [supabase, checklistDay, weekStart]);

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

  const toggleItem = async (item: Item, weekly: boolean) => {
    const dayKey = weekly ? weekStart : checklistDay;
    if (item.done) {
      await supabase
        .from("checklist_completions")
        .delete()
        .eq("item_id", item.id)
        .eq("checklist_day", dayKey);
    } else {
      await supabase
        .from("checklist_completions")
        .insert({ item_id: item.id, checklist_day: dayKey, completed_by: profile.id });
    }
    loadData();
  };

  const openEdit = (list?: Checklist) => {
    setForm(
      list
        ? { id: list.id, title: list.title, items: list.items.map((i) => i.text).join("\n"), weekly: list.weekly }
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
        await supabase.from("checklists").update({ title: form.title.trim(), weekly: form.weekly }).eq("id", checklistId);
        await supabase.from("checklist_items").delete().eq("checklist_id", checklistId);
      } else {
        const { data, error } = await supabase
          .from("checklists")
          .insert({ title: form.title.trim(), section, sort_order: checklists.length, weekly: form.weekly })
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
            style={{ border: `1px solid ${border}`, background: fill, color: ink }}
          />
          <textarea
            placeholder="Items, one per line"
            value={form.items}
            onChange={(e) => setForm({ ...form, items: e.target.value })}
            rows={10}
            className="text-sm px-4 py-3 rounded-2xl outline-none"
            style={{ border: `1px solid ${border}`, background: fill, color: ink }}
          />
          <label className="flex items-center gap-2 text-xs" style={{ color: inkSoft }}>
            <input
              type="checkbox"
              checked={form.weekly}
              onChange={(e) => setForm({ ...form, weekly: e.target.checked })}
            />
            Resets weekly (Friday–Thursday) instead of daily — a tick stays ticked all week
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

  const sendReportEmail = async () => {
    const to = emailTo.trim();
    if (!to) return;
    setSendingEmail(true);
    setEmailStatus(null);
    try {
      const res = await fetch("/api/checklists/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: to, from: reportFrom, to: reportTo, format: emailFormat }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEmailStatus({ ok: false, message: body.error || "Couldn't send that — try again." });
        return;
      }
      setEmailStatus({ ok: true, message: `Sent to ${to}.` });
      setEmailTo("");
    } finally {
      setSendingEmail(false);
    }
  };

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
                background: active ? "#000000" : "#FFFFFF",
                color: active ? "#FFFFFF" : "#000000",
                border: "1px solid #000000",
                fontWeight: active ? 600 : 400,
              }}
            >
              {s}
            </button>
          );
        })}
      </div>

      {(isAdmin || checklistsEditEnabled) && (
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => openEdit()}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-2xl"
            style={{ background: orangeSoft, color: navy }}
          >
            <Plus size={13} /> Add checklist to {section}
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowReport((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-2xl"
              style={{ background: "#FFFFFF", color: navy, border: `1px solid ${border}` }}
            >
              <Download size={13} /> Export report
            </button>
          )}
        </div>
      )}

      {isAdmin && showReport && (
        <div className="flex flex-col gap-3 p-3 rounded-2xl mb-6" style={{ background: bg, border: `1px solid ${border}` }}>
          <div className="text-sm font-semibold" style={{ color: navyText }}>
            Export completion report
          </div>
          <p className="text-xs" style={{ color: inkSoft }}>
            Shows every task ticked in the selected period, when, and by whom — across all sections.
          </p>
          <div className="flex items-center gap-2">
            <label className="text-xs flex-1" style={{ color: inkSoft }}>
              From
              <input
                type="date"
                value={reportFrom}
                onChange={(e) => setReportFrom(e.target.value)}
                max={reportTo}
                className="block mt-1 w-full text-sm px-3 py-1.5 rounded-full outline-none"
                style={{ border: `1px solid ${border}`, background: fill, color: ink }}
              />
            </label>
            <label className="text-xs flex-1" style={{ color: inkSoft }}>
              To
              <input
                type="date"
                value={reportTo}
                onChange={(e) => setReportTo(e.target.value)}
                min={reportFrom}
                max={checklistDay}
                className="block mt-1 w-full text-sm px-3 py-1.5 rounded-full outline-none"
                style={{ border: `1px solid ${border}`, background: fill, color: ink }}
              />
            </label>
          </div>
          <div className="flex gap-2">
            <a
              href={`/api/checklists/report?from=${reportFrom}&to=${reportTo}&format=xlsx`}
              className="flex-1 text-center text-sm font-medium py-2 rounded-full"
              style={{ background: navy, color: "#FFFFFF" }}
            >
              Download .xlsx
            </a>
            <a
              href={`/api/checklists/report?from=${reportFrom}&to=${reportTo}&format=pdf`}
              className="flex-1 text-center text-sm font-medium py-2 rounded-full"
              style={{ background: "#FFFFFF", color: navy, border: `1px solid ${border}` }}
            >
              Download PDF
            </a>
            <button
              onClick={() => {
                setShowEmailForm((v) => !v);
                setEmailStatus(null);
              }}
              aria-label="Send by email"
              title="Send by email"
              className="flex items-center justify-center shrink-0 rounded-full"
              style={{
                width: 36,
                height: 36,
                border: `1px solid ${showEmailForm ? navy : border}`,
                background: showEmailForm ? navy : "transparent",
              }}
            >
              <SendIcon size={14} style={{ color: showEmailForm ? "#FFFFFF" : navy }} />
            </button>
          </div>

          {showEmailForm && (
            <div className="flex flex-col gap-2 pt-1">
              <input
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="Send to…"
                className="text-sm px-4 py-2 rounded-full outline-none"
                style={{ border: `1px solid ${border}`, color: ink, background: fill }}
              />
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-xs" style={{ color: ink }}>
                  <input type="radio" checked={emailFormat === "xlsx"} onChange={() => setEmailFormat("xlsx")} />
                  .xlsx
                </label>
                <label className="flex items-center gap-1.5 text-xs" style={{ color: ink }}>
                  <input type="radio" checked={emailFormat === "pdf"} onChange={() => setEmailFormat("pdf")} />
                  .pdf
                </label>
              </div>
              {emailStatus && (
                <p className="text-xs" style={{ color: emailStatus.ok ? inkSoft : "#E4002B" }}>
                  {emailStatus.message}
                </p>
              )}
              <button
                onClick={sendReportEmail}
                disabled={sendingEmail || !emailTo.trim()}
                className="text-xs font-medium px-3 py-1.5 rounded-2xl w-fit disabled:opacity-60"
                style={{ background: navy, color: "#FFFFFF" }}
              >
                {sendingEmail ? "Sending…" : "Send"}
              </button>
            </div>
          )}
        </div>
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
                  <span className="flex items-center gap-1.5">
                    <span className="text-sm font-medium">{list.title}</span>
                    {list.weekly && (
                      <span className="text-xs" style={{ color: inkSoft }}>
                        (resets weekly)
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: inkSoft }}>
                      {doneCount}/{list.items.length}
                    </span>
                    {(isAdmin || checklistsEditEnabled) && (
                      <>
                        <button onClick={() => openEdit(list)} style={{ color: navyText }}>
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => deleteChecklist(list.id)} style={{ color: "#000000" }}>
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
                      onClick={() => toggleItem(item, list.weekly)}
                      className="flex items-center gap-3 p-2.5 rounded-2xl text-left"
                      style={{ background: bg, border: `1px solid ${border}` }}
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
                            style={{ width: 20, height: 20, background: "#FFFFFF", color: navy }}
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
