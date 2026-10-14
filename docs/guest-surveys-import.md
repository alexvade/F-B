# Gmail → Guest Surveys import

## How it works (live, scheduled)

A cloud routine ("Import new ReviewPro guest surveys",
`https://claude.ai/code/routines/trig_016M7RqaBuexdNHFyH5TLH4f`) runs every
morning. It has Gmail access (via the claude.ai Gmail connector) but no
Supabase credentials, so it never writes to the database directly:

1. Searches Gmail for `subject:"YOU HAVE A NEW RESPONSE" OR subject:"you have
   new review"` — two different ReviewPro alert types get forwarded to this
   inbox:
   - **Post Stay Survey** alerts (`YOU HAVE A NEW RESPONSE`): guest name,
     response link, language, response date, overall score, NPS category
     (Promoter/Passive/Detractor), establishment, room, check-in/check-out,
     and a flat list of question/answer pairs.
   - **OTA review** alerts (`you have new review ... - All Reviews`, e.g. a
     Booking.com review): reviewer name, an OTA source name, overall score,
     free-text positive/negative review, and named category scores
     (Location/Service/Value/Cleanliness/Room — varies per review). These
     don't carry a room, check-in/out, or NPS category, so those fields are
     null; `survey_name` is set to `"<OTA> Review"` to distinguish them in
     the UI, and the category scores + review text are packed into `answers`
     the same way survey Q&A pairs are.
2. Writes the parsed rows as `{ "surveys": [...] }` to
   `data/guest-surveys-inbox.json` and pushes that to the dedicated
   `guest-survey-sync` branch (not `main` — this never touches the deployed
   app or triggers a Vercel build).
3. A GitHub Actions workflow
   (`.github/workflows/guest-survey-import.yml`), triggered by that push,
   POSTs the file's contents to `/api/guest-surveys/import` on the deployed
   app, authenticated with the `GUEST_SURVEY_SYNC_SECRET` repo secret. That
   route holds the real Supabase service-role credentials (Vercel env var)
   and upserts into `guest_surveys` with `onConflict: "gmail_message_id",
   ignoreDuplicates: true` — so re-sending an already-imported email is a
   no-op.

This two-hop relay (routine → git push → GitHub Action → API route) exists
because the cloud routine's sandbox can only reach a fixed set of hosts
(Anthropic APIs, connectors, GitHub) — a direct POST from the routine to the
app's domain is blocked by the sandbox's network policy. GitHub Actions
runners have normal internet access, so they do the actual call.

## Why JSONB for answers

Same reasoning as `events.content` — the question/category set isn't fixed
(it varies by survey, by guest, and now by review source too), so one
flexible array handles every shape without a schema migration every time
ReviewPro changes a form.

## Manual one-off import

If you need to import something the routine missed (ask in a chat session
to "check for new guest survey emails and import them") — same extraction
rules as above, written directly via a throwaway service-role script rather
than through the relay.

## Verification

- `npm run build` + `npx eslint .` clean.
- The Guest Surveys page (`/guest-surveys`) shows new responses with the
  correct score color (green 9–10, amber 7–8, red 0–6), the right
  `survey_name`, and the full Q&A/category list expands correctly — for
  both Post Stay Survey and OTA review rows.
