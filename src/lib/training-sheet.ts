import { parseCsv } from "./csv";

export type ParsedTrainingRecord = {
  learner_name: string;
  identifier: string | null;
  email: string | null;
  employment_start_date: string | null;
  compliance_item_name: string;
  compliance_item_type: string | null;
  status: string;
  due_date: string | null;
  allocation_date: string | null;
  allocated_by: string | null;
  collection_name: string | null;
  department: string | null;
  completed_date: string | null;
  job_title: string | null;
};

function toIsoDate(ddmmyyyy: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(ddmmyyyy.trim());
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

// "Mctague, Amelia" -> "Amelia Mctague" — matches how names read everywhere
// else in the app, rather than the export's ledger-style ordering.
function toDisplayName(learnerName: string): string {
  const i = learnerName.indexOf(",");
  if (i === -1) return learnerName.trim();
  const last = learnerName.slice(0, i).trim();
  const first = learnerName.slice(i + 1).trim();
  return `${first} ${last}`.trim();
}

const REQUIRED_HEADERS = ["Learner Name", "Compliance Item Name", "Status"];

/** Parses a training/compliance export CSV (e.g. from the LMS) into structured rows. */
export function parseTrainingSheet(csvText: string): ParsedTrainingRecord[] {
  const rows = parseCsv(csvText).filter((r) => r.some((c) => c.trim() !== ""));
  if (rows.length < 2) throw new Error("The file doesn't have any data rows.");

  const headers = rows[0].map((h) => h.trim());
  const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    throw new Error(`Missing expected column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`);
  }
  const col = (name: string) => headers.indexOf(name);
  const get = (row: string[], name: string) => {
    const i = col(name);
    return i === -1 ? "" : (row[i] ?? "").trim();
  };

  return rows.slice(1).map((row) => {
    const learnerName = get(row, "Learner Name");
    return {
      learner_name: toDisplayName(learnerName),
      identifier: get(row, "Identifier") || null,
      email: get(row, "Email address") || null,
      employment_start_date: toIsoDate(get(row, "Employment Start Date")),
      compliance_item_name: get(row, "Compliance Item Name"),
      compliance_item_type: get(row, "Compliance Item Type") || null,
      status: get(row, "Status") || "Unknown",
      due_date: toIsoDate(get(row, "Due Date")),
      allocation_date: toIsoDate(get(row, "Allocation Date")),
      allocated_by: get(row, "Allocated By") || null,
      collection_name: get(row, "Collection Name") || null,
      department: get(row, "Department") || null,
      completed_date: toIsoDate(get(row, "Completed Date")),
      job_title: get(row, "Job Title") || null,
    };
  });
}
