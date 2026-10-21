import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToStaff } from "@/lib/push";
import { extractMentionedIds } from "@/lib/mentions";

// Called right after a successful Noticeboard post insert (see
// src/app/(app)/updates/page.tsx) — re-reads the post server-side rather
// than trusting whatever text the client sends, since the push payload
// needs the VAPID private key anyway, which only ever lives server-side.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const postId = body?.postId;
  if (!postId) {
    return NextResponse.json({ error: "Missing postId" }, { status: 400 });
  }

  const admin = createAdminClient();
  const [{ data: post }, { data: author }, { data: allProfiles }] = await Promise.all([
    admin.from("posts").select("text").eq("id", postId).single(),
    admin.from("profiles").select("name").eq("id", user.id).single(),
    admin.from("profiles").select("id, name"),
  ]);
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const authorName = author?.name ?? "Someone";
  const snippet = (post.text ?? "").trim();
  const message = snippet
    ? snippet.length > 100
      ? `${snippet.slice(0, 97)}…`
      : snippet
    : "New post on the Noticeboard";

  // Anyone @mentioned gets a more specific push instead of the generic
  // broadcast, so they're not pinged twice for the same post.
  const people = allProfiles ?? [];
  const mentionedIds = new Set(extractMentionedIds(post.text, people).filter((id) => id !== user.id));
  const everyoneElseIds = people.map((p) => p.id).filter((id) => !mentionedIds.has(id));

  await Promise.all([
    sendPushToStaff(everyoneElseIds, { title: `${authorName} posted on the Noticeboard`, body: message, url: "/updates" }),
    mentionedIds.size
      ? sendPushToStaff(Array.from(mentionedIds), { title: `${authorName} mentioned you on the Noticeboard`, body: message, url: "/updates" })
      : Promise.resolve(),
  ]);

  return NextResponse.json({ ok: true });
}
