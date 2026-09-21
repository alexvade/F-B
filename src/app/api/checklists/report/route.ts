import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { createClient } from "@/lib/supabase/server";

type ReportRow = {
  date: string;
  section: string;
  checklist: string;
  item: string;
  completedBy: string;
  completedAt: string;
};

function formatDay(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
}

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
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const format = searchParams.get("format");
  if (!from || !to || (format !== "xlsx" && format !== "pdf")) {
    return NextResponse.json({ error: "Missing or invalid from/to/format" }, { status: 400 });
  }

  const { data: completions, error } = await supabase
    .from("checklist_completions")
    .select("item_id, checklist_day, completed_by, completed_at")
    .gte("checklist_day", from)
    .lte("checklist_day", to)
    .order("checklist_day");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const itemIds = Array.from(new Set((completions ?? []).map((c) => c.item_id)));
  const completerIds = Array.from(
    new Set((completions ?? []).map((c) => c.completed_by).filter(Boolean))
  ) as string[];

  const [{ data: items }, { data: profiles }] = await Promise.all([
    itemIds.length
      ? supabase.from("checklist_items").select("id, checklist_id, text").in("id", itemIds)
      : Promise.resolve({ data: [] as { id: number; checklist_id: number; text: string }[] }),
    completerIds.length
      ? supabase.from("profiles").select("id, name").in("id", completerIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const checklistIds = Array.from(new Set((items ?? []).map((i) => i.checklist_id)));
  const { data: checklists } = checklistIds.length
    ? await supabase.from("checklists").select("id, title, section").in("id", checklistIds)
    : { data: [] as { id: number; title: string; section: string }[] };

  const itemById = new Map((items ?? []).map((i) => [i.id, i]));
  const checklistById = new Map((checklists ?? []).map((c) => [c.id, c]));
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]));

  const sortedCompletions = [...(completions ?? [])].sort((a, b) =>
    (a.checklist_day + a.completed_at).localeCompare(b.checklist_day + b.completed_at)
  );
  const rows: ReportRow[] = sortedCompletions.map((c) => {
    const item = itemById.get(c.item_id);
    const checklist = item ? checklistById.get(item.checklist_id) : undefined;
    return {
      date: formatDay(c.checklist_day),
      section: checklist?.section ?? "—",
      checklist: checklist?.title ?? "—",
      item: item?.text ?? "—",
      completedBy: (c.completed_by && nameById.get(c.completed_by)) || "Someone",
      completedAt: formatTimestamp(c.completed_at),
    };
  });

  const filenameRange = `${from}_to_${to}`;

  if (format === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Checklist Completions");
    sheet.columns = [
      { header: "Date", key: "date", width: 14 },
      { header: "Section", key: "section", width: 16 },
      { header: "Checklist", key: "checklist", width: 26 },
      { header: "Item", key: "item", width: 44 },
      { header: "Completed By", key: "completedBy", width: 20 },
      { header: "Completed At", key: "completedAt", width: 22 },
    ];
    sheet.getRow(1).font = { bold: true };
    rows.forEach((r) => sheet.addRow(r));
    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="checklist-report-${filenameRange}.xlsx"`,
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

  doc.fontSize(16).fillColor("#000").text("Checklist Completion Report");
  doc.fontSize(10).fillColor("#555").text(`${formatDay(from)} – ${formatDay(to)}`);
  doc.moveDown(1);

  const columns = [
    { key: "date" as const, label: "Date", width: 60 },
    { key: "section" as const, label: "Section", width: 60 },
    { key: "checklist" as const, label: "Checklist", width: 90 },
    { key: "item" as const, label: "Item", width: 165 },
    { key: "completedBy" as const, label: "By", width: 60 },
    { key: "completedAt" as const, label: "Completed At", width: 80 },
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
    doc.fontSize(10).fillColor("#555").text("No completions in this period.");
  }

  doc.end();
  const buffer = await donePromise;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="checklist-report-${filenameRange}.pdf"`,
    },
  });
}
