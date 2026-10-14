"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { todayISO, weekStartOf, weekDates } from "@/lib/dates";
import { bg, border, ink, inkSoft, navy, navyText, orange } from "@/lib/design-tokens";

type LogItem = { id: number; text: string; sort_order: number };

// A Monday-start week, distinct from the Friday-start rota week — this
// matches the paper logs this replaces (e.g. "Week Commencing" Monday).
const TABLE_WEEK_START_DAY = 1;

// An item with exactly this label auto-fills with whoever's viewing today's
// column, so they don't have to type their own name in every day.
const AUTOFILL_NAME_LABEL = "barista name";

export function ChecklistLogTable({
  items,
  canEdit,
  profileId,
  profileName,
}: {
  items: LogItem[];
  canEdit: boolean;
  profileId: string;
  profileName: string;
}) {
  const supabase = createClient();
  const [weekStart, setWeekStart] = useState(() => weekStartOf(todayISO(), TABLE_WEEK_START_DAY));
  const [values, setValues] = useState<Map<string, string>>(new Map());
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const days = weekDates(weekStart);
  const itemIds = items.map((i) => i.id);

  const loadValues = useCallback(async () => {
    if (itemIds.length === 0) return;
    const { data } = await supabase
      .from("checklist_completions")
      .select("item_id, checklist_day, value")
      .in("item_id", itemIds)
      .gte("checklist_day", days[0].date)
      .lte("checklist_day", days[6].date);
    const next = new Map((data ?? []).map((c) => [`${c.item_id}:${c.checklist_day}`, c.value ?? ""]));

    if (canEdit && profileName.trim()) {
      const today = todayISO();
      const nameItem = items.find((i) => i.text.trim().toLowerCase() === AUTOFILL_NAME_LABEL);
      const key = nameItem ? `${nameItem.id}:${today}` : null;
      if (nameItem && key && days.some((d) => d.date === today) && !next.get(key)) {
        await supabase
          .from("checklist_completions")
          .insert({ item_id: nameItem.id, checklist_day: today, completed_by: profileId, value: profileName });
        // Whether this insert won or lost a race against another concurrent
        // load (e.g. React's dev double-effect), re-fetch this one cell so
        // the UI reflects whatever actually ended up in the database.
        const { data: refreshed } = await supabase
          .from("checklist_completions")
          .select("value")
          .eq("item_id", nameItem.id)
          .eq("checklist_day", today)
          .maybeSingle();
        if (refreshed) next.set(key, refreshed.value ?? "");
      }
    }

    setValues(next);
    setDrafts(Object.fromEntries(next.entries()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, weekStart, items, canEdit, profileId, profileName]);

  useEffect(() => {
    loadValues();
    const channel = supabase
      .channel(`checklist-log-${itemIds.join("-")}-${weekStart}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "checklist_completions" }, loadValues)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadValues]);

  const saveCell = async (itemId: number, date: string) => {
    const key = `${itemId}:${date}`;
    const value = (drafts[key] ?? "").trim();
    if (value === (values.get(key) ?? "")) return;
    setSavingKey(key);
    try {
      await supabase.from("checklist_completions").delete().eq("item_id", itemId).eq("checklist_day", date);
      if (value) {
        await supabase
          .from("checklist_completions")
          .insert({ item_id: itemId, checklist_day: date, completed_by: profileId, value });
      }
    } finally {
      setSavingKey(null);
      loadValues();
    }
  };

  const gridBorder = `1px solid ${border}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs" style={{ color: inkSoft }}>
          Week commencing {days[0].label}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setWeekStart(addWeeks(weekStart, -1))}
            aria-label="Previous week"
            className="flex items-center justify-center shrink-0 rounded-full"
            style={{ width: 22, height: 22, border: `1px solid ${border}` }}
          >
            <ChevronLeft size={13} />
          </button>
          <button
            onClick={() => setWeekStart(weekStartOf(todayISO(), TABLE_WEEK_START_DAY))}
            className="text-xs px-2.5 py-1 rounded-2xl"
            style={{ border: `1px solid ${border}`, color: ink }}
          >
            This week
          </button>
          <button
            onClick={() => setWeekStart(addWeeks(weekStart, 1))}
            aria-label="Next week"
            className="flex items-center justify-center shrink-0 rounded-full"
            style={{ width: 22, height: 22, border: `1px solid ${border}` }}
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl" style={{ border: gridBorder }}>
        <table className="text-xs" style={{ borderCollapse: "collapse", minWidth: 130 + days.length * 92 }}>
          <thead>
            <tr>
              <th
                className="text-left p-2 sticky left-0"
                style={{ background: bg, color: ink, minWidth: 130, border: gridBorder }}
              >
                Item
              </th>
              {days.map((d) => {
                const isToday = d.date === todayISO();
                return (
                  <th
                    key={d.date}
                    className="text-center p-2"
                    style={{
                      background: isToday ? orange : bg,
                      color: isToday ? "#FFFFFF" : ink,
                      minWidth: 92,
                      border: gridBorder,
                    }}
                  >
                    <div>{d.day}</div>
                    <div style={{ fontWeight: 400, color: isToday ? "#FFFFFF" : inkSoft }}>{d.label}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td
                  className="p-2 sticky left-0"
                  style={{ background: bg, color: ink, fontWeight: 500, border: gridBorder }}
                >
                  {item.text}
                </td>
                {days.map((d) => {
                  const key = `${item.id}:${d.date}`;
                  return (
                    <td key={d.date} className="p-1" style={{ border: gridBorder, background: bg }}>
                      <input
                        value={drafts[key] ?? ""}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
                        onBlur={() => saveCell(item.id, d.date)}
                        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                        disabled={!canEdit}
                        className="w-full text-xs px-2 py-1.5 rounded-lg outline-none disabled:opacity-70"
                        style={{
                          border: `1.5px solid ${savingKey === key ? navy : border}`,
                          color: navyText,
                          background: "#FFFFFF",
                          minWidth: 80,
                        }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function addWeeks(iso: string, weeks: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}
