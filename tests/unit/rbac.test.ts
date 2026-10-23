import { describe, it, expect } from "vitest";
import { hasPermission } from "@/lib/auth/rbac";

describe("Role-Based Access Control (RBAC)", () => {
  it("grants OWNER full administrative and financial permissions", () => {
    expect(hasPermission("OWNER", "dashboard:view")).toBe(true);
    expect(hasPermission("OWNER", "analytics:view")).toBe(true);
    expect(hasPermission("OWNER", "settings:edit")).toBe(true);
    expect(hasPermission("OWNER", "payments:refund")).toBe(true);
  });

  it("restricts CHEF from financial administration while permitting kitchen updates", () => {
    expect(hasPermission("CHEF", "orders:kitchen_update")).toBe(true);
    expect(hasPermission("CHEF", "menu:availability_toggle")).toBe(true);
    expect(hasPermission("CHEF", "dashboard:view")).toBe(false);
    expect(hasPermission("CHEF", "bills:generate")).toBe(false);
    expect(hasPermission("CHEF", "payments:record")).toBe(false);
    expect(hasPermission("CHEF", "settings:edit")).toBe(false);
  });

  it("grants combined STAFF role access to serving, table floor, billing, and settlement", () => {
    expect(hasPermission("STAFF", "orders:mark_served")).toBe(true);
    expect(hasPermission("STAFF", "orders:add_items")).toBe(true);
    expect(hasPermission("STAFF", "tables:view")).toBe(true);
    expect(hasPermission("STAFF", "bills:generate")).toBe(true);
    expect(hasPermission("STAFF", "bills:split")).toBe(true);
    expect(hasPermission("STAFF", "payments:record")).toBe(true);
    expect(hasPermission("STAFF", "service_requests:update")).toBe(true);

    // Should not have owner analytics/settings permissions
    expect(hasPermission("STAFF", "settings:edit")).toBe(false);
    expect(hasPermission("STAFF", "analytics:view")).toBe(false);
  });
});

