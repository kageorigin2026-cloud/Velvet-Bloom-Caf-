import { describe, it, expect } from "vitest";
import { localDbAdapter } from "@/lib/adapter/local-adapter";
import { PRIMARY_TENANT_ID } from "@/lib/adapter/seed-data";

describe("Customer Bill Settlement and Session Redirection Workflow", () => {
  it("concludes customer session and transitions order, bill, and table status upon full payment settlement", async () => {
    // 1. Setup table and active session
    const table = await localDbAdapter.getTableByQr(PRIMARY_TENANT_ID, "vb_tbl_01_tok99a");
    expect(table).not.toBeNull();

    // Reset table status to AVAILABLE for clean test run
    await localDbAdapter.updateTableStatus(PRIMARY_TENANT_ID, table!.id, "AVAILABLE");

    const session = await localDbAdapter.getOrCreateSession(
      PRIMARY_TENANT_ID,
      table!.id,
      "Clara Oswald",
      "+91 99999 11111"
    );
    expect(session.is_active).toBe(true);

    // Verify getActiveSession returns this session
    const activeBefore = await localDbAdapter.getActiveSession(PRIMARY_TENANT_ID, table!.id);
    expect(activeBefore).not.toBeNull();
    expect(activeBefore?.id).toBe(session.id);

    // 2. Customer places order
    const order = await localDbAdapter.createOrder(PRIMARY_TENANT_ID, {
      tableId: table!.id,
      sessionId: session.id,
      customerName: "Clara Oswald",
      items: [
        {
          menuItemId: "item-01",
          quantity: 2,
          options: [],
        },
      ],
    });
    expect(order.status).toBe("PENDING");

    // 3. Bill is generated / requested
    const bill = await localDbAdapter.generateBill(PRIMARY_TENANT_ID, {
      orderId: order.id,
      tableId: table!.id,
      sessionId: session.id,
      splitType: "NONE",
      splitCount: 1,
    });
    expect(bill.status).toBe("GENERATED");
    expect(bill.final_total).toBeGreaterThan(0);

    // 4. Record full settlement payment
    const payment = await localDbAdapter.recordPayment(PRIMARY_TENANT_ID, {
      billId: bill.id,
      amount: bill.final_total,
      paymentMethod: "ONLINE",
      transactionRef: "TXN-TEST-FULL-001",
      recordedBy: "Customer Self-Checkout",
    });
    expect(payment.status).toBe("COMPLETED");

    // 5. Verify authoritative states after settlement:
    // a. Bill must be marked PAID
    const updatedBill = await localDbAdapter.getBillById(PRIMARY_TENANT_ID, bill.id);
    expect(updatedBill?.status).toBe("PAID");

    // b. Order must be marked COMPLETED
    const updatedOrder = await localDbAdapter.getOrderById(PRIMARY_TENANT_ID, order.id);
    expect(updatedOrder?.status).toBe("COMPLETED");

    // c. Table status must be marked PAID (awaiting busser / clearing)
    const tables = await localDbAdapter.getTables(PRIMARY_TENANT_ID);
    const updatedTable = tables.find((t) => t.id === table!.id);
    expect(updatedTable?.status).toBe("PAID");

    // d. Table session must be inactive (closed) with ended_at populated
    const activeAfter = await localDbAdapter.getActiveSession(PRIMARY_TENANT_ID, table!.id);
    expect(activeAfter).toBeNull();
  });

  it("prevents placing additional orders against a concluded or closed session", async () => {
    const table = await localDbAdapter.getTableByQr(PRIMARY_TENANT_ID, "vb_tbl_02_tok88b");
    expect(table).not.toBeNull();

    const session = await localDbAdapter.getOrCreateSession(PRIMARY_TENANT_ID, table!.id);

    // Conclude session explicitly
    await localDbAdapter.closeSession(PRIMARY_TENANT_ID, session.id);

    // Attempting to place an order on the closed session must fail
    await expect(
      localDbAdapter.createOrder(PRIMARY_TENANT_ID, {
        tableId: table!.id,
        sessionId: session.id,
        customerName: "Late Requester",
        items: [
          {
            menuItemId: "item-01",
            quantity: 1,
            options: [],
          },
        ],
      })
    ).rejects.toThrow("Cannot place an order for a completed or closed session");
  });

  it("does not conclude session or mark bill PAID on partial split payments", async () => {
    const table = await localDbAdapter.getTableByQr(PRIMARY_TENANT_ID, "vb_tbl_03_tok77c");
    expect(table).not.toBeNull();

    await localDbAdapter.updateTableStatus(PRIMARY_TENANT_ID, table!.id, "AVAILABLE");
    const session = await localDbAdapter.getOrCreateSession(PRIMARY_TENANT_ID, table!.id);

    const order = await localDbAdapter.createOrder(PRIMARY_TENANT_ID, {
      tableId: table!.id,
      sessionId: session.id,
      customerName: "Split Party",
      items: [
        {
          menuItemId: "item-02",
          quantity: 2,
          options: [],
        },
      ],
    });

    // Create split bill for 2 guests
    const bill = await localDbAdapter.generateBill(PRIMARY_TENANT_ID, {
      orderId: order.id,
      tableId: table!.id,
      sessionId: session.id,
      splitType: "EQUAL",
      splitCount: 2,
    });
    expect(bill.split_count).toBe(2);
    expect(bill.splits).toHaveLength(2);

    const firstSplit = bill.splits![0];

    // Pay only the first split
    await localDbAdapter.recordPayment(PRIMARY_TENANT_ID, {
      billId: bill.id,
      amount: firstSplit.assigned_amount,
      paymentMethod: "UPI",
      splitIndex: firstSplit.split_index,
    });

    // Check bill status: still GENERATED (not PAID)
    const billAfterSplit1 = await localDbAdapter.getBillById(PRIMARY_TENANT_ID, bill.id);
    expect(billAfterSplit1?.status).not.toBe("PAID");

    // Session must remain active
    const activeSession = await localDbAdapter.getActiveSession(PRIMARY_TENANT_ID, table!.id);
    expect(activeSession).not.toBeNull();
    expect(activeSession?.id).toBe(session.id);
  });

  it("rejects duplicate payment submissions on already settled bills", async () => {
    const table = await localDbAdapter.getTableByQr(PRIMARY_TENANT_ID, "vb_tbl_04_tok66d");
    expect(table).not.toBeNull();

    await localDbAdapter.updateTableStatus(PRIMARY_TENANT_ID, table!.id, "AVAILABLE");
    const session = await localDbAdapter.getOrCreateSession(PRIMARY_TENANT_ID, table!.id);

    const order = await localDbAdapter.createOrder(PRIMARY_TENANT_ID, {
      tableId: table!.id,
      sessionId: session.id,
      items: [
        {
          menuItemId: "item-01",
          quantity: 1,
          options: [],
        },
      ],
    });

    const bill = await localDbAdapter.generateBill(PRIMARY_TENANT_ID, {
      orderId: order.id,
      tableId: table!.id,
      sessionId: session.id,
    });

    // First payment succeeds
    await localDbAdapter.recordPayment(PRIMARY_TENANT_ID, {
      billId: bill.id,
      amount: bill.final_total,
      paymentMethod: "CARD",
    });

    // Second payment attempt on same bill must fail
    await expect(
      localDbAdapter.recordPayment(PRIMARY_TENANT_ID, {
        billId: bill.id,
        amount: bill.final_total,
        paymentMethod: "CARD",
      })
    ).rejects.toThrow("This bill has already been fully paid and settled");
  });

  it("resolves active orders when generating a bill without explicit orderId and validates positive amounts", async () => {
    const table = await localDbAdapter.getTableByQr(PRIMARY_TENANT_ID, "vb_tbl_05_tok55e");
    expect(table).not.toBeNull();

    await localDbAdapter.updateTableStatus(PRIMARY_TENANT_ID, table!.id, "AVAILABLE");
    const session = await localDbAdapter.getOrCreateSession(PRIMARY_TENANT_ID, table!.id);

    // Place an order for this session
    const order = await localDbAdapter.createOrder(PRIMARY_TENANT_ID, {
      tableId: table!.id,
      sessionId: session.id,
      items: [
        {
          menuItemId: "item-01",
          quantity: 2,
          options: [],
        },
      ],
    });

    // Generate bill with orderId omitted (staff clicks Generate Bill on table card)
    const bill = await localDbAdapter.generateBill(PRIMARY_TENANT_ID, {
      tableId: table!.id,
      sessionId: session.id,
    });

    // Bill must automatically derive subtotal from the active order rather than zero
    expect(bill.final_total).toBeGreaterThan(0);
    expect(bill.subtotal).toBe(order.subtotal);
  });
});
