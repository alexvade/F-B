// One-off: creates the very first admin account by inviting directly with
// the service-role key, since the in-app invite flow (src/app/api/admin/
// invite-staff) requires an existing admin to call it. Not needed again
// once at least one admin exists — use /admin/staff after that.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

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

const [, , email, name, contractHours] = process.argv;
if (!email || !name) {
  console.error("Usage: node scripts/bootstrap-admin.mjs <email> <name> [contract_hours]");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
  data: {
    name,
    role: "admin",
    contract_hours: contractHours ? Number(contractHours) : null,
  },
  redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback`,
});

if (error) {
  console.error(error);
  process.exit(1);
}
console.log(`Invited ${email} as admin (user id ${data.user.id}). Check that inbox for the invite email.`);
