import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { buildStockReportBuffer } from "@/lib/stock-report";

// Emails the same report the download links produce. The "From" has to be a
// domain verified with Resend — it can't literally be the admin's own
// address (hotmail.com, gmail.com, etc. can never be verified by anyone but
// their own owner) — so this sends from Resend's shared sandbox address
// with the admin's name in the display name, and their real address as
// Reply-To so replies still land with them.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  // profiles itself no longer grants column-level access to email (see
  // 0019_profiles_email_privacy.sql) — profiles_directory returns it for
  // the viewer's own row, which this always is.
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

  const { to, tabs, format } = await request.json().catch(() => ({}));
  if (!to?.trim() || (format !== "xlsx" && format !== "pdf")) {
    return NextResponse.json({ error: "Missing or invalid to/format" }, { status: 400 });
  }
  const tabLabels: string[] | null = Array.isArray(tabs) && tabs.length > 0 ? tabs : null;

  let report;
  try {
    report = await buildStockReportBuffer(supabase, tabLabels, format);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  const resend = new Resend(apiKey);
  const adminName = callerProfile.name || "Team Ops";
  const { error: sendError } = await resend.emails.send({
    from: `${adminName} (Team Ops) <onboarding@resend.dev>`,
    to: to.trim(),
    replyTo: callerProfile.email || undefined,
    subject: `Stock Order — ${new Date().toISOString().slice(0, 10)}`,
    text: `Attached is the stock order${tabLabels ? ` for: ${tabLabels.join(", ")}` : ""}.\n\nSent from Team Ops by ${adminName}.`,
    attachments: [{ filename: report.filename, content: report.buffer }],
  });
  if (sendError) {
    return NextResponse.json({ error: sendError.message }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
