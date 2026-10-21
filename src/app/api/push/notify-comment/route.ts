import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToStaff } from "@/lib/push";
import { extractMentionedIds } from "@/lib/mentions";

// Called right after a successful Noticeboard comment insert (see
// addComment in src/app/(app)/updates/page.tsx). Unlike a new post, a
// comment is never broadcast to everyone — this only ever sends anything
// if the reply @mentions someone, same re-read-server-side reasoning as
// notify-post.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const commentId = body?.commentId;
  if (!commentId) {
    return NextResponse.json({ error: "Missing commentId" }, { status: 400 });
  }

  const admin = createAdminClient();
  const [{ data: comment }, { data: author }, { data: allProfiles }] = await Promise.all([
    admin.from("comments").select("text").eq("id", commentId).single(),
    admin.from("profiles").select("name").eq("id", user.id).single(),
    admin.from("profiles").select("id, name"),
  ]);
  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  const mentionedIds = extractMentionedIds(comment.text, allProfiles ?? []).filter((id) => id !== user.id);
  if (mentionedIds.length) {
    const authorName = author?.name ?? "Someone";
    const snippet = (comment.text ?? "").trim();
    const message = snippet ? (snippet.length > 100 ? `${snippet.slice(0, 97)}…` : snippet) : "Tagged you in a reply";
    await sendPushToStaff(mentionedIds, { title: `${authorName} mentioned you on the Noticeboard`, body: message, url: "/updates" });
  }

  return NextResponse.json({ ok: true });
}
