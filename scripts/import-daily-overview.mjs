// Imports the "WHH Daily Overview" spreadsheet the hotel emails out each
// day into daily_covers — today's figures (row 3 of the "WHH Briefing
// Sheet" tab) plus the "NEXT SEVEN DAYS" table (rows 20-26). There's no
// live sync for this one, it's a manual hand-off: run this again each time
// a new copy of the spreadsheet comes in, pointed at wherever it's saved.
//
// Usage: node scripts/import-daily-overview.mjs "C:/path/to/WHH Daily Overview DD.MM.YY.xlsx"
import ExcelJS from "exceljs";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node scripts/import-daily-overview.mjs <path-to-xlsx>");
  process.exit(1);
}

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// A formula cell's .value comes back as { formula, result } (or
// { sharedFormula, result } for a shared-formula cell) rather than the
// plain value — unwrap either shape.
const val = (v) => (v && typeof v === "object" && "result" in v ? v.result : v);

const toISODate = (v) => {
  const resolved = val(v);
  if (!resolved) return null;
  const d = resolved instanceof Date ? resolved : new Date(resolved);
  if (Number.isNaN(d.getTime()) || d.getUTCFullYear() < 2000) return null;
  return d.toISOString().slice(0, 10);
};

const toInt = (v) => {
  const resolved = val(v);
  return resolved === null || resolved === undefined || resolved === "" ? null : Math.round(Number(resolved));
};

const run = async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  // Some exports of this report give every tab a name wrapped in literal
  // quote characters (e.g. `"WHH Briefing Sheet"` as the actual .name, not
  // just `WHH Briefing Sheet`) — strip them before matching.
  const sheet = wb.worksheets.find((s) => s.name.replace(/^"|"$/g, "") === "WHH Briefing Sheet");
  if (!sheet) throw new Error('No "WHH Briefing Sheet" tab found in that file.');

  const rows = [];

  // Row 1 col B: the report's "as of" date. Row 3: today's figures — note
  // this row has no Breakfast Covers column (that only appears in the
  // forward-looking table below), so breakfast_count stays null for today.
  const reportDate = toISODate(sheet.getRow(1).getCell(2).value);
  const todayRow = sheet.getRow(3);
  if (reportDate) {
    rows.push({
      date: reportDate,
      rooms_in_house: toInt(todayRow.getCell(1).value),
      gih_count: toInt(todayRow.getCell(2).value),
      arrival_rooms: toInt(todayRow.getCell(3).value),
      departure_rooms: toInt(todayRow.getCell(4).value),
      afternoon_tea: toInt(todayRow.getCell(5).value),
      dinner_covers: toInt(todayRow.getCell(6).value),
      confirmed_events: toInt(todayRow.getCell(7).value),
      non_resident_dinners: toInt(todayRow.getCell(8).value),
      floaters: toInt(todayRow.getCell(9).value),
    });
  }

  // "NEXT SEVEN DAYS" table — header at row 19, up to 7 data rows below it.
  // A blank/unfilled day (no valid date) is skipped rather than upserted.
  for (let r = 20; r <= 26; r++) {
    const row = sheet.getRow(r);
    const date = toISODate(row.getCell(1).value);
    if (!date) continue;
    rows.push({
      date,
      rooms_in_house: toInt(row.getCell(2).value),
      gih_count: toInt(row.getCell(3).value),
      breakfast_count: toInt(row.getCell(4).value),
      afternoon_tea: toInt(row.getCell(5).value),
      dinner_covers: toInt(row.getCell(6).value),
      confirmed_events: toInt(row.getCell(7).value),
      non_resident_dinners: toInt(row.getCell(8).value),
      floaters: toInt(row.getCell(9).value),
    });
  }

  if (rows.length === 0) {
    console.log("Nothing to import — no dated rows found in that file.");
    return;
  }

  const { error } = await supabase.from("daily_covers").upsert(rows, { onConflict: "date" });
  if (error) {
    console.error("Upsert failed:", error.message);
    process.exit(1);
  }
  console.log(`Imported ${rows.length} day(s): ${rows.map((r) => r.date).join(", ")}`);
};

run();
