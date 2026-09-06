// Keep in sync with the `checklist_day()` Postgres function in
// supabase/migrations/0001_init.sql — both implement the same "5am–5am
// day" rule so every client and the database agree on the same boundary.
const VENUE_TIMEZONE = "Europe/London";

function londonWallClock(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: VENUE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return new Date(
    Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second")
    )
  );
}

/** Calendar date (YYYY-MM-DD) in the venue's local timezone. */
export function todayISO(date: Date = new Date()): string {
  return londonWallClock(date).toISOString().slice(0, 10);
}

/** The "checklist day" for `date`: subtract 5 hours, then take the date. */
export function checklistDayISO(date: Date = new Date()): string {
  const local = londonWallClock(date);
  local.setUTCHours(local.getUTCHours() - 5);
  return local.toISOString().slice(0, 10);
}

const DAY_LABELS_FROM_SUNDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The venue's rota week runs Friday→Thursday (matches the F&B Rota sheet), not the ISO Monday start. */
const ROTA_WEEK_START_DAY = 5; // 0 = Sunday, 5 = Friday

/** Start-of-rota-week (Friday) containing `iso` (or today if omitted), as YYYY-MM-DD. */
export function weekStartOf(iso?: string, startDay: number = ROTA_WEEK_START_DAY): string {
  const base = iso ? new Date(iso + "T00:00:00Z") : new Date(todayISO() + "T00:00:00Z");
  const dow = base.getUTCDay();
  const diff = -((dow - startDay + 7) % 7);
  base.setUTCDate(base.getUTCDate() + diff);
  return base.toISOString().slice(0, 10);
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The 7 dates of the rota week starting at `weekStartIso` (a Friday). */
export function weekDates(weekStartIso: string) {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDaysISO(weekStartIso, i);
    const d = new Date(date + "T00:00:00Z");
    return {
      date,
      day: DAY_LABELS_FROM_SUNDAY[d.getUTCDay()],
      label: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }),
    };
  });
}
