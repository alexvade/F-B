import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToStaff } from "@/lib/push";

// TEMPORARY — sends a one-off test push to a single profile by email,
// using production's own VAPID keys (which aren't in local .env.local).
// Delete this route once the test is confirmed.
export async function POST(request: Request) {
  const secret = request.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email } = await request.json().catch(() => ({ email: null }));
  if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 });

  const supabase = createAdminClient();
  const { data: profile, error } = await supabase.from("profiles").select("id, name").eq("email", email).single();
  if (error || !profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const { data: subs } = await supabase.from("push_subscriptions").select("id").eq("staff_id", profile.id);

  await sendPushToStaff([profile.id], {
    title: "Test notification",
    body: "Just checking push is still working after the pg_cron switch!",
    url: "/dashboard",
  });

  return NextResponse.json({ ok: true, profile: profile.name, subscriptionCount: subs?.length ?? 0 });
}
