"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Info, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
import { todayISO, weekStartOf, addDaysISO, weekDates, formatTimeHHMM } from "@/lib/dates";
import { Section } from "@/components/section";
import { bg, border, fill, ink, inkSoft, navy, navySoft, navyText, orange, orangeSoft, warn } from "@/lib/design-tokens";

type Entry = {
  id: number;
  staff_id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  note: string | null;
};

const STAFF_STEPS = [
  "Pick the first and last date you can't work. For a single day, leave both the same.",
  "Leave “All day” ticked, or untick it and set the hours you can't work — e.g. 09:00 to 12:00 if you can only start after midday.",
  "Add a reason if you like (holiday, college, another job) — it helps, but it's optional.",
  "Tap Add. Each day appears in your list below.",
];

const STAFF_GOOD_TO_KNOW = [
  "Any day you haven't marked counts as available, so you could be put on the rota for it.",
  "Managers check this page when they build the rota. It's not a request that gets approved — if it's short notice or the rota is already out, speak to a manager as well.",
  "Only you and the managers can see your dates and reasons.",
  "Plans changed? Tap the bin next to a date to remove it.",
  "Past dates drop off your list automatically. You can add up to about three months in one go.",
];

function HowItWorks() {
  return (
    <div className="p-4 rounded-2xl mb-6" style={{ background: bg, border: `1px solid ${border}` }}>
      <div className="flex items-center gap-2 mb-3">
        <Info size={16} style={{ color: ink }} />
        <h2 className="text-sm font-semibold" style={{ color: navyText }}>
          How this works
        </h2>
      </div>
      <ol className="flex flex-col gap-2 mb-4">
        {STAFF_STEPS.map((step, i) => (
          <li key={i} className="flex gap-3 text-sm leading-relaxed" style={{ color: ink }}>
            <span
              className="flex items-center justify-center shrink-0 rounded-full text-xs font-medium"
              style={{ width: 20, height: 20, border: `1px solid ${border}`, color: navyText, marginTop: 2 }}
            >
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <div className="text-xs font-semibold mb-2" style={{ color: orange }}>
        GOOD TO KNOW
      </div>
      <ul className="flex flex-col gap-1.5">
        {STAFF_GOOD_TO_KNOW.map((tip, i) => (
          <li key={i} className="flex gap-2 text-xs leading-relaxed" style={{ color: ink }}>
            <span>•</span>
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatDateLabel(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function AvailabilityPage() {
  const profile = useProfile();
  const isAdmin = profile.role === "admin";
  const isCasual = profile.is_casual;
  const supabase = createClient();

  // --- My availability (casual staff) ---
  const [myEntries, setMyEntries] = useState<Entry[]>([]);
  const [fromDate, setFromDate] = useState(todayISO());
  const [toDate, setToDate] = useState(todayISO());
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMine = useCallback(async () => {
    const { data } = await supabase
      .from("casual_unavailability")
      .select("*")
      .eq("staff_id", profile.id)
      .gte("date", todayISO())
      .order("date");
    setMyEntries(data ?? []);
  }, [supabase, profile.id]);

  useEffect(() => {
    if (isCasual) loadMine();
  }, [isCasual, loadMine]);

  const addEntries = async () => {
    setError(null);
    if (!fromDate || !toDate || toDate < fromDate) {
      setError("Pick a valid date range.");
      return;
    }
    const dates: string[] = [];
    for (let d = fromDate; d <= toDate; d = addDaysISO(d, 1)) {
      dates.push(d);
      if (dates.length > 90) break; // sanity cap — a quarter at a time is plenty
    }
    setSaving(true);
    try {
      const rows = dates.map((date) => ({
        staff_id: profile.id,
        date,
        start_time: allDay ? null : startTime,
        end_time: allDay ? null : endTime,
        note: note.trim() || null,
      }));
      const { error: insertError } = await supabase.from("casual_unavailability").insert(rows);
      if (insertError) {
        setError(insertError.message);
        return;
      }
      setNote("");
      loadMine();
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async (id: number) => {
    setMyEntries((prev) => prev.filter((e) => e.id !== id));
    await supabase.from("casual_unavailability").delete().eq("id", id);
  };

  // --- Compiled view (admins) ---
  const [weekStart, setWeekStart] = useState(() => weekStartOf(todayISO()));
  const [casualStaff, setCasualStaff] = useState<{ id: string; name: string }[]>([]);
  const [entriesByStaff, setEntriesByStaff] = useState<Record<string, Record<string, Entry[]>>>({});

  const days = useMemo(() => weekDates(weekStart), [weekStart]);
  const today = todayISO();

  const loadCompiled = useCallback(async () => {
    const weekEnd = addDaysISO(weekStart, 6);
    const [staffRes, entriesRes] = await Promise.all([
      supabase.from("profiles_directory").select("id, name").eq("is_casual", true).order("name"),
      supabase
        .from("casual_unavailability")
        .select("*")
        .gte("date", weekStart)
        .lte("date", weekEnd),
    ]);
    setCasualStaff(staffRes.data ?? []);
    const map: Record<string, Record<string, Entry[]>> = {};
    for (const e of entriesRes.data ?? []) {
      map[e.staff_id] ??= {};
      map[e.staff_id][e.date] ??= [];
      map[e.staff_id][e.date].push(e);
    }
    setEntriesByStaff(map);
  }, [supabase, weekStart]);

  useEffect(() => {
    if (isAdmin) loadCompiled();
  }, [isAdmin, loadCompiled]);

  const inputStyle = { border: `1px solid ${border}`, color: ink, background: fill } as const;

  if (!isAdmin && !isCasual) {
    return (
      <Section title="Availability">
        <p className="text-sm" style={{ color: inkSoft }}>
          This page is for casual staff and admins only.
        </p>
      </Section>
    );
  }

  return (
    <Section title="Availability" subtitle="Mark dates you can't work — everything else is assumed available">
      {isCasual && <HowItWorks />}

      {isCasual && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold mb-1" style={{ color: navyText }}>
            Your availability
          </h2>
          <p className="text-xs mb-3" style={{ color: inkSoft }}>
            Add dates you can&apos;t work, with a time range if it&apos;s only part of the day
          </p>
          <div className="p-4 rounded-2xl mb-4" style={{ background: orangeSoft }}>
            <div className="flex flex-wrap gap-2 items-end mb-2">
              <label className="flex flex-col gap-1 text-xs" style={{ color: navy }}>
                From
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="text-sm px-3 py-2 rounded-full outline-none"
                  style={inputStyle}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs" style={{ color: navy }}>
                To
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="text-sm px-3 py-2 rounded-full outline-none"
                  style={inputStyle}
                />
              </label>
              <label className="flex items-center gap-1.5 text-xs pb-2.5" style={{ color: navy }}>
                <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
                All day
              </label>
              {!allDay && (
                <>
                  <label className="flex flex-col gap-1 text-xs" style={{ color: navy }}>
                    From time
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="text-sm px-3 py-2 rounded-full outline-none"
                      style={inputStyle}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs" style={{ color: navy }}>
                    To time
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="text-sm px-3 py-2 rounded-full outline-none"
                      style={inputStyle}
                    />
                  </label>
                </>
              )}
            </div>
            <input
              placeholder="Reason (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="text-sm px-4 py-2 rounded-full outline-none w-full mb-2"
              style={inputStyle}
            />
            <button
              onClick={addEntries}
              disabled={saving}
              className="text-sm font-medium px-4 py-2 rounded-full disabled:opacity-60"
              style={{ background: navy, color: "#FFFFFF" }}
            >
              {saving ? "Adding…" : "Add"}
            </button>
            {error && (
              <p className="text-xs mt-2" style={{ color: "#B91C1C" }}>
                {error}
              </p>
            )}
          </div>

          {myEntries.length === 0 ? (
            <p className="text-sm" style={{ color: inkSoft }}>
              No unavailable dates added — you&apos;re showing as available.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {myEntries.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between p-3 rounded-2xl"
                  style={{ background: bg, border: `1px solid ${border}` }}
                >
                  <div>
                    <div className="text-sm font-medium" style={{ color: navyText }}>
                      {formatDateLabel(e.date)}
                    </div>
                    <div className="text-xs" style={{ color: inkSoft }}>
                      {e.start_time && e.end_time ? `${formatTimeHHMM(e.start_time)}–${formatTimeHHMM(e.end_time)}` : "All day"}
                      {e.note ? ` · ${e.note}` : ""}
                    </div>
                  </div>
                  <button onClick={() => deleteEntry(e.id)} aria-label="Remove" style={{ color: "#000000" }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isAdmin && (
        <div>
          <h2 className="text-sm font-semibold mb-1" style={{ color: navyText }}>
            Casual staff availability
          </h2>
          <p className="text-xs mb-3" style={{ color: inkSoft }}>
            Who can&apos;t work, by day — a dash means available. These are the dates casual staff have marked
            themselves; they aren&apos;t approved or declined here, so follow up directly if something clashes with
            the rota.
          </p>
          <div className="flex gap-1.5 overflow-x-auto mb-4 pb-1" style={{ scrollbarWidth: "thin" }}>
            <button
              className="text-xs px-3 py-1.5 rounded-2xl shrink-0"
              style={{ border: `1px solid ${border}`, color: ink }}
              onClick={() => setWeekStart((w) => addDaysISO(w, -7))}
            >
              ← Prev
            </button>
            <button
              className="text-xs px-3 py-1.5 rounded-2xl shrink-0"
              style={{ border: `1px solid ${border}`, color: ink }}
              onClick={() => setWeekStart(weekStartOf(todayISO()))}
            >
              This week
            </button>
            <button
              className="text-xs px-3 py-1.5 rounded-2xl shrink-0"
              style={{ border: `1px solid ${border}`, color: ink }}
              onClick={() => setWeekStart((w) => addDaysISO(w, 7))}
            >
              Next →
            </button>
          </div>
          <p className="text-sm mb-3" style={{ color: inkSoft }}>
            {days[0].label} – {days[6].label}
          </p>

          {casualStaff.length === 0 ? (
            <p className="text-sm" style={{ color: inkSoft }}>
              No one&apos;s tagged as casual yet — set that in Manage staff.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl" style={{ border: `1px solid ${border}` }}>
              <table className="text-xs" style={{ borderCollapse: "collapse", minWidth: 720 }}>
                <thead>
                  <tr>
                    <th
                      className="text-left p-2 sticky left-0"
                      style={{ background: navySoft, color: ink, minWidth: 160, borderBottom: `1px solid ${border}` }}
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
                          minWidth: 100,
                          borderLeft: `1px solid ${border}`,
                          borderBottom: `1px solid ${border}`,
                        }}
                      >
                        <div>{d.day}</div>
                        <div style={{ color: d.date === today ? "#FFFFFF" : inkSoft, fontWeight: 400 }}>{d.label}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {casualStaff.map((person) => (
                    <tr key={person.id}>
                      <td
                        className="p-2 sticky left-0"
                        style={{ background: fill, fontWeight: 500, borderBottom: `1px solid ${border}` }}
                      >
                        {person.name}
                      </td>
                      {days.map((d) => {
                        const entries = entriesByStaff[person.id]?.[d.date] ?? [];
                        const isToday = d.date === today;
                        return (
                          <td
                            key={d.date}
                            className="text-center p-2"
                            style={{
                              borderBottom: isToday ? `2px solid ${orange}` : `1px solid ${border}`,
                              borderTop: isToday ? `2px solid ${orange}` : undefined,
                              borderLeft: isToday ? `2px solid ${orange}` : `1px solid ${border}`,
                              borderRight: isToday ? `2px solid ${orange}` : undefined,
                            }}
                          >
                            {entries.length === 0 ? (
                              <span style={{ color: inkSoft }}>–</span>
                            ) : (
                              <div className="flex flex-col gap-0.5">
                                {entries.map((e) => (
                                  <span key={e.id} title={e.note ?? undefined} style={{ color: warn, fontWeight: 600 }}>
                                    {e.start_time && e.end_time
                                      ? `${formatTimeHHMM(e.start_time)}–${formatTimeHHMM(e.end_time)}`
                                      : "All day"}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Section>
  );
}
