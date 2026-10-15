# Push notifications

## What triggers one

| Event | Who gets it | Where it's sent from |
|---|---|---|
| New Noticeboard post | Everyone | `src/app/api/push/notify-post` (called by `updates/page.tsx` right after the post is inserted) |
| New guest survey/review imported | Everyone | `src/app/api/guest-surveys/import` |
| Your rota shift is added or changed | Just that person | `src/app/api/sync/rota-sheet` (diffs against the previous values before upserting) |
| Someone's birthday | Everyone | `src/app/api/cron/tick`, once a day around 08:00 Europe/London |
| Your shift ends in ~30 minutes and something's still unticked on today's checklist | Just the people whose shift is ending | `src/app/api/cron/tick`, checked every 15 minutes |

Sending itself always goes through `src/lib/push.ts` (`sendPushToStaff` / `sendPushToAll`), which reads everyone's saved subscriptions and calls the `web-push` library — the actual browser/OS push delivery is handled by Apple/Google/Mozilla's own push services, not this app.

## One-time setup

1. **Database**: run `0048_push_notifications.sql` (adds `push_subscriptions` and `rota_shifts.checklist_reminder_sent_at`).
2. **Environment variables** — add these in Vercel (Settings → Environment Variables) and redeploy:
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — a keypair identifying this app to the push services. Generate once with `npx web-push generate-vapid-keys` (or ask Claude to — no third-party account needed, it's just a local keypair).
   - `CRON_SECRET` — any random string. Vercel automatically sends it back as the cron job's own auth header, so nothing else needs to reference it.
   - `PUSH_CONTACT_EMAIL` (optional) — an address push services can contact if your server ever misbehaves. Defaults to alexandru.vadeanu@gmail.com.
3. **Cron job**: `vercel.json` already defines it (`/api/cron/tick`, every 15 minutes) — Vercel picks this up automatically on deploy, nothing to configure in the dashboard.
4. **Each person opts in themselves**, once, per device: Settings → Notifications → "Enable notifications". The browser will ask for permission; saying yes registers that device.

## The iPhone/Safari catch

iOS only allows push notifications for a site that's been **Added to Home Screen** first (iOS 16.4+) — opening the site in a normal Safari tab, even logged in, can never show a push notification on iPhone. The Settings page already explains this; anyone on iPhone needs to install the app (see the earlier "Team Ops On Your Phone" PDF) before "Enable notifications" will do anything for them.

## If a notification isn't arriving

- Check the person actually tapped "Enable notifications" in Settings and allowed the browser's permission prompt.
- `push_subscriptions` holds one row per device — if someone reinstalled the app or cleared site data, their old subscription is probably dead; sending to it will 404/410, and `sendPushToStaff` deletes it automatically on that response, so the fix is just enabling notifications again on that device.
- For the cron-driven ones (birthdays, checklist reminders), check Vercel's Cron Jobs log (Project → Settings → Cron Jobs) for the run's response — it returns `{ ok: true, birthdays: {...}, checklists: {...} }` so you can see whether it actually evaluated anything that tick.
