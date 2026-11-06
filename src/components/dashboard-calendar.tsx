"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
import { todayISO } from "@/lib/dates";
import { ukMajorDatesForYear } from "@/lib/uk-calendar";
import type { EventContent } from "@/lib/event-content";
import { EmojiText } from "@/components/emoji-text";
import { bg, border, ink, inkSoft, navy, navyText } from "@/lib/design-tokens";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

type EventRow = { id: number; title: string; content: EventContent | null };
type BirthdayRow = { id: number; name: string; day: number; month: number };
type YMD = { year: number; month: number; day: number };
type CalendarNote = { id: number; note_date: string; text: string; added_by: string | null; addedByName: string };

const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const ymdKey = (y: number, m: number, d: number) => `${y}-${m}-${d}`;

/** "Thursday 12 November 2026" (or the legacy year-less "6 November") -> {year, month, day}. */
function parseTimelineDate(dateStr: string, fallbackYear: number): YMD | null {
  const match = dateStr.match(/(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const month = MONTH_NAMES.findIndex((m) => m.toLowerCase() === match[2].toLowerCase());
  if (month === -1) return null;
  const year = match[3] ? parseInt(match[3], 10) : fallbackYear;
  return { year, month, day };
}

export function DashboardCalendar({ events, birthdays }: { events: EventRow[]; birthdays: BirthdayRow[] }) {
  const profile = useProfile();
  const supabase = createClient();

  const [today] = useState<YMD>(() => {
    const [y, m, d] = todayISO().split("-").map(Number);
    return { year: y, month: m - 1, day: d };
  });
  const [viewYear, setViewYear] = useState(today.year);
  const [viewMonth, setViewMonth] = useState(today.month);
  const [selected, setSelected] = useState<YMD | null>(today);
  const [notes, setNotes] = useState<CalendarNote[]>([]);
  const [draftText, setDraftText] = useState("");
  const [saving, setSaving] = useState(false);

  const loadNotes = useCallback(async () => {
    const { data } = await supabase
      .from("calendar_notes")
      .select("id, note_date, text, added_by, created_at")
      .order("note_date");
    const rows = data ?? [];
    const ids = Array.from(new Set(rows.map((r) => r.added_by).filter(Boolean))) as string[];
    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("id, name").in("id", ids)
      : { data: [] };
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]));
    setNotes(
      rows.map((r) => ({
        id: r.id,
        note_date: r.note_date,
        text: r.text,
        added_by: r.added_by,
        addedByName: nameById.get(r.added_by ?? "") ?? "Someone",
      }))
    );
  }, [supabase]);

  useEffect(() => {
    loadNotes();
    const channel = supabase
      .channel("dashboard-calendar-notes")
      .on("postgres_changes", { event: "*", schema: "public", table: "calendar_notes" }, loadNotes)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadNotes, supabase]);

  const eventDays = useMemo(() => {
    const flat: { year: number; month: number; day: number; title: string }[] = [];
    const fallbackYear = new Date().getFullYear();
    for (const ev of events) {
      for (const day of ev.content?.timeline ?? []) {
        const parsed = parseTimelineDate(day.date, fallbackYear);
        if (parsed) flat.push({ ...parsed, title: ev.title });
      }
    }
    return flat;
  }, [events]);

  const majors = useMemo(() => {
    return [viewYear - 1, viewYear, viewYear + 1].flatMap((y) => ukMajorDatesForYear(y));
  }, [viewYear]);

  const detailsFor = useCallback(
    (y: number, m: number, d: number) => {
      const titles = eventDays.filter((e) => e.year === y && e.month === m && e.day === d).map((e) => e.title);
      const names = birthdays.filter((b) => b.month === m + 1 && b.day === d).map((b) => b.name);
      const labels = majors.filter((h) => h.year === y && h.month === m && h.day === d).map((h) => h.label);
      const key = ymdKey(y, m, d);
      const teamNotes = notes.filter((n) => n.note_date === `${y}-${pad2(m + 1)}-${pad2(d)}`);
      return { titles, names, labels, teamNotes, key };
    },
    [eventDays, birthdays, majors, notes]
  );

  const goMonth = (delta: number) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
    setSelected(y === today.year && m === today.month ? today : null);
  };

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startWeekday = (firstOfMonth.getDay() + 6) % 7; // Monday-start
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(viewYear, viewMonth, 1 - startWeekday + i);
    const y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
    const inMonth = m === viewMonth && y === viewYear;
    const isToday = y === today.year && m === today.month && day === today.day;
    const isSelected = !!selected && y === selected.year && m === selected.month && day === selected.day;
    const det = detailsFor(y, m, day);
    return {
      key: det.key,
      y, m, day, inMonth, isToday, isSelected,
      hasEvent: det.titles.length > 0,
      hasBirthday: det.names.length > 0,
      hasHoliday: det.labels.length > 0,
      hasNote: det.teamNotes.length > 0,
    };
  });

  const selectedDetails = selected ? detailsFor(selected.year, selected.month, selected.day) : null;
  const selectedHasAny = !!selectedDetails && (selectedDetails.titles.length + selectedDetails.names.length + selectedDetails.labels.length) > 0;

  const addNote = async () => {
    const text = draftText.trim();
    if (!text || !selected || saving) return;
    setSaving(true);
    await supabase.from("calendar_notes").insert({
      note_date: `${selected.year}-${pad2(selected.month + 1)}-${pad2(selected.day)}`,
      text,
      added_by: profile.id,
    });
    setDraftText("");
    setSaving(false);
    loadNotes();
  };

  const deleteNote = async (id: number) => {
    await supabase.from("calendar_notes").delete().eq("id", id);
    loadNotes();
  };

  return (
    <div className="p-4 rounded-2xl" style={{ background: bg, border: `1px solid ${border}` }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarDays size={15} style={{ color: ink }} />
          <span className="text-sm font-medium" style={{ color: navyText }}>
            Calendar
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => goMonth(-1)}
            aria-label="Previous month"
            className="flex items-center justify-center rounded-full"
            style={{ width: 20, height: 20, border: `1px solid ${border}` }}
          >
            <ChevronLeft size={12} />
          </button>
          <span className="text-xs" style={{ color: ink, minWidth: 84, textAlign: "center" }}>
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          <button
            onClick={() => goMonth(1)}
            aria-label="Next month"
            className="flex items-center justify-center rounded-full"
            style={{ width: 20, height: 20, border: `1px solid ${border}` }}
          >
            <ChevronRight size={12} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1.5">
        {WEEKDAY_LETTERS.map((w, i) => (
          <span key={i} className="text-center text-[11px]" style={{ color: ink }}>
            {w}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const markColor = cell.isToday ? bg : ink;
          return (
            <button
              key={cell.key}
              onClick={() => setSelected({ year: cell.y, month: cell.m, day: cell.day })}
              aria-label={`${WEEKDAY_FULL[new Date(cell.y, cell.m, cell.day).getDay()]} ${cell.day} ${MONTH_NAMES[cell.m]} ${cell.y}`}
              className="flex flex-col items-center justify-center gap-0.5 rounded-lg"
              style={{
                height: 36,
                background: cell.isToday ? navy : "transparent",
                color: cell.isToday ? bg : cell.inMonth ? ink : "rgba(0,0,0,0.32)",
                border: cell.isSelected && !cell.isToday ? `1.5px solid ${border}` : "1.5px solid transparent",
              }}
            >
              <span className="text-xs leading-none">{cell.day}</span>
              <span className="flex items-center gap-0.5" style={{ height: 5 }}>
                {cell.hasEvent && (
                  <span style={{ width: 4, height: 4, borderRadius: "50%", background: markColor, display: "inline-block" }} />
                )}
                {cell.hasBirthday && (
                  <span style={{ width: 4, height: 4, background: markColor, display: "inline-block" }} />
                )}
                {cell.hasHoliday && (
                  <span
                    style={{
                      width: 0, height: 0,
                      borderLeft: "3px solid transparent", borderRight: "3px solid transparent",
                      borderBottom: `5px solid ${markColor}`, display: "inline-block",
                    }}
                  />
                )}
                {cell.hasNote && (
                  <span style={{ width: 4, height: 4, background: markColor, transform: "rotate(45deg)", display: "inline-block" }} />
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 flex-wrap mt-3 pt-2.5" style={{ borderTop: `1px solid rgba(0,0,0,0.15)` }}>
        <span className="flex items-center gap-1.5 text-[11px]" style={{ color: ink }}>
          <span style={{ width: 4, height: 4, borderRadius: "50%", background: ink, display: "inline-block" }} /> Event
        </span>
        <span className="flex items-center gap-1.5 text-[11px]" style={{ color: ink }}>
          <span style={{ width: 4, height: 4, background: ink, display: "inline-block" }} /> Birthday
        </span>
        <span className="flex items-center gap-1.5 text-[11px]" style={{ color: ink }}>
          <span
            style={{
              width: 0, height: 0,
              borderLeft: "3px solid transparent", borderRight: "3px solid transparent",
              borderBottom: `5px solid ${ink}`, display: "inline-block",
            }}
          />{" "}
          Major day
        </span>
        <span className="flex items-center gap-1.5 text-[11px]" style={{ color: ink }}>
          <span style={{ width: 4, height: 4, background: ink, transform: "rotate(45deg)", display: "inline-block" }} /> Note
        </span>
      </div>

      <div className="mt-3 pt-3" style={{ borderTop: `1px solid rgba(0,0,0,0.15)` }}>
        {selected ? (
          <>
            <div className="text-xs font-semibold mb-1.5" style={{ color: ink }}>
              {WEEKDAY_FULL[new Date(selected.year, selected.month, selected.day).getDay()]} {selected.day}{" "}
              {MONTH_NAMES[selected.month]}
            </div>
            {selectedHasAny ? (
              <div className="flex flex-col gap-1">
                {selectedDetails!.labels.map((label, i) => (
                  <div key={`h-${i}`} className="text-xs" style={{ color: ink }}>
                    ★ {label}
                  </div>
                ))}
                {selectedDetails!.names.map((name, i) => (
                  <div key={`b-${i}`} className="text-xs" style={{ color: ink }}>
                    <EmojiText text={`🎂 ${name}`} />
                  </div>
                ))}
                {selectedDetails!.titles.map((title, i) => (
                  <div key={`e-${i}`} className="text-xs" style={{ color: ink }}>
                    {title}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs" style={{ color: inkSoft }}>
                Nothing marked this day.
              </p>
            )}

            {/* Team notes — shared with everyone, not personal */}
            <div className="mt-2.5 pt-2.5" style={{ borderTop: "1px dashed rgba(0,0,0,0.25)" }}>
              <div className="text-[11px] font-semibold mb-1.5" style={{ color: ink }}>
                Team notes
              </div>
              {selectedDetails!.teamNotes.length > 0 && (
                <div className="flex flex-col gap-1 mb-1.5">
                  {selectedDetails!.teamNotes.map((n) => (
                    <div key={n.id} className="flex items-start justify-between gap-2 text-xs" style={{ color: ink }}>
                      <span>
                        ◆ {n.text} <span style={{ color: inkSoft }}>— {n.addedByName}</span>
                      </span>
                      {(n.added_by === profile.id || profile.role === "admin") && (
                        <button onClick={() => deleteNote(n.id)} aria-label="Delete note" className="shrink-0 p-0.5">
                          <X size={11} style={{ color: inkSoft }} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <input
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addNote()}
                  placeholder="Add a note for this day…"
                  className="flex-1 min-w-0 text-xs rounded-lg px-2 py-1.5"
                  style={{ border: `1px solid ${border}`, color: ink, background: bg }}
                />
                <button
                  onClick={addNote}
                  disabled={saving || !draftText.trim()}
                  className="text-xs font-medium px-2.5 py-1.5 rounded-lg shrink-0 disabled:opacity-40"
                  style={{ background: navy, color: "#FFFFFF" }}
                >
                  Add
                </button>
              </div>
            </div>
          </>
        ) : (
          <p className="text-xs" style={{ color: inkSoft }}>
            Tap a day to see what&apos;s on.
          </p>
        )}
      </div>
    </div>
  );
}
