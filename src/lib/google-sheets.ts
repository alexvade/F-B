import { JWT } from "google-auth-library";

function getClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !rawKey) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY are not configured"
    );
  }
  return new JWT({
    email,
    key: rawKey.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

/** Writes a single value into one cell, e.g. writeSheetCell(id, "Beer Cellar", "C5", 2). */
export async function writeSheetCell(
  spreadsheetId: string,
  tabLabel: string,
  cellRef: string,
  value: string | number
) {
  const client = getClient();
  const token = await client.getAccessToken();
  const range = `'${tabLabel.replace(/'/g, "''")}'!${cellRef}`;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      range
    )}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: [[value]] }),
    }
  );
  if (!res.ok) {
    throw new Error(`Google Sheets write failed (${res.status}): ${await res.text()}`);
  }
}
