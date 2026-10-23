import { describe, it, expect } from "vitest";
import { localDbAdapter } from "@/lib/adapter/local-adapter";
import { PRIMARY_TENANT_ID } from "@/lib/adapter/seed-data";

describe("Velvet Bloom Café End-to-End Operational Lifecycle", () => {
  it("executes complete lifecycle: QR Table -> Order -> Additional Item -> Chef Prep -> Delivery -> Split Bill -> Settlement", async () => {
    // 1. Customer Scans QR
    const table = await localDbAdapter.getTableByQr(PRIMARY_TENANT_ID, "vb_tbl_01_tok99a");
    expect(table).not.toBeNull();
    expect(table?.table_number).toBe("Table 1");

    // 2. Establish Active Table Session
    const session = await localDbAdapter.getOrCreateSession(
      PRIMARY_TENANT_ID,
      table!.id,
      "Lady Genevieve",
      "+91 98765 00000"
    );
    expect(session.id).toBeDefined();
    expect(session.is_active).toBe(true);

    // 3. Customer Places Order with Customizations
    const newOrder = await localDbAdapter.createOrder(PRIMARY_TENANT_ID, {
      tableId: table!.id,
      sessionId: session.id,
      customerName: "Lady Genevieve",
      items: [
        {
          menuItemId: "item-01", // Rose Gold Velvet Latte (320)
          quantity: 2,
          options: [{ groupName: "Choice of Milk", optionName: "Barista Oat Milk", extraPrice: 40 }], // +40 each -> 360 * 2 = 720
        },
        {
          menuItemId: "item-08", // Velvet Bloom Opera Cake (360)
          quantity: 1,
          options: [],
        },
      ],
    });

    expect(newOrder.order_number).toMatch(/^VB-\d{8}-\d{4}$/);
    expect(newOrder.status).toBe("PENDING");
    expect(newOrder.subtotal).toBe(1080.0); // 720 + 360
    expect(newOrder.tax).toBe(54.0); // 5% GST of 1080
    expect(newOrder.total).toBe(1134.0);

    // 4. Staff Adds Additional Item Transactionally
    const updatedOrder = await localDbAdapter.addAdditionalItem(PRIMARY_TENANT_ID, {
      orderId: newOrder.id,
      menuItemId: "item-02", // Smoked Cinnamon Flat White (280)
      quantity: 1,
      options: [],
      specialNotes: "Add cinnamon dust on top",
      staffId: "user-staff-01",
    });

    expect(updatedOrder.items).toHaveLength(3);
    const addedItem = updatedOrder.items?.find((i) => i.is_additional);
    expect(addedItem).toBeDefined();
    expect(addedItem?.item_name).toBe("Smoked Cinnamon Flat White");

    // Subtotal was 1080 + 280 = 1360. Tax: 5% of 1360 = 68. Total: 1428.
    expect(updatedOrder.subtotal).toBe(1360.0);
    expect(updatedOrder.tax).toBe(68.0);
    expect(updatedOrder.total).toBe(1428.0);

    // 5. Chef Accepts and Prepares Order
    const accepted = await localDbAdapter.updateOrderStatus(
      PRIMARY_TENANT_ID,
      newOrder.id,
      "ACCEPTED",
      "CHEF",
      "user-chef-01",
      "Accepted by Chef Marcus"
    );
    expect(accepted.status).toBe("ACCEPTED");

    const preparing = await localDbAdapter.updateOrderStatus(
      PRIMARY_TENANT_ID,
      newOrder.id,
      "PREPARING",
      "CHEF",
      "user-chef-01"
    );
    expect(preparing.status).toBe("PREPARING");

    const ready = await localDbAdapter.updateOrderStatus(
      PRIMARY_TENANT_ID,
      newOrder.id,
      "READY",
      "CHEF",
      "user-chef-01",
      "Plated and garnished"
    );
    expect(ready.status).toBe("READY");

    // 6. Service Staff Marks Order Served
    const served = await localDbAdapter.updateOrderStatus(
      PRIMARY_TENANT_ID,
      newOrder.id,
      "SERVED",
      "STAFF",
      "user-staff-01"
    );
    expect(served.status).toBe("SERVED");

    // 7. Generate Bill
    const bill = await localDbAdapter.generateBill(PRIMARY_TENANT_ID, {
      tableId: table!.id,
      sessionId: session.id,
      orderId: newOrder.id,
    });

    expect(bill.subtotal).toBe(1360.0);
    expect(bill.tax).toBe(68.0);
    expect(bill.final_total).toBe(1428.0);
    expect(bill.status).toBe("GENERATED");

    // 8. Split Bill Equally among 3 people
    const splitBill = await localDbAdapter.splitBill(PRIMARY_TENANT_ID, bill.id, "EQUAL", 3);
    expect(splitBill.split_type).toBe("EQUAL");
    expect(splitBill.split_count).toBe(3);
    expect(splitBill.splits).toHaveLength(3);

    // Total 1428 / 3 = 476.0 each
    const sumSplits = splitBill.splits!.reduce((sum, s) => sum + s.assigned_amount, 0);
    expect(sumSplits).toBe(1428.0);

    // 9. Settle Payment
    const payment = await localDbAdapter.recordPayment(PRIMARY_TENANT_ID, {
      billId: bill.id,
      amount: 1428.0,
      paymentMethod: "UPI",
      recordedBy: "user-staff-01",
      transactionRef: "UPI-TEST-TXN-998811",
    });

    expect(payment.status).toBe("COMPLETED");

    // Verify Bill and Order are settled
    const settledBill = await localDbAdapter.getBillById(PRIMARY_TENANT_ID, bill.id);
    expect(settledBill?.status).toBe("PAID");

    const completedOrder = await localDbAdapter.getOrderById(PRIMARY_TENANT_ID, newOrder.id);
    expect(completedOrder?.status).toBe("COMPLETED");

    // 10. Duplicate Settlement Prevention
    await expect(
      localDbAdapter.recordPayment(PRIMARY_TENANT_ID, {
        billId: bill.id,
        amount: 1428.0,
        paymentMethod: "CASH",
      })
    ).rejects.toThrow(/already been fully paid/);
  });
});

