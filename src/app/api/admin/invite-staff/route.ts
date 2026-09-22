import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (callerProfile?.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const { name, email, role, contract_hours } = await request.json();
  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email.trim(), {
    data: {
      name: name.trim(),
      role: role === "admin" ? "admin" : "staff",
      contract_hours: contract_hours || null,
    },
    redirectTo: `${origin}/auth/set-password`,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // The rota is often populated (via the Google Sheet sync) with a
  // staff_name before that person has an account — those rows sit with
  // staff_id null until something links them up. If the name just invited
  // matches one of them, link it now instead of leaving a second, empty
  // "new person" row alongside their real rota history. Matched
  // case-insensitively/trimmed (sheet data isn't always typed consistently)
  // and staff_name is normalised to the exact name just entered, so the
  // Rota screen's own name-based grouping merges them into one row.
  let rotaShiftsLinked = 0;
  if (data.user) {
    const { data: matches } = await admin
      .from("rota_shifts")
      .select("id")
      .ilike("staff_name", name.trim())
      .is("staff_id", null);
    if (matches && matches.length > 0) {
      const { error: linkError } = await admin
        .from("rota_shifts")
        .update({ staff_id: data.user.id, staff_name: name.trim() })
        .in("id", matches.map((m) => m.id));
      if (!linkError) rotaShiftsLinked = matches.length;
    }
  }

  return NextResponse.json({ id: data.user?.id, rotaShiftsLinked });
}
