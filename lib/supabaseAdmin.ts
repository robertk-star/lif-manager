import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.warn(
    "[supabaseAdmin] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
  );
}

/**
 * Server-only Supabase client with service role key.
 * Never import this in client components.
 */
export const supabaseAdmin = createClient(
  supabaseUrl ?? "",
  serviceRoleKey ?? "",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
