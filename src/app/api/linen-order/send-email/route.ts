import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { buildLinenOrderReportBuffer, resetLinenOrder } from "@/lib/linen-order-report";

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
    .select("name, email, is_super_admin")
    .eq("id", user.id)
    .single();
  if (!callerProfile?.is_super_admin) {
    return NextResponse.json({ error: "Super admins only" }, { status: 403 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Email sending isn't configured (missing RESEND_API_KEY)" }, { status: 500 });
  }

  const { to } = await request.json().catch(() => ({}));
  if (!to?.trim()) {
    return NextResponse.json({ error: "Missing recipient" }, { status: 400 });
  }

  let report;
  try {
    report = await buildLinenOrderReportBuffer(supabase);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  const resend = new Resend(apiKey);
  const senderName = callerProfile?.name || "Team Ops";
  const today = new Date().toISOString().slice(0, 10);
  const { error: sendError } = await resend.emails.send({
    from: `${senderName} (Team Ops) <linenorders@team-ops.co.uk>`,
    to: to.trim(),
    replyTo: callerProfile?.email || undefined,
    subject: `Linen Order — Wood Hall Hotel — ${today}`,
    text: `Attached is today's linen order for Wood Hall Hotel.\n\nSent from Team Ops by ${senderName}.`,
    attachments: [{ filename: report.filename, content: report.buffer }],
  });
  if (sendError) {
    return NextResponse.json({ error: sendError.message }, { status: 502 });
  }

  await resetLinenOrder(supabase);

  return NextResponse.json({ ok: true });
}
