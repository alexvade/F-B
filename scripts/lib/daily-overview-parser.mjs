// Shared parsing logic for the "WHH Daily Overview" spreadsheet, used by
// both the local manual-import script and the CI parse-only script (see
// scripts/import-daily-overview.mjs and scripts/parse-daily-overview.mjs).
import ExcelJS from "exceljs";

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

export async function parseDailyOverview(filePath) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  // Some exports of this report give every tab a name wrapped in literal
  // quote characters (e.g. `"WHH Briefing Sheet"` as the actual .name, not
  // just `WHH Briefing Sheet`) — strip them before matching.
  const sheet = wb.worksheets.find((s) => s.name.replace(/^"|"$/g, "") === "WHH Briefing Sheet");
  if (!sheet) throw new Error('No "WHH Briefing Sheet" tab found in that file.');

  const rows = [];
  const importedAt = new Date().toISOString();

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
      updated_at: importedAt,
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
      updated_at: importedAt,
    });
  }

  return rows;
}
