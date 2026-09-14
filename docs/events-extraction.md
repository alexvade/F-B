# Turning function sheets into Events guides

## How it works

There's no in-app AI pipeline for this — deliberately, to avoid a new API
key and per-upload cost. Instead:

1. An admin adds an event on the **Events** tab: uploads the function
   sheet PDF and gives it a title (and optionally a date). This creates a
   row in both `function_sheets` (unchanged, same as before) and `events`
   (with `content` left `null`).
2. Whenever the venue wants new function sheets turned into guides, ask
   Claude in a chat session — e.g. "process this week's events."
3. Claude:
   - Queries `events` where `content is null`.
   - Downloads each linked PDF from its `function_sheets.file_url` (a
     public Storage URL) to a local file.
   - Reads it and extracts the content into the shape defined in
     `src/lib/event-content.ts` (`EventContent`) — masthead info, stats,
     contacts, a day-by-day timeline, menu/drinks cards, who's-providing-
     what, and notes — using the reference wedding guide as the model for
     what to pull out. Sections with nothing to say are just omitted; the
     renderer (`src/components/event-guide.tsx`) only shows sections that
     are present.
   - Writes the result back with a small service-role script, e.g.:
     ```js
     await supabase.from("events").update({ content, updated_at: new Date().toISOString() }).eq("id", eventId);
     ```
     (same pattern as `scripts/_add-cocktails.mjs` used earlier — a
     throwaway script using `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`,
     not something that lives in the repo permanently).

## Why JSONB instead of a normalized schema

Event content varies hugely — a full wedding has ~8 sections, a two-line
corporate room booking might just have a timeline. A single flexible
`content` blob per event, entirely optional field-by-field, means one
template handles both without needing two separate layouts or a schema
migration every time a new kind of section shows up.
