import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToAll, sendPushToStaff } from "@/lib/push";
import { todayISO, checklistDayISO, londonWallClock } from "@/lib/dates";

// Runs every 15 minutes, called by Supabase's pg_cron (see
// supabase/migrations/0049_pg_cron_tick.sql and docs/push-notifications.md).
// A 15-minute Vercel Cron isn't supported on this project's plan, and a
// GitHub Actions schedule was tried before pg_cron but proved unreliable —
// GitHub silently throttles/drops frequent scheduled workflows under load,
// which in production meant real gaps of hours between runs. Either way,
// this just checks a shared secret sent as a bearer token — it doesn't
// care who's calling it.
function isAuthorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

// Birthdays only need posting/pushing once a day — this window just needs
// to contain exactly one of the 15-minute ticks.
const BIRTHDAY_HOUR = 8;
const BIRTHDAY_MINUTE_WINDOW = 15;

// How long before a shift's end_time its "finish the checklist" push fires.
const CHECKLIST_REMINDER_LEAD_MINUTES = 30;

const LINEN_REMINDER_HOUR = 8;
const LINEN_REMINDER_MINUTE_WINDOW = 15;
const LINEN_REMINDER_TITLE = "🧺 Linen count";

async function runBirthdays(supabase: ReturnType<typeof createAdminClient>, now: Date) {
  const local = londonWallClock(now);
  if (local.getUTCHours() !== BIRTHDAY_HOUR || local.getUTCMinutes() >= BIRTHDAY_MINUTE_WINDOW) {
    return { ran: false };
  }

  const day = local.getUTCDate();
  const month = local.getUTCMonth() + 1;
  const { data: todays } = await supabase.from("birthdays").select("*").eq("day", day).eq("month", month);
  if (!todays || todays.length === 0) return { ran: true, posted: 0 };

  const startOfDay = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate())).toISOString();
  let posted = 0;
  for (const b of todays) {
    const marker = `🎂 Happy birthday, ${b.name}`;
    const { data: existing } = await supabase
      .from("posts")
      .select("id")
      .ilike("text", `${marker}%`)
      .gte("created_at", startOfDay)
      .limit(1);
    if (existing && existing.length > 0) continue;

    await supabase.from("posts").insert({ author_id: null, text: `${marker}! 🎉🎈` });
    await sendPushToAll({ title: "🎂 Birthday today!", body: `It's ${b.name}'s birthday — give them a shout.`, url: "/updates" });
    posted++;
  }
  return { ran: true, posted };
}

async function runChecklistReminders(supabase: ReturnType<typeof createAdminClient>, now: Date) {
  const date = todayISO(now);
  const { data: shifts } = await supabase
    .from("rota_shifts")
    .select("id, staff_id, end_time")
    .eq("date", date)
    .eq("status", "work")
    .not("staff_id", "is", null)
    .not("end_time", "is", null)
    .is("checklist_reminder_sent_at", null);
  if (!shifts || shifts.length === 0) return { reminded: 0 };

  const local = londonWallClock(now);
  const nowMinutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  const dueShifts = shifts.filter((s) => {
    const [h, m] = s.end_time!.split(":").map(Number);
    const diff = h * 60 + m - nowMinutes;
    return diff > 0 && diff <= CHECKLIST_REMINDER_LEAD_MINUTES;
  });
  if (dueShifts.length === 0) return { reminded: 0 };

  // Only bother anyone if something's actually still incomplete today —
  // same "checklist day" (5am-5am) boundary the Checklists page itself uses.
  const checklistDay = checklistDayISO(now);
  const [{ data: allItems }, { data: completions }] = await Promise.all([
    supabase.from("checklist_items").select("id"),
    supabase.from("checklist_completions").select("item_id").eq("checklist_day", checklistDay),
  ]);
  const completedIds = new Set((completions ?? []).map((c) => c.item_id));
  const hasIncomplete = (allItems ?? []).some((i) => !completedIds.has(i.id));
  if (!hasIncomplete) {
    // Nothing left to do — mark these as handled anyway so we don't
    // re-evaluate them every 15 minutes for the rest of the shift.
    await supabase
      .from("rota_shifts")
      .update({ checklist_reminder_sent_at: new Date().toISOString() })
      .in("id", dueShifts.map((s) => s.id));
    return { reminded: 0 };
  }

  for (const s of dueShifts) {
    await sendPushToStaff([s.staff_id!], {
      title: "Checklist reminder",
      body: "Your shift ends soon — don't forget to finish today's checklist.",
      url: "/checklists",
    });
  }
  await supabase
    .from("rota_shifts")
    .update({ checklist_reminder_sent_at: new Date().toISOString() })
    .in("id", dueShifts.map((s) => s.id));

  return { reminded: dueShifts.length };
}

// Personal daily reminder for whoever's super-admin (currently just Alex) to
// send Fisher Services the linen count — not tied to any in-app page, just
// a nudge. Looked up by is_super_admin rather than a hardcoded id, since
// account ids aren't stable (an account deleted and re-invited gets a new
// one — see 0059_rota_shifts_staff_id_set_null.sql's own history of this).
async function runLinenReminder(supabase: ReturnType<typeof createAdminClient>, now: Date) {
  const local = londonWallClock(now);
  if (local.getUTCHours() !== LINEN_REMINDER_HOUR || local.getUTCMinutes() >= LINEN_REMINDER_MINUTE_WINDOW) {
    return { ran: false };
  }

  const { data: admins } = await supabase.from("profiles").select("id").eq("is_super_admin", true);
  if (!admins || admins.length === 0) return { ran: true, sent: 0 };

  const startOfDay = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate())).toISOString();
  let sent = 0;
  for (const admin of admins) {
    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("staff_id", admin.id)
      .eq("title", LINEN_REMINDER_TITLE)
      .gte("created_at", startOfDay)
      .limit(1);
    if (existing && existing.length > 0) continue;

    await sendPushToStaff([admin.id], {
      title: LINEN_REMINDER_TITLE,
      body: "Send today's linen count to Fisher Services.",
    });
    sent++;
  }
  return { ran: true, sent };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const [birthdays, checklists, linenReminder] = await Promise.all([
    runBirthdays(supabase, now),
    runChecklistReminders(supabase, now),
    runLinenReminder(supabase, now),
  ]);

  return NextResponse.json({ ok: true, birthdays, checklists, linenReminder });
}
