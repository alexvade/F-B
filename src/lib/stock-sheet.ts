import { parseCsv } from "./csv";

export type ParsedStockProduct = {
  rowNumber: number; // 1-indexed actual row in the Google Sheet
  category: string;
  code: string | null;
  product: string;
  cellarCode: string | null;
  supplier: string | null;
};

export type ParsedStockSheet = {
  orderColLetter: string;
  products: ParsedStockProduct[];
};

function colLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

/**
 * Parses one tab of the Stock Orders sheet. Handles both layouts seen in
 * practice: the simple `Code, Product, To order:` tabs (Beer Cellar,
 * Miscellaneous) and the richer `PW CODE, PRODUCT, CELLAR CODE, SUPPLIER,
 * To Order:` tab (Wine Cellar), which also repeats its header row once per
 * producer group — those repeats are detected and skipped.
 */
function isHeaderRow(row: string[]): boolean {
  const lower = row.map((c) => c.toLowerCase());
  return lower.some((c) => c.includes("product")) && lower.some((c) => c.includes("order"));
}

export function parseStockSheet(csvText: string): ParsedStockSheet {
  const rows = parseCsv(csvText).map((r) => r.map((c) => c.trim()));
  if (rows.length === 0) {
    return { orderColLetter: "C", products: [] };
  }

  // The header isn't always row 1 — Wine Cellar leads with a producer label
  // row before its first "PW CODE, PRODUCT, ..." header. Find it wherever
  // it is; any row before it that looks like a category label still counts.
  const headerRowIdx = rows.findIndex(isHeaderRow);
  if (headerRowIdx === -1) {
    throw new Error('Could not find a header row with "Product" and "To order" columns.');
  }

  let category = "";
  for (let r = 0; r < headerRowIdx; r++) {
    const label = rows[r].find((c) => c)?.trim();
    if (label) category = label;
  }

  const header = rows[headerRowIdx].map((h) => h.toLowerCase());
  const codeCol = 0;
  const productCol = header.findIndex((h) => h.includes("product"));
  const orderCol = header.findIndex((h) => h.includes("order"));
  const cellarCodeCol = header.findIndex((h) => h.includes("cellar"));
  const supplierCol = header.findIndex((h) => h.includes("supplier"));

  const products: ParsedStockProduct[] = [];

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    const allBlank = row.every((c) => !c);
    if (allBlank) continue;

    const productVal = row[productCol] ?? "";
    if (productVal.toLowerCase().replace(/\s+/g, " ").trim() === "product") {
      continue; // repeated header row (Wine Cellar repeats it per producer)
    }

    if (!productVal) {
      // Category / producer label row — first non-empty cell is the label.
      const label = row.find((c) => c)?.trim();
      if (label) category = label;
      continue;
    }

    products.push({
      rowNumber: r + 1,
      category,
      code: row[codeCol]?.trim() || null,
      product: productVal,
      cellarCode: cellarCodeCol >= 0 ? row[cellarCodeCol]?.trim() || null : null,
      supplier: supplierCol >= 0 ? row[supplierCol]?.trim() || null : null,
    });
  }

  return { orderColLetter: colLetter(orderCol), products };
}
