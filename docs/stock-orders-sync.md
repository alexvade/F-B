# Google Sheets → Stock Orders sync

## How it works

Same mechanism as the rota sync (`docs/rota-sheet-sync.md`): the "Stock
Orders" sheet is fetched anonymously per-tab via Google's CSV export
endpoint, parsed (`src/lib/stock-sheet.ts`), and upserted into
`stock_products` — everything **except** `quantity`, which is app-native and
never overwritten by a product-list resync.

This is **read-only** — quantities entered on the Stock Orders screen live
only in the app (via `/api/stock/update-quantity`) and are never written
back into the Google Sheet. The sheet stays a plain product list.

The parser handles two layouts seen in the sheet: the simple `Code, Product,
To order:` tabs (Beer Cellar, Miscellaneous) and the richer `PW CODE,
PRODUCT, CELLAR CODE, SUPPLIER, To Order:` tab (Wine Cellar), which also
repeats its header once per producer group — that's detected and skipped.

## One-time setup

Extensions → Apps Script (from inside the Stock Orders sheet), paste this in:

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
to backfill all tabs immediately.

## If the sheet's layout changes

`src/lib/stock-sheet.ts` looks for a header row (anywhere — Wine Cellar's
isn't row 1) containing both "product" and "order", then reads every row
below it: a row with nothing in the Product column is a category/producer
label; a row whose Product column literally says "Product" is a repeated
header and gets skipped; anything else is a product row.
