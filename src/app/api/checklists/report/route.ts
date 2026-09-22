import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildAllChecklistsReportBuffer } from "@/lib/checklist-grid-report";

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
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const format = searchParams.get("format");
  if (!from || !to || (format !== "xlsx" && format !== "pdf")) {
    return NextResponse.json({ error: "Missing or invalid from/to/format" }, { status: 400 });
  }

  let result;
  try {
    result = await buildAllChecklistsReportBuffer(supabase, from, to, format);
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
