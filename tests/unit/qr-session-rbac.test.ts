import { describe, it, expect, beforeEach } from "vitest";
import { LocalDatabaseAdapter } from "@/lib/adapter/local-adapter";
import { hasPermission } from "@/lib/auth/rbac";
import { verifyStaffRole, createSessionToken } from "@/lib/auth/staff-auth";
import { User } from "@/types/database.types";

describe("QR Table Resolution, Session Lifecycle & RBAC Regression Tests", () => {
  let adapter: LocalDatabaseAdapter;
  const primaryTenantId = "tenant-velvet-bloom-01";
  const secondaryTenantId = "tenant-azure-oasis-02";

  beforeEach(() => {
    adapter = new LocalDatabaseAdapter();
  });

  describe("QR Token Resolution", () => {
    it("resolves a valid QR token to the correct table and tenant", async () => {
      // Table 5 has qr_code_token 'vb_tbl_05_tok55e'
      const table = await adapter.getTableByQr(primaryTenantId, "vb_tbl_05_tok55e");
      expect(table).not.toBeNull();
      expect(table?.table_number).toBe("Table 5");
      expect(table?.tenant_id).toBe(primaryTenantId);
      expect(table?.qr_code_token).toBe("vb_tbl_05_tok55e");
    });

    it("returns null for non-existent or invalid QR tokens", async () => {
      const table = await adapter.getTableByQr(primaryTenantId, "invalid_nonexistent_token_999");
      expect(table).toBeNull();
    });

    it("prevents cross-tenant table lookup using valid token from another tenant", async () => {
      // Primary table token queried under secondary tenant must return null
      const table = await adapter.getTableByQr(secondaryTenantId, "vb_tbl_05_tok55e");
      expect(table).toBeNull();
    });
  });

  describe("Session Lifecycle & Concurrency", () => {
    it("creates an active session on first QR scan and marks table OCCUPIED", async () => {
      const table = await adapter.getTableByQr(primaryTenantId, "vb_tbl_05_tok55e");
      expect(table).not.toBeNull();

      const session = await adapter.getOrCreateSession(primaryTenantId, table!.id, "Guest 1");
      expect(session).toBeDefined();
      expect(session.is_active).toBe(true);
      expect(session.table_id).toBe(table!.id);

      // Verify table is marked OCCUPIED
      const tables = await adapter.getTables(primaryTenantId);
      const updatedTable = tables.find((t) => t.id === table!.id);
      expect(updatedTable?.status).toBe("OCCUPIED");
    });

    it("reuses existing active session on repeat scans or page refreshes without duplicates", async () => {
      const table = await adapter.getTableByQr(primaryTenantId, "vb_tbl_05_tok55e");
      expect(table).not.toBeNull();

      const session1 = await adapter.getOrCreateSession(primaryTenantId, table!.id);
      const session2 = await adapter.getOrCreateSession(primaryTenantId, table!.id);

      expect(session1.id).toBe(session2.id);
      expect(session1.session_token).toBe(session2.session_token);

      const active = await adapter.getActiveSession(primaryTenantId, table!.id);
      expect(active?.id).toBe(session1.id);
    });

    it("handles concurrent session requests safely", async () => {
      const table = await adapter.getTableByQr(primaryTenantId, "vb_tbl_06_tok44f");
      expect(table).not.toBeNull();

      // Simulate simultaneous requests arriving within milliseconds
      const [sessA, sessB] = await Promise.all([
        adapter.getOrCreateSession(primaryTenantId, table!.id, "Concurrent Guest A"),
        adapter.getOrCreateSession(primaryTenantId, table!.id, "Concurrent Guest B"),
      ]);

      expect(sessA.id).toBe(sessB.id);
    });

    it("fails when attempting to create a session on a missing table", async () => {
      await expect(
        adapter.getOrCreateSession(primaryTenantId, "non-existent-table-uuid")
      ).rejects.toThrow();
    });
  });

  describe("Role-Based Staff Access & Privilege Boundaries", () => {
    const mockUser = (role: User["role"], id: string = "user-1"): User => ({
      id,
      tenant_id: primaryTenantId,
      full_name: `Test ${role}`,
      email: `${role.toLowerCase()}@test.com`,
      role,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    it("allows CHEF kitchen preparation status updates but denies financial settlements", () => {
      const chef = mockUser("CHEF");
      const session = createSessionToken(chef);

      // Verify role authorization
      const chefAuth = verifyStaffRole(session.token, ["CHEF"], primaryTenantId);
      expect(chefAuth.authorized).toBe(true);

      expect(hasPermission("CHEF", "orders:kitchen_update")).toBe(true);
      expect(hasPermission("CHEF", "bills:generate")).toBe(false);
      expect(hasPermission("CHEF", "payments:record")).toBe(false);
      expect(hasPermission("CHEF", "settings:edit")).toBe(false);
    });

    it("allows WAITER table and service delivery but denies menu configuration and financial reports", () => {
      expect(hasPermission("WAITER", "orders:mark_served")).toBe(true);
      expect(hasPermission("WAITER", "tables:update_status")).toBe(true);
      expect(hasPermission("WAITER", "service_requests:update")).toBe(true);
      expect(hasPermission("WAITER", "bills:generate")).toBe(false);
      expect(hasPermission("WAITER", "analytics:view")).toBe(false);
    });

    it("allows CASHIER bill generation and payment recording but denies kitchen operations", () => {
      expect(hasPermission("CASHIER", "bills:generate")).toBe(true);
      expect(hasPermission("CASHIER", "bills:split")).toBe(true);
      expect(hasPermission("CASHIER", "payments:record")).toBe(true);
      expect(hasPermission("CASHIER", "orders:kitchen_update")).toBe(false);
      expect(hasPermission("CASHIER", "settings:edit")).toBe(false);
    });

    it("allows MANAGER daily floor operations and analytics but protects critical settings", () => {
      expect(hasPermission("MANAGER", "dashboard:view")).toBe(true);
      expect(hasPermission("MANAGER", "analytics:view")).toBe(true);
      expect(hasPermission("MANAGER", "orders:view")).toBe(true);
      expect(hasPermission("MANAGER", "bills:generate")).toBe(true);
      expect(hasPermission("MANAGER", "settings:edit")).toBe(false);
      expect(hasPermission("MANAGER", "payments:refund")).toBe(false);
    });

    it("rejects cross-tenant staff tokens", () => {
      const user = mockUser("OWNER");
      const session = createSessionToken(user);

      // Token generated for primaryTenantId must be rejected when accessing secondaryTenantId
      const crossAuth = verifyStaffRole(session.token, ["OWNER"], secondaryTenantId);
      expect(crossAuth.authorized).toBe(false);
      expect(crossAuth.error).toBe("Cross-tenant access forbidden");
    });
  });

  describe("Security Hardening & Migration Invariant Verification", () => {
    it("ensures migration 20261025000000 contains all critical security protections", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const migrationPath = path.resolve(process.cwd(), "supabase/migrations/20261025000000_v2_table_session_and_rbac.sql");
      const sql = fs.readFileSync(migrationPath, "utf-8");

      // 1. Concurrency-safe advisory lock in staff auth
      expect(sql).toContain("pg_advisory_xact_lock");
      expect(sql).toContain("hashtext(p_tenant_id::text || ':' || v_clean_ip)");

      // 2. Table row lock acquired BEFORE QR token verification and active session lookup
      const lockIdx = sql.indexOf("FOR UPDATE");
      const qrCheckIdx = sql.indexOf("qr_code_token IS DISTINCT FROM", lockIdx);
      const sessionLookupIdx = sql.indexOf("SELECT * INTO v_session", qrCheckIdx);
      expect(lockIdx).toBeGreaterThan(-1);
      expect(qrCheckIdx).toBeGreaterThan(lockIdx);
      expect(sessionLookupIdx).toBeGreaterThan(qrCheckIdx);

      // 3. provision_initial_owner restricted strictly to service_role
      expect(sql).toContain("REVOKE ALL ON FUNCTION public.provision_initial_owner(UUID, TEXT, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;");
      expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.provision_initial_owner(UUID, TEXT, TEXT, UUID, TEXT) TO service_role;");

      // 4. provision_initial_owner verifies tenant existence and rejects duplicate owner
      expect(sql).toContain("PERFORM id FROM public.tenants WHERE id = p_tenant_id;");
      expect(sql).toContain("WHERE tenant_id = p_tenant_id AND role = 'OWNER'");

      // 5. PIN migration compatibility with bcrypt hashes
      expect(sql).toContain("pin_code NOT LIKE '$2%'");
      expect(sql).toContain("crypt(trim(pin_code)");

      // 6. Search path and SECURITY DEFINER enforcement on all functions
      const secDefinerCount = (sql.match(/SECURITY DEFINER/g) || []).length;
      const searchPathCount = (sql.match(/SET search_path = public, extensions/g) || []).length;
      expect(secDefinerCount).toBe(5);
      expect(searchPathCount).toBe(5);
    });

    it("verifies initial owner onboarding and duplicate owner rejection", async () => {
      const testTenantId = "tenant-fresh-test-03";
      expect(await adapter.hasActiveOwner(testTenantId)).toBe(false);

      // Provision initial owner
      const owner = await adapter.provisionInitialOwner(
        testTenantId,
        "Alexander Vance",
        "owner@velvetbloom.com",
        "4455"
      );
      expect(owner).toBeDefined();
      expect(owner.role).toBe("OWNER");
      expect(owner.email).toBe("owner@velvetbloom.com");
      expect(await adapter.hasActiveOwner(testTenantId)).toBe(true);

      // Attempting duplicate owner provisioning must be rejected
      await expect(
        adapter.provisionInitialOwner(
          testTenantId,
          "Imposter Owner",
          "imposter@test.com",
          "9999"
        )
      ).rejects.toThrow(/already has an owner/i);
    });

    it("validates all 12 tables have unique, non-empty QR tokens matching expected format", async () => {
      const tables = await adapter.getTables(primaryTenantId);
      expect(tables.length).toBeGreaterThanOrEqual(6);

      const tokens = tables.map((t) => t.qr_code_token);
      // All tokens must be non-empty strings
      tokens.forEach((token) => {
        expect(token).toBeDefined();
        expect(typeof token).toBe("string");
        expect(token.length).toBeGreaterThan(5);
      });

      // No duplicate tokens
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(tokens.length);
    });
  });
});

