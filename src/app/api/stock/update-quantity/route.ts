import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Updates a stock product's order quantity. App-only — the Google Sheet
// stays a read-only product list, quantities aren't written back to it.
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

  const { error } = await supabase
    .from("stock_products")
    .update({ quantity: qty, updated_by: user.id, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
