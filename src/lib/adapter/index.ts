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

  if (mode === "supabase") {
    cachedAdapter = new SupabaseDatabaseAdapter();
  } else {
    cachedAdapter = localDbAdapter;
  }

  return cachedAdapter;
}

export function isLocalAdapter(): boolean {
  const adapter = getDatabaseAdapter();
  return adapter.adapterName === "local";
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
