import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseStockSheet } from "@/lib/stock-sheet";

// Called by the Apps Script bound to the Stock Orders Google Sheet whenever
// it's edited. Re-fetches that tab's CSV and upserts the product list into
// stock_products — but deliberately never touches `quantity`, since that's
// app-native data staff enter here, not something the sheet's product-list
// edits should ever overwrite.
export async function POST(request: Request) {
  const secret = request.headers.get("x-stock-sync-secret");
  if (!secret || secret !== process.env.STOCK_SYNC_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sheetId = process.env.STOCK_SHEET_ID;
  if (!sheetId) {
    return NextResponse.json({ error: "STOCK_SHEET_ID is not configured" }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const { gid, tabLabel } = body ?? {};
  if (gid === undefined || gid === null || !tabLabel) {
    return NextResponse.json({ error: "Missing gid or tabLabel" }, { status: 400 });
  }

  const csvRes = await fetch(
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`
  );
  if (!csvRes.ok) {
    return NextResponse.json(
      { error: `Could not fetch sheet CSV (status ${csvRes.status})` },
      { status: 502 }
    );
  }
  const csvText = await csvRes.text();

  let parsed;
  try {
    parsed = parseStockSheet(csvText);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 422 });
  }

  const supabase = createAdminClient();
  const rows = parsed.products.map((p, i) => ({
    tab_gid: String(gid),
    tab_label: tabLabel,
    category: p.category,
    row_number: p.rowNumber,
    order_col_letter: parsed.orderColLetter,
    code: p.code,
    product: p.product,
    cellar_code: p.cellarCode,
    supplier: p.supplier,
    sort_order: i,
  }));

  if (rows.length) {
    const { error } = await supabase
      .from("stock_products")
      .upsert(rows, { onConflict: "tab_gid,row_number" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tabLabel, productsWritten: rows.length });
}
