"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
import { checklistDayISO } from "@/lib/dates";
import { initials } from "@/lib/shift-status";
import { Section } from "@/components/section";
import { border, ink, inkSoft, navy, orange, surface } from "@/lib/design-tokens";

type Item = {
  id: number;
  text: string;
  sort_order: number;
  done: boolean;
  completedByName: string | null;
};
type Checklist = { id: number; title: string; items: Item[] };

export default function ChecklistsPage() {
  const profile = useProfile();
  const supabase = createClient();
  const checklistDay = checklistDayISO();
  const [checklists, setChecklists] = useState<Checklist[]>([]);

  const loadData = useCallback(async () => {
    const [listsRes, itemsRes, completionsRes] = await Promise.all([
      supabase.from("checklists").select("id, title").order("sort_order"),
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

  return (
    <Section title="Checklists" subtitle="Tap an item to mark it done">
      <div className="flex flex-col gap-6">
        {checklists.map((list) => {
          const doneCount = list.items.filter((i) => i.done).length;
          return (
            <div key={list.id}>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-sm font-medium">{list.title}</span>
                <span className="text-xs" style={{ color: inkSoft }}>
                  {doneCount}/{list.items.length}
                </span>
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
    </Section>
  );
}
