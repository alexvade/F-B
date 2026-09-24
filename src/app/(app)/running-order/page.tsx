"use client";

import { useCallback, useEffect, useState } from "react";
import { Camera, Download, Pencil, Plus, Send as SendIcon, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
import { useFeatureFlag } from "@/lib/feature-flags-context";
import { uploadAttachment, getAttachmentUrl, deleteAttachment } from "@/lib/storage";
import { initials } from "@/lib/shift-status";
import { Section } from "@/components/section";
import { bg, border, fill, ink, inkSoft, navy, navyText, orange, orangeSoft } from "@/lib/design-tokens";

type Comment = {
  id: number;
  authorId: string | null;
  authorName: string;
  text: string | null;
  photoUrl: string | null;
  photoDisplayUrl: string | null;
  createdAt: string;
};

type Item = {
  id: number;
  text: string;
  sort_order: number;
  done: boolean;
  completedByName: string | null;
  completedAt: string | null;
  comments: Comment[];
};

type RunningOrder = { id: number; title: string; event_date: string | null; sort_order: number };

export default function RunningOrderPage() {
  const profile = useProfile();
  const isAdmin = profile.role === "admin";
  const editEnabled = useFeatureFlag("running_order_edit");
  const supabase = createClient();

  const [runningOrders, setRunningOrders] = useState<RunningOrder[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
  const [savingNew, setSavingNew] = useState(false);

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [photoDraft, setPhotoDraft] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);
  const [editingList, setEditingList] = useState(false);
  const [listDraft, setListDraft] = useState("");
  const [savingList, setSavingList] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  const [showReport, setShowReport] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailFormat, setEmailFormat] = useState<"xlsx" | "pdf">("pdf");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ ok: boolean; message: string } | null>(null);

  const loadRunningOrders = useCallback(async () => {
    const { data } = await supabase.from("running_orders").select("id, title, event_date, sort_order").order("id");
    const list = data ?? [];
    setRunningOrders(list);
    setActiveId((cur) => (cur && list.some((r) => r.id === cur) ? cur : list.length ? list[list.length - 1].id : null));
  }, [supabase]);

  useEffect(() => {
    loadRunningOrders();
    const channel = supabase
      .channel("running-orders-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "running_orders" }, loadRunningOrders)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadRunningOrders, supabase]);

  const loadItems = useCallback(async () => {
    if (activeId == null) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: itemRows } = await supabase
      .from("running_order_items")
      .select("id, text, sort_order")
      .eq("running_order_id", activeId)
      .order("sort_order");
    const itemIds = (itemRows ?? []).map((i) => i.id);

    const [completionsRes, commentsRes] = await Promise.all([
      itemIds.length
        ? supabase.from("running_order_completions").select("item_id, completed_by, completed_at").in("item_id", itemIds)
        : Promise.resolve({ data: [] }),
      itemIds.length
        ? supabase
            .from("running_order_comments")
            .select("id, item_id, author_id, text, photo_url, created_at")
            .in("item_id", itemIds)
            .order("created_at")
        : Promise.resolve({ data: [] }),
    ]);
    const completionByItem = new Map((completionsRes.data ?? []).map((c) => [c.item_id, c]));
    const commentsByItem = new Map<number, typeof commentsRes.data>();
    for (const c of commentsRes.data ?? []) {
      const list = commentsByItem.get(c.item_id) ?? [];
      list.push(c);
      commentsByItem.set(c.item_id, list);
    }

    const peopleIds = Array.from(
      new Set(
        [
          ...(completionsRes.data ?? []).map((c) => c.completed_by),
          ...(commentsRes.data ?? []).map((c) => c.author_id),
        ].filter(Boolean)
      )
    ) as string[];
    const { data: profiles } = peopleIds.length
      ? await supabase.from("profiles").select("id, name").in("id", peopleIds)
      : { data: [] };
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]));

    const withComments = await Promise.all(
      (itemRows ?? []).map(async (i) => {
        const c = completionByItem.get(i.id);
        const rawComments = commentsByItem.get(i.id) ?? [];
        const comments = await Promise.all(
          rawComments.map(async (rc) => ({
            id: rc.id,
            authorId: rc.author_id,
            authorName: rc.author_id ? nameById.get(rc.author_id) ?? "Someone" : "Someone",
            text: rc.text,
            photoUrl: rc.photo_url,
            photoDisplayUrl: rc.photo_url ? await getAttachmentUrl(rc.photo_url) : null,
            createdAt: rc.created_at,
          }))
        );
        return {
          id: i.id,
          text: i.text,
          sort_order: i.sort_order,
          done: !!c,
          completedByName: c?.completed_by ? nameById.get(c.completed_by) ?? "Someone" : null,
          completedAt: c?.completed_at ?? null,
          comments,
        };
      })
    );
    setItems(withComments);
    setLoading(false);
  }, [supabase, activeId]);

  useEffect(() => {
    loadItems();
    const channel = supabase
      .channel(`running-order-${activeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "running_order_completions" }, loadItems)
      .on("postgres_changes", { event: "*", schema: "public", table: "running_order_items" }, loadItems)
      .on("postgres_changes", { event: "*", schema: "public", table: "running_order_comments" }, loadItems)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadItems, supabase, activeId]);

  const startCreate = () => {
    setNewTitle("");
    setNewDate("");
    setCreating(true);
  };

  // Seeds the new event with a copy of whichever list is currently open, so
  // "Bride"/"Groom" placeholders (or last time's running order) can just be
  // renamed for the day rather than retyped from scratch.
  const createRunningOrder = async () => {
    if (!newTitle.trim()) return;
    setSavingNew(true);
    try {
      const { data: created, error } = await supabase
        .from("running_orders")
        .insert({ title: newTitle.trim(), event_date: newDate || null, sort_order: runningOrders.length })
        .select()
        .single();
      if (error || !created) throw error;
      if (items.length) {
        await supabase.from("running_order_items").insert(
          items.map((i) => ({ running_order_id: created.id, text: i.text, sort_order: i.sort_order }))
        );
      }
      setCreating(false);
      setActiveId(created.id);
      loadRunningOrders();
    } finally {
      setSavingNew(false);
    }
  };

  const deleteRunningOrder = async (ro: RunningOrder) => {
    if (!confirm(`Delete "${ro.title}" and its whole timeline? This can't be undone.`)) return;
    await supabase.from("running_orders").delete().eq("id", ro.id);
    setActiveId(null);
    loadRunningOrders();
  };

  const startEditTitle = (ro: RunningOrder) => {
    setTitleDraft(ro.title);
    setEditingTitle(true);
  };

  const saveTitle = async () => {
    if (!activeId || !titleDraft.trim()) return;
    await supabase.from("running_orders").update({ title: titleDraft.trim() }).eq("id", activeId);
    setEditingTitle(false);
    loadRunningOrders();
  };

  const toggleDone = async (item: Item) => {
    if (item.done) {
      await supabase.from("running_order_completions").delete().eq("item_id", item.id);
    } else {
      await supabase.from("running_order_completions").insert({ item_id: item.id, completed_by: profile.id });
    }
    loadItems();
  };

  const openThread = (item: Item) => {
    setExpandedId((cur) => (cur === item.id ? null : item.id));
    setCommentDraft("");
    setPhotoDraft(null);
  };

  const postComment = async (item: Item) => {
    if (!commentDraft.trim() && !photoDraft) return;
    setPosting(true);
    try {
      const photoUrl = photoDraft ? await uploadAttachment(photoDraft, "running-order") : null;
      await supabase.from("running_order_comments").insert({
        item_id: item.id,
        author_id: profile.id,
        text: commentDraft.trim() || null,
        photo_url: photoUrl,
      });
      setCommentDraft("");
      setPhotoDraft(null);
      loadItems();
    } finally {
      setPosting(false);
    }
  };

  const deleteComment = async (comment: Comment) => {
    if (comment.photoUrl) await deleteAttachment(comment.photoUrl);
    await supabase.from("running_order_comments").delete().eq("id", comment.id);
    loadItems();
  };

  const openListEdit = () => {
    setListDraft(items.map((i) => i.text).join("\n"));
    setEditingList(true);
  };

  // Reconciles by item text rather than deleting and recreating every row,
  // so editing the list (adding/removing/renaming a moment) never wipes an
  // unrelated moment's completion or comments.
  const saveList = async () => {
    if (!activeId) return;
    const texts = listDraft.split("\n").map((s) => s.trim()).filter(Boolean);
    setSavingList(true);
    try {
      const existingByText = new Map(items.map((i) => [i.text, i]));
      const keepIds = new Set<number>();
      for (const [i, text] of texts.entries()) {
        const existing = existingByText.get(text);
        if (existing) {
          keepIds.add(existing.id);
          if (existing.sort_order !== i) {
            await supabase.from("running_order_items").update({ sort_order: i }).eq("id", existing.id);
          }
        } else {
          await supabase.from("running_order_items").insert({ running_order_id: activeId, text, sort_order: i });
        }
      }
      const removedIds = items.filter((i) => !keepIds.has(i.id)).map((i) => i.id);
      if (removedIds.length) {
        await supabase.from("running_order_items").delete().in("id", removedIds);
      }
      setEditingList(false);
      loadItems();
    } finally {
      setSavingList(false);
    }
  };

  const sendReportEmail = async () => {
    const to = emailTo.trim();
    if (!to || !activeId) return;
    setSendingEmail(true);
    setEmailStatus(null);
    try {
      const res = await fetch("/api/running-order/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: to, id: activeId, format: emailFormat }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEmailStatus({ ok: false, message: body.error || "Couldn't send that — try again." });
        return;
      }
      setEmailStatus({ ok: true, message: `Sent to ${to}.` });
      setEmailTo("");
    } finally {
      setSendingEmail(false);
    }
  };

  const formatTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : "";

  const doneCount = items.filter((i) => i.done).length;
  const active = runningOrders.find((r) => r.id === activeId) ?? null;

  if (editingList) {
    return (
      <div>
        <button onClick={() => setEditingList(false)} className="text-xs mb-4" style={{ color: navyText }}>
          ← Cancel
        </button>
        <h2 className="text-lg font-semibold mb-4" style={{ color: navyText }}>
          Edit running order
        </h2>
        <div className="flex flex-col gap-3 max-w-md">
          <textarea
            placeholder="Moments, one per line"
            value={listDraft}
            onChange={(e) => setListDraft(e.target.value)}
            rows={18}
            className="text-sm px-4 py-3 rounded-2xl outline-none"
            style={{ border: `1px solid ${border}`, background: fill, color: ink }}
          />
          <button
            onClick={saveList}
            disabled={savingList}
            className="text-sm font-medium py-2.5 rounded-full disabled:opacity-60"
            style={{ background: navy, color: "#FFFFFF" }}
          >
            {savingList ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <Section title="Running Order" subtitle="Each event's timeline — tap a moment to mark it done">
      <div className="flex gap-1.5 overflow-x-auto mb-4 pb-1" style={{ scrollbarWidth: "thin" }}>
        {runningOrders.map((ro) => {
          const isActive = ro.id === activeId;
          return (
            <button
              key={ro.id}
              onClick={() => setActiveId(ro.id)}
              className="text-xs px-3.5 py-1.5 rounded-2xl shrink-0 whitespace-nowrap"
              style={{
                background: isActive ? "#000000" : "#FFFFFF",
                color: isActive ? "#FFFFFF" : "#000000",
                border: "1px solid #000000",
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {ro.title}
            </button>
          );
        })}
        {(isAdmin || editEnabled) && (
          <button
            onClick={startCreate}
            aria-label="New running order"
            title="New running order"
            className="flex items-center justify-center shrink-0 rounded-2xl"
            style={{ width: 30, height: 30, border: "1px solid #000000" }}
          >
            <Plus size={15} />
          </button>
        )}
      </div>

      {creating && (
        <div className="flex flex-col gap-3 p-3 rounded-2xl mb-6 max-w-md" style={{ background: bg, border: `1px solid ${border}` }}>
          <div className="text-sm font-semibold" style={{ color: navyText }}>
            New running order
          </div>
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Event name (e.g. Smith & Jones Wedding)"
            className="text-sm px-4 py-2 rounded-full outline-none"
            style={{ border: `1px solid ${border}`, background: fill, color: ink }}
          />
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="text-sm px-4 py-2 rounded-full outline-none w-fit"
            style={{ border: `1px solid ${border}`, background: fill, color: ink }}
          />
          <p className="text-xs" style={{ color: inkSoft }}>
            Starts as a copy of {active ? `"${active.title}"` : "the current list"} — rename or add/remove
            moments after.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={createRunningOrder}
              disabled={savingNew || !newTitle.trim()}
              className="text-xs font-medium px-3 py-1.5 rounded-2xl disabled:opacity-60"
              style={{ background: navy, color: "#FFFFFF" }}
            >
              {savingNew ? "Creating…" : "Create"}
            </button>
            <button
              onClick={() => setCreating(false)}
              className="text-xs font-medium px-3 py-1.5 rounded-2xl"
              style={{ background: "#FFFFFF", color: navy, border: `1px solid ${border}` }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {active && (
        <div className="flex items-center gap-2 mb-1">
          {editingTitle ? (
            <>
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveTitle()}
                className="text-sm px-3 py-1 rounded-full outline-none"
                style={{ border: `1px solid ${border}`, background: fill, color: ink }}
              />
              <button onClick={saveTitle} className="text-xs font-medium" style={{ color: navy }}>
                Save
              </button>
              <button onClick={() => setEditingTitle(false)} className="text-xs" style={{ color: inkSoft }}>
                Cancel
              </button>
            </>
          ) : (
            (isAdmin || editEnabled) && (
              <>
                <button onClick={() => startEditTitle(active)} style={{ color: navyText }} aria-label="Rename">
                  <Pencil size={12} />
                </button>
                {isAdmin && (
                  <button onClick={() => deleteRunningOrder(active)} style={{ color: "#000000" }} aria-label="Delete this running order">
                    <Trash2 size={12} />
                  </button>
                )}
              </>
            )
          )}
        </div>
      )}

      {(isAdmin || editEnabled) && (
        <div className="flex items-center gap-2 mb-4 mt-2">
          <button
            onClick={openListEdit}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-2xl"
            style={{ background: orangeSoft, color: navy }}
          >
            <Pencil size={13} /> Edit moments
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowReport((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-2xl"
              style={{ background: "#FFFFFF", color: navy, border: `1px solid ${border}` }}
            >
              <Download size={13} /> Export report
            </button>
          )}
        </div>
      )}

      {isAdmin && showReport && activeId && (
        <div className="flex flex-col gap-3 p-3 rounded-2xl mb-6" style={{ background: bg, border: `1px solid ${border}` }}>
          <div className="text-sm font-semibold" style={{ color: navyText }}>
            Export this event&apos;s timeline
          </div>
          <p className="text-xs" style={{ color: inkSoft }}>
            Every moment, its completion time, who did it, and every comment and photo attached.
          </p>
          <div className="flex gap-2">
            <a
              href={`/api/running-order/report?id=${activeId}&format=xlsx`}
              className="flex-1 text-center text-sm font-medium py-2 rounded-full"
              style={{ background: navy, color: "#FFFFFF" }}
            >
              Download .xlsx
            </a>
            <a
              href={`/api/running-order/report?id=${activeId}&format=pdf`}
              className="flex-1 text-center text-sm font-medium py-2 rounded-full"
              style={{ background: "#FFFFFF", color: navy, border: `1px solid ${border}` }}
            >
              Download PDF
            </a>
            <button
              onClick={() => {
                setShowEmailForm((v) => !v);
                setEmailStatus(null);
              }}
              aria-label="Send by email"
              title="Send by email"
              className="flex items-center justify-center shrink-0 rounded-full"
              style={{
                width: 36,
                height: 36,
                border: `1px solid ${showEmailForm ? navy : border}`,
                background: showEmailForm ? navy : "transparent",
              }}
            >
              <SendIcon size={14} style={{ color: showEmailForm ? "#FFFFFF" : navy }} />
            </button>
          </div>

          {showEmailForm && (
            <div className="flex flex-col gap-2 pt-1">
              <input
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="Send to…"
                className="text-sm px-4 py-2 rounded-full outline-none"
                style={{ border: `1px solid ${border}`, color: ink, background: fill }}
              />
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-xs" style={{ color: ink }}>
                  <input type="radio" checked={emailFormat === "xlsx"} onChange={() => setEmailFormat("xlsx")} />
                  .xlsx
                </label>
                <label className="flex items-center gap-1.5 text-xs" style={{ color: ink }}>
                  <input type="radio" checked={emailFormat === "pdf"} onChange={() => setEmailFormat("pdf")} />
                  .pdf
                </label>
              </div>
              {emailStatus && (
                <p className="text-xs" style={{ color: emailStatus.ok ? inkSoft : "#E4002B" }}>
                  {emailStatus.message}
                </p>
              )}
              <button
                onClick={sendReportEmail}
                disabled={sendingEmail || !emailTo.trim()}
                className="text-xs font-medium px-3 py-1.5 rounded-2xl w-fit disabled:opacity-60"
                style={{ background: navy, color: "#FFFFFF" }}
              >
                {sendingEmail ? "Sending…" : "Send"}
              </button>
            </div>
          )}
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="text-xs mb-3" style={{ color: inkSoft }}>
          {doneCount}/{items.length} done
        </div>
      )}

      {loading ? (
        <p className="text-sm" style={{ color: inkSoft }}>
          Loading…
        </p>
      ) : !activeId ? (
        <p className="text-sm" style={{ color: inkSoft }}>
          No running orders yet — tap + above to start one.
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm" style={{ color: inkSoft }}>
          No moments added yet.
        </p>
      ) : (
        <div className="flex flex-col">
          {items.map((item, idx) => {
            const expanded = expandedId === item.id;
            const distinctCommenters = Array.from(
              new Map(item.comments.map((c) => [c.authorId ?? c.authorName, c.authorName])).entries()
            );
            return (
              <div key={item.id} className="flex gap-3">
                <div className="flex flex-col items-center shrink-0" style={{ width: 20 }}>
                  <button
                    onClick={() => toggleDone(item)}
                    aria-label={item.done ? "Mark not done" : "Mark done"}
                    className="flex items-center justify-center shrink-0 rounded-full mt-3"
                    style={{
                      width: 18,
                      height: 18,
                      border: `2px solid ${item.done ? orange : border}`,
                      background: item.done ? orange : "#FFFFFF",
                    }}
                  >
                    {item.done && <span style={{ color: navy, fontSize: 11, lineHeight: 1, fontWeight: 700 }}>✓</span>}
                  </button>
                  {idx < items.length - 1 && <div className="flex-1 w-px my-1" style={{ background: border, minHeight: 20 }} />}
                </div>

                <div className="flex-1 pb-3">
                  <button
                    onClick={() => openThread(item)}
                    className="w-full text-left rounded-2xl px-4 py-3"
                    style={{
                      background: item.done ? navy : bg,
                      border: `1px solid ${item.done ? navy : border}`,
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="text-sm font-semibold"
                        style={{
                          color: item.done ? "#FFFFFF" : ink,
                          textDecoration: item.done ? "line-through" : "none",
                        }}
                      >
                        {item.text}
                      </span>
                      {item.done && (
                        <span className="text-xs shrink-0" style={{ color: "rgba(255,255,255,0.75)" }}>
                          {formatTime(item.completedAt)}
                        </span>
                      )}
                    </div>
                    {item.done && item.completedByName && (
                      <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.75)" }}>
                        Completed by {item.completedByName}
                      </p>
                    )}

                    {(distinctCommenters.length > 0 || expanded) && (
                      <div className="flex items-center mt-2.5">
                        {distinctCommenters.slice(0, 4).map(([key, name], i) => (
                          <span
                            key={key}
                            className="flex items-center justify-center rounded-full text-xs font-medium shrink-0"
                            style={{
                              width: 22,
                              height: 22,
                              marginLeft: i === 0 ? 0 : -6,
                              background: "#FFFFFF",
                              color: navy,
                              border: `1.5px solid ${item.done ? navy : bg}`,
                            }}
                          >
                            {initials(name)}
                          </span>
                        ))}
                        {distinctCommenters.length > 4 && (
                          <span
                            className="flex items-center justify-center rounded-full text-xs font-medium shrink-0"
                            style={{
                              width: 22,
                              height: 22,
                              marginLeft: -6,
                              background: orangeSoft,
                              color: navy,
                              border: `1.5px solid ${item.done ? navy : bg}`,
                            }}
                          >
                            +{distinctCommenters.length - 4}
                          </span>
                        )}
                        <span
                          className="flex items-center justify-center rounded-full shrink-0"
                          style={{
                            width: 22,
                            height: 22,
                            marginLeft: distinctCommenters.length ? 4 : 0,
                            background: "transparent",
                            border: `1.5px dashed ${item.done ? "rgba(255,255,255,0.6)" : inkSoft}`,
                          }}
                        >
                          <Plus size={12} style={{ color: item.done ? "#FFFFFF" : inkSoft }} />
                        </span>
                        <span className="text-xs ml-2" style={{ color: item.done ? "rgba(255,255,255,0.75)" : inkSoft }}>
                          {item.comments.length > 0
                            ? `${item.comments.length} comment${item.comments.length === 1 ? "" : "s"}`
                            : "Add a comment"}
                        </span>
                      </div>
                    )}
                  </button>

                  {expanded && (
                    <div className="flex flex-col gap-2.5 mt-2 p-3 rounded-2xl" style={{ background: bg, border: `1px solid ${border}` }}>
                      {item.comments.map((c) => (
                        <div key={c.id} className="flex gap-2">
                          <span
                            className="flex items-center justify-center rounded-full text-xs font-medium shrink-0"
                            style={{ width: 24, height: 24, background: "#FFFFFF", color: navy }}
                          >
                            {initials(c.authorName)}
                          </span>
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium" style={{ color: ink }}>
                                {c.authorName}
                              </span>
                              <span className="text-xs" style={{ color: inkSoft }}>
                                {formatTime(c.createdAt)}
                              </span>
                              {(c.authorId === profile.id || isAdmin) && (
                                <button onClick={() => deleteComment(c)} className="ml-auto" style={{ color: inkSoft }} aria-label="Delete comment">
                                  <X size={12} />
                                </button>
                              )}
                            </div>
                            {c.text && (
                              <p className="text-sm" style={{ color: ink }}>
                                {c.text}
                              </p>
                            )}
                            {c.photoDisplayUrl && (
                              <a href={c.photoDisplayUrl} target="_blank" rel="noreferrer">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={c.photoDisplayUrl}
                                  alt=""
                                  className="rounded-xl object-cover mt-1"
                                  style={{ width: 72, height: 72, border: `1px solid ${border}` }}
                                />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}

                      <div className="flex items-center gap-2 pt-1">
                        <input
                          value={commentDraft}
                          onChange={(e) => setCommentDraft(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && postComment(item)}
                          placeholder="Add a comment…"
                          className="flex-1 text-sm px-3 py-2 rounded-full outline-none"
                          style={{ border: `1px solid ${border}`, background: fill, color: ink }}
                        />
                        <label className="shrink-0 cursor-pointer" style={{ color: navyText }} aria-label="Add photo">
                          <Camera size={17} />
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={(e) => setPhotoDraft(e.target.files?.[0] ?? null)}
                            className="hidden"
                          />
                        </label>
                        <button
                          onClick={() => postComment(item)}
                          disabled={posting || (!commentDraft.trim() && !photoDraft)}
                          className="shrink-0 flex items-center justify-center rounded-full disabled:opacity-40"
                          style={{ width: 32, height: 32, background: navy }}
                          aria-label="Send comment"
                        >
                          <SendIcon size={14} style={{ color: "#FFFFFF" }} />
                        </button>
                      </div>
                      {photoDraft && (
                        <p className="text-xs" style={{ color: inkSoft }}>
                          {photoDraft.name} attached
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}
