import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EventGuide } from "@/components/event-guide";
import { bg, border, ink, inkSoft, navyText, orange } from "@/lib/design-tokens";

export default async function EventDetailPage({ params }: PageProps<"/events/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("*").eq("id", Number(id)).single();
  if (!event) notFound();

  let fileUrl: string | null = null;
  if (event.function_sheet_id) {
    const { data: sheet } = await supabase
      .from("function_sheets")
      .select("file_url")
      .eq("id", event.function_sheet_id)
      .single();
    if (sheet?.file_url) {
      const marker = "/attachments/";
      const i = sheet.file_url.indexOf(marker);
      const path = i === -1 ? sheet.file_url : sheet.file_url.slice(i + marker.length);
      const { data: signed } = await supabase.storage.from("attachments").createSignedUrl(path, 60 * 60);
      fileUrl = signed?.signedUrl ?? null;
    }
  }

  return (
    <div>
      <Link href="/events" className="text-xs mb-4 inline-block" style={{ color: navyText }}>
        ← Back to Events
      </Link>

      {event.content ? (
        <EventGuide content={event.content} />
      ) : (
        <div>
          <h1
            className="text-lg font-semibold mb-1 inline-block pb-1"
            style={{ color: navyText, borderBottom: `3px solid ${orange}` }}
          >
            {event.title}
          </h1>
          <p className="text-sm mt-3 mb-4" style={{ color: inkSoft }}>
            Details haven&apos;t been added for this event yet.
          </p>
          {fileUrl && (
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 w-fit px-3 py-2 rounded-2xl"
              style={{ background: bg, border: `1px solid ${border}`, color: ink }}
            >
              <FileText size={15} style={{ color: orange }} />
              <span className="text-sm">Open the original PDF</span>
            </a>
          )}
        </div>
      )}
    </div>
  );
}
