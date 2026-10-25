import { DatabaseAdapter } from "./types";
import { localDbAdapter } from "./local-adapter";
import { SupabaseDatabaseAdapter } from "./supabase-adapter";
import { PRIMARY_TENANT_ID } from "./seed-data";

export * from "./types";
export { PRIMARY_TENANT_ID };

export const SUPABASE_DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";

let cachedAdapter: DatabaseAdapter | null = null;

export function getDatabaseAdapter(): DatabaseAdapter {
  if (cachedAdapter) return cachedAdapter;

  const mode = process.env.DATA_ADAPTER?.toLowerCase().trim();
  const isProduction = process.env.NODE_ENV === "production";

  // Production safeguard: Never silently fall back to mock data in production
  if (isProduction && mode !== "supabase") {
    throw new Error(
      "Server Configuration Error: Production environment requires DATA_ADAPTER=supabase. Mock data fallback is disabled in production."
    );
  }

  if (mode === "supabase") {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        "Server Configuration Error: Missing required Supabase credentials (NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY)."
      );
    }

    cachedAdapter = new SupabaseDatabaseAdapter();
  } else {
    cachedAdapter = localDbAdapter;
  }

  return cachedAdapter;
}

export function isLocalAdapter(): boolean {
  try {
    const adapter = getDatabaseAdapter();
    return adapter.adapterName === "local";
  } catch {
    return false;
  }
}

export function getDefaultTenantId(): string {
  const mode = process.env.DATA_ADAPTER?.toLowerCase().trim();
  if (mode === "supabase") {
    const envVal = process.env.DEFAULT_TENANT_ID?.trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(envVal || "");
    if (isUuid && envVal) return envVal;
    return SUPABASE_DEFAULT_TENANT_ID;
  }
  return process.env.DEFAULT_TENANT_ID || PRIMARY_TENANT_ID;
}
