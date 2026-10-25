import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Canonical Supabase V2 production endpoint
const V2_SUPABASE_URL = "https://iwszvepliiqwaoetgaub.supabase.co";

// Server-only fallback service role key for trusted serverless functions
// Allows server-side RPC execution even if environment variables are not injected into hosting provider
const SERVER_SERVICE_ROLE_FALLBACK =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3c3p2ZXBsaWlxd2FvZXRnYXViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjY4Mjk4MCwiZXhwIjoyMTA4MjU4OTgwfQ.LWLkmxoE1G7MXOIUbV4EUUIUOdDTP6L66rgLyY6Is5Q";

let cachedServiceClient: SupabaseClient | null = null;

/**
 * Returns a trusted server-side Supabase client authenticated as service_role.
 * Throws immediately if invoked in browser or client-side runtime.
 */
export function getServiceRoleClient(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error("SECURITY VIOLATION: getServiceRoleClient invoked in client-side browser runtime!");
  }

  if (cachedServiceClient) return cachedServiceClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || V2_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || SERVER_SERVICE_ROLE_FALLBACK;

  cachedServiceClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedServiceClient;
}
