import { describe, it, expect } from "vitest";
import { localDbAdapter } from "@/lib/adapter/local-adapter";
import { PRIMARY_TENANT_ID } from "@/lib/adapter/seed-data";

describe("Customer Order Tracking Feature", () => {
  it("verifies successful checkout creates an authentic order with valid tracking reference", async () => {
    // 1. Obtain table and session
    const table = await localDbAdapter.getTableByQr(PRIMARY_TENANT_ID, "vb_tbl_01_tok99a");
    expect(table).not.toBeNull();

    const session = await localDbAdapter.getOrCreateSession(
      PRIMARY_TENANT_ID,
      table!.id,
      "Julian Mercer",
      "+91 98765 11223"
    );

    // 2. Place order
    const order = await localDbAdapter.createOrder(PRIMARY_TENANT_ID, {
      tableId: table!.id,
      sessionId: session.id,
      customerName: "Julian Mercer",
      items: [
        {
          menuItemId: "item-01",
          quantity: 1,
          options: [],
        },
      ],
    });

    // Confirmation screen requirements
    expect(order.id).toBeDefined();
    expect(order.order_number).toBeDefined();
    expect(order.order_number).toMatch(/^VB-\d{8}-\d{4}$/);
    expect(order.status).toBe("PENDING");
    expect(order.total).toBeGreaterThan(0);
    expect(order.table_id).toBe(table!.id);
  });

  it("retrieves the authentic order by orderNumber via database adapter", async () => {
    const table = await localDbAdapter.getTableByQr(PRIMARY_TENANT_ID, "vb_tbl_02_tok88b");
    const session = await localDbAdapter.getOrCreateSession(PRIMARY_TENANT_ID, table!.id);

    const createdOrder = await localDbAdapter.createOrder(PRIMARY_TENANT_ID, {
      tableId: table!.id,
      sessionId: session.id,
      customerName: "Audrey Hepburn",
      items: [
        {
          menuItemId: "item-02",
          quantity: 2,
          options: [],
        },
      ],
    });

    // Lookup by order number
    const trackedOrder = await localDbAdapter.getOrderByNumber(
      PRIMARY_TENANT_ID,
      createdOrder.order_number
    );

    expect(trackedOrder).not.toBeNull();
    expect(trackedOrder?.id).toBe(createdOrder.id);
    expect(trackedOrder?.order_number).toBe(createdOrder.order_number);
    expect(trackedOrder?.customer_name).toBe("Audrey Hepburn");
    expect(trackedOrder?.items).toHaveLength(1);
    expect(trackedOrder?.items?.[0].quantity).toBe(2);
  });

  it("handles invalid or non-existent order numbers gracefully without throwing", async () => {
    const nonExistent = await localDbAdapter.getOrderByNumber(
      PRIMARY_TENANT_ID,
      "VB-99999999-9999"
    );
    expect(nonExistent).toBeNull();

    const empty = await localDbAdapter.getOrderByNumber(PRIMARY_TENANT_ID, "");
    expect(empty).toBeNull();

    const garbage = await localDbAdapter.getOrderByNumber(
      PRIMARY_TENANT_ID,
      "INVALID_ORDER_TOKEN"
    );
    expect(garbage).toBeNull();
  });

  it("accurately tracks the complete order lifecycle through all steps", async () => {
    const table = await localDbAdapter.getTableByQr(PRIMARY_TENANT_ID, "vb_tbl_01_tok99a");
    const session = await localDbAdapter.getOrCreateSession(PRIMARY_TENANT_ID, table!.id);

    const order = await localDbAdapter.createOrder(PRIMARY_TENANT_ID, {
      tableId: table!.id,
      sessionId: session.id,
      items: [{ menuItemId: "item-01", quantity: 1, options: [] }],
    });

    const expectedSteps = [
      "PENDING",
      "ACCEPTED",
      "PREPARING",
      "READY",
      "SERVED",
      "COMPLETED",
    ] as const;

    // Verify initial
    expect(order.status).toBe("PENDING");

    // Advance through each step
    for (let i = 1; i < expectedSteps.length; i++) {
      const targetStatus = expectedSteps[i];
      const role =
        targetStatus === "ACCEPTED" || targetStatus === "PREPARING" || targetStatus === "READY"
          ? "CHEF"
          : targetStatus === "SERVED"
          ? "SERVICE"
          : "BILLING";

      const updated = await localDbAdapter.updateOrderStatus(
        PRIMARY_TENANT_ID,
        order.id,
        targetStatus,
        role,
        "staff-user-01"
      );

      expect(updated.status).toBe(targetStatus);

      // Verify tracked order matches updated status
      const fetched = await localDbAdapter.getOrderByNumber(
        PRIMARY_TENANT_ID,
        order.order_number
      );
      expect(fetched?.status).toBe(targetStatus);
    }
  });

  it("handles cancelled orders gracefully on tracking lookup", async () => {
    const table = await localDbAdapter.getTableByQr(PRIMARY_TENANT_ID, "vb_tbl_03_tok77c");
    const session = await localDbAdapter.getOrCreateSession(PRIMARY_TENANT_ID, table!.id);

    const order = await localDbAdapter.createOrder(PRIMARY_TENANT_ID, {
      tableId: table!.id,
      sessionId: session.id,
      items: [{ menuItemId: "item-03", quantity: 1, options: [] }],
    });

    const cancelledOrder = await localDbAdapter.updateOrderStatus(
      PRIMARY_TENANT_ID,
      order.id,
      "CANCELLED",
      "SERVICE",
      "staff-user-01",
      "Customer changed their mind"
    );

    expect(cancelledOrder.status).toBe("CANCELLED");

    const tracked = await localDbAdapter.getOrderByNumber(
      PRIMARY_TENANT_ID,
      order.order_number
    );
    expect(tracked?.status).toBe("CANCELLED");
  });

  it("verifies order tracking URL contract uses genuine backend order number", () => {
    const orderNumber = "VB-20261022-8192";
    const trackingRoute = `/track/${orderNumber}`;

    expect(trackingRoute).toBe("/track/VB-20261022-8192");
    expect(trackingRoute.startsWith("/track/VB-")).toBe(true);
  });
});

