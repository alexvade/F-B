import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";

type Item = { id: number; text: string; sort_order: number };
type Completion = { item_id: number; completed_at: string; completed_by: string | null };
type CommentRow = {
  id: number;
  item_id: number;
  author_id: string | null;
  text: string | null;
  photo_url: string | null;
  file_url: string | null;
  file_name: string | null;
  created_at: string;
};

// A comment can embed an image (either its quick-snap photo, or a general
// file upload that turns out to be a photo) and/or note a non-image file —
// both independently, since one comment can carry both a camera photo and
// a separate file attachment at once.
type ResolvedAttachment = { kind: "image"; buffer: Buffer } | { kind: "file"; name: string };

function formatDayLong(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatTimeHMS(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Europe/London",
  });
}

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Real time rarely matches the planned running order — later steps often
// finish before earlier ones. Completed items sort by when they actually
// happened; anything not yet done keeps its place at the end, in list order.
function sortByCompletionTime(items: Item[], completionByItem: Map<number, Completion>): Item[] {
  return [...items].sort((a, b) => {
    const ca = completionByItem.get(a.id);
    const cb = completionByItem.get(b.id);
    if (ca && cb) return new Date(ca.completed_at).getTime() - new Date(cb.completed_at).getTime();
    if (ca) return -1;
    if (cb) return 1;
    return a.sort_order - b.sort_order;
  });
}

// Mirrors src/lib/storage.ts's toStoragePath — older rows may hold a full
// public URL rather than a bare path.
function toStoragePath(stored: string): string {
  const marker = "/attachments/";
  const i = stored.indexOf(marker);
  return i === -1 ? stored : stored.slice(i + marker.length);
}

async function downloadRaw(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  path: string
): Promise<Buffer | null> {
  const { data, error } = await supabase.storage.from("attachments").download(toStoragePath(path));
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

// Source photos come straight off phone cameras (often several MB each,
// with a dozen+ in one export) — embedding them at full resolution is what
// was blowing past Resend's attachment size limit and failing the "send by
// email" option with a 413. Downscaling to the size they're actually
// displayed at (plus headroom) keeps every export a few hundred KB instead
// of tens of MB. A non-image file (e.g. a PDF) fails to decode here and
// falls back to a text note instead of an embed.
async function downloadAndCompressImage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  path: string
): Promise<Buffer | null> {
  const raw = await downloadRaw(supabase, path);
  if (!raw) return null;
  try {
    return await sharp(raw).rotate().resize(600, 600, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 72 }).toBuffer();
  } catch {
    return null;
  }
}

async function resolveAttachments(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  comments: CommentRow[]
): Promise<Map<number, ResolvedAttachment[]>> {
  const map = new Map<number, ResolvedAttachment[]>();
  for (const cm of comments) {
    const entries: ResolvedAttachment[] = [];
    if (cm.photo_url) {
      const img = await downloadAndCompressImage(supabase, cm.photo_url);
      if (img) entries.push({ kind: "image", buffer: img });
    }
    if (cm.file_url) {
      const img = await downloadAndCompressImage(supabase, cm.file_url);
      if (img) entries.push({ kind: "image", buffer: img });
      else entries.push({ kind: "file", name: cm.file_name ?? "attached file" });
    }
    if (entries.length) map.set(cm.id, entries);
  }
  return map;
}

async function loadCompletionsAndComments(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  items: Item[]
) {
  const itemIds = items.map((i) => i.id);
  const [completionsRes, commentsRes] = await Promise.all([
    itemIds.length
      ? supabase.from("running_order_completions").select("item_id, completed_at, completed_by").in("item_id", itemIds)
      : Promise.resolve({ data: [] as Completion[] }),
    itemIds.length
      ? supabase
          .from("running_order_comments")
          .select("id, item_id, author_id, text, photo_url, file_url, file_name, created_at")
          .in("item_id", itemIds)
          .order("created_at")
      : Promise.resolve({ data: [] as CommentRow[] }),
  ]);
  const completions = (completionsRes.data ?? []) as Completion[];
  const comments = (commentsRes.data ?? []) as CommentRow[];

  const commentsByItem = new Map<number, CommentRow[]>();
  for (const c of comments) {
    const list = commentsByItem.get(c.item_id) ?? [];
    list.push(c);
    commentsByItem.set(c.item_id, list);
  }

  const peopleIds = Array.from(
    new Set([...completions.map((c) => c.completed_by), ...comments.map((c) => c.author_id)].filter(Boolean))
  ) as string[];
  const { data: profiles } = peopleIds.length
    ? await supabase.from("profiles").select("id, name").in("id", peopleIds)
    : { data: [] };
  const nameById = new Map((profiles ?? []).map((p: { id: string; name: string }) => [p.id, p.name]));

  const attachmentsByComment = await resolveAttachments(supabase, comments);

  return {
    completionByItem: new Map(completions.map((c) => [c.item_id, c])),
    commentsByItem,
    nameById,
    attachmentsByComment,
  };
}

// One event's timeline, rendered with the same detail as the on-screen
// page — every moment, its completion timestamp (HH:MM:SS) and who did it,
// every comment, and any attached photos/files.
export async function buildRunningOrderReportBuffer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  runningOrderId: number,
  format: "xlsx" | "pdf"
): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
  const { data: runningOrder, error: roError } = await supabase
    .from("running_orders")
    .select("title, event_date")
    .eq("id", runningOrderId)
    .single();
  if (roError || !runningOrder) throw new Error("Running order not found");

  const { data: items } = await supabase
    .from("running_order_items")
    .select("id, text, sort_order")
    .eq("running_order_id", runningOrderId)
    .order("sort_order");
  const { completionByItem, commentsByItem, nameById, attachmentsByComment } = await loadCompletionsAndComments(
    supabase,
    items ?? []
  );

  const subtitle = runningOrder.event_date ? formatDayLong(runningOrder.event_date) : null;
  const filenameSlug = slugify(runningOrder.title) || `running-order-${runningOrderId}`;

  if (format === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(runningOrder.title.slice(0, 31));
    sheet.columns = [
      { header: "Time", key: "time", width: 12 },
      { header: "Moment", key: "moment", width: 32 },
      { header: "Completed by", key: "by", width: 18 },
      { header: "Comments", key: "comments", width: 50 },
      { header: "Photo", key: "photo", width: 16 },
    ];
    sheet.getRow(1).font = { bold: true };

    for (const item of items ?? []) {
      const c = completionByItem.get(item.id);
      const comments = commentsByItem.get(item.id) ?? [];
      const commentLines = comments
        .map((cm) => {
          const who = cm.author_id ? nameById.get(cm.author_id) ?? "Someone" : "Someone";
          const fileNames = (attachmentsByComment.get(cm.id) ?? [])
            .filter((a): a is { kind: "file"; name: string } => a.kind === "file")
            .map((a) => a.name);
          const line = `${formatTimeHMS(cm.created_at)} ${who}: ${cm.text ?? ""}`.trim();
          return fileNames.length ? `${line} [file: ${fileNames.join(", ")}]` : line;
        })
        .join("\n");
      const row = sheet.addRow({
        time: c ? formatTimeHMS(c.completed_at) : "",
        moment: item.text,
        by: c?.completed_by ? nameById.get(c.completed_by) ?? "Someone" : "",
        comments: commentLines,
        photo: "",
      });
      row.alignment = { wrapText: true, vertical: "top" };

      const images = comments.flatMap(
        (cm) =>
          (attachmentsByComment.get(cm.id) ?? []).filter((a): a is { kind: "image"; buffer: Buffer } => a.kind === "image")
      );
      if (images.length) {
        row.height = Math.max(60, 70 * images.length);
        images.forEach((img, i) => {
          // exceljs's Buffer type param predates newer @types/node additions
          // (maxByteLength etc.) — functionally identical, cast to satisfy tsc.
          const imageId = workbook.addImage({ buffer: img.buffer as unknown as ExcelJS.Buffer, extension: "jpeg" });
          sheet.addImage(imageId, {
            tl: { col: 4, row: row.number - 1 + i * 0.95 },
            ext: { width: 80, height: 80 },
          });
        });
      }
    }

    const thinBorder = { style: "thin" as const, color: { argb: "FF999999" } };
    for (let r = 1; r <= (items?.length ?? 0) + 1; r++) {
      for (let c = 1; c <= 5; c++) {
        sheet.getRow(r).getCell(c).border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };
      }
    }

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return {
      buffer,
      filename: `${filenameSlug}.xlsx`,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }

  const doc = new PDFDocument({ margin: 36, size: "A4" });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const donePromise = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const pageBottom = () => doc.page.height - doc.page.margins.bottom;
  const ensureSpace = (needed: number) => {
    if (doc.y + needed > pageBottom()) doc.addPage();
  };

  doc.fontSize(18).fillColor("#000").font("Helvetica-Bold").text(runningOrder.title);
  if (subtitle) doc.fontSize(11).fillColor("#555").font("Helvetica").text(subtitle);
  doc.moveDown(1);

  const timelineOrder = sortByCompletionTime(items ?? [], completionByItem);
  for (const item of timelineOrder) {
    const c = completionByItem.get(item.id);
    const comments = commentsByItem.get(item.id) ?? [];

    ensureSpace(40);
    doc.fontSize(12).fillColor("#000").font("Helvetica-Bold").text(item.text, { continued: false });
    if (c) {
      const by = c.completed_by ? nameById.get(c.completed_by) ?? "Someone" : "Someone";
      doc.fontSize(9).fillColor("#555").font("Helvetica").text(`Completed ${formatTimeHMS(c.completed_at)} by ${by}`);
    } else {
      doc.fontSize(9).fillColor("#999").font("Helvetica").text("Not completed");
    }

    for (const cm of comments) {
      const author = cm.author_id ? nameById.get(cm.author_id) ?? "Someone" : "Someone";
      ensureSpace(30);
      doc.fontSize(9).fillColor("#333").font("Helvetica-Bold").text(`${formatTimeHMS(cm.created_at)} ${author}`, {
        indent: 14,
      });
      if (cm.text) {
        doc.fontSize(9).fillColor("#333").font("Helvetica").text(cm.text, { indent: 14 });
      }
      for (const attachment of attachmentsByComment.get(cm.id) ?? []) {
        if (attachment.kind === "image") {
          ensureSpace(90);
          doc.image(attachment.buffer, doc.page.margins.left + 14, doc.y, { width: 80, height: 80 });
          doc.y += 86;
        } else {
          doc.fontSize(8).fillColor("#999").text(`[file attached: ${attachment.name}]`, { indent: 14 });
        }
      }
    }
    doc.moveDown(0.75);
  }

  if ((items ?? []).length === 0) {
    doc.fontSize(10).fillColor("#555").text("No moments on this running order.");
  }

  doc.end();
  const buffer = await donePromise;
  return { buffer, filename: `${filenameSlug}.pdf`, contentType: "application/pdf" };
}
