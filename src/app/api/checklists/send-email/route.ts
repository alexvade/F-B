import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { buildAllChecklistsReportBuffer } from "@/lib/checklist-grid-report";

// Emails the same report the download links produce. Same From/Reply-To
// approach as api/stock/send-email — see that route's comment for why.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const { data: callerProfile } = await supabase
    .from("profiles_directory")
    .select("role, name, email")
    .eq("id", user.id)
    .single();
  if (callerProfile?.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Email sending isn't configured (missing RESEND_API_KEY)" }, { status: 500 });
  }

  const { email, from, to, format } = await request.json().catch(() => ({}));
  if (!email?.trim() || !from || !to || (format !== "xlsx" && format !== "pdf")) {
    return NextResponse.json({ error: "Missing or invalid email/from/to/format" }, { status: 400 });
  }

  let report;
  try {
    report = await buildAllChecklistsReportBuffer(supabase, from, to, format);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  const resend = new Resend(apiKey);
  const adminName = callerProfile.name || "Team Ops";
  const { error: sendError } = await resend.emails.send({
    from: `${adminName} (Team Ops) <reports@team-ops.co.uk>`,
    to: email.trim(),
    replyTo: callerProfile.email || undefined,
    subject: `Checklist Completion Report — ${from} to ${to}`,
    text: `Attached is the checklist completion report for ${from} to ${to}.\n\nSent from Team Ops by ${adminName}.`,
    attachments: [{ filename: report.filename, content: report.buffer }],
  });
  if (sendError) {
    return NextResponse.json({ error: sendError.message }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
