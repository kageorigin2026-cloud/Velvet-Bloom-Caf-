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

  it("grants MANAGER daily operations and analytics but restricts core configuration changes", () => {
    expect(hasPermission("MANAGER", "dashboard:view")).toBe(true);
    expect(hasPermission("MANAGER", "analytics:view")).toBe(true);
    expect(hasPermission("MANAGER", "orders:view")).toBe(true);
    expect(hasPermission("MANAGER", "orders:kitchen_update")).toBe(true);
    expect(hasPermission("MANAGER", "bills:generate")).toBe(true);
    expect(hasPermission("MANAGER", "payments:record")).toBe(true);
    expect(hasPermission("MANAGER", "settings:view")).toBe(true);
    expect(hasPermission("MANAGER", "settings:edit")).toBe(false);
    expect(hasPermission("MANAGER", "payments:refund")).toBe(false);
    expect(hasPermission("MANAGER", "staff:edit")).toBe(false);
  });

  it("grants WAITER table and service operations but restricts billing and analytics", () => {
    expect(hasPermission("WAITER", "orders:view")).toBe(true);
    expect(hasPermission("WAITER", "orders:mark_served")).toBe(true);
    expect(hasPermission("WAITER", "orders:add_items")).toBe(true);
    expect(hasPermission("WAITER", "tables:view")).toBe(true);
    expect(hasPermission("WAITER", "tables:update_status")).toBe(true);
    expect(hasPermission("WAITER", "service_requests:update")).toBe(true);
    expect(hasPermission("WAITER", "bills:generate")).toBe(false);
    expect(hasPermission("WAITER", "payments:record")).toBe(false);
    expect(hasPermission("WAITER", "analytics:view")).toBe(false);
  });

  it("grants CASHIER billing and payment settlement permissions but restricts kitchen", () => {
    expect(hasPermission("CASHIER", "bills:view")).toBe(true);
    expect(hasPermission("CASHIER", "bills:generate")).toBe(true);
    expect(hasPermission("CASHIER", "bills:split")).toBe(true);
    expect(hasPermission("CASHIER", "payments:view")).toBe(true);
    expect(hasPermission("CASHIER", "payments:record")).toBe(true);
    expect(hasPermission("CASHIER", "orders:kitchen_update")).toBe(false);
    expect(hasPermission("CASHIER", "settings:edit")).toBe(false);
    expect(hasPermission("CASHIER", "analytics:view")).toBe(false);
  });
});

