import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import type { SupabaseClient } from "@supabase/supabase-js";

function formatDay(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function datesBetween(from: string, to: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

// Renders one checklist's value-bearing items as a day-by-day table — one
// row per date in range, one column per item — for logs like the Barista
// section's Brew Log, where the point (unlike a plain tick-off checklist)
// is reviewing what was actually recorded each day.
export async function buildChecklistValueReportBuffer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  checklistId: number,
  from: string,
  to: string,
  format: "xlsx" | "pdf"
): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
  const { data: checklist, error: checklistError } = await supabase
    .from("checklists")
    .select("title")
    .eq("id", checklistId)
    .single();
  if (checklistError || !checklist) {
    throw new Error(checklistError?.message || "Checklist not found");
  }

  const { data: items, error: itemsError } = await supabase
    .from("checklist_items")
    .select("id, text, sort_order")
    .eq("checklist_id", checklistId)
    .order("sort_order");
  if (itemsError) throw new Error(itemsError.message);

  const itemIds = (items ?? []).map((i) => i.id);
  const { data: completions, error: completionsError } = itemIds.length
    ? await supabase
        .from("checklist_completions")
        .select("item_id, checklist_day, value")
        .in("item_id", itemIds)
        .gte("checklist_day", from)
        .lte("checklist_day", to)
    : { data: [] as { item_id: number; checklist_day: string; value: string | null }[], error: null };
  if (completionsError) throw new Error(completionsError.message);

  const valueByKey = new Map((completions ?? []).map((c) => [`${c.item_id}:${c.checklist_day}`, c.value ?? ""]));
  const dates = datesBetween(from, to);
  const filenameSlug = checklist.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const filenameRange = `${from}_to_${to}`;

  if (format === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(checklist.title.slice(0, 31));
    sheet.columns = [
      { header: "Date", key: "date", width: 16 },
      ...(items ?? []).map((i) => ({ header: i.text, key: String(i.id), width: 24 })),
    ];
    sheet.getRow(1).font = { bold: true };
    for (const date of dates) {
      const row: Record<string, string> = { date: formatDay(date) };
      for (const i of items ?? []) row[String(i.id)] = valueByKey.get(`${i.id}:${date}`) ?? "";
      sheet.addRow(row);
    }
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return {
      buffer,
      filename: `${filenameSlug}-${filenameRange}.xlsx`,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }

  // PDF — landscape, since a log like this tends to have many columns.
  const doc = new PDFDocument({ margin: 30, size: "A4", layout: "landscape" });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const donePromise = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  doc.fontSize(16).fillColor("#000").text(checklist.title);
  doc.fontSize(10).fillColor("#555").text(`${formatDay(from)} – ${formatDay(to)}`);
  doc.moveDown(1);

  const dateColWidth = 55;
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const itemColWidth = (usableWidth - dateColWidth) / Math.max(items?.length ?? 1, 1);
  const columns = [
    { key: "__date", label: "Date", width: dateColWidth },
    ...(items ?? []).map((i) => ({ key: String(i.id), label: i.text, width: itemColWidth })),
  ];
  const rowPadding = 6;

  let y = doc.y;
  const drawHeader = () => {
    let x = doc.page.margins.left;
    doc.fontSize(8).fillColor("#000");
    const headerHeight = Math.max(...columns.map((c) => doc.heightOfString(c.label, { width: c.width }))) + rowPadding;
    for (const c of columns) {
      doc.text(c.label, x, y, { width: c.width });
      x += c.width;
    }
    y += headerHeight;
    doc
      .moveTo(doc.page.margins.left, y)
      .lineTo(doc.page.width - doc.page.margins.right, y)
      .strokeColor("#999")
      .stroke();
    y += 4;
  };
  drawHeader();

  doc.fontSize(8);
  for (const date of dates) {
    const cells: Record<string, string> = { __date: formatDay(date) };
    for (const i of items ?? []) cells[String(i.id)] = valueByKey.get(`${i.id}:${date}`) ?? "";

    const rowHeight = Math.max(...columns.map((c) => doc.heightOfString(cells[c.key], { width: c.width }))) + rowPadding;
    if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = doc.page.margins.top;
      drawHeader();
      doc.fontSize(8);
    }

    let x = doc.page.margins.left;
    doc.fillColor("#000");
    for (const c of columns) {
      doc.text(cells[c.key], x, y, { width: c.width });
      x += c.width;
    }
    y += rowHeight;
  }

  if (dates.length === 0) {
    doc.fontSize(10).fillColor("#555").text("No dates in this period.");
  }

  doc.end();
  const buffer = await donePromise;
  return { buffer, filename: `${filenameSlug}-${filenameRange}.pdf`, contentType: "application/pdf" };
}
