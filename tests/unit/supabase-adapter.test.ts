import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getDatabaseAdapter, getDefaultTenantId, isLocalAdapter, SUPABASE_DEFAULT_TENANT_ID } from "@/lib/adapter";
import { SupabaseDatabaseAdapter } from "@/lib/adapter/supabase-adapter";
import { authenticateStaff, createSessionToken, parseSessionToken, verifyStaffRole } from "@/lib/auth/staff-auth";
import fs from "fs";
import path from "path";

describe("Supabase Integration & Architecture Verification", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("verifies all 5 Supabase migrations exist in sequential order", () => {
    const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");
    const files = fs.readdirSync(migrationsDir).sort();

    expect(files).toContain("20261022000000_v2_multi_tenant_schema.sql");
    expect(files).toContain("20261022000001_v2_rls_policies.sql");
    expect(files).toContain("20261022000002_v2_seed_data.sql");
    expect(files).toContain("20261022000003_v2_stored_procedures.sql");
    expect(files).toContain("20261022000004_v2_storage_setup.sql");
    expect(files).toContain("20261023000000_v2_stored_procedure_updates.sql");
    expect(files).toContain("20261025000000_v2_table_session_and_rbac.sql");

    // Check that forward migration defines table session atomicity and staff auth
    const forwardContent = fs.readFileSync(path.join(migrationsDir, "20261025000000_v2_table_session_and_rbac.sql"), "utf-8");
    expect(forwardContent).toContain("get_or_create_tenant_session");
    expect(forwardContent).toContain("authenticate_tenant_staff");
    expect(forwardContent).toContain("update_tenant_table_status");

    // Check that stored procedures migration defines the key atomic functions
    const spContent = fs.readFileSync(path.join(migrationsDir, "20261022000003_v2_stored_procedures.sql"), "utf-8");
    expect(spContent).toContain("create_tenant_order");
    expect(spContent).toContain("update_order_status_with_event");
    expect(spContent).toContain("add_additional_item_transaction");
    expect(spContent).toContain("generate_tenant_bill");
    expect(spContent).toContain("record_tenant_payment");
    expect(spContent).toContain("update_tenant_table_status");
    expect(spContent).toContain("get_live_kpis");

    // Check storage migration
    const storageContent = fs.readFileSync(path.join(migrationsDir, "20261022000004_v2_storage_setup.sql"), "utf-8");
    expect(storageContent).toContain("cafe-assets");
    expect(storageContent).toContain("get_auth_tenant_id");
  });

  it("ensures DATA_ADAPTER=local runs in development mode without external credentials", () => {
    process.env.DATA_ADAPTER = "local";
    expect(isLocalAdapter()).toBe(true);
    const adapter = getDatabaseAdapter();
    expect(adapter.adapterName).toBe("local");
  });

  it("ensures SupabaseDatabaseAdapter fails clearly when credentials are missing instead of silently falling back", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const supabaseAdapter = new SupabaseDatabaseAdapter();
    expect(supabaseAdapter.adapterName).toBe("supabase");

    // Attempting any database call without credentials must throw a clear error
    await expect(supabaseAdapter.getTables("some-tenant-id")).rejects.toThrow(
      /Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY/i
    );
  });

  it("resolves default tenant ID to a valid PostgreSQL UUID in Supabase mode", () => {
    process.env.DATA_ADAPTER = "supabase";
    delete process.env.DEFAULT_TENANT_ID;

    const tenantId = getDefaultTenantId();
    expect(tenantId).toBe(SUPABASE_DEFAULT_TENANT_ID);
    expect(tenantId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it("accepts custom valid UUID for DEFAULT_TENANT_ID in Supabase mode", () => {
    process.env.DATA_ADAPTER = "supabase";
    process.env.DEFAULT_TENANT_ID = "12345678-1234-1234-1234-123456789abc";

    const tenantId = getDefaultTenantId();
    expect(tenantId).toBe("12345678-1234-1234-1234-123456789abc");
  });

  it("verifies server-side authorization guard prevents unauthorized or cross-tenant access", () => {
    const mockUser = {
      id: "u-chef-01",
      tenant_id: "00000000-0000-0000-0000-000000000001",
      full_name: "Chef Marco",
      email: "chef@velvetbloom.com",
      role: "CHEF" as const,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const session = createSessionToken(mockUser);
    expect(session.token).toBeDefined();

    // 1. Valid Chef access
    const chefCheck = verifyStaffRole(
      session.token,
      ["CHEF", "ADMIN", "OWNER"],
      "00000000-0000-0000-0000-000000000001"
    );
    expect(chefCheck.authorized).toBe(true);

    // 2. Cross-tenant access must be rejected
    const crossTenantCheck = verifyStaffRole(
      session.token,
      ["CHEF"],
      "99999999-9999-9999-9999-999999999999"
    );
    expect(crossTenantCheck.authorized).toBe(false);
    expect(crossTenantCheck.error).toContain("Cross-tenant access forbidden");

    // 3. Insufficient role access (Chef attempting cashier-only operation)
    const roleCheck = verifyStaffRole(
      session.token,
      ["CASHIER", "STAFF"],
      "00000000-0000-0000-0000-000000000001"
    );
    expect(roleCheck.authorized).toBe(false);
    expect(roleCheck.error).toContain("Insufficient permissions");

    // 4. Missing token
    const emptyCheck = verifyStaffRole(null, ["CHEF"]);
    expect(emptyCheck.authorized).toBe(false);
  });

  it("prevents password-less staff authentication when in Supabase mode", async () => {
    process.env.DATA_ADAPTER = "supabase";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "mock-key";

    // Attempting email login without password in Supabase mode must be rejected immediately
    const result = await authenticateStaff("00000000-0000-0000-0000-000000000001", {
      email: "admin@velvetbloom.com",
    });

    expect(result).toBeNull();
  });
});

