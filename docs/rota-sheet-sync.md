# Google Sheets → Rota live sync

## How it works

The "F&B Rota" Google Sheet is shared "anyone with the link can view," which
means the app's server can fetch any tab's contents anonymously via Google's
CSV export endpoint — no Google API credentials needed for reading:

```
https://docs.google.com/spreadsheets/d/<SHEET_ID>/export?format=csv&gid=<TAB_GID>
```

A small Apps Script bound to the Sheet fires on every edit and calls the
app's `/api/sync/rota-sheet` webhook with just the tab's `gid`. The webhook
re-fetches that tab's CSV, parses it (`src/lib/rota-sheet.ts`), and upserts
`rota_shifts`, `daily_covers`, and `daily_events` for that week.

Staff are matched to existing accounts **by name** (case-insensitive, minus
the `(40)`/`(C)` contract suffix). Anyone in the sheet who hasn't been
invited yet via **Manage staff** is skipped and reported in the response's
`unmatched` list — invite them, and the next edit (or a manual re-sync) will
pick their shifts up.

Only `rota_shifts` / `daily_covers` / `daily_events` are touched — never
`profiles`, so this can't accidentally create or modify accounts.

## One-time setup (per Google account that owns the Sheet)

1. Open the Sheet → **Extensions → Apps Script**.
2. Delete the placeholder code and paste in the script below.
3. Fill in `WEBHOOK_URL` (the deployed app's URL) and `SECRET` (the
   `ROTA_SYNC_SECRET` env var value — ask whoever set up the app for it).
4. Save the project (any name is fine, e.g. "Rota Sync").
5. Click the clock icon (**Triggers**) in the left sidebar → **+ Add Trigger**.
   - Function: `onEditInstallable`
   - Event source: `From spreadsheet`
   - Event type: `On edit`
   - Save.
6. Google will show an "unverified app" consent screen the first time —
   that's expected for a personal script. Click **Advanced → Go to (project
   name) → Allow**. It only needs permission to make outbound web requests.
7. Test it: edit any cell in a week tab, then check the app's Rota screen
   for that week — it should update within a couple of seconds.

```javascript
// Apps Script — bound to the F&B Rota Google Sheet.
const WEBHOOK_URL = "https://f-b-self.vercel.app/api/sync/rota-sheet";
const SECRET = "PASTE_ROTA_SYNC_SECRET_HERE";

function onEditInstallable(e) {
  const gid = e.source.getActiveSheet().getSheetId();
  UrlFetchApp.fetch(WEBHOOK_URL, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ gid: gid }),
    headers: { "x-rota-sync-secret": SECRET },
    muteHttpExceptions: true,
  });
}
```

## If the sheet's layout ever changes

`src/lib/rota-sheet.ts` expects, per week tab:
- A `Date` row (dd/mm/yyyy per day, each day spanning 2 columns) and a `Day` row below it.
- `GIH` / `Breakfast` rows above `Date`.
- Any other labelled row above `Date` is treated as a room/event row; a row named
  `<room> Lunch | Dinner` is merged into the event directly above it as extra detail.
- Staff rows (`Name (contract)`) below `Day`, each cell either `OFF`, `HOL`, or a
  `HH:MM` start time (with the end time in the next column).
- A `Colour map` row marks the end of the staff section.

If the sheet is restructured, update the parser accordingly — it's a plain
CSV parser with no hidden assumptions beyond what's listed above.
