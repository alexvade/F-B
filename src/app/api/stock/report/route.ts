import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildStockReportBuffer } from "@/lib/stock-report";

// Admin-gated export of the current stock order — everything with a
// quantity actually set (> 0), across every tab, as a .xlsx or .pdf. Not
// date-ranged like the checklist report, since this is a snapshot of what
// needs ordering right now rather than a history.
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const { data: callerProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (callerProfile?.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");
  if (format !== "xlsx" && format !== "pdf") {
    return NextResponse.json({ error: "Missing or invalid format" }, { status: 400 });
  }
  // Comma-separated tab labels to restrict the export to — omit to include
  // every tab, same as before this option existed.
  const tabsParam = searchParams.get("tabs");
  const tabLabels = tabsParam
    ? tabsParam
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : null;

  let result;
  try {
    result = await buildStockReportBuffer(supabase, tabLabels, format);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": result.contentType,
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  });
}
