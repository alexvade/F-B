// CI-only counterpart to import-daily-overview.mjs: parses the spreadsheet
// and prints the rows as JSON, but never touches Supabase or any
// credential. Used by .github/workflows/daily-overview-import.yml, which
// pipes this script's output to a POST against the scoped
// /api/daily-overview/import route instead — that route holds the real
// (service-role) credentials; this script and the workflow that runs it
// never do.
//
// Usage: node scripts/parse-daily-overview.mjs "path/to/WHH Daily Overview DD.MM.YY.xlsx"
import { parseDailyOverview } from "./lib/daily-overview-parser.mjs";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node scripts/parse-daily-overview.mjs <path-to-xlsx>");
  process.exit(1);
}

const rows = await parseDailyOverview(filePath);
process.stdout.write(JSON.stringify({ rows }));
