export type ShiftStatusLabel = "in" | "out" | "due";

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Ported from the prototype exactly: a shift ending at or before its start
 * time (e.g. 12:00–01:30) is treated as ending the following day, so it
 * doesn't flip to "Out" the instant the clock passes midnight.
 */
export function computeShiftStatus(
  start: string,
  end: string,
  nowMinutes: number
): ShiftStatusLabel {
  const startMin = toMinutes(start);
  const endMinRaw = toMinutes(end);
  const adjustedEnd = endMinRaw <= startMin ? endMinRaw + 1440 : endMinRaw;
  if (nowMinutes < startMin) return "due";
  if (nowMinutes >= adjustedEnd) return "out";
  return "in";
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
