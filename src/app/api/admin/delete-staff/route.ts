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

  const { id } = await request.json();
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing user id" }, { status: 400 });
  }
  if (id === user.id) {
    return NextResponse.json({ error: "You can't delete your own account" }, { status: 400 });
  }

  const admin = createAdminClient();
  // Deletes the auth.users row; profiles.id cascades from it, so the
  // profile row goes with it automatically.
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
