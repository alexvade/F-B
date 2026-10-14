import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Called by .github/workflows/daily-overview-import.yml after it parses a
// "WHH Daily Overview" spreadsheet the scheduled Gmail routine found and
// pushed (see scripts/parse-daily-overview.mjs — the workflow never holds
// the service-role key, only this route does).
export async function POST(request: Request) {
  const secret = request.headers.get("x-daily-overview-sync-secret");
  if (!secret || secret !== process.env.DAILY_OVERVIEW_SYNC_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.rows)) {
    return NextResponse.json({ error: "Missing rows array" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("daily_covers")
    .upsert(body.rows, { onConflict: "date" })
    .select("date");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, imported: data?.length ?? 0 });
}
