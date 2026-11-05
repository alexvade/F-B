import ExcelJS from "exceljs";
import type { SupabaseClient } from "@supabase/supabase-js";

export const LINEN_ORDER_RECIPIENT = "hdnewc@fisherservices.co.uk";

// Rebuilds Fisher Services' own linen hire order form as an .xlsx — same
// article list, same grouping/order, same header fields — from whatever's
// currently saved in linen_order_items/linen_order_meta. Shared by the
// send-email route so the attachment can't drift from what's on screen.
export async function buildLinenOrderReportBuffer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
): Promise<{ buffer: Buffer; filename: string }> {
  const [{ data: items, error: itemsError }, { data: meta, error: metaError }] = await Promise.all([
    supabase
      .from("linen_order_items")
      .select("article, category, sort_order, total_sent, colour, increase_required, decrease_required, reject")
      .order("sort_order"),
    supabase.from("linen_order_meta").select("your_name, labels_colour, empty_bags_cages").eq("id", 1).single(),
  ]);
  if (itemsError) throw new Error(itemsError.message);
  if (metaError) throw new Error(metaError.message);

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-GB"); // dd/mm/yyyy, matching the source form

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Linen Order");
  sheet.properties.defaultColWidth = 14;
  sheet.getColumn(1).width = 28;
  sheet.getColumn(2).width = 12;
  sheet.getColumn(3).width = 10;
  sheet.getColumn(4).width = 18;
  sheet.getColumn(5).width = 18;
  sheet.getColumn(6).width = 10;
  const FONT = { name: "Arial", size: 10 } as const;

  const addLabelRow = (label: string, value: string) => {
    const row = sheet.addRow([label, value]);
    row.getCell(1).font = { ...FONT, bold: true };
    row.getCell(2).font = FONT;
  };

  const titleRow = sheet.addRow(["Linen Hire — Wood Hall Hotel"]);
  titleRow.getCell(1).font = { ...FONT, bold: true, size: 14 };
  sheet.addRow([]);
  addLabelRow("Date:", dateStr);
  addLabelRow("Hotel Name:", "WOOD HALL HOTEL");
  addLabelRow("Your Name:", meta?.your_name ?? "");
  addLabelRow("Labels (State Colour):", meta?.labels_colour ?? "");
  addLabelRow("Empty Bags/Cages collected:", meta?.empty_bags_cages != null ? String(meta.empty_bags_cages) : "");
  sheet.addRow([]);

  const headerRow = sheet.addRow(["Article", "Total Sent", "Colour", "Increase Required", "Decrease Required", "Reject"]);
  headerRow.eachCell((cell) => {
    cell.font = { ...FONT, bold: true };
    cell.border = { bottom: { style: "thin" } };
  });

  let lastCategory: string | null = null;
  for (const item of items ?? []) {
    if (item.category !== lastCategory) {
      if (lastCategory !== null) sheet.addRow([]);
      const catRow = sheet.addRow([item.category]);
      catRow.getCell(1).font = { ...FONT, bold: true, italic: true };
      lastCategory = item.category;
    }
    const row = sheet.addRow([
      item.article,
      item.total_sent ?? "",
      item.colour ?? "",
      item.increase_required ?? "",
      item.decrease_required ?? "",
      item.reject ?? "",
    ]);
    row.eachCell((cell) => (cell.font = FONT));
  }

  sheet.addRow([]);
  const footer = sheet.addRow([`Sent via Team Ops — completed order for ${dateStr}`]);
  footer.getCell(1).font = { ...FONT, italic: true, size: 9, color: { argb: "FF666666" } };

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return { buffer, filename: `linen-order-${today.toISOString().slice(0, 10)}.xlsx` };
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
