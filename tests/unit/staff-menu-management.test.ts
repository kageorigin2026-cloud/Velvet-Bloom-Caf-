import { describe, it, expect, beforeEach } from "vitest";
import { LocalDatabaseAdapter } from "@/lib/adapter/local-adapter";
import {
  createSessionToken,
  parseSessionToken,
  verifyStaffRole,
  extractStaffToken,
  STAFF_COOKIE_NAME,
} from "@/lib/auth/staff-auth";
import { User, MenuItem, UserRole } from "@/types/database.types";
import { NextRequest } from "next/server";

describe("Staff Management & Menu Management Invariant Tests", () => {
  let adapter: LocalDatabaseAdapter;
  const tenantId = "tenant-velvet-bloom-01";

  beforeEach(() => {
    adapter = new LocalDatabaseAdapter();
  });

  describe("Staff Management & Terminal Access Control", () => {
    it("returns staff list with sanitized fields (never leaking pin_code)", async () => {
      const staff = await adapter.getUsers(tenantId);
      expect(staff.length).toBeGreaterThan(0);
      for (const member of staff) {
        expect(member.tenant_id).toBe(tenantId);
        expect(member.pin_code).toBeUndefined();
      }
    });

    it("allows creating all 5 operational staff roles with valid numeric PINs", async () => {
      const roles: UserRole[] = ["MANAGER", "CHEF", "WAITER", "CASHIER", "STAFF"];

      for (let i = 0; i < roles.length; i++) {
        const role = roles[i];
        const pin = `789${i}`;
        const newStaff = await adapter.createStaffMember(tenantId, {
          fullName: `Staff Member ${role}`,
          email: `staff.${role.toLowerCase()}@velvetbloom.com`,
          role,
          pin,
          phone: `+91 98765 0000${i}`,
        });

        expect(newStaff.id).toBeDefined();
        expect(newStaff.full_name).toBe(`Staff Member ${role}`);
        expect(newStaff.role).toBe(role);
        expect(newStaff.is_active).toBe(true);

        // Verify the staff member can authenticate with their PIN
        const authUser = await adapter.getUserByPin(tenantId, pin);
        expect(authUser).not.toBeNull();
        expect(authUser?.email).toBe(`staff.${role.toLowerCase()}@velvetbloom.com`);
        expect(authUser?.role).toBe(role);
      }
    });

    it("strictly prohibits creating accounts with OWNER or ADMIN role via staff management", async () => {
      await expect(
        adapter.createStaffMember(tenantId, {
          fullName: "Impostor Owner",
          email: "impostor@velvetbloom.com",
          role: "OWNER",
          pin: "7777",
        })
      ).rejects.toThrow(/Cannot create OWNER or ADMIN/i);

      await expect(
        adapter.createStaffMember(tenantId, {
          fullName: "Impostor Admin",
          email: "admin2@velvetbloom.com",
          role: "ADMIN",
          pin: "8888",
        })
      ).rejects.toThrow(/Cannot create OWNER or ADMIN/i);
    });

    it("rejects duplicate email within the same tenant", async () => {
      await adapter.createStaffMember(tenantId, {
        fullName: "First Staff",
        email: "staff1@velvetbloom.com",
        role: "CHEF",
        pin: "4321",
      });

      await expect(
        adapter.createStaffMember(tenantId, {
          fullName: "Duplicate Email Staff",
          email: "staff1@velvetbloom.com",
          role: "WAITER",
          pin: "6543",
        })
      ).rejects.toThrow(/already in use/i);
    });

    it("allows updating staff details and resetting terminal PIN", async () => {
      const created = await adapter.createStaffMember(tenantId, {
        fullName: "Sunita Rao",
        email: "sunita@velvetbloom.com",
        role: "CASHIER",
        pin: "2468",
      });

      // Update details
      const updated = await adapter.updateStaffMember(tenantId, created.id, {
        fullName: "Sunita Rao Sharma",
        phone: "+91 99999 88888",
      });
      expect(updated.full_name).toBe("Sunita Rao Sharma");

      // Reset PIN to 1357
      const pinUpdated = await adapter.updateStaffPin(tenantId, created.id, "1357");
      expect(pinUpdated).toBe(true);

      // Verify old PIN no longer authenticates
      const oldAuth = await adapter.getUserByPin(tenantId, "2468");
      expect(oldAuth).toBeNull();

      // Verify new PIN authenticates
      const newAuth = await adapter.getUserByPin(tenantId, "1357");
      expect(newAuth).not.toBeNull();
      expect(newAuth?.id).toBe(created.id);
    });

    it("deactivating staff account blocks subsequent login attempts", async () => {
      const staff = await adapter.createStaffMember(tenantId, {
        fullName: "Temporary Worker",
        email: "temp@velvetbloom.com",
        role: "WAITER",
        pin: "9876",
      });

      // Can authenticate while active
      expect(await adapter.getUserByPin(tenantId, "9876")).not.toBeNull();

      // Deactivate
      await adapter.deleteStaffMember(tenantId, staff.id);

      // Cannot authenticate once deactivated
      expect(await adapter.getUserByPin(tenantId, "9876")).toBeNull();
    });

    it("strictly prevents deactivating or demoting the primary Owner account", async () => {
      const owner = (await adapter.getUsers(tenantId)).find((u) => u.role === "OWNER");
      expect(owner).toBeDefined();

      await expect(
        adapter.updateStaffMember(tenantId, owner!.id, { isActive: false })
      ).rejects.toThrow(/Cannot deactivate the primary Owner/i);

      await expect(
        adapter.updateStaffMember(tenantId, owner!.id, { role: "WAITER" })
      ).rejects.toThrow(/Cannot change role/i);
    });
  });

  describe("Menu Management & Safe Archiving", () => {
    it("creates a new menu item with valid non-negative price", async () => {
      const categories = await adapter.getCategories(tenantId);
      expect(categories.length).toBeGreaterThan(0);

      const newItem = await adapter.createMenuItem(tenantId, {
        categoryId: categories[0].id,
        name: "Cardamom Saffron Brioche",
        description: "Fluffy artisan brioche infused with Kashmiri saffron",
        price: 320,
        isVeg: true,
        prepTimeMinutes: 20,
      });

      expect(newItem.id).toBeDefined();
      expect(newItem.name).toBe("Cardamom Saffron Brioche");
      expect(newItem.price).toBe(320);
      expect(newItem.is_available).toBe(true);
      expect(newItem.is_archived).toBe(false);

      // Verify it appears in active catalog
      const items = await adapter.getMenuItems(tenantId);
      expect(items.some((i) => i.id === newItem.id)).toBe(true);
    });

    it("updates menu item details and allows toggling availability", async () => {
      const items = await adapter.getMenuItems(tenantId);
      const target = items[0];
      const initialPrice = target.price;

      // Toggle availability to false
      const toggled = await adapter.updateMenuItemAvailability(tenantId, target.id, false);
      expect(toggled.is_available).toBe(false);

      // Update price and name
      const updated = await adapter.updateMenuItem(tenantId, target.id, {
        name: `${target.name} (Special Edition)`,
        price: initialPrice + 50,
      });
      expect(updated.name).toContain("Special Edition");
      expect(updated.price).toBe(initialPrice + 50);
    });

    it("safely archives menu items without deleting them or breaking past records", async () => {
      const categories = await adapter.getCategories(tenantId);
      const dish = await adapter.createMenuItem(tenantId, {
        categoryId: categories[0].id,
        name: "Seasonal Autumn Tart",
        price: 260,
        isVeg: true,
      });

      // Archive dish
      const archived = await adapter.archiveMenuItem(tenantId, dish.id);
      expect(archived.is_archived).toBe(true);
      expect(archived.is_available).toBe(false);

      // Active catalog query excludes archived dishes by default
      const activeItems = await adapter.getMenuItems(tenantId, undefined, false);
      expect(activeItems.some((i) => i.id === dish.id)).toBe(false);

      // Admin catalog query with includeArchived = true includes archived dishes
      const allItems = await adapter.getMenuItems(tenantId, undefined, true);
      expect(allItems.some((i) => i.id === dish.id)).toBe(true);

      // Item still retrievable by ID for historical orders/bills
      const retrieved = await adapter.getMenuItemById(tenantId, dish.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(dish.id);
    });
  });

  describe("Owner Multi-Dashboard Switching & RBAC Strictness", () => {
    it("grants OWNER universal access across Admin, Kitchen Display, and Service/Billing", () => {
      const ownerUser: User = {
        id: "owner-1",
        tenant_id: tenantId,
        full_name: "Alexander Vance",
        email: "owner@velvetbloom.com",
        role: "OWNER",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const session = createSessionToken(ownerUser);

      // Check Admin access
      const adminAuth = verifyStaffRole(session.token, ["OWNER", "ADMIN"], tenantId);
      expect(adminAuth.authorized).toBe(true);

      // Check Kitchen Display access
      const chefAuth = verifyStaffRole(session.token, ["CHEF"], tenantId);
      expect(chefAuth.authorized).toBe(true);

      // Check Service & Billing access
      const staffAuth = verifyStaffRole(session.token, ["WAITER", "CASHIER"], tenantId);
      expect(staffAuth.authorized).toBe(true);
    });

    it("strictly isolates Chef to kitchen and denies access to Admin controls", () => {
      const chefUser: User = {
        id: "chef-1",
        tenant_id: tenantId,
        full_name: "Marcus Chen",
        email: "chef@velvetbloom.com",
        role: "CHEF",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const session = createSessionToken(chefUser);

      // Authorized for kitchen
      const kitchenAuth = verifyStaffRole(session.token, ["CHEF"], tenantId);
      expect(kitchenAuth.authorized).toBe(true);

      // Denied for admin
      const adminAuth = verifyStaffRole(session.token, ["OWNER", "ADMIN"], tenantId);
      expect(adminAuth.authorized).toBe(false);
      expect(adminAuth.error).toContain("Insufficient permissions");
    });

    it("strictly isolates Waiter to floor service and denies access to Admin and Kitchen", () => {
      const waiterUser: User = {
        id: "waiter-1",
        tenant_id: tenantId,
        full_name: "Elena Rostova",
        email: "elena@velvetbloom.com",
        role: "WAITER",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const session = createSessionToken(waiterUser);

      // Authorized for floor service
      const floorAuth = verifyStaffRole(session.token, ["WAITER", "STAFF"], tenantId);
      expect(floorAuth.authorized).toBe(true);

      // Denied for admin
      const adminAuth = verifyStaffRole(session.token, ["OWNER", "ADMIN"], tenantId);
      expect(adminAuth.authorized).toBe(false);

      // Denied for kitchen
      const kitchenAuth = verifyStaffRole(session.token, ["CHEF"], tenantId);
      expect(kitchenAuth.authorized).toBe(false);
    });

    it("extractStaffToken gives precedence to Authorization Bearer header over session cookie", () => {
      const ownerUser: User = {
        id: "owner-1",
        tenant_id: tenantId,
        full_name: "Alexander Vance",
        email: "owner@velvetbloom.com",
        role: "OWNER",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const chefUser: User = {
        id: "chef-1",
        tenant_id: tenantId,
        full_name: "Marcus Chen",
        email: "chef@velvetbloom.com",
        role: "CHEF",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const ownerSession = createSessionToken(ownerUser);
      const chefSession = createSessionToken(chefUser);

      // Create NextRequest with Chef in cookie and Owner in Authorization header
      const req = new NextRequest("http://localhost:3000/api/staff", {
        headers: {
          authorization: `Bearer ${ownerSession.token}`,
          cookie: `${STAFF_COOKIE_NAME}=${chefSession.token}`,
        },
      });

      const extracted = extractStaffToken(req);
      expect(extracted).toBe(ownerSession.token);

      // Verify the extracted token grants OWNER authorization
      const auth = verifyStaffRole(extracted, ["OWNER", "ADMIN"], tenantId);
      expect(auth.authorized).toBe(true);
      expect(auth.session?.role).toBe("OWNER");
    });

    it("verifyStaffRole supports case-insensitive roles and tenant comparisons", () => {
      const ownerUser: User = {
        id: "owner-1",
        tenant_id: "00000000-0000-0000-0000-000000000001",
        full_name: "Alexander Vance",
        email: "owner@velvetbloom.com",
        role: "OWNER",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const session = createSessionToken(ownerUser);

      // Case-insensitive role and tenant ID check
      const auth = verifyStaffRole(
        session.token,
        ["owner" as any, "admin" as any],
        "00000000-0000-0000-0000-000000000001".toUpperCase()
      );
      expect(auth.authorized).toBe(true);
      expect(auth.session?.role).toBe("OWNER");
    });

    it("provides informative error message identifying active role when rejected", () => {
      const chefUser: User = {
        id: "chef-1",
        tenant_id: tenantId,
        full_name: "Nag Chef",
        email: "nag@velvetbloom.com",
        role: "CHEF",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const session = createSessionToken(chefUser);

      const auth = verifyStaffRole(session.token, ["OWNER", "ADMIN"], tenantId);
      expect(auth.authorized).toBe(false);
      expect(auth.error).toContain("CHEF");
      expect(auth.error).toContain("OWNER");
    });
  });
});
