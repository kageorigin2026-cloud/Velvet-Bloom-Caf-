import { describe, it, expect, beforeEach } from "vitest";
import { LocalDatabaseAdapter } from "@/lib/adapter/local-adapter";
import {
  createSessionToken,
  parseSessionToken,
  verifyStaffRole,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/staff-auth";
import { hasPermission } from "@/lib/auth/rbac";

describe("Existing Owner Authentication & Route Protection Tests", () => {
  let adapter: LocalDatabaseAdapter;
  const tenantId = "tenant-velvet-bloom-01";

  beforeEach(() => {
    adapter = new LocalDatabaseAdapter();
  });

  describe("Owner & Staff Authentication Invariants", () => {
    it("recognizes existing Owner and returns hasActiveOwner = true (preventing loop back to setup)", async () => {
      // Primary tenant has seeded owner
      const hasOwner = await adapter.hasActiveOwner(tenantId);
      expect(hasOwner).toBe(true);

      // Verify that duplicate owner creation is strictly blocked
      await expect(
        adapter.provisionInitialOwner(
          tenantId,
          "Second Owner",
          "second@velvetbloom.com",
          "1234"
        )
      ).rejects.toThrow(/already has an owner/i);
    });

    it("authenticates existing Owner with valid PIN and generates correct session token", async () => {
      // Seeded Owner Alexander Vance in local adapter has PIN '1111'
      const user = await adapter.getUserByPin(tenantId, "1111");
      expect(user).not.toBeNull();
      expect(user?.role).toBe("OWNER");
      expect(user?.full_name).toContain("Alexander Vance");
      expect(user?.is_active).toBe(true);

      // Create session
      const session = createSessionToken(user!);
      expect(session.token).toBeDefined();
      expect(session.user.role).toBe("OWNER");

      // Verify token can be parsed and authenticated
      const parsed = parseSessionToken(session.token);
      expect(parsed).not.toBeNull();
      expect(parsed?.role).toBe("OWNER");
      expect(parsed?.tenantId).toBe(tenantId);
    });

    it("rejects authentication with invalid PIN", async () => {
      // PIN '0000' does not exist in seeded users
      const user = await adapter.getUserByPin(tenantId, "0000");
      expect(user).toBeNull();
    });

    it("rejects authentication for inactive accounts", async () => {
      // Add an inactive user to the adapter
      const inactiveUser = {
        id: "u-inactive-01",
        tenant_id: tenantId,
        full_name: "Inactive Staff",
        email: "inactive@velvetbloom.com",
        role: "WAITER" as const,
        pin_code: "8888",
        is_active: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      (adapter as any).users.push(inactiveUser);

      const user = await adapter.getUserByPin(tenantId, "8888");
      expect(user).toBeNull();
    });

    it("verifies Chef and other staff authentication continues to work", async () => {
      // Chef Marcus Chen has PIN '2222'
      const chef = await adapter.getUserByPin(tenantId, "2222");
      expect(chef).not.toBeNull();
      expect(chef?.role).toBe("CHEF");
      expect(hasPermission(chef!.role, "orders:kitchen_update")).toBe(true);
      expect(hasPermission(chef!.role, "dashboard:view")).toBe(false);

      // Waiter Liam Chen has PIN '3333'
      const waiter = await adapter.getUserByPin(tenantId, "3333");
      expect(waiter).not.toBeNull();
      expect(waiter?.role).toBe("WAITER");
      expect(hasPermission(waiter!.role, "tables:view")).toBe(true);

      // Cashier Priya Sharma has PIN '4444'
      const cashier = await adapter.getUserByPin(tenantId, "4444");
      expect(cashier).not.toBeNull();
      expect(cashier?.role).toBe("CASHIER");
      expect(hasPermission(cashier!.role, "bills:generate")).toBe(true);
    });
  });

  describe("Protected Route & Session Security", () => {
    it("denies access to protected Owner routes when unauthenticated", () => {
      const nullTokenCheck = verifyStaffRole(null, ["OWNER", "ADMIN"], tenantId);
      expect(nullTokenCheck.authorized).toBe(false);
      expect(nullTokenCheck.error).toContain("Authentication required");

      const emptyTokenCheck = verifyStaffRole("", ["OWNER", "ADMIN"], tenantId);
      expect(emptyTokenCheck.authorized).toBe(false);

      const invalidTokenCheck = verifyStaffRole("invalid.malformed.token", ["OWNER", "ADMIN"], tenantId);
      expect(invalidTokenCheck.authorized).toBe(false);
      expect(invalidTokenCheck.error).toContain("Invalid or expired");
    });

    it("denies non-owner/admin roles from accessing owner-only operations", async () => {
      // Chef session
      const chef = await adapter.getUserByPin(tenantId, "2222");
      expect(chef).not.toBeNull();
      const chefSession = createSessionToken(chef!);

      const ownerCheck = verifyStaffRole(chefSession.token, ["OWNER", "ADMIN"], tenantId);
      expect(ownerCheck.authorized).toBe(false);
      expect(ownerCheck.error).toContain("Insufficient permissions");
    });

    it("grants OWNER full access to protected owner routes", async () => {
      const owner = await adapter.getUserByPin(tenantId, "1111");
      expect(owner).not.toBeNull();
      const ownerSession = createSessionToken(owner!);

      const ownerCheck = verifyStaffRole(ownerSession.token, ["OWNER", "ADMIN"], tenantId);
      expect(ownerCheck.authorized).toBe(true);
      expect(ownerCheck.session?.role).toBe("OWNER");
    });

    it("prevents cross-tenant token use", async () => {
      const owner = await adapter.getUserByPin(tenantId, "1111");
      expect(owner).not.toBeNull();
      const ownerSession = createSessionToken(owner!);

      const crossTenantCheck = verifyStaffRole(
        ownerSession.token,
        ["OWNER", "ADMIN"],
        "tenant-other-99"
      );
      expect(crossTenantCheck.authorized).toBe(false);
      expect(crossTenantCheck.error).toContain("Cross-tenant");
    });

    it("validates session cookie configuration constants", () => {
      expect(SESSION_COOKIE_NAME).toBe("vb_staff_session");
    });
  });
});

