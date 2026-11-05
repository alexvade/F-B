import * as XLSX from "xlsx";
import type { SupabaseClient } from "@supabase/supabase-js";

export const LINEN_ORDER_RECIPIENT = "hdnewc@fisherservices.co.uk";

// Fisher Services' own linen hire order form, exactly as submitted — stored
// in the private "attachments" bucket (not committed to the repo, same as
// every other uploaded document the app handles) and downloaded fresh on
// each send with the service-role client.
const TEMPLATE_PATH = "linen-order/fisher-services-template.xls";

// Fisher Services process this by eye/by machine against their own form —
// "same file, just the figures changed" — so this edits specific cells in a
// parsed copy of their actual template rather than rebuilding a lookalike
// sheet. Everything else — layout, merges, column order, the sheet's own
// name, number formats — comes through untouched. Row numbers below are
// literally the template's own rows.
const ARTICLE_ROW: Record<string, number> = {
  "Sheets Single": 13,
  "Sheets King": 14,
  "Pillow Cases": 15,
  "Hand Towels": 16,
  "Bath Sheets": 17,
  "Bath Mats": 18,
  "Glass Cloths": 20,
  "Kitchen Cloths": 21,
  "Oven Cloths": 22,
  "Table Napkins": 24,
  "Table Cloths (54 x 54)": 25,
  "Table Cloths (70 x 70)": 26,
  "Table Cloths (90 x 90)": 27,
  "Table Cloths (70 x 144)": 28,
  "Duvet Covers Single": 30,
  "Duvet Covers King": 31,
  "Duvet Covers Superking": 32,
  "Premier Hand Towels": 34,
  "Leisure Towels": 35,
  "Hand Towels Slate Grey": 36,
  "Bath Sheets Slate Grey": 37,
  "Spa Jumbo Sheets": 38,
};

// Excel's date serial, matching the template's own B2/B7 cells (epoch of
// 1899-12-30, including the fictitious 1900 leap day Excel still honours).
function excelDateSerial(d: Date): number {
  return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / 86400000);
}

function setCell(ws: XLSX.WorkSheet, addr: string, value: string | number | null | undefined, type: "n" | "s") {
  if (value === null || value === undefined || value === "") {
    delete ws[addr];
    return;
  }
  // Keep the template's own number format / style on this cell (e.g. B2's
  // "m/d/yy") rather than replacing the whole cell object — only the value
  // actually needs to change.
  const cell: XLSX.CellObject = { ...ws[addr], t: type, v: value };
  // Drop any cached display text and formula (e.g. B7's "=B2") so nothing
  // stale survives alongside the new value.
  delete cell.w;
  delete cell.f;
  ws[addr] = cell;
}

export async function buildLinenOrderReportBuffer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
): Promise<{ buffer: Buffer; filename: string }> {
  const [{ data: items, error: itemsError }, { data: meta, error: metaError }] = await Promise.all([
    supabase
      .from("linen_order_items")
      .select("article, total_sent, colour, increase_required, decrease_required, reject")
      .order("sort_order"),
    supabase.from("linen_order_meta").select("your_name, labels_colour, empty_bags_cages").eq("id", 1).single(),
  ]);
  if (itemsError) throw new Error(itemsError.message);
  if (metaError) throw new Error(metaError.message);

  const { data: templateFile, error: templateError } = await supabase.storage
    .from("attachments")
    .download(TEMPLATE_PATH);
  if (templateError || !templateFile) {
    throw new Error(templateError?.message || "Couldn't download the linen order template");
  }
  const templateBuffer = Buffer.from(await templateFile.arrayBuffer());

  const workbook = XLSX.read(templateBuffer, {
    type: "buffer",
    cellStyles: true,
    cellFormula: true,
  });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const today = new Date();
  const serial = excelDateSerial(today);
  setCell(sheet, "B2", serial, "n"); // title-area date
  setCell(sheet, "B7", serial, "n"); // "Date:" (template has this as =B2, kept in sync here)
  setCell(sheet, "B9", meta?.your_name ?? null, "s"); // "Your Name:"
  setCell(sheet, "G7", meta?.labels_colour ?? null, "s"); // "Labels (State Colour):-"
  setCell(sheet, "G9", meta?.empty_bags_cages ?? null, "n"); // "Empty Bags / Cages:-"

  for (const item of items ?? []) {
    const row = ARTICLE_ROW[item.article];
    if (!row) continue; // template layout changed underneath us — skip rather than write to the wrong cell
    setCell(sheet, `B${row}`, item.total_sent, "n");
    setCell(sheet, `E${row}`, item.colour, "s");
    setCell(sheet, `F${row}`, item.increase_required, "n");
    setCell(sheet, `G${row}`, item.decrease_required, "n");
    setCell(sheet, `H${row}`, item.reject, "n");
  }

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xls" }) as Buffer;
  return { buffer, filename: `linen-order-${today.toISOString().slice(0, 10)}.xls` };
}

// Clears everything that's specific to a single day's order once it's been
// sent, so tomorrow starts from a blank form — "Your Name" is the one field
// that carries over, since it rarely changes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resetLinenOrder(supabase: SupabaseClient<any>) {
  await supabase
    .from("linen_order_items")
    .update({ total_sent: null, colour: null, increase_required: null, decrease_required: null, reject: null })
    .not("article", "is", null);
  await supabase.from("linen_order_meta").update({ labels_colour: null, empty_bags_cages: null }).eq("id", 1);
}
