"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { todayISO, weekStartOf, weekDates } from "@/lib/dates";
import { bg, border, fill, ink, inkSoft, navy, navyText, orange } from "@/lib/design-tokens";

type LogItem = { id: number; text: string; sort_order: number };

// A Monday-start week, distinct from the Friday-start rota week — this
// matches the paper logs this replaces (e.g. "Week Commencing" Monday).
const TABLE_WEEK_START_DAY = 1;

export function ChecklistLogTable({
  items,
  canEdit,
  profileId,
}: {
  items: LogItem[];
  canEdit: boolean;
  profileId: string;
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
    setValues(next);
    setDrafts(Object.fromEntries(next.entries()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, weekStart, items.length]);

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

      <div className="overflow-x-auto rounded-2xl" style={{ border: `1px solid ${border}` }}>
        <table className="text-xs" style={{ borderCollapse: "collapse", minWidth: 160 + items.length * 150 }}>
          <thead>
            <tr>
              <th
                className="text-left p-2 sticky left-0"
                style={{ background: bg, color: ink, minWidth: 90, borderBottom: `1px solid ${border}` }}
              >
                Day
              </th>
              {items.map((item) => (
                <th
                  key={item.id}
                  className="text-left p-2"
                  style={{ background: bg, color: ink, minWidth: 150, borderBottom: `1px solid ${border}` }}
                >
                  {item.text}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const isToday = d.date === todayISO();
              return (
                <tr key={d.date}>
                  <td
                    className="p-2 sticky left-0"
                    style={{
                      background: isToday ? orange : fill,
                      color: isToday ? "#FFFFFF" : ink,
                      fontWeight: 500,
                      borderBottom: `1px solid ${border}`,
                    }}
                  >
                    {d.day} {d.label}
                  </td>
                  {items.map((item) => {
                    const key = `${item.id}:${d.date}`;
                    return (
                      <td key={item.id} className="p-1" style={{ borderBottom: `1px solid ${border}` }}>
                        <input
                          value={drafts[key] ?? ""}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
                          onBlur={() => saveCell(item.id, d.date)}
                          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                          disabled={!canEdit}
                          className="w-full text-xs px-2 py-1.5 rounded-lg outline-none disabled:opacity-70"
                          style={{
                            border: `1px solid ${savingKey === key ? navy : "transparent"}`,
                            color: navyText,
                            background: "#FFFFFF",
                            minWidth: 130,
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
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
