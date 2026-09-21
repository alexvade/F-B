import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Updates a stock product's editable fields (name, code, cellar code,
// supplier, category, delisted). Note: for an item synced from the Google
// Sheet, the next sheet-triggered sync (api/sync/stock-sheet) will overwrite
// product/code/cellar_code/supplier/category back to whatever the sheet
// says — only `delisted` and `quantity` are sync-untouched. Manually-added
// items (their own synthetic tab_gid) are never touched by sync.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id, product, code, cellarCode, supplier, category, delisted } = await request.json().catch(() => ({}));
  if (typeof id !== "number") {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  if (!product?.trim() || !category?.trim()) {
    return NextResponse.json({ error: "Product and category are required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("stock_products")
    .update({
      product: product.trim(),
      code: code?.trim() || null,
      cellar_code: cellarCode?.trim() || null,
      supplier: supplier?.trim() || null,
      category: category.trim(),
      delisted: !!delisted,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
