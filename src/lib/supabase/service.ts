import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

// Service-role client for server-only, non-user contexts (e.g. cron jobs) where
// there is no authenticated session to derive RLS from. Never import this into
// anything reachable from the browser.
export function createServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY belum diisi di environment.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
