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
    .select("is_super_admin")
    .eq("id", user.id)
    .single();
  if (!callerProfile?.is_super_admin) {
    return NextResponse.json({ error: "Super admins only" }, { status: 403 });
  }

  const { id, name } = await request.json();
  if (!id?.trim() || !name?.trim()) {
    return NextResponse.json({ error: "Missing id or name" }, { status: 400 });
  }
  const newName = name.trim();

  const admin = createAdminClient();
  const { data: before, error: beforeError } = await admin
    .from("profiles")
    .select("name")
    .eq("id", id)
    .single();
  if (beforeError || !before) {
    return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
  }
  const oldName = before.name;
  if (oldName === newName) {
    return NextResponse.json({ ok: true, rotaRowsRenamed: 0 });
  }

  const { error: profileError } = await admin.from("profiles").update({ name: newName }).eq("id", id);
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  // The rota (and the roster it feeds into guest-survey shout-out
  // matching) joins on staff_name text, not staff_id, because it's
  // populated from a Google Sheet sync that predates accounts existing —
  // see 0002_rota_staff_name.sql. Renaming the profile without renaming
  // these would silently orphan the person's shift history under their
  // old name.
  const { data: renamedShifts } = await admin
    .from("rota_shifts")
    .update({ staff_name: newName })
    .eq("staff_name", oldName)
    .select("id");
  await admin.from("rota_staff_order").update({ staff_name: newName }).eq("staff_name", oldName);

  return NextResponse.json({ ok: true, rotaRowsRenamed: renamedShifts?.length ?? 0 });
}
