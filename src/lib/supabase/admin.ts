import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Service-role client — server-only (route handlers / server actions).
// NEVER import this from a Client Component or expose SUPABASE_SERVICE_ROLE_KEY
// via NEXT_PUBLIC_*. Used for admin operations like inviting staff by email.
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
