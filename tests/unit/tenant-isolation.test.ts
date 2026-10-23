import { describe, it, expect } from "vitest";
import { localDbAdapter } from "@/lib/adapter/local-adapter";
import { PRIMARY_TENANT_ID, SECONDARY_TENANT_ID } from "@/lib/adapter/seed-data";

describe("Multi-Tenant Data Isolation", () => {
  it("strictly isolates menu items by tenant_id", async () => {
    const primaryItems = await localDbAdapter.getMenuItems(PRIMARY_TENANT_ID);
    const secondaryItems = await localDbAdapter.getMenuItems(SECONDARY_TENANT_ID);

    expect(primaryItems.length).toBeGreaterThan(0);
    expect(secondaryItems.length).toBeGreaterThan(0);

    // Primary items must only have PRIMARY_TENANT_ID
    for (const item of primaryItems) {
      expect(item.tenant_id).toBe(PRIMARY_TENANT_ID);
    }

    // Secondary items must only have SECONDARY_TENANT_ID
    for (const item of secondaryItems) {
      expect(item.tenant_id).toBe(SECONDARY_TENANT_ID);
    }

    // No overlap
    const primaryIds = new Set(primaryItems.map((i) => i.id));
    const secondaryIds = new Set(secondaryItems.map((i) => i.id));
    const intersection = [...primaryIds].filter((id) => secondaryIds.has(id));
    expect(intersection).toHaveLength(0);
  });

  it("strictly isolates tables and QR tokens by tenant_id", async () => {
    const primaryTables = await localDbAdapter.getTables(PRIMARY_TENANT_ID);
    const secondaryTables = await localDbAdapter.getTables(SECONDARY_TENANT_ID);

    expect(primaryTables.every((t) => t.tenant_id === PRIMARY_TENANT_ID)).toBe(true);
    expect(secondaryTables.every((t) => t.tenant_id === SECONDARY_TENANT_ID)).toBe(true);

    // Secondary table QR token cannot be resolved under primary tenant
    const secondaryToken = secondaryTables[0].qr_code_token;
    const lookupUnderPrimary = await localDbAdapter.getTableByQr(PRIMARY_TENANT_ID, secondaryToken);
    expect(lookupUnderPrimary).toBeNull();
  });

  it("prevents cross-tenant order creation", async () => {
    const secondaryTables = await localDbAdapter.getTables(SECONDARY_TENANT_ID);
    const foreignTableId = secondaryTables[0].id;

    // Attempting to create an order in primary tenant using a secondary tenant's table
    await expect(
      localDbAdapter.createOrder(PRIMARY_TENANT_ID, {
        tableId: foreignTableId,
        sessionId: "sess-fake",
        items: [{ menuItemId: "item-01", quantity: 1, options: [] }],
      })
    ).rejects.toThrow(/Invalid table/);
  });

  it("strictly isolates orders and 15-day analytics by tenant", async () => {
    const primaryOrders = await localDbAdapter.getOrders(PRIMARY_TENANT_ID);
    const secondaryOrders = await localDbAdapter.getOrders(SECONDARY_TENANT_ID);

    expect(primaryOrders.every((o) => o.tenant_id === PRIMARY_TENANT_ID)).toBe(true);
    expect(secondaryOrders.every((o) => o.tenant_id === SECONDARY_TENANT_ID)).toBe(true);

    const primaryAnalytics = await localDbAdapter.getRolling15DayAnalytics(PRIMARY_TENANT_ID);
    const secondaryAnalytics = await localDbAdapter.getRolling15DayAnalytics(SECONDARY_TENANT_ID);

    expect(primaryAnalytics.total_15day_orders).toBeGreaterThan(0);
    expect(secondaryAnalytics.total_15day_orders).toBe(0); // Secondary has no historical orders
  });
});

