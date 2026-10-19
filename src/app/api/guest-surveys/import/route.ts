import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToAll } from "@/lib/push";
import { buildRoster, applyManualRosterOverrides, buildRows } from "@/lib/guest-survey-dashboard";

// Congratulation openers for the auto-post below — one is picked at
// random per shout-out so the Noticeboard doesn't read like a form letter.
const SHOUTOUT_OPENERS = [
  (n: string) => `🌟 Shout-out time — ${n} just made a guest's day!`,
  (n: string) => `👏 Nice one, ${n}! A guest took the time to say thanks.`,
  (n: string) => `🎉 ${n}, you're a legend — spotted in today's reviews!`,
  (n: string) => `⭐ Guests are talking — ${n} got a lovely mention!`,
  (n: string) => `🙌 Well done ${n} — another happy guest shout-out!`,
  (n: string) => `💫 ${n} strikes again! Another guest singled them out.`,
  (n: string) => `🌟 Round of applause for ${n} — guest review love incoming!`,
  (n: string) => `👏 ${n}, someone noticed! Great work.`,
];

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
    .select("id, gmail_message_id, guest_name, response_date, overall_score, nps_category, room, check_in, check_out, answers");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (data && data.length > 0) {
    const first = data[0];
    const scoreText = first.overall_score !== null ? ` (score ${first.overall_score})` : "";
    const message =
      data.length === 1
        ? `${first.guest_name}'s survey just came in${scoreText}.`
        : `${data.length} new guest surveys just came in.`;
    await sendPushToAll({ title: "New guest survey", body: message, url: "/guest-surveys" });

    // `data` here is only the rows the upsert actually inserted (duplicates
    // are skipped by `ignoreDuplicates`), so every shout-out below is for a
    // genuinely new review — no separate dedup check needed.
    await postStaffShoutouts(supabase, data);
  }

  return NextResponse.json({ ok: true, imported: data?.length ?? 0 });
}

async function postStaffShoutouts(
  supabase: ReturnType<typeof createAdminClient>,
  rows: { id: number; guest_name: string; response_date: string | null; overall_score: number | null; nps_category: string | null; room: string | null; check_in: string | null; check_out: string | null; answers: { question: string; answer: string | null }[] }[]
) {
  const { data: order } = await supabase.from("rota_staff_order").select("staff_name");
  const roster = applyManualRosterOverrides(buildRoster((order ?? []).map((r) => r.staff_name)));
  if (!roster.length) return;

  const built = buildRows(rows, roster);

  for (const row of built) {
    const praised = new Map<string, string>(); // canonical name -> quote
    for (const s of row.staff) if (s.tone === "praise" && !praised.has(s.name)) praised.set(s.name, s.quote);

    for (const [name, quote] of praised) {
      const firstName = name.split(" ")[0];
      const opener = SHOUTOUT_OPENERS[Math.floor(Math.random() * SHOUTOUT_OPENERS.length)](firstName);
      const snippet = quote.length > 220 ? quote.slice(0, 220) + "…" : quote;
      await supabase.from("posts").insert({ author_id: null, text: `${opener}\n\n"${snippet}"` });
      await sendPushToAll({ title: "⭐ Staff shout-out", body: `${firstName} was just praised by a guest!`, url: "/updates" });
    }
  }
}
