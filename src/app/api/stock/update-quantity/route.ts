import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { writeSheetCell } from "@/lib/google-sheets";

// Updates a stock product's order quantity and mirrors it back into the
// exact cell it came from in the Stock Orders Google Sheet, so whoever
// places the order can work from either the app or the sheet.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id, quantity } = await request.json().catch(() => ({}));
  if (typeof id !== "number") {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const qty: number | null = quantity === null || quantity === "" ? null : Number(quantity);

  const { data: product, error: fetchError } = await supabase
    .from("stock_products")
    .select("tab_label, row_number, order_col_letter")
    .eq("id", id)
    .single();
  if (fetchError || !product) {
    return NextResponse.json({ error: fetchError?.message ?? "Not found" }, { status: 404 });
  }

  const { error: updateError } = await supabase
    .from("stock_products")
    .update({ quantity: qty, updated_by: user.id, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const sheetId = process.env.STOCK_SHEET_ID;
  if (sheetId) {
    try {
      await writeSheetCell(
        sheetId,
        product.tab_label,
        `${product.order_col_letter}${product.row_number}`,
        qty ?? ""
      );
    } catch (err) {
      // Supabase already has the new quantity — surface the sheet-write
      // failure without pretending the whole request failed.
      return NextResponse.json({ ok: true, sheetWriteError: (err as Error).message });
    }
  }

  return NextResponse.json({ ok: true });
}
