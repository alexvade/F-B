"use client";

import { useEffect, useState, useCallback } from "react";
import { Clock, Sparkles, Users, BedDouble, CheckSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
import { todayISO, checklistDayISO } from "@/lib/dates";
import { computeShiftStatus, initials } from "@/lib/shift-status";
import {
  bg,
  border,
  good,
  ink,
  inkSoft,
  navy,
  navySoft,
  navyText,
  orange,
  orangeSoft,
  surface,
} from "@/lib/design-tokens";

type WorkingToday = { name: string; start: string | null; end: string | null };
type DashboardEvent = { id: number; room: string | null; title: string };
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

  const [now, setNow] = useState(new Date());
  const [covers, setCovers] = useState<{ gih_count: number | null; breakfast_count: number | null } | null>(null);
  const [working, setWorking] = useState<WorkingToday[]>([]);
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTask, setNewTask] = useState("");

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const today = todayISO();
  const checklistDay = checklistDayISO();

  const loadData = useCallback(async () => {
    const [coversRes, shiftsRes, eventsRes, todayTodosRes, outstandingRes] = await Promise.all([
      supabase.from("daily_covers").select("*").eq("date", today).maybeSingle(),
      supabase
        .from("rota_shifts")
        .select("staff_id, staff_name, start_time, end_time, status")
        .eq("date", today)
        .eq("status", "work"),
      supabase.from("daily_events").select("*").eq("date", today).order("id"),
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
    ]);

    setCovers(coversRes.data ?? null);
    setEvents(eventsRes.data ?? []);

    const staffIds = (shiftsRes.data ?? []).map((s) => s.staff_id).filter(Boolean) as string[];
    const allTodoIds = [
      ...(todayTodosRes.data ?? []).flatMap((t) => [t.added_by, t.completed_by].filter(Boolean)),
      ...(outstandingRes.data ?? []).flatMap((t) => [t.added_by, t.completed_by].filter(Boolean)),
    ] as string[];
    const nameIds = Array.from(new Set([...staffIds, ...allTodoIds]));
    const { data: profiles } = nameIds.length
      ? await supabase.from("profiles").select("id, name").in("id", nameIds)
      : { data: [] };
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]));

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
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_events" }, loadData)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData, supabase]);

  const todayTodos = todos.filter((t) => t.checklist_day === checklistDay);
  const outstandingTodos = todos.filter((t) => t.checklist_day !== checklistDay && !t.done);

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
        Good to see you, {profile.name.split(" ")[0]}
      </h1>
      <p className="text-sm mb-6 mt-2" style={{ color: inkSoft }}>
        Here&apos;s what&apos;s happening on shift today
      </p>

      {/* Date & time */}
      <div
        className="flex items-center justify-between p-5 rounded-3xl mb-4"
        style={{ background: `linear-gradient(135deg, ${navySoft} 0%, ${surface} 100%)` }}
      >
        <div>
          <div className="text-sm" style={{ color: inkSoft }}>
            {dateLabel}
          </div>
          <div className="text-3xl font-semibold tabular-nums" style={{ color: navyText }}>
            {timeLabel}
          </div>
        </div>
        <Clock size={32} style={{ color: orange, opacity: 0.8 }} />
      </div>

      {/* Guests today */}
      <div
        className="flex items-center justify-between p-4 rounded-2xl mb-4"
        style={{
          background: `linear-gradient(135deg, ${orangeSoft} 0%, ${surface} 100%)`,
          border: `1px solid ${border}`,
        }}
      >
        <div className="flex items-center gap-2">
          <BedDouble size={15} style={{ color: inkSoft }} />
          <span className="text-sm font-medium" style={{ color: navyText }}>
            Guests today
          </span>
        </div>
        {covers ? (
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-xs" style={{ color: inkSoft }}>
                GIH
              </div>
              <div className="text-lg font-semibold" style={{ color: navyText }}>
                {covers.gih_count ?? "–"}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs" style={{ color: inkSoft }}>
                Breakfast
              </div>
              <div className="text-lg font-semibold" style={{ color: navyText }}>
                {covers.breakfast_count ?? "–"}
              </div>
            </div>
          </div>
        ) : (
          <span className="text-xs" style={{ color: inkSoft }}>
            No data for today
          </span>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        {/* Working today */}
        <div className="p-4 rounded-2xl" style={{ background: surface, border: `1px solid ${border}` }}>
          <div className="flex items-center gap-2 mb-3">
            <Users size={15} style={{ color: inkSoft }} />
            <span className="text-sm font-medium" style={{ color: navyText }}>
              Working today
            </span>
          </div>
          {working.length === 0 ? (
            <p className="text-sm" style={{ color: inkSoft }}>
              No one scheduled today.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {working.map((p) => {
                const status =
                  p.start && p.end ? computeShiftStatus(p.start, p.end, nowMinutes) : null;
                const isIn = status === "in";
                const isOut = status === "out";
                const isDue = status === "due";
                return (
                  <div key={p.name} className="flex items-center gap-2">
                    <div
                      className="flex items-center justify-center rounded-full text-xs font-medium shrink-0"
                      style={{
                        width: 24,
                        height: 24,
                        background: isIn ? navy : isOut ? border : orangeSoft,
                        color: isIn ? surface : isOut ? inkSoft : navy,
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
                        style={{ background: navySoft, color: navyText, fontWeight: 600 }}
                      >
                        In
                      </span>
                    )}
                    {isOut && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-2xl"
                        style={{ background: bg, color: inkSoft, fontWeight: 600 }}
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
                );
              })}
            </div>
          )}
        </div>

        {/* Events today */}
        <div className="p-4 rounded-2xl" style={{ background: surface, border: `1px solid ${border}` }}>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={15} style={{ color: inkSoft }} />
            <span className="text-sm font-medium" style={{ color: navyText }}>
              Events today
            </span>
          </div>
          {events.length === 0 ? (
            <p className="text-sm" style={{ color: inkSoft }}>
              Nothing scheduled.
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {events.map((e) => (
                <div key={e.id} className="flex gap-3">
                  <span className="text-xs shrink-0 w-14" style={{ color: inkSoft }}>
                    {e.room}
                  </span>
                  <span className="text-sm">{e.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* To do today */}
      <div className="p-4 rounded-2xl" style={{ background: surface, border: `1px solid ${border}` }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CheckSquare size={15} style={{ color: inkSoft }} />
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
            {todayTodos.map((task) => (
              <button
                key={task.id}
                onClick={() => toggleTask(task)}
                className="flex items-center gap-3 py-1.5 w-full text-left"
                style={{ borderBottom: `1px solid ${border}` }}
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
            style={{ border: `1px solid ${border}`, color: ink, background: bg }}
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
          style={{ background: surface, border: `1px solid ${orange}` }}
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
            {outstandingTodos.map((task) => (
              <button
                key={task.id}
                onClick={() => toggleTask(task)}
                className="flex items-center gap-3 py-1.5 w-full text-left"
                style={{ borderBottom: `1px solid ${border}` }}
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
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
