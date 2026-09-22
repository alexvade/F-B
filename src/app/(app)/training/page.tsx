"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Upload, ChevronRight, Share2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
import { useFeatureFlag } from "@/lib/feature-flags-context";
import { parseTrainingSheet } from "@/lib/training-sheet";
import { Section } from "@/components/section";
import { timestamp } from "@/lib/relative-time";
import { bg, border, fill, ink, inkSoft, navy, navyText, orangeSoft } from "@/lib/design-tokens";

type TrainingRecord = {
  id: number;
  learner_name: string;
  identifier: string | null;
  email: string | null;
  employment_start_date: string | null;
  compliance_item_name: string;
  compliance_item_type: string | null;
  status: string;
  due_date: string | null;
  allocation_date: string | null;
  allocated_by: string | null;
  collection_name: string | null;
  department: string | null;
  completed_date: string | null;
  job_title: string | null;
};

type LastUpload = { uploaded_at: string; row_count: number; uploaded_by_name: string };

const isOverdue = (r: TrainingRecord) => r.status.toLowerCase() === "overdue";

function daysOverdue(dueDate: string | null): number | null {
  if (!dueDate) return null;
  const due = new Date(dueDate + "T00:00:00");
  const diff = Math.floor((Date.now() - due.getTime()) / 86400000);
  return diff > 0 ? diff : 0;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// A grab-bag of reminder phrasings — picked randomly each time so a
// nudge posted every week doesn't read as the exact same copy-paste
// message (see Dashboard's GREETINGS / Noticeboard's COMPOSER_PLACEHOLDERS).
const REMINDER_TEMPLATES: ((name: string, count: number, module: string) => string)[] = [
  (n, c, m) => `${n} — you have ${c} overdue ${m}. Please log in to Mapal to complete ${c === 1 ? "it" : "these"}.`,
  (n, c, m) => `Reminder for ${n}: ${c} ${m} ${c === 1 ? "is" : "are"} overdue. Please log in to Mapal when you get a chance.`,
  (n, c, m) => `${n}, you're behind on ${c} ${m} in Mapal — please log in and complete ${c === 1 ? "it" : "them"} as soon as you can.`,
  (n, c, m) => `Friendly nudge for ${n}: ${c} overdue ${m} waiting in Mapal. Please log in to complete ${c === 1 ? "it" : "these"}.`,
  (n, c, m) => `${n} has ${c} overdue ${m}. Please log in to Mapal to get ${c === 1 ? "it" : "these"} sorted.`,
];

function randomReminderText(name: string, count: number): string {
  const template = REMINDER_TEMPLATES[Math.floor(Math.random() * REMINDER_TEMPLATES.length)];
  return template(name, count, count === 1 ? "module" : "modules");
}

export default function TrainingPage() {
  const profile = useProfile();
  const isAdmin = profile.role === "admin";
  const trainingUploadEnabled = useFeatureFlag("training_upload");
  const canUpload = isAdmin || trainingUploadEnabled;
  const supabase = createClient();

  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [lastUpload, setLastUpload] = useState<LastUpload | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"overdue" | "all">("overdue");
  const [viewMode, setViewMode] = useState<"person" | "item">("person");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    const [recordsRes, uploadRes] = await Promise.all([
      supabase.from("training_directory").select("*").order("learner_name"),
      supabase.from("training_uploads").select("*").order("uploaded_at", { ascending: false }).limit(1),
    ]);
    setRecords(recordsRes.data ?? []);
    const upload = uploadRes.data?.[0];
    if (!upload) {
      setLastUpload(null);
    } else {
      const { data: p } = upload.uploaded_by
        ? await supabase.from("profiles").select("name").eq("id", upload.uploaded_by).single()
        : { data: null };
      setLastUpload({ uploaded_at: upload.uploaded_at, row_count: upload.row_count, uploaded_by_name: p?.name ?? "Someone" });
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setShareStatus(null);
  }, [selectedKey]);

  const handleFile = async (file: File) => {
    setUploadError(null);
    let parsed;
    try {
      parsed = parseTrainingSheet(await file.text());
    } catch (err) {
      setUploadError((err as Error).message || "Couldn't read that file.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (parsed.length === 0) {
      setUploadError("No rows found in that file.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (!confirm(`Replace the current training data with this file's ${parsed.length} rows?`)) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setUploading(true);
    try {
      const { error: delError } = await supabase.from("training_records").delete().gte("id", 0);
      if (delError) throw delError;
      const { error: insError } = await supabase.from("training_records").insert(parsed);
      if (insError) throw insError;
      await supabase.from("training_uploads").insert({ uploaded_by: profile.id, row_count: parsed.length });
      setSelectedKey(null);
      loadData();
    } catch (err) {
      setUploadError((err as Error).message || "Couldn't save that file.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const shareReminder = async (learnerName: string, overdueCount: number) => {
    const firstName = learnerName.split(" ")[0];
    const text = randomReminderText(firstName, overdueCount);
    await supabase.from("posts").insert({ author_id: profile.id, text });
    setShareStatus("Posted to the Noticeboard.");
  };

  const filtered = useMemo(
    () => (statusFilter === "overdue" ? records.filter(isOverdue) : records),
    [records, statusFilter]
  );

  const personGroups = useMemo(() => {
    const map = new Map<string, { key: string; learner_name: string; job_title: string | null; department: string | null; email: string | null; records: TrainingRecord[] }>();
    for (const r of filtered) {
      const key = r.identifier ?? r.learner_name;
      if (!map.has(key)) {
        map.set(key, { key, learner_name: r.learner_name, job_title: r.job_title, department: r.department, email: r.email, records: [] });
      }
      map.get(key)!.records.push(r);
    }
    const q = search.trim().toLowerCase();
    return Array.from(map.values())
      .filter((g) => !q || g.learner_name.toLowerCase().includes(q))
      .sort((a, b) => {
        const diff = b.records.filter(isOverdue).length - a.records.filter(isOverdue).length;
        return diff !== 0 ? diff : a.learner_name.localeCompare(b.learner_name);
      });
  }, [filtered, search]);

  const itemGroups = useMemo(() => {
    const map = new Map<string, { key: string; compliance_item_name: string; compliance_item_type: string | null; records: TrainingRecord[] }>();
    for (const r of filtered) {
      const key = r.compliance_item_name;
      if (!map.has(key)) {
        map.set(key, { key, compliance_item_name: r.compliance_item_name, compliance_item_type: r.compliance_item_type, records: [] });
      }
      map.get(key)!.records.push(r);
    }
    const q = search.trim().toLowerCase();
    return Array.from(map.values())
      .filter((g) => !q || g.compliance_item_name.toLowerCase().includes(q))
      .sort((a, b) => {
        const diff = b.records.filter(isOverdue).length - a.records.filter(isOverdue).length;
        return diff !== 0 ? diff : a.compliance_item_name.localeCompare(b.compliance_item_name);
      });
  }, [filtered, search]);

  const totalOverdue = records.filter(isOverdue).length;
  const peopleOverdueCount = new Set(records.filter(isOverdue).map((r) => r.identifier ?? r.learner_name)).size;

  const inputStyle = { border: `1px solid ${border}`, background: fill, color: ink } as const;

  const selectedPerson = viewMode === "person" ? personGroups.find((g) => g.key === selectedKey) : undefined;
  const selectedItem = viewMode === "item" ? itemGroups.find((g) => g.key === selectedKey) : undefined;

  if (selectedPerson) {
    const overdueCount = selectedPerson.records.filter(isOverdue).length;
    return (
      <div>
        <button onClick={() => setSelectedKey(null)} className="text-xs mb-4" style={{ color: navyText }}>
          ← Back to Training
        </button>
        <div className="flex items-start justify-between gap-3 mb-1">
          <h2 className="text-lg font-semibold" style={{ color: navyText }}>
            {selectedPerson.learner_name}
          </h2>
          {canUpload && overdueCount > 0 && (
            <button
              onClick={() => shareReminder(selectedPerson.learner_name, overdueCount)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-2xl shrink-0"
              style={{ background: orangeSoft, color: navy }}
            >
              <Share2 size={13} /> Share reminder
            </button>
          )}
        </div>
        {shareStatus && (
          <p className="text-xs mb-2" style={{ color: inkSoft }}>
            {shareStatus}
          </p>
        )}
        <p className="text-xs mb-4" style={{ color: inkSoft }}>
          {[selectedPerson.job_title, selectedPerson.department, selectedPerson.email].filter(Boolean).join(" · ")}
        </p>
        <div className="flex flex-col gap-1">
          {selectedPerson.records.map((r) => (
            <div key={r.id} className="p-3 rounded-2xl" style={{ background: bg, border: `1px solid ${border}` }}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium" style={{ color: ink }}>
                  {r.compliance_item_name}
                </span>
                {isOverdue(r) && (
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
                    style={{ background: "#000000", color: "#FFFFFF" }}
                  >
                    Overdue
                  </span>
                )}
              </div>
              <div className="text-xs mt-1" style={{ color: inkSoft }}>
                {r.compliance_item_type} · Due {formatDate(r.due_date)}
                {isOverdue(r) && r.due_date && ` · ${daysOverdue(r.due_date)} day${daysOverdue(r.due_date) === 1 ? "" : "s"} overdue`}
                {r.completed_date && ` · Completed ${formatDate(r.completed_date)}`}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (selectedItem) {
    return (
      <div>
        <button onClick={() => setSelectedKey(null)} className="text-xs mb-4" style={{ color: navyText }}>
          ← Back to Training
        </button>
        <h2 className="text-lg font-semibold mb-1" style={{ color: navyText }}>
          {selectedItem.compliance_item_name}
        </h2>
        <p className="text-xs mb-4" style={{ color: inkSoft }}>
          {selectedItem.compliance_item_type} · {selectedItem.records.length} people
        </p>
        <div className="flex flex-col gap-1">
          {selectedItem.records.map((r) => (
            <div key={r.id} className="p-3 rounded-2xl" style={{ background: bg, border: `1px solid ${border}` }}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium" style={{ color: ink }}>
                  {r.learner_name}
                </span>
                {isOverdue(r) && (
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
                    style={{ background: "#000000", color: "#FFFFFF" }}
                  >
                    Overdue
                  </span>
                )}
              </div>
              <div className="text-xs mt-1" style={{ color: inkSoft }}>
                {r.job_title} · Due {formatDate(r.due_date)}
                {isOverdue(r) && r.due_date && ` · ${daysOverdue(r.due_date)} day${daysOverdue(r.due_date) === 1 ? "" : "s"} overdue`}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Section title="Training" subtitle="Weekly compliance export — identify overdue training at a glance">
      {canUpload && (
        <label
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-2xl mb-2 cursor-pointer w-fit"
          style={{ background: orangeSoft, color: navy }}
        >
          <Upload size={13} />
          {uploading ? "Uploading…" : "Upload this week's export (.csv)"}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </label>
      )}
      {uploadError && (
        <p className="text-xs mb-2" style={{ color: ink }}>
          {uploadError}
        </p>
      )}
      <p className="text-xs mb-6" style={{ color: inkSoft }}>
        {lastUpload
          ? `Last updated ${timestamp(lastUpload.uploaded_at)} by ${lastUpload.uploaded_by_name} · ${lastUpload.row_count} rows`
          : "No training data uploaded yet."}
      </p>

      {records.length > 0 && (
        <>
          <div className="p-4 rounded-2xl mb-4" style={{ background: bg, border: `1px solid ${border}` }}>
            <div className="text-2xl font-semibold" style={{ color: navyText }}>
              {totalOverdue}
            </div>
            <div className="text-xs" style={{ color: inkSoft }}>
              overdue item{totalOverdue === 1 ? "" : "s"} across {peopleOverdueCount} staff member{peopleOverdueCount === 1 ? "" : "s"}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-4">
            <input
              placeholder={viewMode === "person" ? "Search by name…" : "Search by training…"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-sm px-4 py-2 rounded-full outline-none flex-1 min-w-[160px]"
              style={inputStyle}
            />
            {(["overdue", "all"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className="text-xs px-3 py-1.5 rounded-2xl shrink-0"
                style={{
                  background: statusFilter === s ? "#000000" : "#FFFFFF",
                  color: statusFilter === s ? "#FFFFFF" : "#000000",
                  border: "1px solid #000000",
                  fontWeight: statusFilter === s ? 600 : 400,
                }}
              >
                {s === "overdue" ? "Overdue only" : "All statuses"}
              </button>
            ))}
            {(["person", "item"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className="text-xs px-3 py-1.5 rounded-2xl shrink-0"
                style={{
                  background: viewMode === v ? "#000000" : "#FFFFFF",
                  color: viewMode === v ? "#FFFFFF" : "#000000",
                  border: "1px solid #000000",
                  fontWeight: viewMode === v ? 600 : 400,
                }}
              >
                {v === "person" ? "By person" : "By training"}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            {viewMode === "person"
              ? personGroups.map((g) => {
                  const overdueCount = g.records.filter(isOverdue).length;
                  return (
                    <button
                      key={g.key}
                      onClick={() => setSelectedKey(g.key)}
                      className="flex items-center justify-between p-3 rounded-3xl text-left"
                      style={{ background: bg, border: `1px solid ${border}` }}
                    >
                      <div>
                        <div className="text-sm font-medium" style={{ color: ink }}>
                          {g.learner_name}
                        </div>
                        <div className="text-xs" style={{ color: inkSoft }}>
                          {[g.job_title, g.department].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {overdueCount > 0 && (
                          <span
                            className="text-xs font-medium px-2 py-0.5 rounded-full"
                            style={{ background: "#000000", color: "#FFFFFF" }}
                          >
                            {overdueCount} overdue
                          </span>
                        )}
                        <ChevronRight size={16} style={{ color: inkSoft }} />
                      </div>
                    </button>
                  );
                })
              : itemGroups.map((g) => {
                  const overdueCount = g.records.filter(isOverdue).length;
                  return (
                    <button
                      key={g.key}
                      onClick={() => setSelectedKey(g.key)}
                      className="flex items-center justify-between p-3 rounded-3xl text-left"
                      style={{ background: bg, border: `1px solid ${border}` }}
                    >
                      <div>
                        <div className="text-sm font-medium" style={{ color: ink }}>
                          {g.compliance_item_name}
                        </div>
                        <div className="text-xs" style={{ color: inkSoft }}>
                          {g.compliance_item_type} · {g.records.length} people
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {overdueCount > 0 && (
                          <span
                            className="text-xs font-medium px-2 py-0.5 rounded-full"
                            style={{ background: "#000000", color: "#FFFFFF" }}
                          >
                            {overdueCount} overdue
                          </span>
                        )}
                        <ChevronRight size={16} style={{ color: inkSoft }} />
                      </div>
                    </button>
                  );
                })}
            {(viewMode === "person" ? personGroups.length : itemGroups.length) === 0 && (
              <p className="text-sm" style={{ color: inkSoft }}>
                Nothing matches that search.
              </p>
            )}
          </div>
        </>
      )}
    </Section>
  );
}
