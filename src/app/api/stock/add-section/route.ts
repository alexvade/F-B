import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";

// Adds a whole new subsection (category) to a tab in one go — a name plus a
// list of item names — rather than one item at a time. Mirrors add-item's
// tab_gid/row_number handling so these rows behave the same as any other
// manually-added stock item (never touched by the Google Sheet sync).
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { tabLabel, category, items } = await request.json().catch(() => ({}));
  const products: string[] = Array.isArray(items)
    ? items.map((s: unknown) => String(s).trim()).filter(Boolean)
    : [];
  if (!tabLabel?.trim() || !category?.trim() || products.length === 0) {
    return NextResponse.json(
      { error: "Tab, section name and at least one item are required" },
      { status: 400 }
    );
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("stock_products")
    .select("tab_gid, row_number, sort_order")
    .eq("tab_label", tabLabel.trim());
  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const tabGid = existingRows?.[0]?.tab_gid ?? `manual-${crypto.randomUUID()}`;
  let nextRowNumber = existingRows?.length ? Math.max(...existingRows.map((r) => r.row_number)) + 1 : 1;
  let nextSortOrder = existingRows?.length ? Math.max(...existingRows.map((r) => r.sort_order)) + 1 : 0;

  const rows = products.map((product) => ({
    tab_gid: tabGid,
    tab_label: tabLabel.trim(),
    category: category.trim(),
    row_number: nextRowNumber++,
    order_col_letter: "-",
    product,
    sort_order: nextSortOrder++,
  }));

  const { error } = await supabase.from("stock_products").insert(rows);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, count: rows.length });
}
