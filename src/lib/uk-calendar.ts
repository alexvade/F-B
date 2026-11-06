// England & Wales bank holidays plus the other dates widely
// celebrated/observed across the UK that a hospitality venue cares about —
// for the dashboard calendar tile. Computed algorithmically (Easter via the
// anonymous Gregorian algorithm, nth-weekday-of-month, nearest-Sunday)
// rather than hardcoded, so they land correctly every year. Scotland/NI-only
// bank holidays (2 Jan, St Andrew's Day, St Patrick's Day as a public
// holiday) are left out since this venue is in England.

export type UKMajorDate = { year: number; month: number; day: number; label: string };

function toParts(d: Date) {
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
}

function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return toParts(new Date(year, month - 1, day));
}

function addDays(year: number, month: number, day: number, delta: number) {
  return toParts(new Date(year, month, day + delta));
}

// weekday: 0=Sun..6=Sat (native getDay convention). n>0 = nth occurrence
// from the start of the month, n<0 = nth from the end (-1 = last).
function nthWeekdayOfMonth(year: number, monthIndex: number, weekday: number, n: number) {
  if (n > 0) {
    const first = new Date(year, monthIndex, 1);
    const offset = (weekday - first.getDay() + 7) % 7;
    return toParts(new Date(year, monthIndex, 1 + offset + (n - 1) * 7));
  }
  const last = new Date(year, monthIndex + 1, 0);
  const offsetEnd = (last.getDay() - weekday + 7) % 7;
  return toParts(new Date(year, monthIndex, last.getDate() - offsetEnd));
}

// Remembrance Sunday's actual rule — the Sunday nearest 11 November, not
// simply "the 2nd Sunday" (those usually but don't always coincide).
function closestSundayTo(year: number, month: number, day: number) {
  const d = new Date(year, month, day);
  const dow = d.getDay();
  if (dow === 0) return toParts(d);
  const delta = dow <= 3 ? -dow : 7 - dow;
  return toParts(new Date(year, month, day + delta));
}

export function ukMajorDatesForYear(year: number): UKMajorDate[] {
  const easter = easterSunday(year);
  const fromEaster = (delta: number) => addDays(easter.year, easter.month, easter.day, delta);
  return [
    { year, month: 0, day: 1, label: "New Year's Day (Bank Holiday)" },
    { year, month: 0, day: 25, label: "Burns Night" },
    { year, month: 1, day: 14, label: "Valentine's Day" },
    { ...fromEaster(-47), label: "Pancake Day (Shrove Tuesday)" },
    { year, month: 2, day: 17, label: "St Patrick's Day" },
    { ...fromEaster(-21), label: "Mother's Day (UK)" },
    { ...fromEaster(-2), label: "Good Friday (Bank Holiday)" },
    { ...easter, label: "Easter Sunday" },
    { ...fromEaster(1), label: "Easter Monday (Bank Holiday)" },
    { year, month: 3, day: 23, label: "St George's Day" },
    { ...nthWeekdayOfMonth(year, 4, 1, 1), label: "Early May Bank Holiday" },
    { ...nthWeekdayOfMonth(year, 4, 1, -1), label: "Spring Bank Holiday" },
    { ...nthWeekdayOfMonth(year, 5, 0, 3), label: "Father's Day (UK)" },
    { ...nthWeekdayOfMonth(year, 7, 1, -1), label: "Summer Bank Holiday" },
    { year, month: 9, day: 31, label: "Halloween" },
    { year, month: 10, day: 5, label: "Bonfire Night" },
    { ...closestSundayTo(year, 10, 11), label: "Remembrance Sunday" },
    { year, month: 11, day: 24, label: "Christmas Eve" },
    { year, month: 11, day: 25, label: "Christmas Day (Bank Holiday)" },
    { year, month: 11, day: 26, label: "Boxing Day (Bank Holiday)" },
    { year, month: 11, day: 31, label: "New Year's Eve" },
  ];
}
