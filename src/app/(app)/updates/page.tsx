"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Paperclip, FileText, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
import { uploadAttachment } from "@/lib/storage";
import { relativeTime, timestamp } from "@/lib/relative-time";
import { initials } from "@/lib/shift-status";
import { Section } from "@/components/section";
import { bg, border, ink, inkSoft, navy, navyText, orange, orangeSoft, surface } from "@/lib/design-tokens";

type Comment = {
  id: number;
  authorName: string;
  text: string | null;
  photo_url: string | null;
  file_url: string | null;
  file_name: string | null;
};
type Post = {
  id: number;
  authorId: string | null;
  authorName: string;
  text: string | null;
  photo_url: string | null;
  file_url: string | null;
  file_name: string | null;
  created_at: string;
  comments: Comment[];
};

function AttachmentPreview({
  url,
  name,
  isImage,
  onRemove,
}: {
  url: string;
  name?: string;
  isImage: boolean;
  onRemove: () => void;
}) {
  return isImage ? (
    <div className="relative inline-block mt-2">
      <img src={url} alt="Attached" className="rounded-2xl" style={{ maxHeight: 140, display: "block" }} />
      <button
        onClick={onRemove}
        className="absolute flex items-center justify-center rounded-full"
        style={{ top: 4, right: 4, width: 20, height: 20, background: "rgba(0,0,0,0.55)", color: "#FFFFFF" }}
      >
        <X size={12} />
      </button>
    </div>
  ) : (
    <div
      className="flex items-center gap-2 mt-2 px-2.5 py-1.5 rounded-2xl"
      style={{ background: orangeSoft, width: "fit-content" }}
    >
      <FileText size={14} style={{ color: navyText }} />
      <span className="text-xs" style={{ color: navyText }}>
        {name}
      </span>
      <button onClick={onRemove}>
        <X size={12} style={{ color: navyText }} />
      </button>
    </div>
  );
}

export default function UpdatesPage() {
  const profile = useProfile();
  const supabase = createClient();

  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState("");
  const [newPhoto, setNewPhoto] = useState<File | null>(null);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});
  const [commentPhoto, setCommentPhoto] = useState<Record<number, File | null>>({});
  const [commentFile, setCommentFile] = useState<Record<number, File | null>>({});
  const photoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadPosts = useCallback(async () => {
    const { data: postRows } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });
    const { data: commentRows } = await supabase
      .from("comments")
      .select("*")
      .order("created_at");

    const ids = Array.from(
      new Set([
        ...(postRows ?? []).map((p) => p.author_id).filter(Boolean),
        ...(commentRows ?? []).map((c) => c.author_id).filter(Boolean),
      ])
    ) as string[];
    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("id, name").in("id", ids)
      : { data: [] };
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]));

    setPosts(
      (postRows ?? []).map((p) => ({
        id: p.id,
        authorId: p.author_id,
        authorName: nameById.get(p.author_id ?? "") ?? "Someone",
        text: p.text,
        photo_url: p.photo_url,
        file_url: p.file_url,
        file_name: p.file_name,
        created_at: p.created_at,
        comments: (commentRows ?? [])
          .filter((c) => c.post_id === p.id)
          .map((c) => ({
            id: c.id,
            authorName: nameById.get(c.author_id ?? "") ?? "Someone",
            text: c.text,
            photo_url: c.photo_url,
            file_url: c.file_url,
            file_name: c.file_name,
          })),
      }))
    );
  }, [supabase]);

  useEffect(() => {
    loadPosts();
    const channel = supabase
      .channel("updates-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, loadPosts)
      .on("postgres_changes", { event: "*", schema: "public", table: "comments" }, loadPosts)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadPosts, supabase]);

  const addPost = async () => {
    if (!newPost.trim() && !newPhoto && !newFile) return;
    setPosting(true);
    setPostError(null);
    try {
      const photoUrl = newPhoto ? await uploadAttachment(newPhoto, "posts") : null;
      const fileUrl = newFile ? await uploadAttachment(newFile, "posts") : null;
      const { error } = await supabase.from("posts").insert({
        author_id: profile.id,
        text: newPost.trim() || null,
        photo_url: photoUrl,
        file_url: fileUrl,
        file_name: newFile?.name ?? null,
      });
      if (error) throw error;
      setNewPost("");
      setNewPhoto(null);
      setNewFile(null);
      if (photoInputRef.current) photoInputRef.current.value = "";
      if (fileInputRef.current) fileInputRef.current.value = "";
      loadPosts();
    } catch (err) {
      setPostError((err as Error).message || "Couldn't post — try again.");
    } finally {
      setPosting(false);
    }
  };

  const deletePost = async (post: Post) => {
    if (!confirm("Delete this post?")) return;
    await supabase.from("posts").delete().eq("id", post.id);
    loadPosts();
  };

  const addComment = async (postId: number) => {
    const text = (commentDrafts[postId] || "").trim();
    const photo = commentPhoto[postId];
    const file = commentFile[postId];
    if (!text && !photo && !file) return;
    try {
      const photoUrl = photo ? await uploadAttachment(photo, "comments") : null;
      const fileUrl = file ? await uploadAttachment(file, "comments") : null;
      const { error } = await supabase.from("comments").insert({
        post_id: postId,
        author_id: profile.id,
        text: text || null,
        photo_url: photoUrl,
        file_url: fileUrl,
        file_name: file?.name ?? null,
      });
      if (error) throw error;
      setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
      setCommentPhoto((prev) => ({ ...prev, [postId]: null }));
      setCommentFile((prev) => ({ ...prev, [postId]: null }));
      loadPosts();
    } catch (err) {
      setPostError((err as Error).message || "Couldn't post that reply — try again.");
    }
  };

  return (
    <Section title="Updates" subtitle="Shared announcements and shift notes">
      <div className="p-3 rounded-2xl mb-6" style={{ background: surface, border: `1px solid ${border}` }}>
        <textarea
          value={newPost}
          onChange={(e) => setNewPost(e.target.value)}
          placeholder="Share an update with the team…"
          className="w-full text-sm resize-none outline-none px-4 py-3 rounded-full text-center"
          rows={1}
          style={{ color: ink, background: bg, border: `1px solid ${border}` }}
        />
        {newPhoto && (
          <AttachmentPreview
            url={URL.createObjectURL(newPhoto)}
            isImage
            onRemove={() => setNewPhoto(null)}
          />
        )}
        {newFile && (
          <AttachmentPreview
            url={URL.createObjectURL(newFile)}
            name={newFile.name}
            isImage={newFile.type.startsWith("image/")}
            onRemove={() => setNewFile(null)}
          />
        )}
        {postError && (
          <p className="text-xs mt-2" style={{ color: "#C24A3B" }}>
            {postError}
          </p>
        )}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: navyText }}>
              <Camera size={15} />
              Add photo
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setNewPhoto(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: navyText }}>
              <Paperclip size={15} />
              Add file
              <input
                ref={fileInputRef}
                type="file"
                onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </label>
          </div>
          <button
            onClick={addPost}
            disabled={posting}
            className="text-xs font-medium px-4 py-2 rounded-full disabled:opacity-60"
            style={{ background: navy, color: "#FFFFFF" }}
          >
            {posting ? "Posting…" : "Post"}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {posts.map((p) => (
          <div key={p.id} className="pb-4" style={{ borderBottom: `1px solid ${border}` }}>
            <div className="flex items-baseline justify-between">
              <span className="flex items-center gap-2">
                <span
                  className="flex items-center justify-center rounded-full text-xs font-medium shrink-0"
                  style={{ width: 24, height: 24, background: orangeSoft, color: navyText }}
                >
                  {initials(p.authorName)}
                </span>
                <span className="text-sm font-medium">{p.authorName}</span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-xs whitespace-nowrap" style={{ color: inkSoft }}>
                  {relativeTime(p.created_at)} · {timestamp(p.created_at)}
                </span>
                {(p.authorId === profile.id || profile.role === "admin") && (
                  <button onClick={() => deletePost(p)} style={{ color: inkSoft }} title="Delete post">
                    <Trash2 size={13} />
                  </button>
                )}
              </span>
            </div>
            {p.text && (
              <p className="text-sm mt-1" style={{ color: ink }}>
                {p.text}
              </p>
            )}
            {p.photo_url && (
              <img src={p.photo_url} alt="Attached" className="rounded-2xl mt-2" style={{ maxHeight: 220, maxWidth: "100%" }} />
            )}
            {p.file_url &&
              (p.file_name?.match(/\.(png|jpe?g|gif|webp)$/i) ? (
                <img src={p.file_url} alt="Attached" className="rounded-2xl mt-2" style={{ maxHeight: 220, maxWidth: "100%" }} />
              ) : (
                <a
                  href={p.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 mt-2 px-2.5 py-1.5 rounded-2xl"
                  style={{ background: orangeSoft, width: "fit-content" }}
                >
                  <FileText size={14} style={{ color: navyText }} />
                  <span className="text-xs" style={{ color: navyText }}>
                    {p.file_name}
                  </span>
                </a>
              ))}

            {p.comments.length > 0 && (
              <div className="flex flex-col gap-2 mt-3 pl-3" style={{ borderLeft: `2px solid ${border}` }}>
                {p.comments.map((c) => (
                  <div key={c.id}>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="flex items-center justify-center rounded-full text-xs font-medium shrink-0"
                        style={{ width: 18, height: 18, background: orangeSoft, color: navyText, fontSize: 9 }}
                      >
                        {initials(c.authorName)}
                      </span>
                      <span className="text-xs font-medium">{c.authorName}</span>
                    </div>
                    {c.text && (
                      <p className="text-xs mt-0.5" style={{ color: inkSoft }}>
                        {c.text}
                      </p>
                    )}
                    {c.photo_url && (
                      <img src={c.photo_url} alt="Attached" className="rounded-2xl mt-1" style={{ maxHeight: 140, maxWidth: "100%" }} />
                    )}
                    {c.file_url &&
                      (c.file_name?.match(/\.(png|jpe?g|gif|webp)$/i) ? (
                        <img src={c.file_url} alt="Attached" className="rounded-2xl mt-1" style={{ maxHeight: 140, maxWidth: "100%" }} />
                      ) : (
                        <a
                          href={c.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 mt-1 px-2 py-1 rounded-2xl"
                          style={{ background: orangeSoft, width: "fit-content" }}
                        >
                          <FileText size={12} style={{ color: navyText }} />
                          <span className="text-xs" style={{ color: navyText }}>
                            {c.file_name}
                          </span>
                        </a>
                      ))}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3">
              {commentPhoto[p.id] && (
                <AttachmentPreview
                  url={URL.createObjectURL(commentPhoto[p.id]!)}
                  isImage
                  onRemove={() => setCommentPhoto((prev) => ({ ...prev, [p.id]: null }))}
                />
              )}
              {commentFile[p.id] && (
                <AttachmentPreview
                  url={URL.createObjectURL(commentFile[p.id]!)}
                  name={commentFile[p.id]!.name}
                  isImage={commentFile[p.id]!.type.startsWith("image/")}
                  onRemove={() => setCommentFile((prev) => ({ ...prev, [p.id]: null }))}
                />
              )}
              <div className="flex items-center gap-2">
                <input
                  value={commentDrafts[p.id] || ""}
                  onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && addComment(p.id)}
                  placeholder="Reply with more info…"
                  className="flex-1 text-xs px-3.5 py-2 rounded-full outline-none"
                  style={{ border: `1px solid ${border}`, color: ink, background: bg }}
                />
                <label
                  className="flex items-center justify-center shrink-0 cursor-pointer"
                  style={{ color: navyText, width: 26, height: 26 }}
                  title="Add photo"
                >
                  <Camera size={16} />
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => setCommentPhoto((prev) => ({ ...prev, [p.id]: e.target.files?.[0] ?? null }))}
                    className="hidden"
                  />
                </label>
                <label
                  className="flex items-center justify-center shrink-0 cursor-pointer"
                  style={{ color: navyText, width: 26, height: 26 }}
                  title="Add file"
                >
                  <Paperclip size={16} />
                  <input
                    type="file"
                    onChange={(e) => setCommentFile((prev) => ({ ...prev, [p.id]: e.target.files?.[0] ?? null }))}
                    className="hidden"
                  />
                </label>
                <button
                  onClick={() => addComment(p.id)}
                  className="text-xs font-medium px-4 py-2 rounded-full shrink-0"
                  style={{ background: orangeSoft, color: orange }}
                >
                  Reply
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
