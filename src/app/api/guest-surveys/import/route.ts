import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Called by the scheduled cloud agent that checks Gmail for new ReviewPro
// survey emails (see docs/guest-surveys-import.md). The agent does the
// Gmail search and parsing (it has the Gmail connector but not this app's
// service-role key, since .env.local is gitignored and never reaches its
// clone of the repo) and POSTs the structured rows here; this route does
// the actual write with the real credentials, which only ever live in this
// deployment's environment variables.
export async function POST(request: Request) {
  const secret = request.headers.get("x-guest-survey-sync-secret");
  if (!secret || secret !== process.env.GUEST_SURVEY_SYNC_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.surveys)) {
    return NextResponse.json({ error: "Missing surveys array" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("guest_surveys")
    .upsert(body.surveys, { onConflict: "gmail_message_id", ignoreDuplicates: true })
    .select("id, gmail_message_id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, imported: data?.length ?? 0 });
}
