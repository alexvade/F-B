"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Paperclip, FileText, Trash2, X, ChartColumn, Plus, Pin, PinOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
import { uploadAttachment, getAttachmentUrl, deleteAttachment } from "@/lib/storage";
import { relativeTime, timestamp } from "@/lib/relative-time";
import { initials } from "@/lib/shift-status";
import { Section } from "@/components/section";
import { EmojiText } from "@/components/emoji-text";
import { bg, border, fill, ink, inkSoft, navy, navyText, orange, orangeSoft } from "@/lib/design-tokens";

// A grab-bag of composer placeholders — picked once per page load so it
// doesn't say the exact same thing every time (see Dashboard's GREETINGS).
const COMPOSER_PLACEHOLDERS = [
  "Share an update with the team…",
  "What's on your mind?",
  "Got something to share?",
  "Anything the team should know?",
  "What's happening today?",
  "Drop a note for the team…",
  "Any news, gossip, or reminders?",
  "Tell the team what's up…",
  "What's new?",
  "Shout something into the void…",
];

type Comment = {
  id: number;
  authorName: string;
  text: string | null;
  photo_url: string | null;
  file_url: string | null;
  file_name: string | null;
  photoDisplayUrl: string | null;
  fileDisplayUrl: string | null;
};
type PollVote = { optionIndex: number; voterId: string };
type Post = {
  id: number;
  authorId: string | null;
  authorName: string;
  text: string | null;
  photo_url: string | null;
  file_url: string | null;
  file_name: string | null;
  photoDisplayUrl: string | null;
  fileDisplayUrl: string | null;
  created_at: string;
  comments: Comment[];
  pollOptions: string[] | null;
  pollVotes: PollVote[];
  pinned: boolean;
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

  // Picked client-side only (not in the initializer) so the server-rendered
  // HTML and the first client render agree — Math.random() at render time
  // would otherwise mismatch and force React to redo the initial hydration.
  const [placeholder, setPlaceholder] = useState(COMPOSER_PLACEHOLDERS[0]);
  useEffect(() => {
    setPlaceholder(COMPOSER_PLACEHOLDERS[Math.floor(Math.random() * COMPOSER_PLACEHOLDERS.length)]);
  }, []);
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState("");
  const [newPhoto, setNewPhoto] = useState<File | null>(null);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [showPoll, setShowPoll] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
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
    const { data: voteRows } = await supabase.from("poll_votes").select("*");

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

    const storedPaths = Array.from(
      new Set([
        ...(postRows ?? []).flatMap((p) => [p.photo_url, p.file_url].filter(Boolean)),
        ...(commentRows ?? []).flatMap((c) => [c.photo_url, c.file_url].filter(Boolean)),
      ])
    ) as string[];
    const signedByPath = new Map(
      await Promise.all(storedPaths.map(async (p) => [p, await getAttachmentUrl(p)] as const))
    );

    setPosts(
      (postRows ?? []).map((p) => ({
        id: p.id,
        authorId: p.author_id,
        authorName: nameById.get(p.author_id ?? "") ?? "Someone",
        text: p.text,
        photo_url: p.photo_url,
        file_url: p.file_url,
        file_name: p.file_name,
        photoDisplayUrl: p.photo_url ? signedByPath.get(p.photo_url) ?? null : null,
        fileDisplayUrl: p.file_url ? signedByPath.get(p.file_url) ?? null : null,
        created_at: p.created_at,
        pinned: p.pinned,
        pollOptions: p.poll_options,
        pollVotes: (voteRows ?? [])
          .filter((v) => v.post_id === p.id)
          .map((v) => ({ optionIndex: v.option_index, voterId: v.voter_id })),
        comments: (commentRows ?? [])
          .filter((c) => c.post_id === p.id)
          .map((c) => ({
            id: c.id,
            authorName: nameById.get(c.author_id ?? "") ?? "Someone",
            text: c.text,
            photo_url: c.photo_url,
            file_url: c.file_url,
            file_name: c.file_name,
            photoDisplayUrl: c.photo_url ? signedByPath.get(c.photo_url) ?? null : null,
            fileDisplayUrl: c.file_url ? signedByPath.get(c.file_url) ?? null : null,
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
      .on("postgres_changes", { event: "*", schema: "public", table: "poll_votes" }, loadPosts)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadPosts, supabase]);

  const addPost = async () => {
    const validOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (showPoll && validOptions.length < 2) {
      setPostError("Add at least two poll options.");
      return;
    }
    const hasPoll = showPoll && validOptions.length >= 2;
    if (!newPost.trim() && !newPhoto && !newFile && !hasPoll) return;
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
        poll_options: hasPoll ? validOptions : null,
      });
      if (error) throw error;
      setNewPost("");
      setNewPhoto(null);
      setNewFile(null);
      setShowPoll(false);
      setPollOptions(["", ""]);
      if (photoInputRef.current) photoInputRef.current.value = "";
      if (fileInputRef.current) fileInputRef.current.value = "";
      loadPosts();
    } catch (err) {
      setPostError((err as Error).message || "Couldn't post — try again.");
    } finally {
      setPosting(false);
    }
  };

  const updatePollOption = (index: number, value: string) => {
    setPollOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  };
  const addPollOption = () => setPollOptions((prev) => (prev.length < 6 ? [...prev, ""] : prev));
  const removePollOption = (index: number) =>
    setPollOptions((prev) => (prev.length > 2 ? prev.filter((_, i) => i !== index) : prev));

  const castVote = async (postId: number, optionIndex: number) => {
    await supabase
      .from("poll_votes")
      .upsert({ post_id: postId, voter_id: profile.id, option_index: optionIndex }, { onConflict: "post_id,voter_id" });
    loadPosts();
  };

  const togglePin = async (post: Post) => {
    await supabase.from("posts").update({ pinned: !post.pinned }).eq("id", post.id);
    loadPosts();
  };

  const deletePost = async (post: Post) => {
    if (!confirm("Delete this post?")) return;
    await supabase.from("posts").delete().eq("id", post.id);
    await Promise.all([
      deleteAttachment(post.photo_url),
      deleteAttachment(post.file_url),
      ...post.comments.flatMap((c) => [deleteAttachment(c.photo_url), deleteAttachment(c.file_url)]),
    ]);
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
    <Section title="Noticeboard" subtitle="Shared announcements and shift notes">
      <div className="p-3 rounded-2xl mb-6" style={{ background: bg, border: `1px solid ${border}` }}>
        <textarea
          value={newPost}
          onChange={(e) => setNewPost(e.target.value)}
          placeholder={placeholder}
          className="w-full text-sm resize-none outline-none px-4 py-3 rounded-full text-left"
          rows={1}
          style={{ color: ink, background: fill, border: `1px solid ${border}` }}
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
        {showPoll && (
          <div className="flex flex-col gap-2 mt-2">
            {pollOptions.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={opt}
                  onChange={(e) => updatePollOption(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                  className="flex-1 text-sm px-4 py-2 rounded-full outline-none"
                  style={{ color: ink, background: fill, border: `1px solid ${border}` }}
                />
                {pollOptions.length > 2 && (
                  <button onClick={() => removePollOption(i)} aria-label="Remove option" style={{ color: navyText }}>
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
            {pollOptions.length < 6 && (
              <button
                onClick={addPollOption}
                className="flex items-center gap-1 text-xs w-fit"
                style={{ color: navyText }}
              >
                <Plus size={13} /> Add option
              </button>
            )}
          </div>
        )}
        {postError && (
          <p className="text-xs mt-2" style={{ color: ink }}>
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
            <button
              onClick={() => setShowPoll((prev) => !prev)}
              className="flex items-center gap-1.5 text-xs"
              style={{ color: showPoll ? navy : navyText, fontWeight: showPoll ? 700 : 400 }}
            >
              <ChartColumn size={15} />
              Add poll
            </button>
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
        {[...posts].sort((a, b) => Number(b.pinned) - Number(a.pinned)).map((p) => (
          <div key={p.id} className="pb-4" style={{ borderBottom: `1px solid ${border}` }}>
            {p.pinned && (
              <span className="flex items-center gap-1 text-xs font-medium mb-1.5" style={{ color: orange }}>
                <Pin size={12} fill={orange} /> Pinned
              </span>
            )}
            <div className="flex items-baseline justify-between">
              <span className="flex items-center gap-2">
                <span
                  className="flex items-center justify-center rounded-full text-xs font-medium shrink-0"
                  style={{ width: 24, height: 24, background: navyText, color: orangeSoft }}
                >
                  {initials(p.authorName)}
                </span>
                <span className="text-sm font-medium">{p.authorName}</span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-xs whitespace-nowrap" style={{ color: inkSoft }}>
                  {relativeTime(p.created_at)} · {timestamp(p.created_at)}
                </span>
                {profile.role === "admin" && (
                  <button
                    onClick={() => togglePin(p)}
                    style={{ color: p.pinned ? orange : inkSoft }}
                    title={p.pinned ? "Unpin post" : "Pin post to top"}
                  >
                    {p.pinned ? <PinOff size={13} /> : <Pin size={13} />}
                  </button>
                )}
                {(p.authorId === profile.id || profile.role === "admin") && (
                  <button onClick={() => deletePost(p)} style={{ color: inkSoft }} title="Delete post">
                    <Trash2 size={13} />
                  </button>
                )}
              </span>
            </div>
            {p.text && (
              <p className="text-sm mt-1" style={{ color: ink }}>
                <EmojiText text={p.text} />
              </p>
            )}
            {p.photoDisplayUrl && (
              <img src={p.photoDisplayUrl} alt="Attached" className="rounded-2xl mt-2" style={{ maxHeight: 220, maxWidth: "100%" }} />
            )}
            {p.fileDisplayUrl &&
              (p.file_name?.match(/\.(png|jpe?g|gif|webp)$/i) ? (
                <img src={p.fileDisplayUrl} alt="Attached" className="rounded-2xl mt-2" style={{ maxHeight: 220, maxWidth: "100%" }} />
              ) : (
                <a
                  href={p.fileDisplayUrl}
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

            {p.pollOptions && p.pollOptions.length > 0 && (
              <div className="flex flex-col gap-1.5 mt-3">
                {p.pollOptions.map((opt, i) => {
                  const count = p.pollVotes.filter((v) => v.optionIndex === i).length;
                  const total = p.pollVotes.length;
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  const mine = p.pollVotes.some((v) => v.voterId === profile.id && v.optionIndex === i);
                  return (
                    <button
                      key={i}
                      onClick={() => castVote(p.id, i)}
                      className="flex items-center justify-between w-full px-3.5 py-2 rounded-full text-left text-xs"
                      style={{
                        border: `1px solid ${border}`,
                        background: mine ? navy : fill,
                        color: mine ? "#FFFFFF" : ink,
                      }}
                    >
                      <span className="flex items-center gap-1.5">
                        <EmojiText text={opt} />
                      </span>
                      <span className="shrink-0 ml-3">
                        {count} · {pct}%
                      </span>
                    </button>
                  );
                })}
                <span className="text-xs" style={{ color: inkSoft }}>
                  {p.pollVotes.length} vote{p.pollVotes.length === 1 ? "" : "s"}
                </span>
              </div>
            )}

            {p.comments.length > 0 && (
              <div className="flex flex-col gap-2 mt-3 pl-3" style={{ borderLeft: `2px solid ${border}` }}>
                {p.comments.map((c) => (
                  <div key={c.id}>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="flex items-center justify-center rounded-full text-xs font-medium shrink-0"
                        style={{ width: 18, height: 18, background: navyText, color: orangeSoft, fontSize: 9 }}
                      >
                        {initials(c.authorName)}
                      </span>
                      <span className="text-xs font-medium">{c.authorName}</span>
                    </div>
                    {c.text && (
                      <p className="text-xs mt-0.5" style={{ color: inkSoft }}>
                        <EmojiText text={c.text} />
                      </p>
                    )}
                    {c.photoDisplayUrl && (
                      <img src={c.photoDisplayUrl} alt="Attached" className="rounded-2xl mt-1" style={{ maxHeight: 140, maxWidth: "100%" }} />
                    )}
                    {c.fileDisplayUrl &&
                      (c.file_name?.match(/\.(png|jpe?g|gif|webp)$/i) ? (
                        <img src={c.fileDisplayUrl} alt="Attached" className="rounded-2xl mt-1" style={{ maxHeight: 140, maxWidth: "100%" }} />
                      ) : (
                        <a
                          href={c.fileDisplayUrl}
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
                  style={{ border: `1px solid ${border}`, color: ink, background: fill }}
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
