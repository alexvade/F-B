"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
import { todayISO, mondayOf, addDaysISO, weekDates } from "@/lib/dates";
import type { ShiftStatus } from "@/lib/supabase/types";
import {
  bg,
  border,
  ink,
  inkSoft,
  navy,
  navySoft,
  navyText,
  orange,
  orangeSoft,
  surface,
  warn,
} from "@/lib/design-tokens";

type Staff = { id: string; name: string };
type Shift = { status: ShiftStatus; start_time: string | null; end_time: string | null };
type Covers = { gih_count: number | null; breakfast_count: number | null };
type EventRow = { id: number; room: string | null; title: string; details: string | null };

export default function RotaPage() {
  const profile = useProfile();
  const isAdmin = profile.role === "admin";
  const supabase = createClient();

  const [monday, setMonday] = useState(() => mondayOf(todayISO()));
  const [editing, setEditing] = useState(false);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [shifts, setShifts] = useState<Record<string, Record<string, Shift>>>({});
  const [covers, setCovers] = useState<Record<string, Covers>>({});
  const [events, setEvents] = useState<Record<string, EventRow[]>>({});
  const [newEventDraft, setNewEventDraft] = useState<Record<string, { room: string; title: string; details: string }>>({});

  const days = useMemo(() => weekDates(monday), [monday]);
  const today = todayISO();
  const weekEnd = addDaysISO(monday, 6);

  const loadData = useCallback(async () => {
    const [staffRes, shiftsRes, coversRes, eventsRes] = await Promise.all([
      supabase.from("profiles").select("id, name").order("name"),
      supabase
        .from("rota_shifts")
        .select("staff_id, date, status, start_time, end_time")
        .gte("date", monday)
        .lte("date", weekEnd),
      supabase.from("daily_covers").select("*").gte("date", monday).lte("date", weekEnd),
      supabase
        .from("daily_events")
        .select("*")
        .gte("date", monday)
        .lte("date", weekEnd)
        .order("id"),
    ]);

    setStaff(staffRes.data ?? []);

    const shiftMap: Record<string, Record<string, Shift>> = {};
    for (const s of shiftsRes.data ?? []) {
      shiftMap[s.staff_id] ??= {};
      shiftMap[s.staff_id][s.date] = {
        status: s.status,
        start_time: s.start_time,
        end_time: s.end_time,
      };
    }
    setShifts(shiftMap);

    const coversMap: Record<string, Covers> = {};
    for (const c of coversRes.data ?? []) coversMap[c.date] = c;
    setCovers(coversMap);

    const eventsMap: Record<string, EventRow[]> = {};
    for (const e of eventsRes.data ?? []) {
      eventsMap[e.date] ??= [];
      eventsMap[e.date].push(e);
    }
    setEvents(eventsMap);
  }, [supabase, monday, weekEnd]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveShift = async (staffId: string, date: string, shift: Shift) => {
    setShifts((prev) => ({ ...prev, [staffId]: { ...prev[staffId], [date]: shift } }));
    await supabase
      .from("rota_shifts")
      .upsert({ staff_id: staffId, date, ...shift }, { onConflict: "staff_id,date" });
  };

  const saveCovers = async (date: string, next: Covers) => {
    setCovers((prev) => ({ ...prev, [date]: next }));
    await supabase.from("daily_covers").upsert({ date, ...next });
  };

  const addEvent = async (date: string) => {
    const draft = newEventDraft[date];
    if (!draft?.title.trim()) return;
    await supabase.from("daily_events").insert({
      date,
      room: draft.room.trim() || null,
      title: draft.title.trim(),
      details: draft.details.trim() || null,
    });
    setNewEventDraft((prev) => ({ ...prev, [date]: { room: "", title: "", details: "" } }));
    loadData();
  };

  const removeEvent = async (id: number) => {
    await supabase.from("daily_events").delete().eq("id", id);
    loadData();
  };

  const inputStyle = {
    border: `1px solid ${border}`,
    color: ink,
    background: bg,
  } as const;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1
          className="text-lg font-semibold inline-block pb-1"
          style={{ color: navyText, borderBottom: `3px solid ${orange}` }}
        >
          Rota
        </h1>
        {isAdmin && (
          <button
            onClick={() => setEditing((e) => !e)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-2xl"
            style={{
              background: editing ? navy : orangeSoft,
              color: editing ? "#FFFFFF" : navy,
            }}
          >
            <Pencil size={13} />
            {editing ? "Done editing" : "Edit rota"}
          </button>
        )}
      </div>
      <div className="flex items-center justify-between mb-6 mt-2">
        <p className="text-sm" style={{ color: inkSoft }}>
          {days[0].label} – {days[6].label}
        </p>
        <div className="flex gap-2">
          <button
            className="text-xs px-3 py-1 rounded-2xl"
            style={{ border: `1px solid ${border}`, color: ink }}
            onClick={() => setMonday((m) => addDaysISO(m, -7))}
          >
            ← Prev
          </button>
          <button
            className="text-xs px-3 py-1 rounded-2xl"
            style={{ border: `1px solid ${border}`, color: ink }}
            onClick={() => setMonday(mondayOf(todayISO()))}
          >
            This week
          </button>
          <button
            className="text-xs px-3 py-1 rounded-2xl"
            style={{ border: `1px solid ${border}`, color: ink }}
            onClick={() => setMonday((m) => addDaysISO(m, 7))}
          >
            Next →
          </button>
        </div>
      </div>

      <h2 className="text-sm font-semibold mb-3" style={{ color: navyText }}>
        Staff shifts
      </h2>
      <div className="overflow-x-auto rounded-2xl mb-6" style={{ border: `1px solid ${border}` }}>
        <table className="text-xs" style={{ borderCollapse: "collapse", minWidth: 720 }}>
          <thead>
            <tr>
              <th
                className="text-left p-2 sticky left-0"
                style={{ background: navySoft, color: ink, minWidth: 160 }}
              >
                Name
              </th>
              {days.map((d) => (
                <th
                  key={d.date}
                  className="text-center p-2"
                  style={{
                    background: d.date === today ? orange : navySoft,
                    color: d.date === today ? "#FFFFFF" : ink,
                    minWidth: editing ? 150 : 84,
                  }}
                >
                  <div>{d.day}</div>
                  <div style={{ color: d.date === today ? "#FFFFFF" : inkSoft, fontWeight: 400 }}>
                    {d.label}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {staff.map((person, pi) => (
              <tr key={person.id} style={{ background: pi % 2 === 0 ? surface : bg }}>
                <td
                  className="p-2 sticky left-0"
                  style={{ background: pi % 2 === 0 ? surface : bg, fontWeight: 500 }}
                >
                  {person.name}
                </td>
                {days.map((d) => {
                  const shift = shifts[person.id]?.[d.date];
                  return (
                    <td
                      key={d.date}
                      className="text-center p-2"
                      style={{ background: d.date === today ? orangeSoft : "transparent" }}
                    >
                      {editing ? (
                        <div className="flex flex-col gap-1 items-center">
                          <select
                            value={shift?.status ?? "off"}
                            onChange={(e) =>
                              saveShift(person.id, d.date, {
                                status: e.target.value as ShiftStatus,
                                start_time: shift?.start_time ?? "09:00",
                                end_time: shift?.end_time ?? "17:00",
                              })
                            }
                            className="text-xs rounded px-1 py-0.5"
                            style={inputStyle}
                          >
                            <option value="work">Work</option>
                            <option value="off">Off</option>
                            <option value="holiday">Holiday</option>
                          </select>
                          {shift?.status === "work" && (
                            <div className="flex gap-1">
                              <input
                                type="time"
                                value={shift.start_time ?? ""}
                                onChange={(e) =>
                                  saveShift(person.id, d.date, { ...shift, start_time: e.target.value })
                                }
                                className="text-xs rounded px-1 py-0.5 w-[68px]"
                                style={inputStyle}
                              />
                              <input
                                type="time"
                                value={shift.end_time ?? ""}
                                onChange={(e) =>
                                  saveShift(person.id, d.date, { ...shift, end_time: e.target.value })
                                }
                                className="text-xs rounded px-1 py-0.5 w-[68px]"
                                style={inputStyle}
                              />
                            </div>
                          )}
                        </div>
                      ) : shift?.status === "work" ? (
                        <span>
                          {shift.start_time}–{shift.end_time}
                        </span>
                      ) : shift?.status === "holiday" ? (
                        <span style={{ color: warn }}>HOL</span>
                      ) : shift?.status === "off" ? (
                        <span style={{ color: inkSoft }}>OFF</span>
                      ) : (
                        <span style={{ color: inkSoft }}>–</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 mb-6">
        {days.map((d) => {
          const dayCovers = covers[d.date] ?? { gih_count: null, breakfast_count: null };
          const dayEvents = events[d.date] ?? [];
          const draft = newEventDraft[d.date] ?? { room: "", title: "", details: "" };
          return (
            <div
              key={d.date}
              className="p-3 rounded-2xl"
              style={{ background: surface, border: `1px solid ${border}` }}
            >
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-sm font-medium">
                  {d.day} {d.label}
                </span>
                {editing ? (
                  <div className="flex items-center gap-2 text-xs" style={{ color: inkSoft }}>
                    GIH
                    <input
                      type="number"
                      value={dayCovers.gih_count ?? ""}
                      onChange={(e) =>
                        saveCovers(d.date, {
                          ...dayCovers,
                          gih_count: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      className="w-14 rounded px-1 py-0.5"
                      style={inputStyle}
                    />
                    Breakfast
                    <input
                      type="number"
                      value={dayCovers.breakfast_count ?? ""}
                      onChange={(e) =>
                        saveCovers(d.date, {
                          ...dayCovers,
                          breakfast_count: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      className="w-14 rounded px-1 py-0.5"
                      style={inputStyle}
                    />
                  </div>
                ) : (
                  <span className="text-xs" style={{ color: inkSoft }}>
                    GIH {dayCovers.gih_count ?? "–"} · Breakfast {dayCovers.breakfast_count ?? "–"}
                  </span>
                )}
              </div>
              {dayEvents.length === 0 ? (
                <p className="text-xs" style={{ color: inkSoft }}>
                  No functions booked
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {dayEvents.map((e) => (
                    <div key={e.id} className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-medium" style={{ color: navyText }}>
                          {e.room} · {e.title}
                        </div>
                        <div className="text-xs" style={{ color: inkSoft }}>
                          {e.details}
                        </div>
                      </div>
                      {editing && (
                        <button onClick={() => removeEvent(e.id)} style={{ color: inkSoft }}>
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {editing && (
                <div className="flex flex-col gap-1 mt-2 pt-2" style={{ borderTop: `1px solid ${border}` }}>
                  <div className="flex gap-1">
                    <input
                      placeholder="Room"
                      value={draft.room}
                      onChange={(e) =>
                        setNewEventDraft((prev) => ({ ...prev, [d.date]: { ...draft, room: e.target.value } }))
                      }
                      className="text-xs rounded px-2 py-1 w-20"
                      style={inputStyle}
                    />
                    <input
                      placeholder="Event title"
                      value={draft.title}
                      onChange={(e) =>
                        setNewEventDraft((prev) => ({ ...prev, [d.date]: { ...draft, title: e.target.value } }))
                      }
                      className="text-xs rounded px-2 py-1 flex-1"
                      style={inputStyle}
                    />
                  </div>
                  <input
                    placeholder="Details"
                    value={draft.details}
                    onChange={(e) =>
                      setNewEventDraft((prev) => ({ ...prev, [d.date]: { ...draft, details: e.target.value } }))
                    }
                    className="text-xs rounded px-2 py-1"
                    style={inputStyle}
                  />
                  <button
                    onClick={() => addEvent(d.date)}
                    className="text-xs font-medium px-3 py-1 rounded-2xl self-start"
                    style={{ background: navy, color: "#FFFFFF" }}
                  >
                    Add event
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
