// One-off loader: pushes the extracted prototype content (scripts/seed-data/,
// scripts/seed-assets/) into a real Supabase project. Run once after the
// schema migration (supabase/migrations/0001_init.sql) has been applied.
//
// Usage: node scripts/seed-db.mjs
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, either in
// the environment or in .env.local next to this script's project root.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DATA = path.join(__dirname, "seed-data");
const ASSETS = path.join(__dirname, "seed-assets");
const BUCKET = "attachments";

function loadEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = /^\s*([\w.-]+)\s*=\s*(.*)?\s*$/.exec(line);
    if (!match) continue;
    const [, key, value = ""] = match;
    if (!(key in process.env)) process.env[key] = value.replace(/^["']|["']$/g, "");
  }
}
loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — set them in .env.local first."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA, name + ".json"), "utf8"));
}

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  if (buckets?.some((b) => b.name === BUCKET)) {
    console.log(`bucket "${BUCKET}" already exists`);
    return;
  }
  const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
  if (error) throw error;
  console.log(`created public bucket "${BUCKET}"`);
}

const CONTENT_TYPE_BY_EXT = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

async function uploadAsset(localPath, storagePath) {
  const buffer = fs.readFileSync(localPath);
  const ext = path.extname(storagePath).toLowerCase();
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    upsert: true,
    contentType: CONTENT_TYPE_BY_EXT[ext] ?? "application/octet-stream",
  });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

async function seedChecklists() {
  const checklists = readJson("checklists");
  for (let ci = 0; ci < checklists.length; ci++) {
    const list = checklists[ci];
    const { data: inserted, error } = await supabase
      .from("checklists")
      .insert({ title: list.title, sort_order: ci })
      .select()
      .single();
    if (error) throw error;
    const items = list.items.map((item, ii) => ({
      checklist_id: inserted.id,
      text: item.text,
      sort_order: ii,
    }));
    const { error: itemsError } = await supabase.from("checklist_items").insert(items);
    if (itemsError) throw itemsError;
  }
  console.log(`seeded ${checklists.length} checklists`);
}

async function seedSops() {
  const sops = readJson("sops");
  for (let i = 0; i < sops.length; i++) {
    const sop = sops[i];
    let photo_url = null;
    if (sop.imageFile) {
      photo_url = await uploadAsset(
        path.join(ASSETS, "sop-images", sop.imageFile),
        `sops/${sop.imageFile}`
      );
    }
    const { error } = await supabase.from("sops").insert({
      category: sop.category,
      title: sop.title,
      steps: sop.steps,
      photo_url,
      sort_order: i,
    });
    if (error) throw error;
  }
  console.log(`seeded ${sops.length} SOPs`);
}

async function seedCocktails() {
  const cocktails = readJson("cocktails");
  const rows = cocktails.map((c, i) => ({
    name: c.name,
    category: c.category,
    glass_shape: c.shape,
    colour: c.color,
    garnish: c.garnish,
    ingredients: c.ingredients,
    method: c.method,
    sort_order: i,
  }));
  const { error } = await supabase.from("cocktails").insert(rows);
  if (error) throw error;
  console.log(`seeded ${rows.length} cocktails`);
}

async function seedWines() {
  const wines = readJson("wines");
  const rows = wines.map((w, i) => ({
    section: w.section,
    name: w.name,
    region: w.region,
    vintage: w.vintage,
    price: w.price,
    glass_note: w.glass,
    tasting_note: w.desc,
    sort_order: i,
  }));
  const { error } = await supabase.from("wines").insert(rows);
  if (error) throw error;
  console.log(`seeded ${rows.length} wines`);
}

async function seedFunctionSheets() {
  const sheets = readJson("function_sheets");
  for (const sheet of sheets) {
    let file_url = null;
    if (sheet.assetFile) {
      file_url = await uploadAsset(
        path.join(ASSETS, "function-sheets", sheet.assetFile),
        `function-sheets/${sheet.assetFile}`
      );
    }
    if (!file_url) continue;
    const { error } = await supabase.from("function_sheets").insert({
      title: sheet.title,
      file_url,
      file_name: sheet.filename,
    });
    if (error) throw error;
  }
  console.log(`seeded ${sheets.length} function sheets`);
}

async function seedCoversAndEvents() {
  const weekDates = readJson("week_dates");
  const dailyCovers = readJson("daily_covers");
  const dailyEvents = readJson("daily_events");

  const covers = weekDates.map((d, i) => ({
    date: d.date,
    gih_count: dailyCovers[i]?.gih ?? null,
    breakfast_count: dailyCovers[i]?.breakfast ?? null,
  }));
  const { error: coversError } = await supabase.from("daily_covers").upsert(covers);
  if (coversError) throw coversError;

  const events = weekDates.flatMap((d, i) =>
    (dailyEvents[i] ?? []).map((e) => ({
      date: d.date,
      room: e.room,
      title: e.title,
      details: e.details,
    }))
  );
  if (events.length) {
    const { error: eventsError } = await supabase.from("daily_events").insert(events);
    if (eventsError) throw eventsError;
  }
  console.log(`seeded covers/events for ${weekDates.length} days`);
}

async function clearExisting() {
  // Makes the script safe to re-run (e.g. after a mid-run failure) without
  // duplicating rows. Only touches tables this script owns — never touches
  // profiles, posts, todos, nominations, or anything a real user created.
  for (const table of [
    "checklist_items",
    "checklists",
    "sops",
    "cocktails",
    "wines",
    "function_sheets",
    "daily_events",
  ]) {
    const { error } = await supabase.from(table).delete().gte("id", 0);
    if (error) throw error;
  }
  await supabase.from("daily_covers").delete().neq("date", "1900-01-01");
  console.log("cleared previously seeded rows");
}

async function main() {
  await ensureBucket();
  await clearExisting();
  await seedChecklists();
  await seedSops();
  await seedCocktails();
  await seedWines();
  await seedFunctionSheets();
  await seedCoversAndEvents();
  console.log("\nDone. Staff accounts, rota shifts, posts and nominations are NOT seeded —");
  console.log("invite real staff via /admin/staff, then fill in the rota from the app.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
