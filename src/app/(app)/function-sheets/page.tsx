"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, FileStack, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
import { uploadAttachment } from "@/lib/storage";
import { Section } from "@/components/section";
import { border, ink, inkSoft, navy, orangeSoft, orange, surface } from "@/lib/design-tokens";

type Sheet = { id: number; title: string; file_url: string; file_name: string | null };

export default function FunctionSheetsPage() {
  const profile = useProfile();
  const isAdmin = profile.role === "admin";
  const supabase = createClient();

  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    const { data } = await supabase.from("function_sheets").select("*").order("uploaded_at", { ascending: false });
    setSheets(data ?? []);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const file_url = await uploadAttachment(file, "function-sheets");
      const title = file.name.replace(/\.pdf$/i, "");
      await supabase
        .from("function_sheets")
        .insert({ title, file_url, file_name: file.name, uploaded_by: profile.id });
      if (fileInputRef.current) fileInputRef.current.value = "";
      loadData();
    } finally {
      setUploading(false);
    }
  };

  const deleteSheet = async (id: number) => {
    await supabase.from("function_sheets").delete().eq("id", id);
    loadData();
  };

  return (
    <Section title="Function Sheets" subtitle="Tap a sheet to open the original PDF">
      {isAdmin && (
        <label
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-2xl mb-4 cursor-pointer w-fit"
          style={{ background: orangeSoft, color: navy }}
        >
          <Upload size={13} />
          {uploading ? "Uploading…" : "Upload function sheet"}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />
        </label>
      )}
      <div className="flex flex-col gap-1">
        {sheets.map((sheet) => (
          <div
            key={sheet.id}
            className="flex items-center justify-between p-3 rounded-3xl"
            style={{ background: surface, border: `1px solid ${border}` }}
          >
            <a href={sheet.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 flex-1">
              <FileStack size={18} style={{ color: orange }} />
              <div>
                <div className="text-sm font-medium" style={{ color: ink }}>
                  {sheet.title}
                </div>
                <div className="text-xs" style={{ color: inkSoft }}>
                  {sheet.file_name}
                </div>
              </div>
            </a>
            <div className="flex items-center gap-2 shrink-0">
              {isAdmin && (
                <button onClick={() => deleteSheet(sheet.id)} style={{ color: "#C24A3B" }}>
                  <Trash2 size={15} />
                </button>
              )}
              <ChevronRight size={16} style={{ color: inkSoft }} />
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
