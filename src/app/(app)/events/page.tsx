"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, FileStack, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
import { uploadAttachment } from "@/lib/storage";
import { Section } from "@/components/section";
import { bg, border, fill, ink, inkSoft, navy, navyText, orange, orangeSoft } from "@/lib/design-tokens";

type EventRow = {
  id: number;
  title: string;
  event_date: string | null;
  content: unknown;
};

export default function EventsPage() {
  const profile = useProfile();
  const isAdmin = profile.role === "admin";
  const supabase = createClient();

  const [events, setEvents] = useState<EventRow[]>([]);
  const [adding, setAdding] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadEvents = useCallback(async () => {
    const { data } = await supabase
      .from("events")
      .select("id, title, event_date, content")
      .order("event_date", { ascending: false, nullsFirst: true })
      .order("id", { ascending: false });
    setEvents(data ?? []);
  }, [supabase]);

  useEffect(() => {
    loadEvents();
    const channel = supabase
      .channel("events-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, loadEvents)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadEvents, supabase]);

  const deleteEvent = async (id: number) => {
    if (!confirm("Remove this event guide? The original function sheet PDF stays in Function Sheets.")) return;
    await supabase.from("events").delete().eq("id", id);
    loadEvents();
  };

  const handleFileSelect = (f: File | null) => {
    setFile(f);
    if (f && !title) {
      setTitle(f.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim());
    }
  };

  const submit = async () => {
    if (!file || !title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const file_url = await uploadAttachment(file, "function-sheets");
      const { data: sheet, error: sheetError } = await supabase
        .from("function_sheets")
        .insert({ title: title.trim(), file_url, file_name: file.name, uploaded_by: profile.id })
        .select()
        .single();
      if (sheetError) throw sheetError;

      const { error: eventError } = await supabase.from("events").insert({
        title: title.trim(),
        function_sheet_id: sheet.id,
        event_date: eventDate || null,
        created_by: profile.id,
      });
      if (eventError) throw eventError;

      setAdding(false);
      setFile(null);
      setTitle("");
      setEventDate("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      loadEvents();
    } catch (err) {
      setError((err as Error).message || "Couldn't add that event — try again.");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = { border: `1px solid ${border}`, background: fill, color: ink } as const;

  if (adding) {
    return (
      <div>
        <button onClick={() => setAdding(false)} className="text-xs mb-4" style={{ color: navyText }}>
          ← Cancel
        </button>
        <h2 className="text-lg font-semibold mb-4" style={{ color: navyText }}>
          New event
        </h2>
        <div className="flex flex-col gap-3 max-w-md">
          <label className="text-xs" style={{ color: inkSoft }}>
            Function sheet (PDF)
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
              className="block mt-1 text-xs"
            />
          </label>
          <input
            placeholder="Event title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-sm px-4 py-2 rounded-full outline-none"
            style={inputStyle}
          />
          <label className="text-xs" style={{ color: inkSoft }}>
            Event date (optional)
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="block mt-1 text-sm px-4 py-2 rounded-full outline-none"
              style={inputStyle}
            />
          </label>
          {error && (
            <p className="text-xs" style={{ color: "#000000" }}>
              {error}
            </p>
          )}
          <button
            onClick={submit}
            disabled={saving || !file || !title.trim()}
            className="text-sm font-medium py-2.5 rounded-full disabled:opacity-60"
            style={{ background: navy, color: "#FFFFFF" }}
          >
            {saving ? "Adding…" : "Add event"}
          </button>
          <p className="text-xs" style={{ color: inkSoft }}>
            This also shows up under Function Sheets. The rich guide (timeline, menus, contacts) gets added
            separately once the PDF&apos;s been processed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Section title="Events" subtitle="Function guides — timeline, contacts, menus and more">
      {isAdmin && (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-2xl mb-4"
          style={{ background: orangeSoft, color: navy }}
        >
          <Plus size={13} /> Add event
        </button>
      )}

      {events.length === 0 ? (
        <p className="text-sm" style={{ color: inkSoft }}>
          No events yet.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {events.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between p-3 rounded-3xl"
              style={{ background: bg, border: `1px solid ${border}` }}
            >
              <Link href={`/events/${e.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                <FileStack size={18} style={{ color: orange }} />
                <div>
                  <div className="text-sm font-medium" style={{ color: ink }}>
                    {e.title}
                  </div>
                  <div className="text-xs" style={{ color: inkSoft }}>
                    {e.event_date
                      ? new Date(e.event_date + "T00:00:00").toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })
                      : "No date set"}
                    {!e.content && " · Awaiting details"}
                  </div>
                </div>
              </Link>
              <div className="flex items-center gap-3 shrink-0 ml-3">
                {isAdmin && (
                  <button onClick={() => deleteEvent(e.id)} aria-label="Remove event">
                    <Trash2 size={14} style={{ color: inkSoft }} />
                  </button>
                )}
                <Link href={`/events/${e.id}`}>
                  <ChevronRight size={16} style={{ color: inkSoft }} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
