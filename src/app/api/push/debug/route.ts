import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import webpush from "web-push";

// TEMPORARY — diagnosing why the real push triggers (Noticeboard post, rota
// sync) aren't delivering anything, despite their own routes returning 200.
// Never returns actual key/secret values, only presence booleans and
// web-push's own error details for one real send attempt to the caller's
// own subscriptions. Delete this route once the mystery's solved.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const { data: profile } = await supabase.from("profiles").select("is_super_admin").eq("id", user.id).single();
  if (!profile?.is_super_admin) {
    return NextResponse.json({ error: "Super admins only" }, { status: 403 });
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const contactEmail = process.env.PUSH_CONTACT_EMAIL;

  const admin = createAdminClient();
  const { data: subs, error: subsError } = await admin
    .from("push_subscriptions")
    .select("id, endpoint")
    .eq("staff_id", user.id);

  const diagnostics: Record<string, unknown> = {
    hasPublicKey: !!publicKey,
    publicKeyLength: publicKey?.length ?? 0,
    hasPrivateKey: !!privateKey,
    privateKeyLength: privateKey?.length ?? 0,
    contactEmailSet: !!contactEmail,
    subscriptionCount: subs?.length ?? 0,
    subscriptionIds: subs?.map((s) => s.id) ?? [],
    subsError: subsError?.message ?? null,
  };

  if (!publicKey || !privateKey) {
    diagnostics.sendAttempted = false;
    diagnostics.conclusion = "VAPID keys are missing from this deployment's environment.";
    return NextResponse.json(diagnostics);
  }

  try {
    webpush.setVapidDetails(`mailto:${contactEmail || "alexandru.vadeanu@gmail.com"}`, publicKey, privateKey);
  } catch (err) {
    diagnostics.sendAttempted = false;
    diagnostics.vapidSetupError = (err as Error).message;
    return NextResponse.json(diagnostics);
  }

  const results = [];
  for (const sub of subs ?? []) {
    const { data: full } = await admin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("id", sub.id)
      .single();
    if (!full) continue;
    try {
      await webpush.sendNotification(
        { endpoint: full.endpoint, keys: { p256dh: full.p256dh, auth: full.auth } },
        JSON.stringify({ title: "Debug test", body: `Sent via /api/push/debug at ${new Date().toISOString()}`, url: "/dashboard" })
      );
      results.push({ id: sub.id, ok: true });
    } catch (err) {
      const e = err as { statusCode?: number; body?: string; message?: string };
      results.push({ id: sub.id, ok: false, statusCode: e.statusCode, body: e.body, message: e.message });
    }
  }
  diagnostics.sendAttempted = true;
  diagnostics.results = results;

  return NextResponse.json(diagnostics);
}
