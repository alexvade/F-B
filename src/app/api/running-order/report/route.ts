import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildRunningOrderReportBuffer } from "@/lib/running-order-report";

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
  const id = Number(searchParams.get("id"));
  const format = searchParams.get("format");
  if (!id || (format !== "xlsx" && format !== "pdf")) {
    return NextResponse.json({ error: "Missing or invalid id/format" }, { status: 400 });
  }

  let result;
  try {
    result = await buildRunningOrderReportBuffer(supabase, id, format);
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
