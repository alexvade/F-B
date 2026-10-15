import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

// Lazily configured — importing this module must never throw just because
// the VAPID env vars aren't set yet (e.g. in a build step, or before
// someone's finished setting up notifications), only actually sending one
// should fail in that case.
let configured = false;
function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys are not configured (NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)");
  }
  webpush.setVapidDetails(
    `mailto:${process.env.PUSH_CONTACT_EMAIL || "alexandru.vadeanu@gmail.com"}`,
    publicKey,
    privateKey
  );
  configured = true;
}

export type PushPayload = {
  title: string;
  body: string;
  /** App-relative path to open when the notification is tapped, e.g. "/rota". */
  url?: string;
};

/** Sends one push to every subscribed device for each of the given staff ids. Silently no-ops if VAPID isn't configured yet, or there's nothing to send to. */
export async function sendPushToStaff(staffIds: string[], payload: PushPayload): Promise<void> {
  const uniqueIds = Array.from(new Set(staffIds)).filter(Boolean);
  if (uniqueIds.length === 0) return;

  try {
    ensureConfigured();
  } catch {
    return;
  }

  const supabase = createAdminClient();
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("staff_id", uniqueIds);
  if (!subs || subs.length === 0) return;

  const payloadStr = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payloadStr
        );
      } catch (err) {
        // 404/410 = the browser's dropped this subscription for good (e.g.
        // uninstalled, or permission revoked) — stop retrying it forever.
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    })
  );
}

/** Sends to every member of staff — birthdays and new Noticeboard posts go to everyone. */
export async function sendPushToAll(payload: PushPayload): Promise<void> {
  const supabase = createAdminClient();
  const { data: profiles } = await supabase.from("profiles").select("id");
  await sendPushToStaff((profiles ?? []).map((p) => p.id), payload);
}
