// One-off migration script: pulls the prototype's hardcoded data + embedded
// base64 assets out of team-ops-prototype.jsx into real files this repo can
// seed a Supabase project from. Not part of the shipped app.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROTOTYPE_PATH =
  process.argv[2] || "C:\\Users\\alexv\\Downloads\\team-ops-prototype.jsx";
const OUT_DATA = path.join(__dirname, "seed-data");
const OUT_ASSETS = path.join(__dirname, "seed-assets");
const OUT_FONTS = path.join(__dirname, "..", "public", "fonts");

const src = fs.readFileSync(PROTOTYPE_PATH, "utf8");
const lines = src.split("\n");

// The data-only region: from the design-tokens comment (after the lucide
// import block) through the end of the SOPS array, right before the first
// JSX-bearing component (`function CocktailGlass`).
const startIdx = lines.findIndex((l) => l.includes("// ---- Design tokens ----"));
const endIdx = lines.findIndex((l) => l.trim().startsWith("function CocktailGlass"));
if (startIdx === -1 || endIdx === -1) {
  throw new Error("Could not locate data region markers in prototype file — did it change shape?");
}
const dataBlock = lines.slice(startIdx, endIdx).join("\n");

const EXPORT_NAMES = [
  "AVENIR_FONT_FACE",
  "INITIAL_POSTS",
  "INITIAL_ROTA",
  "INITIAL_CHECKLISTS",
  "EVENTS_TODAY",
  "DAY_KEYS",
  "WEEK_DATES",
  "DAILY_COVERS",
  "DAILY_EVENTS",
  "STAFF_ROTA",
  "WINE_SECTIONS",
  "WINES",
  "FUNCTION_SHEETS",
  "COCKTAILS",
  "INITIAL_NOMINATIONS",
  "SOPS",
];

const cjsPath = path.join(__dirname, "._extracted-data.cjs");
fs.writeFileSync(
  cjsPath,
  dataBlock + "\nmodule.exports = { " + EXPORT_NAMES.join(", ") + " };\n"
);

const data = (await import("file://" + cjsPath.replace(/\\/g, "/"))).default;
fs.unlinkSync(cjsPath);

fs.mkdirSync(OUT_DATA, { recursive: true });
fs.mkdirSync(path.join(OUT_ASSETS, "sop-images"), { recursive: true });
fs.mkdirSync(path.join(OUT_ASSETS, "function-sheets"), { recursive: true });
fs.mkdirSync(OUT_FONTS, { recursive: true });

function writeJson(name, value) {
  fs.writeFileSync(
    path.join(OUT_DATA, name + ".json"),
    JSON.stringify(value, null, 2)
  );
  console.log(`wrote seed-data/${name}.json`);
}

function decodeDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!match) return null;
  return { mime: match[1], buffer: Buffer.from(match[2], "base64") };
}

const EXT_BY_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
};

// --- Font ---
const fontMatch = /url\(data:(font\/[^;]+);base64,([^)]+)\)/s.exec(
  data.AVENIR_FONT_FACE
);
if (fontMatch) {
  const [, mime, b64] = fontMatch;
  const ext = mime.split("/")[1] || "woff";
  const fontFile = path.join(OUT_FONTS, `avenir-light.${ext}`);
  fs.writeFileSync(fontFile, Buffer.from(b64, "base64"));
  console.log(`wrote public/fonts/avenir-light.${ext} (${mime})`);
} else {
  console.warn("Could not find embedded font data in AVENIR_FONT_FACE — check manually.");
}

// --- SOPs (extract images, keep text) ---
const sopsOut = data.SOPS.map((sop) => {
  const { image, ...rest } = sop;
  let imageFile = null;
  if (image) {
    const decoded = decodeDataUrl(image);
    if (decoded) {
      const ext = EXT_BY_MIME[decoded.mime] || "bin";
      imageFile = `sop-${sop.id}.${ext}`;
      fs.writeFileSync(
        path.join(OUT_ASSETS, "sop-images", imageFile),
        decoded.buffer
      );
    }
  }
  return { ...rest, imageFile };
});
writeJson("sops", sopsOut);
console.log(`extracted ${sopsOut.filter((s) => s.imageFile).length} SOP images`);

// --- Function sheets (extract PDFs, keep title/filename) ---
const sheetsOut = data.FUNCTION_SHEETS.map((sheet) => {
  const { data: pdfDataUrl, ...rest } = sheet;
  let assetFile = null;
  const decoded = pdfDataUrl ? decodeDataUrl(pdfDataUrl) : null;
  if (decoded) {
    assetFile = `sheet-${sheet.id}.pdf`;
    fs.writeFileSync(
      path.join(OUT_ASSETS, "function-sheets", assetFile),
      decoded.buffer
    );
  }
  return { ...rest, assetFile };
});
writeJson("function_sheets", sheetsOut);
console.log(`extracted ${sheetsOut.filter((s) => s.assetFile).length} function sheet PDFs`);

// --- Everything else: plain JSON, no embedded assets ---
writeJson("checklists", data.INITIAL_CHECKLISTS);
writeJson("staff_rota", data.STAFF_ROTA);
writeJson("day_keys", data.DAY_KEYS);
writeJson("week_dates", data.WEEK_DATES);
writeJson("daily_covers", data.DAILY_COVERS);
writeJson("daily_events", data.DAILY_EVENTS);
writeJson("wine_sections", data.WINE_SECTIONS);
writeJson("wines", data.WINES);
writeJson("cocktails", data.COCKTAILS);
writeJson("nominations", data.INITIAL_NOMINATIONS);
writeJson("posts", data.INITIAL_POSTS);
writeJson("events_today", data.EVENTS_TODAY);

console.log("\nDone. Seed data is in scripts/seed-data/, binary assets in scripts/seed-assets/ and public/fonts/.");
