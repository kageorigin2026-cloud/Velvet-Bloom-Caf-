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
});

