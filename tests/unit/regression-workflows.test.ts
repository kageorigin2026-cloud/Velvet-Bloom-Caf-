import { describe, it, expect } from "vitest";
import { localDbAdapter } from "@/lib/adapter/local-adapter";
import { isValidOrderTransition, RecordPaymentSchema, UpdateOrderStatusSchema } from "@/lib/validation/schemas";
import { isValidUUID } from "@/lib/utils";
import { PRIMARY_TENANT_ID } from "@/lib/adapter/seed-data";

describe("Regression Tests: Core Operational Workflows", () => {
  describe("1. UUID Validation & Sanitization", () => {
    it("correctly identifies valid and invalid UUIDs", () => {
      // Valid RFC 4122 hexadecimal UUIDs
      expect(isValidUUID("00000000-0000-0000-0000-000000000001")).toBe(true);
      expect(isValidUUID("48cdfdb6-fab6-437d-b30f-842d18b5adcb")).toBe(true);
      expect(isValidUUID("c0000001-0000-0000-0000-000000000001")).toBe(true);

      // Non-UUID strings used in frontend/mocks
      expect(isValidUUID("user-chef-01")).toBe(false);
      expect(isValidUUID("user-staff-01")).toBe(false);
      expect(isValidUUID("sess-01")).toBe(false);
      expect(isValidUUID("")).toBe(false);
      expect(isValidUUID(undefined)).toBe(false);
      expect(isValidUUID(null)).toBe(false);
      expect(isValidUUID("not-a-uuid-at-all")).toBe(false);
    });
  });

  describe("2. Chef Order Acceptance & Status Transitions", () => {
    it("allows Chef to accept a PENDING order with non-UUID actor ID safely", async () => {
      // Create a test order
      const table = await localDbAdapter.getTableByQr(PRIMARY_TENANT_ID, "vb_tbl_02_tok88b");
      expect(table).not.toBeNull();

      const session = await localDbAdapter.getOrCreateSession(PRIMARY_TENANT_ID, table!.id, "Guest Test");
      const order = await localDbAdapter.createOrder(PRIMARY_TENANT_ID, {
        tableId: table!.id,
        sessionId: session.id,
        items: [{ menuItemId: "item-01", quantity: 1 }],
      });

      expect(order.status).toBe("PENDING");

      // Chef accepts the order with actorId: "user-chef-01"
      const accepted = await localDbAdapter.updateOrderStatus(
        PRIMARY_TENANT_ID,
        order.id,
        "ACCEPTED",
        "CHEF",
        "user-chef-01",
        "Chef accepted order"
      );

      expect(accepted.status).toBe("ACCEPTED");
      const lastEvent = accepted.events?.[accepted.events.length - 1];
      expect(lastEvent).toBeDefined();
      expect(lastEvent?.new_status).toBe("ACCEPTED");
      expect(lastEvent?.previous_status).toBe("PENDING");
      expect(lastEvent?.actor_type).toBe("CHEF");
    });

    it("is idempotent: accepting an already accepted order returns order without error", async () => {
      const table = await localDbAdapter.getTableByQr(PRIMARY_TENANT_ID, "vb_tbl_03_tok77c");
      const session = await localDbAdapter.getOrCreateSession(PRIMARY_TENANT_ID, table!.id);
      const order = await localDbAdapter.createOrder(PRIMARY_TENANT_ID, {
        tableId: table!.id,
        sessionId: session.id,
        items: [{ menuItemId: "item-02", quantity: 1 }],
      });

      await localDbAdapter.updateOrderStatus(PRIMARY_TENANT_ID, order.id, "ACCEPTED", "CHEF", "user-chef-01");

      // Second accept call must not throw or create duplicate transitions
      const secondCall = await localDbAdapter.updateOrderStatus(
        PRIMARY_TENANT_ID,
        order.id,
        "ACCEPTED",
        "CHEF",
        "user-chef-01"
      );
      expect(secondCall.status).toBe("ACCEPTED");
    });

    it("blocks illegal status transitions", async () => {
      const table = await localDbAdapter.getTableByQr(PRIMARY_TENANT_ID, "vb_tbl_04_tok66d");
      const session = await localDbAdapter.getOrCreateSession(PRIMARY_TENANT_ID, table!.id);
      const order = await localDbAdapter.createOrder(PRIMARY_TENANT_ID, {
        tableId: table!.id,
        sessionId: session.id,
        items: [{ menuItemId: "item-03", quantity: 1 }],
      });

      // PENDING directly to READY or COMPLETED is illegal
      await expect(
        localDbAdapter.updateOrderStatus(PRIMARY_TENANT_ID, order.id, "READY", "CHEF", "user-chef-01")
      ).rejects.toThrow(/Invalid order status transition/i);

      await expect(
        localDbAdapter.updateOrderStatus(PRIMARY_TENANT_ID, order.id, "COMPLETED", "CHEF", "user-chef-01")
      ).rejects.toThrow(/Invalid order status transition/i);
    });

    it("validates UpdateOrderStatusSchema with various actor formats", () => {
      const parsedValid = UpdateOrderStatusSchema.safeParse({
        status: "ACCEPTED",
        actorType: "CHEF",
        actorId: "user-chef-01",
        notes: "Chef accepted",
      });
      expect(parsedValid.success).toBe(true);

      const parsedInvalidStatus = UpdateOrderStatusSchema.safeParse({
        status: "COOKING_NOW", // invalid enum
      });
      expect(parsedInvalidStatus.success).toBe(false);
    });
  });

  describe("3. QR Table & Session Creation", () => {
    it("creates table session and safely transitions table to OCCUPIED", async () => {
      const table = await localDbAdapter.getTableByQr(PRIMARY_TENANT_ID, "vb_tbl_05_tok55e");
      expect(table).not.toBeNull();

      const session = await localDbAdapter.getOrCreateSession(
        PRIMARY_TENANT_ID,
        table!.id,
        "Lord Byron",
        "+91 99999 11111"
      );

      expect(session).toBeDefined();
      expect(session.is_active).toBe(true);
      expect(session.customer_name).toBe("Lord Byron");

      // Verify table status is OCCUPIED
      const tables = await localDbAdapter.getTables(PRIMARY_TENANT_ID);
      const updatedTable = tables.find((t) => t.id === table!.id);
      expect(updatedTable?.status).toBe("OCCUPIED");
    });

    it("reuses existing active session instead of creating duplicates on refresh", async () => {
      const table = await localDbAdapter.getTableByQr(PRIMARY_TENANT_ID, "vb_tbl_06_tok44f");
      const session1 = await localDbAdapter.getOrCreateSession(PRIMARY_TENANT_ID, table!.id, "Customer A");
      const session2 = await localDbAdapter.getOrCreateSession(PRIMARY_TENANT_ID, table!.id, "Customer A");

      expect(session1.id).toBe(session2.id);
      expect(session1.session_token).toBe(session2.session_token);
    });

    it("allows manual and programmatic table status transitions", async () => {
      const table = await localDbAdapter.getTableByQr(PRIMARY_TENANT_ID, "vb_tbl_07_tok33g");
      const updated = await localDbAdapter.updateTableStatus(PRIMARY_TENANT_ID, table!.id, "CLEANING");
      expect(updated.status).toBe("CLEANING");

      const available = await localDbAdapter.updateTableStatus(PRIMARY_TENANT_ID, table!.id, "AVAILABLE");
      expect(available.status).toBe("AVAILABLE");
    });
  });

  describe("4. Bill Payment Success & Duplicate Prevention", () => {
    it("records payment, settles bill, and marks order completed atomically", async () => {
      const table = await localDbAdapter.getTableByQr(PRIMARY_TENANT_ID, "vb_tbl_08_tok22h");
      const session = await localDbAdapter.getOrCreateSession(PRIMARY_TENANT_ID, table!.id);
      const order = await localDbAdapter.createOrder(PRIMARY_TENANT_ID, {
        tableId: table!.id,
        sessionId: session.id,
        items: [{ menuItemId: "item-01", quantity: 1 }],
      });

      const bill = await localDbAdapter.generateBill(PRIMARY_TENANT_ID, {
        tableId: table!.id,
        sessionId: session.id,
        orderId: order.id,
      });

      expect(["REQUESTED", "GENERATED"]).toContain(bill.status);
      expect(bill.final_total).toBeGreaterThan(0);

      // Record payment with non-UUID recordedBy string
      const payment = await localDbAdapter.recordPayment(PRIMARY_TENANT_ID, {
        billId: bill.id,
        amount: bill.final_total,
        paymentMethod: "UPI",
        transactionRef: "TXN-REGRESSION-12345",
        recordedBy: "user-staff-01",
      });

      expect(payment.status).toBe("COMPLETED");
      expect(payment.amount).toBe(bill.final_total);

      // Verify bill status updated to PAID
      const updatedBill = await localDbAdapter.getBillById(PRIMARY_TENANT_ID, bill.id);
      expect(updatedBill?.status).toBe("PAID");

      // Verify order status updated to COMPLETED
      const updatedOrder = await localDbAdapter.getOrderById(PRIMARY_TENANT_ID, order.id);
      expect(updatedOrder?.status).toBe("COMPLETED");

      // Verify table status updated to PAID
      const tables = await localDbAdapter.getTables(PRIMARY_TENANT_ID);
      const updatedTable = tables.find((t) => t.id === table!.id);
      expect(updatedTable?.status).toBe("PAID");
    });

    it("prevents duplicate payments on an already settled bill", async () => {
      const table = await localDbAdapter.getTableByQr(PRIMARY_TENANT_ID, "vb_tbl_09_tok11i");
      const session = await localDbAdapter.getOrCreateSession(PRIMARY_TENANT_ID, table!.id);
      const bill = await localDbAdapter.generateBill(PRIMARY_TENANT_ID, {
        tableId: table!.id,
        sessionId: session.id,
      });

      // First payment settles the bill
      await localDbAdapter.recordPayment(PRIMARY_TENANT_ID, {
        billId: bill.id,
        amount: bill.final_total,
        paymentMethod: "CASH",
        recordedBy: "user-staff-01",
      });

      // Second payment must be rejected
      await expect(
        localDbAdapter.recordPayment(PRIMARY_TENANT_ID, {
          billId: bill.id,
          amount: bill.final_total,
          paymentMethod: "CASH",
          recordedBy: "user-staff-01",
        })
      ).rejects.toThrow(/already been fully paid/i);
    });

    it("validates RecordPaymentSchema: coerces string amounts and rejects invalid amounts", () => {
      // Coerces string amount to number
      const parsedWithStrings = RecordPaymentSchema.safeParse({
        billId: "bill-01",
        amount: "320.50",
        paymentMethod: "CARD",
        recordedBy: "user-staff-01",
      });
      expect(parsedWithStrings.success).toBe(true);
      if (parsedWithStrings.success) {
        expect(parsedWithStrings.data.amount).toBe(320.5);
      }

      // Rejects negative or zero amount
      const parsedZero = RecordPaymentSchema.safeParse({
        billId: "bill-01",
        amount: 0,
        paymentMethod: "CASH",
      });
      expect(parsedZero.success).toBe(false);

      const parsedNegative = RecordPaymentSchema.safeParse({
        billId: "bill-01",
        amount: -100,
        paymentMethod: "CASH",
      });
      expect(parsedNegative.success).toBe(false);
    });
  });
});
