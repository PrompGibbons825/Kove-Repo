import { createClient } from "@supabase/supabase-js";

/**
 * Supabase service-role client — bypasses RLS.
 * Only use in server-side webhook handlers and background jobs.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
