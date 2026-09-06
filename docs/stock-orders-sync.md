# Google Sheets ↔ Stock Orders sync

## How it works

Same read side as the rota sync (`docs/rota-sheet-sync.md`): the "Stock
Orders" sheet is fetched anonymously per-tab via Google's CSV export
endpoint, parsed (`src/lib/stock-sheet.ts`), and upserted into
`stock_products` — everything **except** `quantity`, which is app-native and
never overwritten by a product-list resync.

Unlike the rota, this one **writes back**: when someone enters a quantity on
the Stock Orders screen, `/api/stock/update-quantity` saves it to Supabase
*and* writes the same number into the exact cell it came from in the Google
Sheet (via a service account, since writing needs real credentials — the
anonymous CSV trick is read-only).

The parser handles two layouts seen in the sheet: the simple `Code, Product,
To order:` tabs (Beer Cellar, Miscellaneous) and the richer `PW CODE,
PRODUCT, CELLAR CODE, SUPPLIER, To Order:` tab (Wine Cellar), which also
repeats its header once per producer group — that's detected and skipped.

## One-time setup

### 1. Google Cloud service account (for write-back)

1. [console.cloud.google.com](https://console.cloud.google.com) → create a project.
2. **APIs & Services → Library** → enable **Google Sheets API**.
3. **APIs & Services → Credentials → Create Credentials → Service Account** → any name → Create and Continue → skip role → Done.
4. Open it → **Keys** → **Add Key → Create new key → JSON** → download it.
5. From that JSON file, take `client_email` and `private_key`.
6. In the Stock Orders sheet → **Share** → paste in `client_email` → **Editor** access.
7. Set these on the deployed app (Vercel env vars, and `.env.local` for local dev):
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL` = the `client_email` value
   - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` = the `private_key` value, quoted, with its `\n`s kept literal (the JSON file already has them escaped correctly — paste it as-is inside quotes)

### 2. Apps Script (bound to the Stock Orders sheet)

Same pattern as the rota — Extensions → Apps Script, paste this in:

```javascript
const WEBHOOK_URL = "https://f-b-self.vercel.app/api/sync/stock-sheet";
const SECRET = "PASTE_STOCK_SYNC_SECRET_HERE";

function onEditInstallable(e) {
  syncSheet(e.source.getActiveSheet());
}

function syncAllSheets() {
  SpreadsheetApp.getActiveSpreadsheet().getSheets().forEach(syncSheet);
}

function syncSheet(sheet) {
  UrlFetchApp.fetch(WEBHOOK_URL, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ gid: sheet.getSheetId(), tabLabel: sheet.getName() }),
    headers: { "x-stock-sync-secret": SECRET },
    muteHttpExceptions: true,
  });
}
```

Then: Triggers → Add Trigger → `onEditInstallable`, From spreadsheet, On edit
→ Save → approve the permissions prompt. Run `syncAllSheets` once manually
to backfill all three tabs immediately.

## If the sheet's layout changes

`src/lib/stock-sheet.ts` looks for a header row (anywhere — Wine Cellar's
isn't row 1) containing both "product" and "order", then reads every row
below it: a row with nothing in the Product column is a category/producer
label; a row whose Product column literally says "Product" is a repeated
header and gets skipped; anything else is a product row.
