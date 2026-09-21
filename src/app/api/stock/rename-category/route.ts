import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Renames a subsection (category) within a tab by bulk-updating every
// product row that carries it — a section isn't its own row, just a shared
// string on stock_products.category, so "editing a section" means editing
// that string everywhere it's used within this tab.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { tabLabel, category, newCategory } = await request.json().catch(() => ({}));
  if (!tabLabel?.trim() || !category?.trim() || !newCategory?.trim()) {
    return NextResponse.json({ error: "Missing tab, section or new name" }, { status: 400 });
  }

  const { error } = await supabase
    .from("stock_products")
    .update({ category: newCategory.trim() })
    .eq("tab_label", tabLabel.trim())
    .eq("category", category.trim());
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
