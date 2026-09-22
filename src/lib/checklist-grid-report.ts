import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import type { SupabaseClient } from "@supabase/supabase-js";

type ChecklistItem = { id: number; text: string; sort_order: number; requires_value: boolean };
type Completion = { item_id: number; checklist_day: string; value: string | null };

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

// One row per date in range, one column per item — a value item shows what
// was recorded, a plain tick item shows ✓ if it was done that day.
function cellFor(item: ChecklistItem, date: string, completionByKey: Map<string, Completion>): string {
  const completion = completionByKey.get(`${item.id}:${date}`);
  if (item.requires_value) return completion?.value ?? "";
  return completion ? "✓" : "";
}

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function loadChecklistGrid(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  checklistId: number,
  from: string,
  to: string
): Promise<{ title: string; items: ChecklistItem[]; dates: string[]; completionByKey: Map<string, Completion> } | null> {
  const { data: checklist, error: checklistError } = await supabase
    .from("checklists")
    .select("title")
    .eq("id", checklistId)
    .single();
  if (checklistError || !checklist) return null;

  const { data: items, error: itemsError } = await supabase
    .from("checklist_items")
    .select("id, text, sort_order, requires_value")
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
    : { data: [] as Completion[], error: null };
  if (completionsError) throw new Error(completionsError.message);

  return {
    title: checklist.title,
    items: items ?? [],
    dates: datesBetween(from, to),
    completionByKey: new Map((completions ?? []).map((c) => [`${c.item_id}:${c.checklist_day}`, c])),
  };
}

function addGridSheet(
  workbook: ExcelJS.Workbook,
  usedNames: Set<string>,
  title: string,
  items: ChecklistItem[],
  dates: string[],
  completionByKey: Map<string, Completion>
) {
  let sheetName = title.slice(0, 31);
  let n = 2;
  while (usedNames.has(sheetName)) {
    sheetName = `${title.slice(0, 28)} ${n++}`;
  }
  usedNames.add(sheetName);

  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = [
    { header: "Date", key: "date", width: 16 },
    ...items.map((i) => ({ header: i.text, key: String(i.id), width: 24 })),
  ];
  sheet.getRow(1).font = { bold: true };
  for (const date of dates) {
    const row: Record<string, string> = { date: formatDay(date) };
    for (const i of items) row[String(i.id)] = cellFor(i, date, completionByKey);
    sheet.addRow(row);
  }

  const thinBorder = { style: "thin" as const, color: { argb: "FF999999" } };
  const numCols = items.length + 1;
  for (let r = 1; r <= dates.length + 1; r++) {
    for (let c = 1; c <= numCols; c++) {
      sheet.getRow(r).getCell(c).border = {
        top: thinBorder,
        left: thinBorder,
        bottom: thinBorder,
        right: thinBorder,
      };
    }
  }
}

function drawGridSection(
  doc: PDFKit.PDFDocument,
  title: string,
  items: ChecklistItem[],
  dates: string[],
  completionByKey: Map<string, Completion>,
  fresh: boolean,
  subtitle?: string
) {
  if (!fresh) doc.addPage();
  doc.fontSize(14).fillColor("#000").text(title);
  if (subtitle) doc.fontSize(10).fillColor("#555").text(subtitle);
  doc.moveDown(0.5);

  const dateColWidth = 55;
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const itemColWidth = (usableWidth - dateColWidth) / Math.max(items.length, 1);
  const columns = [
    { key: "__date", label: "Date", width: dateColWidth },
    ...items.map((i) => ({ key: String(i.id), label: i.text, width: itemColWidth })),
  ];

  const cellPad = 4;
  const tableLeft = doc.page.margins.left;

  let y = doc.y;
  const drawRow = (cells: Record<string, string>, bold: boolean) => {
    const height =
      Math.max(...columns.map((c) => doc.heightOfString(cells[c.key], { width: c.width - cellPad * 2 }))) +
      cellPad * 2;
    let x = tableLeft;
    doc.fontSize(8).fillColor("#000");
    for (const c of columns) {
      doc.rect(x, y, c.width, height).strokeColor("#999").lineWidth(0.75).stroke();
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").text(cells[c.key], x + cellPad, y + cellPad, {
        width: c.width - cellPad * 2,
      });
      x += c.width;
    }
    doc.font("Helvetica");
    y += height;
    return height;
  };
  const drawHeader = () => {
    const headerCells: Record<string, string> = Object.fromEntries(columns.map((c) => [c.key, c.label]));
    drawRow(headerCells, true);
  };
  drawHeader();

  for (const date of dates) {
    const cells: Record<string, string> = { __date: formatDay(date) };
    for (const i of items) cells[String(i.id)] = cellFor(i, date, completionByKey);

    const projectedHeight =
      Math.max(...columns.map((c) => doc.heightOfString(cells[c.key], { width: c.width - cellPad * 2 }))) +
      cellPad * 2;
    if (y + projectedHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = doc.page.margins.top;
      drawHeader();
    }
    drawRow(cells, false);
  }

  if (dates.length === 0) {
    doc.fontSize(10).fillColor("#555").text("No dates in this period.");
  }
}

// One checklist, rendered as a day-by-day grid — one row per date in range,
// one column per item. Used by the small per-checklist export.
export async function buildChecklistValueReportBuffer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  checklistId: number,
  from: string,
  to: string,
  format: "xlsx" | "pdf"
): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
  const grid = await loadChecklistGrid(supabase, checklistId, from, to);
  if (!grid) throw new Error("Checklist not found");
  const filenameRange = `${from}_to_${to}`;
  const filenameSlug = slugify(grid.title);

  if (format === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    addGridSheet(workbook, new Set(), grid.title, grid.items, grid.dates, grid.completionByKey);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return {
      buffer,
      filename: `${filenameSlug}-${filenameRange}.xlsx`,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }

  const doc = new PDFDocument({ margin: 30, size: "A4", layout: "landscape" });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const donePromise = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
  drawGridSection(doc, grid.title, grid.items, grid.dates, grid.completionByKey, true, `${formatDay(from)} – ${formatDay(to)}`);
  doc.end();
  const buffer = await donePromise;
  return { buffer, filename: `${filenameSlug}-${filenameRange}.pdf`, contentType: "application/pdf" };
}

// Every checklist that had any activity in range, each as its own grid — the
// "Export report" button's report (across all sections), so it looks the
// same as exporting one checklist at a time instead of a flat completion log.
export async function buildAllChecklistsReportBuffer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  from: string,
  to: string,
  format: "xlsx" | "pdf"
): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
  const { data: checklists, error } = await supabase
    .from("checklists")
    .select("id, title, section")
    .order("section")
    .order("sort_order");
  if (error) throw new Error(error.message);

  const grids: { title: string; items: ChecklistItem[]; dates: string[]; completionByKey: Map<string, Completion> }[] = [];
  for (const c of checklists ?? []) {
    const grid = await loadChecklistGrid(supabase, c.id, from, to);
    if (grid && grid.completionByKey.size > 0) grids.push(grid);
  }

  const filenameRange = `${from}_to_${to}`;

  if (format === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    const usedNames = new Set<string>();
    for (const g of grids) addGridSheet(workbook, usedNames, g.title, g.items, g.dates, g.completionByKey);
    if (grids.length === 0) workbook.addWorksheet("Checklist Report");
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return {
      buffer,
      filename: `checklist-report-${filenameRange}.xlsx`,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }

  const doc = new PDFDocument({ margin: 30, size: "A4", layout: "landscape" });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const donePromise = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  doc.fontSize(16).fillColor("#000").text("Checklist Report");
  doc.fontSize(10).fillColor("#555").text(`${formatDay(from)} – ${formatDay(to)}`);
  if (grids.length === 0) {
    doc.moveDown(1);
    doc.fontSize(10).fillColor("#555").text("No completions in this period.");
  } else {
    doc.moveDown(1);
    grids.forEach((g, i) => drawGridSection(doc, g.title, g.items, g.dates, g.completionByKey, i === 0));
  }

  doc.end();
  const buffer = await donePromise;
  return { buffer, filename: `checklist-report-${filenameRange}.pdf`, contentType: "application/pdf" };
}
