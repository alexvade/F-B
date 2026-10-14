// Imports the "WHH Daily Overview" spreadsheet the hotel emails out each
// day into daily_covers — today's figures (row 3 of the "WHH Briefing
// Sheet" tab) plus the "NEXT SEVEN DAYS" table (rows 20-26).
//
// For a one-off file, run this directly, pointed at wherever it's saved.
// The scheduled Gmail routine uses a separate path instead (see
// scripts/parse-daily-overview.mjs) that never touches the service-role
// key — only this manual script does.
//
// Usage: node scripts/import-daily-overview.mjs "C:/path/to/WHH Daily Overview DD.MM.YY.xlsx"
import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import { parseDailyOverview } from "./lib/daily-overview-parser.mjs";

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

const run = async () => {
  const rows = await parseDailyOverview(filePath);
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
