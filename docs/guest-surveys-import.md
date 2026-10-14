# Gmail → Guest Surveys import

## How it works

There's no live inbox integration — deliberately, same reasoning as Events
(`docs/events-extraction.md`). Instead, whenever new ReviewPro "Post Stay
Survey" alerts have come in, ask Claude in a chat session (e.g. "check for
new guest survey emails and import them"). Claude:

1. Searches Gmail for `subject:"YOU HAVE A NEW RESPONSE"` (the forwarded
   ReviewPro alert's subject always contains this, prefixed with the
   forwarder's "Fw:").
2. For each matching message not already in `guest_surveys`
   (`gmail_message_id` is unique — check existing ids first), reads the
   plain-text body and extracts:
   - Guest name, the response link, language, response date
   - Overall score and NPS category (Promoter/Passive/Detractor)
   - Establishment, room, check-in/check-out dates
   - Every question/answer pair in the body, in order, into `answers`
     (a flexible JSONB list — ReviewPro's question set varies survey to
     survey and guest to guest, so this isn't normalized into columns)
3. Inserts one row per email into `guest_surveys` directly (service-role
   script, same pattern as `scripts/_add-cocktails.mjs` used elsewhere this
   project — a throwaway script, not something that lives in the repo
   permanently).

## Why JSONB for answers

Same reasoning as `events.content` — the question list isn't fixed (some
surveys ask about sustainability, some don't; a guest might skip optional
questions), so one flexible array handles every shape without a schema
migration every time ReviewPro changes their form.

## Verification

- `npm run build` + `npx eslint .` clean.
- The Guest Surveys page (`/guest-surveys`) shows the new response with
  its correct score color (green 9–10 "Promoter", amber 7–8 "Passive",
  red 0–6 "Detractor") and the full Q&A list expands correctly.
