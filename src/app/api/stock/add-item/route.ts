import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";

// Adds a manual stock item — either into an existing tab (reuses its
// tab_gid, appends after its highest row_number) or a brand new tab label
// (gets its own synthetic tab_gid), since a tab only exists in the UI
// while at least one stock_products row carries its label. Admin-gated by
// RLS (admin_insert_stock_products, 0024_stock_products_admin_write.sql).
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { tabLabel, category, product, code, supplier, cellarCode } = await request.json().catch(() => ({}));
  if (!tabLabel?.trim() || !category?.trim() || !product?.trim()) {
    return NextResponse.json({ error: "Tab, category and product are required" }, { status: 400 });
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("stock_products")
    .select("tab_gid, row_number, sort_order")
    .eq("tab_label", tabLabel.trim());
  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const tabGid = existingRows?.[0]?.tab_gid ?? `manual-${crypto.randomUUID()}`;
  const nextRowNumber = existingRows?.length ? Math.max(...existingRows.map((r) => r.row_number)) + 1 : 1;
  const nextSortOrder = existingRows?.length ? Math.max(...existingRows.map((r) => r.sort_order)) + 1 : 0;

  const { error } = await supabase.from("stock_products").insert({
    tab_gid: tabGid,
    tab_label: tabLabel.trim(),
    category: category.trim(),
    row_number: nextRowNumber,
    order_col_letter: "-",
    code: code?.trim() || null,
    product: product.trim(),
    cellar_code: cellarCode?.trim() || null,
    supplier: supplier?.trim() || null,
    sort_order: nextSortOrder,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
