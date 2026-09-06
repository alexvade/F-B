import { parseCsv } from "./csv";
import type { ShiftStatus } from "./supabase/types";

export type ParsedShift = {
  staffName: string;
  date: string;
  status: ShiftStatus;
  start_time: string | null;
  end_time: string | null;
};
export type ParsedCovers = { date: string; gih_count: number | null; breakfast_count: number | null };
export type ParsedEvent = { date: string; room: string; title: string; details: string | null };

export type ParsedRotaSheet = {
  shifts: ParsedShift[];
  covers: ParsedCovers[];
  events: ParsedEvent[];
  dates: string[];
  /** Staff names in the order their rows appear in the sheet. */
  staffOrder: string[];
};

function toIsoDate(ddmmyyyy: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(ddmmyyyy.trim());
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

const STAFF_NAME_RE = /^(.+?)\s*\(([^)]*)\)\s*$/;

/** Parses one week-tab of the F&B Rota sheet's CSV export into structured rows. */
export function parseRotaSheet(csvText: string): ParsedRotaSheet {
  const rows = parseCsv(csvText).map((r) => r.map((c) => c.trim()));

  const dateRowIdx = rows.findIndex((r) => r[0]?.toLowerCase() === "date");
  const dayRowIdx = rows.findIndex((r) => r[0]?.toLowerCase() === "day");
  if (dateRowIdx === -1) {
    throw new Error('Could not find a "Date" row in the sheet — has its layout changed?');
  }
  const dateRow = rows[dateRowIdx];

  // Each day occupies a 2-column pair (start_time, end_time) — identified by
  // where the Date row has a value.
  const dayColumns: { col: number; date: string }[] = [];
  for (let i = 1; i < dateRow.length; i++) {
    const iso = dateRow[i] ? toIsoDate(dateRow[i]) : null;
    if (iso) dayColumns.push({ col: i, date: iso });
  }

  const covers: ParsedCovers[] = dayColumns.map((d) => ({
    date: d.date,
    gih_count: null,
    breakfast_count: null,
  }));
  const coversByDate = new Map(covers.map((c) => [c.date, c]));

  // --- Section above "Date": GIH / Breakfast / room & event bookings ---
  const eventsByRoomDate = new Map<string, ParsedEvent>();
  let lastRoomLabel: string | null = null;

  for (let r = 0; r < dateRowIdx; r++) {
    const row = rows[r];
    const label = row[0] ?? "";
    const labelLower = label.toLowerCase();
    if (!label || labelLower === "notes") continue;

    if (labelLower === "gih") {
      for (const d of dayColumns) {
        const v = row[d.col];
        if (v) coversByDate.get(d.date)!.gih_count = Number(v) || null;
      }
      continue;
    }
    if (labelLower === "breakfast") {
      for (const d of dayColumns) {
        const v = row[d.col];
        if (v) coversByDate.get(d.date)!.breakfast_count = Number(v) || null;
      }
      continue;
    }

    const lunchDinnerMatch = /^(.*)\s+lunch\s*\|\s*dinner$/i.exec(label);
    if (lunchDinnerMatch && lunchDinnerMatch[1].trim() === lastRoomLabel) {
      // Supplementary lunch/dinner times for the room row directly above.
      for (const d of dayColumns) {
        const lunch = row[d.col];
        const dinner = row[d.col + 1];
        const key = `${lastRoomLabel}|${d.date}`;
        const existing = eventsByRoomDate.get(key);
        if (existing && (lunch || dinner)) {
          const extra = [lunch && `Lunch: ${lunch}`, dinner && `Dinner: ${dinner}`]
            .filter(Boolean)
            .join(" · ");
          existing.details = existing.details ? `${existing.details} · ${extra}` : extra;
        }
      }
      continue;
    }

    // Otherwise: a room/event label row, e.g. "M&E 1", "Weddings Meal | Evening".
    lastRoomLabel = label;
    for (const d of dayColumns) {
      const cell = row[d.col];
      if (!cell) continue;
      const lines = cell.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0) continue;
      eventsByRoomDate.set(`${label}|${d.date}`, {
        date: d.date,
        room: label,
        title: lines[0],
        details: lines.slice(1).join(" · ") || null,
      });
    }
  }

  // --- Section below "Day": staff shift rows ---
  const shifts: ParsedShift[] = [];
  const staffOrder: string[] = [];
  const staffStartIdx = (dayRowIdx === -1 ? dateRowIdx : dayRowIdx) + 1;
  for (let r = staffStartIdx; r < rows.length; r++) {
    const row = rows[r];
    const label = row[0] ?? "";
    if (!label) continue;
    if (/^colour map/i.test(label)) break;

    const nameMatch = STAFF_NAME_RE.exec(label);
    const staffName = (nameMatch ? nameMatch[1] : label).trim();
    if (!staffName) continue;
    staffOrder.push(staffName);

    for (const d of dayColumns) {
      const v1 = (row[d.col] ?? "").trim();
      const v2 = (row[d.col + 1] ?? "").trim();
      if (!v1) continue;
      if (v1.toUpperCase() === "OFF") {
        shifts.push({ staffName, date: d.date, status: "off", start_time: null, end_time: null });
      } else if (v1.toUpperCase() === "HOL") {
        shifts.push({ staffName, date: d.date, status: "holiday", start_time: null, end_time: null });
      } else if (/^\d{1,2}:\d{2}$/.test(v1)) {
        shifts.push({
          staffName,
          date: d.date,
          status: "work",
          start_time: v1,
          end_time: v2 || null,
        });
      }
    }
  }

  return {
    shifts,
    covers,
    staffOrder,
    events: Array.from(eventsByRoomDate.values()),
    dates: dayColumns.map((d) => d.date),
  };
}
