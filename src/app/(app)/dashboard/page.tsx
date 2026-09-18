"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Clock, Sparkles, Users, BedDouble, CheckSquare, Cake, Trash2, History, Pencil, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
import { todayISO, checklistDayISO } from "@/lib/dates";
import { timestamp } from "@/lib/relative-time";
import { computeShiftStatus, initials } from "@/lib/shift-status";
import type { EventContent } from "@/lib/event-content";
import { EmojiText } from "@/components/emoji-text";
import { WeatherWidget } from "@/components/weather-widget";
import {
  bg,
  border,
  fill,
  good,
  ink,
  inkSoft,
  navy,
  navyText,
  orange,
  orangeSoft,
} from "@/lib/design-tokens";

type WorkingToday = { name: string; start: string | null; end: string | null };
type EventRow = { id: number; title: string; content: EventContent | null };
type BirthdayRow = { id: number; name: string; day: number; month: number };
type LineField = "time" | "what" | "where";
type LineOverride = {
  eventId: number;
  dayDate: string;
  itemIndex: number;
  field: LineField;
  previousValue: string;
  newValue: string;
  changedByName: string;
  changedAt: string;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function timelineDayIsToday(dateStr: string, now: Date) {
  const match = dateStr.match(/(\d{1,2})\s+([A-Za-z]+)/);
  if (!match) return false;
  return parseInt(match[1], 10) === now.getDate() && match[2] === MONTHS[now.getMonth()];
}

// A grab-bag of greetings — some deadpan, some daft — so the dashboard
// doesn't say the exact same thing every single time you open it.
const GREETINGS: ((name: string) => string)[] = [
  (n) => `Good to see you, ${n}`,
  (n) => `Welcome back, ${n}`,
  (n) => `Hello, ${n}`,
  (n) => `Hey ${n}, ready to roll?`,
  (n) => `Alright, ${n}?`,
  (n) => `Hiya ${n}`,
  (n) => `Yo ${n}, let's get into it`,
  (n) => `Here's today's rundown, ${n}`,
  (n) => `Onwards, ${n}`,
  (n) => `${n}! Just in time to save the day (probably)`,
  (n) => `Brace yourself, ${n} — it's shift o'clock`,
  (n) => `Plot twist: ${n} showed up`,
  (n) => `Ah, ${n} has entered the chat`,
  (n) => `Look who it is — ${n}`,
  (n) => `${n}, reporting for duty`,
  (n) => `Team Ops missed you, ${n}`,
  (n) => `Back at it again, ${n}`,
  (n) => `${n}! The legend arrives`,
];

type Todo = {
  id: number;
  text: string;
  done: boolean;
  checklist_day: string;
  added_by_name: string;
  completed_by_name: string | null;
};

export default function DashboardPage() {
  const profile = useProfile();
  const supabase = createClient();
  // Picked client-side only (not in the initializer) so the server-rendered
  // HTML and the first client render agree — Math.random() at render time
  // would otherwise mismatch and force React to redo the initial hydration.
  const firstName = profile.name.split(" ")[0];
  const [greeting, setGreeting] = useState(() => GREETINGS[0](firstName));
  useEffect(() => {
    setGreeting(GREETINGS[Math.floor(Math.random() * GREETINGS.length)](firstName));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [now, setNow] = useState(new Date());
  const [covers, setCovers] = useState<{ gih_count: number | null; breakfast_count: number | null } | null>(null);
  const [working, setWorking] = useState<WorkingToday[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [birthdays, setBirthdays] = useState<BirthdayRow[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [lineOverrides, setLineOverrides] = useState<LineOverride[]>([]);
  const [showEventHistory, setShowEventHistory] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    eventId: number;
    dayDate: string;
    itemIndex: number;
    currentTime: string;
    currentWhat: string;
    currentWhere: string;
  } | null>(null);
  const [editDraft, setEditDraft] = useState({ time: "", what: "", where: "" });
  const [newTask, setNewTask] = useState("");

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const today = todayISO();
  const checklistDay = checklistDayISO();

  const loadData = useCallback(async () => {
    const [coversRes, shiftsRes, eventsRes, birthdaysRes, todayTodosRes, outstandingRes, overridesRes] =
      await Promise.all([
        supabase.from("daily_covers").select("*").eq("date", today).maybeSingle(),
        supabase
          .from("rota_shifts")
          .select("staff_id, staff_name, start_time, end_time, status")
          .eq("date", today)
          .eq("status", "work"),
        supabase.from("events").select("id, title, content").not("content", "is", null),
        supabase.from("birthdays").select("id, name, day, month"),
        supabase
          .from("todos")
          .select("*")
          .eq("checklist_day", checklistDay)
          .order("created_at"),
        supabase
          .from("todos")
          .select("*")
          .lt("checklist_day", checklistDay)
          .eq("done", false)
          .order("created_at"),
        supabase.from("event_line_overrides").select("*").order("changed_at"),
      ]);

    setCovers(coversRes.data ?? null);
    setEvents(eventsRes.data ?? []);
    setBirthdays(birthdaysRes.data ?? []);

    const staffIds = (shiftsRes.data ?? []).map((s) => s.staff_id).filter(Boolean) as string[];
    const allTodoIds = [
      ...(todayTodosRes.data ?? []).flatMap((t) => [t.added_by, t.completed_by].filter(Boolean)),
      ...(outstandingRes.data ?? []).flatMap((t) => [t.added_by, t.completed_by].filter(Boolean)),
    ] as string[];
    const overrideIds = (overridesRes.data ?? []).map((o) => o.changed_by).filter(Boolean) as string[];
    const nameIds = Array.from(new Set([...staffIds, ...allTodoIds, ...overrideIds]));
    const { data: profiles } = nameIds.length
      ? await supabase.from("profiles").select("id, name").in("id", nameIds)
      : { data: [] };
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]));

    setLineOverrides(
      (overridesRes.data ?? []).map((o) => ({
        eventId: o.event_id,
        dayDate: o.day_date,
        itemIndex: o.item_index,
        field: o.field as LineField,
        previousValue: o.previous_value,
        newValue: o.new_value,
        changedByName: nameById.get(o.changed_by ?? "") ?? "Someone",
        changedAt: o.changed_at,
      }))
    );

    setWorking(
      (shiftsRes.data ?? [])
        .map((s) => ({
          name: (s.staff_id && nameById.get(s.staff_id)) || s.staff_name,
          start: s.start_time,
          end: s.end_time,
        }))
        .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""))
    );

    const mapTodo = (t: {
      id: number;
      text: string;
      done: boolean;
      checklist_day: string;
      added_by: string | null;
      completed_by: string | null;
    }): Todo => ({
      id: t.id,
      text: t.text,
      done: t.done,
      checklist_day: t.checklist_day,
      added_by_name: nameById.get(t.added_by ?? "") ?? "Someone",
      completed_by_name: t.completed_by ? nameById.get(t.completed_by) ?? "Someone" : null,
    });

    setTodos([
      ...(todayTodosRes.data ?? []).map(mapTodo),
      ...(outstandingRes.data ?? []).map(mapTodo),
    ]);
  }, [supabase, today, checklistDay]);

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel("dashboard-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "todos" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "rota_shifts" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_covers" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "birthdays" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_line_overrides" }, loadData)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData, supabase]);

  const todayTodos = todos.filter((t) => t.checklist_day === checklistDay);
  const outstandingTodos = todos.filter((t) => t.checklist_day !== checklistDay && !t.done);
  const todaysEventDays = events.flatMap((e) => {
    const day = (e.content?.timeline ?? []).find((d) => timelineDayIsToday(d.date, now));
    return day ? [{ id: e.id, title: e.title, day }] : [];
  });
  const todaysBirthdays = birthdays.filter((b) => b.day === now.getDate() && b.month === now.getMonth() + 1);

  const overridesFor = (eventId: number, dayDate: string, itemIndex: number, field: LineField) =>
    lineOverrides.filter(
      (o) => o.eventId === eventId && o.dayDate === dayDate && o.itemIndex === itemIndex && o.field === field
    );

  const currentValueFor = (eventId: number, dayDate: string, itemIndex: number, field: LineField, staticValue: string) => {
    const matches = overridesFor(eventId, dayDate, itemIndex, field);
    return matches.length > 0 ? matches[matches.length - 1].newValue : staticValue;
  };

  const originalValueFor = (eventId: number, dayDate: string, itemIndex: number, field: LineField, staticValue: string) => {
    const matches = overridesFor(eventId, dayDate, itemIndex, field);
    return matches.length > 0 ? matches[0].previousValue : staticValue;
  };

  const FIELD_LABEL: Record<LineField, string> = { time: "Time", what: "Title", where: "Location" };

  const todaysHistory = todaysEventDays
    .flatMap(({ id, day }) => lineOverrides.filter((o) => o.eventId === id && o.dayDate === day.date))
    .sort((a, b) => b.changedAt.localeCompare(a.changedAt));

  const itemLabelFor = (eventId: number, dayDate: string, itemIndex: number) => {
    const day = todaysEventDays.find((d) => d.id === eventId && d.day.date === dayDate)?.day;
    const staticWhat = day?.events[itemIndex]?.what ?? "Item";
    return currentValueFor(eventId, dayDate, itemIndex, "what", staticWhat);
  };

  const startEditingItem = (eventId: number, dayDate: string, itemIndex: number, time: string, what: string, where: string) => {
    setEditingItem({ eventId, dayDate, itemIndex, currentTime: time, currentWhat: what, currentWhere: where });
    setEditDraft({ time, what, where });
  };

  const saveLineEdit = async () => {
    if (!editingItem) return;
    const { eventId, dayDate, itemIndex, currentTime, currentWhat, currentWhere } = editingItem;
    const time = editDraft.time.trim();
    const what = editDraft.what.trim();
    const where = editDraft.where.trim();

    const changes: { field: LineField; previous: string; next: string }[] = [];
    if (time && time !== currentTime) changes.push({ field: "time", previous: currentTime, next: time });
    if (what && what !== currentWhat) changes.push({ field: "what", previous: currentWhat, next: what });
    if (where !== currentWhere) changes.push({ field: "where", previous: currentWhere, next: where });

    if (changes.length === 0) {
      setEditingItem(null);
      return;
    }
    await supabase.from("event_line_overrides").insert(
      changes.map((c) => ({
        event_id: eventId,
        day_date: dayDate,
        item_index: itemIndex,
        field: c.field,
        previous_value: c.previous,
        new_value: c.next,
        changed_by: profile.id,
      }))
    );
    setEditingItem(null);
    loadData();
  };

  const addTask = async () => {
    if (!newTask.trim()) return;
    await supabase.from("todos").insert({
      text: newTask.trim(),
      added_by: profile.id,
      checklist_day: checklistDay,
    });
    setNewTask("");
    loadData();
  };

  const toggleTask = async (task: Todo) => {
    await supabase
      .from("todos")
      .update({ done: !task.done, completed_by: !task.done ? profile.id : null })
      .eq("id", task.id);
    loadData();
  };

  const deleteTask = async (task: Todo) => {
    await supabase.from("todos").delete().eq("id", task.id);
    loadData();
  };

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timeLabel = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div>
      <h1
        className="text-lg font-semibold mb-1 inline-block pb-1"
        style={{ color: navyText, borderBottom: `3px solid ${orange}` }}
      >
        {greeting}
      </h1>
      <p className="text-sm mb-6 mt-2" style={{ color: inkSoft }}>
        Here&apos;s what&apos;s happening on shift today
      </p>

      {/* Date & time, and weather, side by side */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div
          className="flex items-center justify-between p-4 rounded-2xl"
          style={{ background: bg, border: `1px solid ${border}`, minHeight: 76 }}
        >
          <div>
            <div className="text-xs mb-1" style={{ color: inkSoft }}>
              {dateLabel}
            </div>
            <div className="text-2xl font-semibold tabular-nums" style={{ color: navyText }}>
              {timeLabel}
            </div>
          </div>
          <Clock size={32} style={{ color: orange, opacity: 0.8 }} />
        </div>

        <WeatherWidget />
      </div>

      {/* Birthdays today — only shown when it's actually someone's birthday */}
      {todaysBirthdays.length > 0 && (
        <div className="p-4 rounded-2xl mb-4" style={{ background: bg, border: `1px solid ${border}` }}>
          <div className="flex items-center gap-2 mb-3">
            <Cake size={15} style={{ color: orange }} />
            <span className="text-sm font-medium" style={{ color: navyText }}>
              Birthdays today
            </span>
          </div>
          <div className="flex flex-col gap-1">
            {todaysBirthdays.map((b) => (
              <div key={b.id} className="text-sm" style={{ color: ink }}>
                <EmojiText text={`🎂 ${b.name}`} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        {/* Guests today */}
        <div
          className="p-4 rounded-2xl"
          style={{
            background: bg,
            border: `1px solid ${border}`,
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <BedDouble size={15} style={{ color: orange }} />
            <span className="text-sm font-medium" style={{ color: navyText }}>
              Guests today
            </span>
          </div>
          {covers ? (
            <div className="flex items-center gap-8">
              <div>
                <div className="text-xs" style={{ color: inkSoft }}>
                  Breakfast
                </div>
                <div className="text-2xl font-semibold" style={{ color: navyText }}>
                  {covers.breakfast_count ?? "–"}
                </div>
              </div>
              <div>
                <div className="text-xs" style={{ color: inkSoft }}>
                  GIH
                </div>
                <div className="text-2xl font-semibold" style={{ color: navyText }}>
                  {covers.gih_count ?? "–"}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm" style={{ color: inkSoft }}>
              No data for today
            </p>
          )}
        </div>

        {/* Working today */}
        <div
          className="p-4 rounded-2xl"
          style={{
            background: bg,
            border: `1px solid ${border}`,
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Users size={15} style={{ color: orange }} />
            <span className="text-sm font-medium" style={{ color: navyText }}>
              Working today
            </span>
          </div>
          {working.length === 0 ? (
            <p className="text-sm" style={{ color: inkSoft }}>
              No one scheduled today.
            </p>
          ) : (
            <div className="flex flex-col">
              {working.map((p, i) => {
                const status =
                  p.start && p.end ? computeShiftStatus(p.start, p.end, nowMinutes) : null;
                const isIn = status === "in";
                const isOut = status === "out";
                const isDue = status === "due";
                return (
                  <div key={p.name}>
                    {i > 0 && <div style={{ height: 1, background: border, margin: "0 12px" }} />}
                    <div className="flex items-center gap-2 py-2">
                    <div
                      className="flex items-center justify-center rounded-full text-xs font-medium shrink-0"
                      style={{
                        width: 24,
                        height: 24,
                        background: "#000000",
                        color: bg,
                      }}
                    >
                      {initials(p.name)}
                    </div>
                    <span
                      className="text-sm"
                      style={{
                        color: isIn ? navyText : isOut ? inkSoft : ink,
                        fontWeight: isIn ? 600 : 400,
                      }}
                    >
                      {p.name.split(" ")[0]}
                    </span>
                    {isIn && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-2xl"
                        style={{ background: "#000000", color: bg, fontWeight: 600 }}
                      >
                        In
                      </span>
                    )}
                    {isOut && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-2xl"
                        style={{ background: bg, color: ink, border: `1px solid ${border}`, fontWeight: 600 }}
                      >
                        Out
                      </span>
                    )}
                    {isDue && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-2xl"
                        style={{ background: orangeSoft, color: orange, fontWeight: 600 }}
                      >
                        Due
                      </span>
                    )}
                    {p.start && p.end && (
                      <span className="text-xs ml-auto" style={{ color: inkSoft }}>
                        {p.start}–{p.end}
                      </span>
                    )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Events today */}
      <div className="p-4 rounded-2xl mb-4" style={{ background: bg, border: `1px solid ${border}` }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={15} style={{ color: orange }} />
            <span className="text-sm font-medium" style={{ color: navyText }}>
              Events today
            </span>
          </div>
          {todaysEventDays.length > 0 && (
            <button
              onClick={() => setShowEventHistory((prev) => !prev)}
              className="flex items-center gap-1 text-xs"
              style={{ color: showEventHistory ? navy : inkSoft, fontWeight: showEventHistory ? 700 : 400 }}
            >
              <History size={13} />
              History
            </button>
          )}
        </div>
        {showEventHistory && (
          <div className="flex flex-col gap-2 p-3 rounded-2xl mb-3" style={{ background: fill, border: `1px solid ${border}` }}>
            {todaysHistory.length === 0 ? (
              <p className="text-xs" style={{ color: inkSoft }}>
                No changes yet today.
              </p>
            ) : (
              todaysHistory.map((h, i) => (
                <div key={i} className="text-xs" style={{ color: ink }}>
                  <span style={{ fontWeight: 500 }}>{itemLabelFor(h.eventId, h.dayDate, h.itemIndex)}</span>
                  {" "}
                  ({FIELD_LABEL[h.field]}): {h.previousValue || "—"} → {h.newValue || "—"}
                  <span style={{ color: inkSoft }}>
                    {" "}
                    · {h.changedByName} · {timestamp(h.changedAt)}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
        {todaysEventDays.length === 0 ? (
          <p className="text-sm" style={{ color: inkSoft }}>
            Nothing scheduled.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {todaysEventDays.map(({ id, title, day }) => (
              <div key={id}>
                <Link href={`/events/${id}`} className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium" style={{ color: "#000000" }}>
                    {title}
                  </span>
                  {day.tag && (
                    <span className="text-xs" style={{ color: "#000000" }}>
                      {day.tag}
                    </span>
                  )}
                </Link>
                <div className="flex flex-col">
                  {day.events.map((e, j) => {
                    const currentTime = currentValueFor(id, day.date, j, "time", e.time);
                    const originalTime = originalValueFor(id, day.date, j, "time", e.time);
                    const timeChanged = overridesFor(id, day.date, j, "time").length > 0 && originalTime !== currentTime;

                    const currentWhat = currentValueFor(id, day.date, j, "what", e.what);
                    const originalWhat = originalValueFor(id, day.date, j, "what", e.what);
                    const whatChanged = overridesFor(id, day.date, j, "what").length > 0 && originalWhat !== currentWhat;

                    const currentWhere = currentValueFor(id, day.date, j, "where", e.where ?? "");
                    const originalWhere = originalValueFor(id, day.date, j, "where", e.where ?? "");
                    const whereChanged = overridesFor(id, day.date, j, "where").length > 0 && originalWhere !== currentWhere;

                    const isEditingThis =
                      editingItem?.eventId === id && editingItem.dayDate === day.date && editingItem.itemIndex === j;

                    return (
                      <div key={j}>
                        {j > 0 && <div style={{ height: 1, background: border, margin: "0 12px" }} />}
                        {isEditingThis ? (
                          <div className="flex flex-col gap-2 py-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="time"
                                value={editDraft.time}
                                onChange={(ev) => setEditDraft((prev) => ({ ...prev, time: ev.target.value }))}
                                className="text-xs rounded px-2 py-1.5 shrink-0"
                                style={{ border: `1px solid ${border}`, color: ink, background: fill, width: 90 }}
                                autoFocus
                              />
                              <input
                                value={editDraft.what}
                                onChange={(ev) => setEditDraft((prev) => ({ ...prev, what: ev.target.value }))}
                                placeholder="Set up / access"
                                className="text-sm rounded px-2 py-1.5 flex-1 min-w-0"
                                style={{ border: `1px solid ${border}`, color: ink, background: fill }}
                              />
                            </div>
                            <input
                              value={editDraft.where}
                              onChange={(ev) => setEditDraft((prev) => ({ ...prev, where: ev.target.value }))}
                              placeholder="Vavasour Lobby, Vavasour Suite"
                              className="text-xs rounded px-2 py-1.5"
                              style={{ border: `1px solid ${border}`, color: ink, background: fill }}
                            />
                            <div className="flex items-center justify-end gap-3">
                              <button onClick={() => setEditingItem(null)} className="text-xs" style={{ color: inkSoft }}>
                                Cancel
                              </button>
                              <button
                                onClick={saveLineEdit}
                                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-2xl"
                                style={{ background: navy, color: "#FFFFFF" }}
                              >
                                <Check size={13} /> Confirm
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-3 py-2">
                            <div className="shrink-0 w-16">
                              {timeChanged ? (
                                <span className="flex flex-col text-xs">
                                  <span style={{ textDecoration: "line-through", color: inkSoft }}>{originalTime}</span>
                                  <span style={{ color: "#000000", fontWeight: 600 }}>{currentTime}</span>
                                </span>
                              ) : (
                                <span className="text-xs" style={{ color: "#000000" }}>
                                  {currentTime}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              {whatChanged ? (
                                <div className="text-sm">
                                  <div style={{ textDecoration: "line-through", color: inkSoft }}>{originalWhat}</div>
                                  <div style={{ color: "#000000", fontWeight: 600 }}>{currentWhat}</div>
                                </div>
                              ) : (
                                <div className="text-sm" style={{ color: "#000000" }}>
                                  {currentWhat}
                                </div>
                              )}
                              {(currentWhere || whereChanged) &&
                                (whereChanged ? (
                                  <div className="text-xs">
                                    {originalWhere && (
                                      <div style={{ textDecoration: "line-through", color: inkSoft }}>{originalWhere}</div>
                                    )}
                                    {currentWhere && <div style={{ color: inkSoft, fontWeight: 600 }}>{currentWhere}</div>}
                                  </div>
                                ) : (
                                  <div className="text-xs" style={{ color: inkSoft }}>
                                    {currentWhere}
                                  </div>
                                ))}
                              {e.brief && (
                                <div className="text-xs mt-0.5" style={{ color: orange }}>
                                  {e.brief}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => startEditingItem(id, day.date, j, currentTime, currentWhat, currentWhere)}
                              className="shrink-0 self-start p-1"
                              aria-label="Edit"
                            >
                              <Pencil size={12} style={{ color: inkSoft }} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* To do today */}
      <div
        className="p-4 rounded-2xl"
        style={{ background: bg, border: `1px solid ${border}` }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CheckSquare size={15} style={{ color: orange }} />
            <span className="text-sm font-medium" style={{ color: navyText }}>
              To do today
            </span>
          </div>
          <span className="text-xs" style={{ color: inkSoft }}>
            {todayTodos.filter((t) => !t.done).length} open
          </span>
        </div>
        {todayTodos.length === 0 ? (
          <p className="text-sm" style={{ color: good }}>
            Nothing added yet.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {todayTodos.map((task, i) => (
              <div
                key={task.id}
                className="flex items-center gap-3 py-1.5 w-full"
                style={{ borderBottom: i < todayTodos.length - 1 ? `1px solid ${border}` : "none" }}
              >
                <button
                  onClick={() => toggleTask(task)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <span
                    className="flex items-center justify-center shrink-0"
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      border: `1.5px solid ${task.done ? orange : border}`,
                      background: task.done ? orange : "transparent",
                    }}
                  >
                    {task.done && (
                      <span style={{ color: navy, fontSize: 11, lineHeight: 1, fontWeight: 700 }}>
                        ✓
                      </span>
                    )}
                  </span>
                  <span
                    className="text-sm flex-1"
                    style={{
                      color: task.done ? inkSoft : ink,
                      textDecoration: task.done ? "line-through" : "none",
                    }}
                  >
                    {task.text}
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0 ml-3">
                    <span
                      className="flex items-center justify-center rounded-full text-xs font-medium"
                      style={{ width: 20, height: 20, background: orangeSoft, color: navyText }}
                    >
                      {initials(task.done ? task.completed_by_name ?? task.added_by_name : task.added_by_name)}
                    </span>
                    <span className="text-xs" style={{ color: inkSoft }}>
                      {task.done ? task.completed_by_name : task.added_by_name}
                    </span>
                  </span>
                </button>
                {profile.role === "admin" && (
                  <button onClick={() => deleteTask(task)} className="shrink-0 p-1" aria-label="Delete task">
                    <Trash2 size={14} style={{ color: inkSoft }} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: `1px solid ${border}` }}>
          <input
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTask()}
            placeholder="Add something to do…"
            className="flex-1 text-sm px-4 py-2 rounded-full outline-none"
            style={{ border: `1px solid ${border}`, color: ink, background: fill }}
          />
          <button
            onClick={addTask}
            className="text-xs font-medium px-3 py-1.5 rounded-2xl shrink-0"
            style={{ background: navy, color: "#FFFFFF" }}
          >
            Add
          </button>
        </div>
      </div>

      {/* Outstanding */}
      {outstandingTodos.length > 0 && (
        <div
          className="p-4 rounded-2xl mt-4"
          style={{ background: bg, border: `1px solid ${orange}` }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckSquare size={15} style={{ color: orange }} />
              <span className="text-sm font-medium" style={{ color: orange }}>
                Outstanding
              </span>
            </div>
            <span className="text-xs" style={{ color: inkSoft }}>
              {outstandingTodos.length} carried over
            </span>
          </div>
          <div className="flex flex-col gap-1">
            {outstandingTodos.map((task, i) => (
              <div
                key={task.id}
                className="flex items-center gap-3 py-1.5 w-full"
                style={{ borderBottom: i < outstandingTodos.length - 1 ? `1px solid ${border}` : "none" }}
              >
                <button
                  onClick={() => toggleTask(task)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <span
                    className="flex items-center justify-center shrink-0"
                    style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${border}` }}
                  />
                  <span className="text-sm flex-1" style={{ color: ink }}>
                    {task.text}
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0 ml-3">
                    <span
                      className="flex items-center justify-center rounded-full text-xs font-medium"
                      style={{ width: 20, height: 20, background: orangeSoft, color: navyText }}
                    >
                      {initials(task.added_by_name)}
                    </span>
                    <span className="text-xs" style={{ color: inkSoft }}>
                      {task.added_by_name}
                    </span>
                  </span>
                </button>
                {profile.role === "admin" && (
                  <button onClick={() => deleteTask(task)} className="shrink-0 p-1" aria-label="Delete task">
                    <Trash2 size={14} style={{ color: inkSoft }} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
