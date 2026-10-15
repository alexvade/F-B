// Reads cell background colours straight from the Google Sheets API — the
// CSV export used elsewhere for the rota sync is plain text, with no
// formatting, so colour-coded shifts need this separate call. Needs a
// Sheets-API-enabled Google Cloud API key (GOOGLE_SHEETS_API_KEY); the
// sheet itself still just needs to be "anyone with the link can view", same
// as the CSV export (see docs/rota-sheet-sync.md).

type RgbColor = { red?: number; green?: number; blue?: number };

function quoteSheetName(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
}

function toHex(channel: number | undefined): string {
  const v = Math.round((channel ?? 0) * 255);
  return Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0");
}

function rgbToHex(color: RgbColor | undefined): string | null {
  if (!color) return null;
  const r = color.red ?? 0;
  const g = color.green ?? 0;
  const b = color.blue ?? 0;
  // Near-white is "no colour-coding" on a cell, not a deliberate highlight —
  // skip it so un-painted shifts don't get a faint tint applied.
  if (r > 0.95 && g > 0.95 && b > 0.95) return null;
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Fetches the background colour of every cell in one tab, as a grid aligned
 * row-for-row and column-for-column with that same tab's CSV export. Returns
 * null (rather than throwing) if the API key is missing or the call fails —
 * callers should treat that as "no colour data this time" and carry on with
 * the plain CSV-based sync.
 */
export async function fetchRotaColorGrid(
  sheetId: string,
  gid: number | string
): Promise<(string | null)[][] | null> {
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  if (!apiKey) return null;

  try {
    // 1) Cheap metadata-only call to resolve the tab's title from its gid —
    // the data call below needs a `ranges=<title>` param, not a gid.
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?key=${apiKey}&fields=sheets.properties(sheetId,title)`
    );
    if (!metaRes.ok) return null;
    const meta = await metaRes.json();
    const sheetMeta = (meta.sheets ?? []).find(
      (s: { properties?: { sheetId?: number } }) => String(s.properties?.sheetId) === String(gid)
    );
    const title = sheetMeta?.properties?.title;
    if (!title) return null;

    // 2) The actual formatting data, scoped to just that one tab.
    const range = encodeURIComponent(quoteSheetName(title));
    const dataRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?key=${apiKey}&ranges=${range}&fields=sheets.data.rowData.values.userEnteredFormat.backgroundColor`
    );
    if (!dataRes.ok) return null;
    const data = await dataRes.json();
    const rowData = data.sheets?.[0]?.data?.[0]?.rowData ?? [];

    return rowData.map((row: { values?: { userEnteredFormat?: { backgroundColor?: RgbColor } }[] }) =>
      (row.values ?? []).map((cell) => rgbToHex(cell.userEnteredFormat?.backgroundColor))
    );
  } catch {
    return null;
  }
}
