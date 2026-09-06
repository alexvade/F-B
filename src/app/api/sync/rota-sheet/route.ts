import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseRotaSheet } from "@/lib/rota-sheet";

// Called by the Apps Script bound to the F&B Rota Google Sheet whenever it's
// edited (see docs/rota-sheet-sync.md for the script + setup steps). Fetches
// that one week-tab's CSV export and upserts it into rota_shifts /
// daily_covers / daily_events. Staff are matched to existing accounts by
// name — anyone not yet invited is reported back in `unmatched`, not synced.
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

  let parsed;
  try {
    parsed = parseRotaSheet(csvText);
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
    };
  });

  if (shiftRows.length) {
    const { error } = await supabase
      .from("rota_shifts")
      .upsert(shiftRows, { onConflict: "staff_name,date" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (parsed.covers.length) {
    const { error } = await supabase.from("daily_covers").upsert(parsed.covers, { onConflict: "date" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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

  return NextResponse.json({
    ok: true,
    datesSynced: parsed.dates,
    shiftsWritten: shiftRows.length,
    coversWritten: parsed.covers.length,
    eventsWritten: parsed.events.length,
    unmatched: Array.from(unmatched),
  });
}
