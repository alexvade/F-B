import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { createClient } from "@/lib/supabase/server";

// Admin-gated export of the current stock order — everything with a
// quantity actually set (> 0), across every tab, as a .xlsx or .pdf. Not
// date-ranged like the checklist report, since this is a snapshot of what
// needs ordering right now rather than a history.
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const { data: callerProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (callerProfile?.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");
  if (format !== "xlsx" && format !== "pdf") {
    return NextResponse.json({ error: "Missing or invalid format" }, { status: 400 });
  }
  // Comma-separated tab labels to restrict the export to — omit to include
  // every tab, same as before this option existed.
  const tabsParam = searchParams.get("tabs");
  const tabLabels = tabsParam
    ? tabsParam
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : null;

  let query = supabase
    .from("stock_products")
    .select("tab_label, category, product, code, cellar_code, supplier, quantity, delisted, sort_order")
    .not("quantity", "is", null)
    .gt("quantity", 0)
    .order("tab_label")
    .order("sort_order");
  if (tabLabels && tabLabels.length > 0) {
    query = query.in("tab_label", tabLabels);
  }
  const { data: products, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type ReportRow = {
    tab: string;
    category: string;
    product: string;
    code: string;
    cellarCode: string;
    supplier: string;
    quantity: string;
  };
  const rows: ReportRow[] = (products ?? []).map((p) => ({
    tab: p.tab_label,
    category: p.category,
    product: p.product + (p.delisted ? " (DELISTED)" : ""),
    code: p.code ?? "",
    cellarCode: p.cellar_code ?? "",
    supplier: p.supplier ?? "",
    quantity: String(p.quantity),
  }));

  const today = new Date().toISOString().slice(0, 10);

  if (format === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Stock Order");
    sheet.columns = [
      { header: "Tab", key: "tab", width: 16 },
      { header: "Category", key: "category", width: 18 },
      { header: "Product", key: "product", width: 42 },
      { header: "Code", key: "code", width: 12 },
      { header: "Cellar Code", key: "cellarCode", width: 14 },
      { header: "Supplier", key: "supplier", width: 20 },
      { header: "Qty", key: "quantity", width: 8 },
    ];
    sheet.getRow(1).font = { bold: true };
    rows.forEach((r) => sheet.addRow(r));
    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="stock-order-${today}.xlsx"`,
      },
    });
  }

  // PDF
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const donePromise = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  doc.fontSize(16).fillColor("#000").text("Stock Order");
  doc.fontSize(10).fillColor("#555").text(`Snapshot taken ${today}`);
  doc.moveDown(1);

  const columns = [
    { key: "tab" as const, label: "Tab", width: 60 },
    { key: "category" as const, label: "Category", width: 70 },
    { key: "product" as const, label: "Product", width: 180 },
    { key: "code" as const, label: "Code", width: 45 },
    { key: "supplier" as const, label: "Supplier", width: 75 },
    { key: "quantity" as const, label: "Qty", width: 35 },
  ];
  const rowPadding = 6;
  const headerRowHeight = 16;

  let y = doc.y;
  const drawHeader = () => {
    let x = doc.page.margins.left;
    doc.fontSize(9).fillColor("#000");
    for (const c of columns) {
      doc.text(c.label, x, y, { width: c.width, lineBreak: false });
      x += c.width;
    }
    y += headerRowHeight;
    doc
      .moveTo(doc.page.margins.left, y)
      .lineTo(doc.page.width - doc.page.margins.right, y)
      .strokeColor("#999")
      .stroke();
    y += 4;
  };
  drawHeader();

  doc.fontSize(8);
  for (const r of rows) {
    const rowHeight =
      Math.max(...columns.map((c) => doc.heightOfString(r[c.key], { width: c.width }))) + rowPadding;

    if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = doc.page.margins.top;
      drawHeader();
      doc.fontSize(8);
    }

    let x = doc.page.margins.left;
    doc.fillColor("#000");
    for (const c of columns) {
      doc.text(r[c.key], x, y, { width: c.width });
      x += c.width;
    }
    y += rowHeight;
  }

  if (rows.length === 0) {
    doc.fontSize(10).fillColor("#555").text("Nothing has a quantity set right now.");
  }

  doc.end();
  const buffer = await donePromise;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="stock-order-${today}.pdf"`,
    },
  });
}
