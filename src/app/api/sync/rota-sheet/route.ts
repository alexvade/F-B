import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseRotaSheet } from "@/lib/rota-sheet";
import { fetchRotaColorGrid } from "@/lib/google-sheet-colors";
import { sendPushToStaff } from "@/lib/push";
import { formatTimeHHMM, formatDDMM } from "@/lib/dates";
import type { ShiftStatus } from "@/lib/supabase/types";

type ChangedShift = { date: string; status: ShiftStatus; start_time: string | null; end_time: string | null };

function describeShift(s: ChangedShift): string {
  if (s.status === "off") return "OFF";
  if (s.status === "holiday") return "Holiday";
  if (s.start_time && s.end_time) return `${formatTimeHHMM(s.start_time)}–${formatTimeHHMM(s.end_time)}`;
  return s.status;
}

// Called by the Apps Script bound to the F&B Rota Google Sheet whenever it's
// edited (see docs/rota-sheet-sync.md for the script + setup steps). Fetches
// that one week-tab's CSV export and upserts it into rota_shifts /
// daily_events. Staff are matched to existing accounts by name — anyone not
// yet invited is reported back in `unmatched`, not synced.
//
// Does NOT touch daily_covers — GIH/breakfast/etc. figures come solely from
// the WHH Daily Overview spreadsheet import (scripts/import-daily-overview.mjs).
export async function POST(request: Request) {
  const secret = request.headers.get("x-rota-sync-secret");
  if (!secret || secret !== process.env.ROTA_SYNC_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sheetId = process.env.ROTA_SHEET_ID;
  if (!sheetId) {
    return NextResponse.json({ error: "ROTA_SHEET_ID is not configured" }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const gid = body?.gid;
  if (gid === undefined || gid === null) {
    return NextResponse.json({ error: "Missing gid" }, { status: 400 });
  }

  const csvRes = await fetch(
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`
  );
  if (!csvRes.ok) {
    return NextResponse.json(
      { error: `Could not fetch sheet CSV (status ${csvRes.status}) — is it still shared "anyone with the link"?` },
      { status: 502 }
    );
  }
  const csvText = await csvRes.text();

  // Colour-coded shifts — best-effort; the plain shift/event sync below
  // still runs even if this comes back null (no API key configured, or the
  // Sheets API call failed for some other reason).
  const colorGrid = await fetchRotaColorGrid(sheetId, gid);

  let parsed;
  try {
    parsed = parseRotaSheet(csvText, colorGrid ?? undefined);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 422 });
  }

  const supabase = createAdminClient();

  const { data: profiles } = await supabase.from("profiles").select("id, name");
  const idByName = new Map((profiles ?? []).map((p) => [p.name.trim().toLowerCase(), p.id]));

  // Every sheet row gets written — staff_name is always known, staff_id is
  // just an optional enrichment for whoever's already been invited. Someone
  // without an account yet still shows up on the Rota screen; they just
  // can't log in to see it themselves until they are.
  const unmatched = new Set<string>();
  const shiftRows = parsed.shifts.map((s) => {
    const staffId = idByName.get(s.staffName.trim().toLowerCase()) ?? null;
    if (!staffId) unmatched.add(s.staffName);
    return {
      staff_id: staffId,
      staff_name: s.staffName,
      date: s.date,
      status: s.status,
      start_time: s.start_time,
      end_time: s.end_time,
      color: s.color,
    };
  });

  // Fetched before the upsert, so a change notification only goes out for
  // what this sync actually altered — not for every row the sheet contains
  // (the hourly syncAllSheets catch-up re-sends every tab regardless of
  // whether anyone touched it).
  const changedByStaff = new Map<string, ChangedShift[]>();
  if (shiftRows.length) {
    const dates = Array.from(new Set(shiftRows.map((r) => r.date)));
    const { data: existingRows } = await supabase
      .from("rota_shifts")
      .select("staff_name, date, status, start_time, end_time")
      .in("date", dates);
    const existingByKey = new Map(
      (existingRows ?? []).map((r) => [`${r.staff_name}|${r.date}`, r])
    );

    const { error } = await supabase
      .from("rota_shifts")
      .upsert(shiftRows, { onConflict: "staff_name,date" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    for (const row of shiftRows) {
      if (!row.staff_id) continue;
      const existing = existingByKey.get(`${row.staff_name}|${row.date}`);
      // Postgres returns a `time` column as "HH:MM:SS", but the sheet only
      // ever produces "HH:MM" — comparing those directly made every timed
      // shift look "changed" on every single sync (including the hourly
      // syncAllSheets catch-up), flooding people with false-positive pushes.
      const changed =
        !existing ||
        existing.status !== row.status ||
        formatTimeHHMM(existing.start_time) !== formatTimeHHMM(row.start_time) ||
        formatTimeHHMM(existing.end_time) !== formatTimeHHMM(row.end_time);
      if (changed) {
        const list = changedByStaff.get(row.staff_id) ?? [];
        list.push({ date: row.date, status: row.status, start_time: row.start_time, end_time: row.end_time });
        changedByStaff.set(row.staff_id, list);
      }
    }
  }

  if (parsed.dates.length) {
    const { error: deleteError } = await supabase
      .from("daily_events")
      .delete()
      .in("date", parsed.dates);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

    if (parsed.events.length) {
      const { error: insertError } = await supabase.from("daily_events").insert(parsed.events);
      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  // Row order in the sheet is the venue's own ordering (e.g. grouped by
  // contract type) — keep the Rota screen matching it instead of A-Z.
  if (parsed.staffOrder.length) {
    const orderRows = parsed.staffOrder.map((staff_name, sort_order) => ({ staff_name, sort_order }));
    const { error } = await supabase
      .from("rota_staff_order")
      .upsert(orderRows, { onConflict: "staff_name" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await Promise.all(
    Array.from(changedByStaff.entries()).map(([staffId, shifts]) => {
      const sorted = [...shifts].sort((a, b) => a.date.localeCompare(b.date));
      const body = sorted.map((s) => `${formatDDMM(s.date)}: ${describeShift(s)}`).join(", ");
      return sendPushToStaff([staffId], {
        title: "Your shift has changed",
        body,
        url: "/rota",
      });
    })
  );

  return NextResponse.json({
    ok: true,
    datesSynced: parsed.dates,
    shiftsWritten: shiftRows.length,
    eventsWritten: parsed.events.length,
    unmatched: Array.from(unmatched),
    coloursSynced: colorGrid !== null,
    staffNotified: changedByStaff.size,
  });
}
