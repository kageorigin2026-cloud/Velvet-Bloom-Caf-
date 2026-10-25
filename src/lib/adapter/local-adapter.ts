import {
  Tenant,
  CafeSettings,
  User,
  CafeTable,
  TableSession,
  Category,
  MenuItem,
  Order,
  OrderItem,
  OrderStatus,
  TableStatus,
  Bill,
  BillStatus,
  SplitType,
  Payment,
  ServiceRequest,
  ServiceRequestStatus,
  Review,
  Rolling15DayAnalytics,
  LiveDashboardKPIs,
  DailyAnalytics,
  ItemSalesPerformance,
  CategorySalesPerformance,
  HourlyDistribution,
} from "@/types/database.types";
import { DatabaseAdapter } from "./types";
import {
  INITIAL_TENANTS,
  INITIAL_SETTINGS,
  INITIAL_USERS,
  INITIAL_TABLES,
  INITIAL_CATEGORIES,
  INITIAL_MENU_ITEMS,
  INITIAL_ORDERS,
  INITIAL_BILLS,
  INITIAL_SERVICE_REQUESTS,
  INITIAL_REVIEWS,
  PRIMARY_TENANT_ID,
} from "./seed-data";
import {
  CreateOrderSchema,
  AddAdditionalItemSchema,
  GenerateBillSchema,
  RecordPaymentSchema,
  CreateServiceRequestSchema,
  CreateReviewSchema,
  isValidOrderTransition,
} from "@/lib/validation/schemas";
import { calculateOrderPricing, calculateEqualSplit } from "@/lib/pricing";
import { z } from "zod";

type EventCallback = (event: { type: string; payload: any; tenantId: string }) => void;

class LocalDatabaseAdapterImpl implements DatabaseAdapter {
  readonly adapterName = "local" as const;

  private tenants: Tenant[] = [];
  private settings: Record<string, CafeSettings> = {};
  private users: User[] = [];
  private tables: CafeTable[] = [];
  private sessions: TableSession[] = [];
  private categories: Category[] = [];
  private menuItems: MenuItem[] = [];
  private orders: Order[] = [];
  private bills: Bill[] = [];
  private payments: Payment[] = [];
  private serviceRequests: ServiceRequest[] = [];
  private reviews: Review[] = [];

  private listeners: Set<EventCallback> = new Set();
  private initialized = false;

  constructor() {
    this.init();
  }

  private init() {
    if (this.initialized) return;

    this.tenants = JSON.parse(JSON.stringify(INITIAL_TENANTS));
    this.settings = JSON.parse(JSON.stringify(INITIAL_SETTINGS));
    this.users = JSON.parse(JSON.stringify(INITIAL_USERS));
    this.tables = JSON.parse(JSON.stringify(INITIAL_TABLES));
    this.categories = JSON.parse(JSON.stringify(INITIAL_CATEGORIES));
    this.menuItems = JSON.parse(JSON.stringify(INITIAL_MENU_ITEMS));
    this.orders = JSON.parse(JSON.stringify(INITIAL_ORDERS));
    this.bills = JSON.parse(JSON.stringify(INITIAL_BILLS));
    this.serviceRequests = JSON.parse(JSON.stringify(INITIAL_SERVICE_REQUESTS));
    this.reviews = JSON.parse(JSON.stringify(INITIAL_REVIEWS));

    // Seed 15 days of historical orders and settled payments for realistic analytics
    this.seed15DayHistoricalRecords();

    this.initialized = true;
  }

  private seed15DayHistoricalRecords() {
    const now = new Date();
    const primaryItems = this.menuItems.filter((i) => i.tenant_id === PRIMARY_TENANT_ID);
    if (primaryItems.length === 0) return;

    // Seed 15 past days
    for (let dayOffset = 14; dayOffset >= 1; dayOffset--) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() - dayOffset);

      // Vary orders per day between 10 and 25
      const ordersForDay = 12 + ((dayOffset * 7) % 12);

      for (let i = 0; i < ordersForDay; i++) {
        const orderHour = 9 + ((i * 3) % 13); // Hours 9am - 10pm
        const orderMinute = (i * 17) % 60;
        const orderTime = new Date(targetDate);
        orderTime.setHours(orderHour, orderMinute, 0, 0);

        const orderId = `hist-order-${dayOffset}-${i}`;
        const orderNum = `VB-${orderTime.toISOString().slice(0, 10).replace(/-/g, "")}-${String(100 + i)}`;

        // Pick 1 to 3 items
        const numItems = 1 + (i % 3);
        const orderItems: OrderItem[] = [];
        let subtotal = 0;

        for (let j = 0; j < numItems; j++) {
          const item = primaryItems[(i + j) % primaryItems.length];
          const qty = 1 + ((i + j) % 2);
          const itemTotal = item.price * qty;
          subtotal += itemTotal;

          orderItems.push({
            id: `hist-item-${dayOffset}-${i}-${j}`,
            order_id: orderId,
            menu_item_id: item.id,
            item_name: item.name,
            item_price: item.price,
            quantity: qty,
            options_price: 0,
            item_total: itemTotal,
            created_at: orderTime.toISOString(),
          });
        }

        const isCancelled = i === 3 && dayOffset % 4 === 0;
        const status: OrderStatus = isCancelled ? "CANCELLED" : "COMPLETED";
        const tax = Math.round(subtotal * 0.05 * 100) / 100;
        const total = subtotal + tax;

        const histOrder: Order = {
          id: orderId,
          tenant_id: PRIMARY_TENANT_ID,
          order_number: orderNum,
          table_id: this.tables[i % this.tables.length].id,
          session_id: `hist-sess-${dayOffset}-${i}`,
          customer_name: `Guest #${dayOffset}-${i}`,
          status,
          subtotal,
          tax,
          discount: 0,
          total,
          estimated_time_minutes: 15,
          created_at: orderTime.toISOString(),
          updated_at: new Date(orderTime.getTime() + 25 * 60000).toISOString(),
          items: orderItems,
        };

        this.orders.push(histOrder);

        if (!isCancelled) {
          const billId = `hist-bill-${dayOffset}-${i}`;
          this.bills.push({
            id: billId,
            tenant_id: PRIMARY_TENANT_ID,
            bill_number: `INV-${orderTime.toISOString().slice(0, 10).replace(/-/g, "")}-${String(100 + i)}`,
            order_id: orderId,
            table_id: histOrder.table_id,
            session_id: histOrder.session_id,
            subtotal,
            tax,
            service_charge: 0,
            discount: 0,
            final_total: total,
            split_type: "NONE",
            split_count: 1,
            status: "PAID",
            created_at: new Date(orderTime.getTime() + 20 * 60000).toISOString(),
            updated_at: new Date(orderTime.getTime() + 22 * 60000).toISOString(),
          });

          this.payments.push({
            id: `hist-pay-${dayOffset}-${i}`,
            tenant_id: PRIMARY_TENANT_ID,
            bill_id: billId,
            amount: total,
            payment_method: i % 2 === 0 ? "UPI" : i % 3 === 0 ? "CARD" : "CASH",
            transaction_ref: `TXN-${dayOffset}-${i}-${Date.now().toString().slice(-6)}`,
            status: "COMPLETED",
            recorded_by: "user-staff-01",
            created_at: new Date(orderTime.getTime() + 22 * 60000).toISOString(),
          });
        }
      }
    }
  }

  public subscribe(cb: EventCallback): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private emit(type: string, payload: any, tenantId: string) {
    for (const listener of this.listeners) {
      try {
        listener({ type, payload, tenantId });
      } catch (err) {
        console.error("Local event listener error:", err);
      }
    }
  }

  // Tenant & Cafe Info
  async getTenant(tenantId: string): Promise<Tenant | null> {
    return this.tenants.find((t) => t.id === tenantId) || null;
  }

  async getSettings(tenantId: string): Promise<CafeSettings> {
    const s = this.settings[tenantId];
    if (s) return { ...s };
    return {
      id: `settings-${tenantId}`,
      tenant_id: tenantId,
      cafe_name: "Velvet Bloom Café",
      tagline: "Sip. Savor. Bloom.",
      tech_brand: "Powered by Kage Origin",
      tax_rate: 5.0,
      service_charge_rate: 0.0,
      currency: "₹",
      is_ordering_paused: false,
      busy_message: "Kitchen is busy.",
      average_prep_time_minutes: 15,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  async updateSettings(tenantId: string, updates: Partial<CafeSettings>): Promise<CafeSettings> {
    const current = await this.getSettings(tenantId);
    const updated: CafeSettings = {
      ...current,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.settings[tenantId] = updated;
    this.emit("settings.updated", updated, tenantId);
    return updated;
  }

  // Tables & Sessions
  async getTables(tenantId: string): Promise<CafeTable[]> {
    return this.tables.filter((t) => t.tenant_id === tenantId);
  }

  async getTableByQr(tenantId: string, qrToken: string): Promise<CafeTable | null> {
    return this.tables.find((t) => t.tenant_id === tenantId && t.qr_code_token === qrToken) || null;
  }

  async updateTableStatus(tenantId: string, tableId: string, status: TableStatus): Promise<CafeTable> {
    const table = this.tables.find((t) => t.tenant_id === tenantId && t.id === tableId);
    if (!table) throw new Error(`Table not found for tenant ${tenantId}`);
    table.status = status;
    table.updated_at = new Date().toISOString();
    this.emit("table.status_changed", table, tenantId);
    return { ...table };
  }

  async getOrCreateSession(
    tenantId: string,
    tableId: string,
    customerName?: string,
    phone?: string,
    qrToken?: string
  ): Promise<TableSession> {
    const existing = this.sessions.find(
      (s) => s.tenant_id === tenantId && s.table_id === tableId && s.is_active
    );
    if (existing) {
      if (customerName && !existing.customer_name) existing.customer_name = customerName;
      if (phone && !existing.customer_phone) existing.customer_phone = phone;
      return { ...existing };
    }

    const newSession: TableSession = {
      id: `sess-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tenant_id: tenantId,
      table_id: tableId,
      session_token: `stok_${Math.random().toString(36).substring(2, 12)}`,
      customer_name: customerName || "Valued Guest",
      customer_phone: phone,
      guest_count: 2,
      is_active: true,
      started_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    this.sessions.push(newSession);

    // Update table status to occupied
    await this.updateTableStatus(tenantId, tableId, "OCCUPIED");
    return { ...newSession };
  }

  async getActiveSession(tenantId: string, tableId: string): Promise<TableSession | null> {
    const session = this.sessions.find(
      (s) => s.tenant_id === tenantId && s.table_id === tableId && s.is_active
    );
    return session ? { ...session } : null;
  }

  async closeSession(tenantId: string, sessionId: string): Promise<TableSession> {
    const session = this.sessions.find((s) => s.tenant_id === tenantId && s.id === sessionId);
    if (!session) throw new Error("Session not found");
    session.is_active = false;
    session.ended_at = new Date().toISOString();
    return { ...session };
  }

  // Menu & Categories
  async getCategories(tenantId: string): Promise<Category[]> {
    return this.categories
      .filter((c) => c.tenant_id === tenantId && c.is_active)
      .sort((a, b) => a.display_order - b.display_order);
  }

  async getMenuItems(tenantId: string, categoryId?: string): Promise<MenuItem[]> {
    return this.menuItems.filter((i) => {
      if (i.tenant_id !== tenantId) return false;
      if (categoryId && i.category_id !== categoryId) return false;
      return true;
    });
  }

  async getMenuItemById(tenantId: string, itemId: string): Promise<MenuItem | null> {
    return this.menuItems.find((i) => i.tenant_id === tenantId && i.id === itemId) || null;
  }

  async updateMenuItemAvailability(tenantId: string, itemId: string, isAvailable: boolean): Promise<MenuItem> {
    const item = this.menuItems.find((i) => i.tenant_id === tenantId && i.id === itemId);
    if (!item) throw new Error("Menu item not found");
    item.is_available = isAvailable;
    item.updated_at = new Date().toISOString();
    this.emit("menu_item.updated", item, tenantId);
    return { ...item };
  }

  // Orders
  async createOrder(tenantId: string, data: z.infer<typeof CreateOrderSchema>): Promise<Order> {
    const settings = await this.getSettings(tenantId);
    const table = this.tables.find((t) => t.tenant_id === tenantId && t.id === data.tableId);
    if (!table) throw new Error("Invalid table for tenant");

    const session = this.sessions.find((s) => s.tenant_id === tenantId && s.id === data.sessionId);
    if (session && !session.is_active) {
      throw new Error("Cannot place an order for a completed or closed session");
    }

    const orderId = `order-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const seq = String(this.orders.filter((o) => o.tenant_id === tenantId).length + 1).padStart(4, "0");
    const orderNumber = `VB-${datePrefix}-${seq}`;

    // Authoritatively recalculate pricing from menu items database
    const pricingInputs: { unitPrice: number; quantity: number; optionsExtraPrice: number }[] = [];
    const orderItems: OrderItem[] = [];

    for (const itemInput of data.items) {
      const dbItem = this.menuItems.find((m) => m.tenant_id === tenantId && m.id === itemInput.menuItemId);
      if (!dbItem) throw new Error(`Menu item not found: ${itemInput.menuItemId}`);
      if (!dbItem.is_available) throw new Error(`Item currently unavailable: ${dbItem.name}`);

      const optionsExtra = (itemInput.options || []).reduce((acc, opt) => acc + (opt.extraPrice || 0), 0);
      const qty = Math.max(1, itemInput.quantity || 1);
      const itemTotal = (dbItem.price + optionsExtra) * qty;

      pricingInputs.push({
        unitPrice: dbItem.price,
        quantity: qty,
        optionsExtraPrice: optionsExtra,
      });

      orderItems.push({
        id: `oi-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        order_id: orderId,
        menu_item_id: dbItem.id,
        item_name: dbItem.name,
        item_price: dbItem.price,
        quantity: qty,
        options_price: optionsExtra,
        item_total: itemTotal,
        special_notes: itemInput.specialNotes,
        is_additional: false,
        created_at: new Date().toISOString(),
        options: (itemInput.options || []).map((opt) => ({
          group_name: opt.groupName,
          option_name: opt.optionName,
          extra_price: opt.extraPrice,
        })),
      });
    }

    const calculated = calculateOrderPricing(pricingInputs, settings.tax_rate, settings.service_charge_rate, 0);

    const newOrder: Order = {
      id: orderId,
      tenant_id: tenantId,
      order_number: orderNumber,
      table_id: data.tableId,
      session_id: data.sessionId,
      customer_name: data.customerName || "Valued Guest",
      customer_phone: data.customerPhone,
      status: "PENDING",
      subtotal: calculated.subtotal,
      tax: calculated.tax,
      discount: calculated.discount,
      total: calculated.finalTotal,
      special_instructions: data.specialInstructions,
      estimated_time_minutes: settings.average_prep_time_minutes || 15,
      eta_timestamp: new Date(Date.now() + (settings.average_prep_time_minutes || 15) * 60000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: orderItems,
      events: [
        {
          id: `ev-${Date.now()}`,
          order_id: orderId,
          previous_status: null,
          new_status: "PENDING",
          actor_type: "CUSTOMER",
          notes: "Order placed by customer via table QR",
          created_at: new Date().toISOString(),
        },
      ],
      table: { ...table },
    };

    this.orders.unshift(newOrder);

    // Update table status
    await this.updateTableStatus(tenantId, data.tableId, "OCCUPIED");

    this.emit("order.created", newOrder, tenantId);
    return { ...newOrder };
  }

  async getOrderById(tenantId: string, orderId: string): Promise<Order | null> {
    const o = this.orders.find((ord) => ord.tenant_id === tenantId && ord.id === orderId);
    if (!o) return null;
    return { ...o, table: this.tables.find((t) => t.id === o.table_id) };
  }

  async getOrderByNumber(tenantId: string, orderNumber: string): Promise<Order | null> {
    const o = this.orders.find((ord) => ord.tenant_id === tenantId && ord.order_number === orderNumber);
    if (!o) return null;
    return { ...o, table: this.tables.find((t) => t.id === o.table_id) };
  }

  async getOrders(tenantId: string, filter?: { status?: OrderStatus; tableId?: string }): Promise<Order[]> {
    return this.orders
      .filter((o) => {
        if (o.tenant_id !== tenantId) return false;
        if (filter?.status && o.status !== filter.status) return false;
        if (filter?.tableId && o.table_id !== filter.tableId) return false;
        return true;
      })
      .map((o) => ({
        ...o,
        table: this.tables.find((t) => t.id === o.table_id),
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async updateOrderStatus(
    tenantId: string,
    orderId: string,
    newStatus: OrderStatus,
    actorType: string,
    actorId?: string,
    notes?: string
  ): Promise<Order> {
    const order = this.orders.find((o) => o.tenant_id === tenantId && o.id === orderId);
    if (!order) throw new Error("Order not found");

    if (order.status === newStatus) {
      return order;
    }

    if (!isValidOrderTransition(order.status, newStatus)) {
      throw new Error(`Invalid order status transition from ${order.status} to ${newStatus}`);
    }

    const prevStatus = order.status;
    order.status = newStatus;
    order.updated_at = new Date().toISOString();

    if (!order.events) order.events = [];
    order.events.push({
      id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      order_id: orderId,
      previous_status: prevStatus,
      new_status: newStatus,
      actor_type: actorType,
      actor_id: actorId,
      notes: notes || `Status changed from ${prevStatus} to ${newStatus}`,
      created_at: new Date().toISOString(),
    });

    this.emit("order.updated", order, tenantId);

    if (newStatus === "READY") {
      this.emit("order.ready", order, tenantId);
    } else if (newStatus === "SERVED") {
      this.emit("order.served", order, tenantId);
    } else if (newStatus === "COMPLETED") {
      this.emit("order.completed", order, tenantId);
    } else if (newStatus === "CANCELLED" || newStatus === "REJECTED") {
      this.emit("order.cancelled", order, tenantId);
    }

    return { ...order, table: this.tables.find((t) => t.id === order.table_id) };
  }

  async addAdditionalItem(tenantId: string, data: z.infer<typeof AddAdditionalItemSchema>): Promise<Order> {
    const order = this.orders.find((o) => o.tenant_id === tenantId && o.id === data.orderId);
    if (!order) throw new Error("Order not found");

    if (order.status === "COMPLETED" || order.status === "CANCELLED" || order.status === "REJECTED") {
      throw new Error(`Cannot add additional items to a ${order.status} order`);
    }

    const dbItem = this.menuItems.find((m) => m.tenant_id === tenantId && m.id === data.menuItemId);
    if (!dbItem) throw new Error("Menu item not found");
    if (!dbItem.is_available) throw new Error(`Item ${dbItem.name} is currently unavailable`);

    const optionsExtra = (data.options || []).reduce((acc, opt) => acc + (opt.extraPrice || 0), 0);
    const qty = Math.max(1, data.quantity || 1);
    const itemTotal = (dbItem.price + optionsExtra) * qty;

    const newItem: OrderItem = {
      id: `oi-add-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      order_id: order.id,
      menu_item_id: dbItem.id,
      item_name: dbItem.name,
      item_price: dbItem.price,
      quantity: qty,
      options_price: optionsExtra,
      item_total: itemTotal,
      special_notes: data.specialNotes,
      is_additional: true,
      added_by_staff_id: data.staffId,
      created_at: new Date().toISOString(),
      options: (data.options || []).map((opt) => ({
        group_name: opt.groupName,
        option_name: opt.optionName,
        extra_price: opt.extraPrice,
      })),
    };

    if (!order.items) order.items = [];
    order.items.push(newItem);

    // Authoritative recalculation of order totals
    const settings = await this.getSettings(tenantId);
    const pricingInputs = order.items.map((i) => ({
      unitPrice: i.item_price,
      quantity: i.quantity,
      optionsExtraPrice: i.options_price,
    }));

    const calculated = calculateOrderPricing(pricingInputs, settings.tax_rate, settings.service_charge_rate, order.discount);
    order.subtotal = calculated.subtotal;
    order.tax = calculated.tax;
    order.total = calculated.finalTotal;
    order.updated_at = new Date().toISOString();

    // If order was READY or SERVED, reopen status to PREPARING so Kitchen can fulfill addition
    if (order.status === "READY" || order.status === "SERVED") {
      order.status = "PREPARING";
    }

    if (!order.events) order.events = [];
    order.events.push({
      id: `ev-${Date.now()}`,
      order_id: order.id,
      previous_status: order.status,
      new_status: order.status,
      actor_type: "STAFF",
      actor_id: data.staffId,
      notes: `Additional item added: ${qty}x ${dbItem.name}`,
      created_at: new Date().toISOString(),
    });

    // If a bill exists for this order, update bill totals as well
    const existingBill = this.bills.find((b) => b.tenant_id === tenantId && b.order_id === order.id && b.status !== "PAID");
    if (existingBill) {
      existingBill.subtotal = calculated.subtotal;
      existingBill.tax = calculated.tax;
      existingBill.final_total = calculated.finalTotal;
      existingBill.updated_at = new Date().toISOString();
      this.emit("bill.updated", existingBill, tenantId);
    }

    this.emit("order.additional_item_added", { order, newItem }, tenantId);
    this.emit("order.updated", order, tenantId);

    return { ...order, table: this.tables.find((t) => t.id === order.table_id) };
  }

  // Bills & Payments
  async getBills(tenantId: string, status?: BillStatus): Promise<Bill[]> {
    return this.bills
      .filter((b) => {
        if (b.tenant_id !== tenantId) return false;
        if (status && b.status !== status) return false;
        return true;
      })
      .map((b) => ({
        ...b,
        table: this.tables.find((t) => t.id === b.table_id),
        order: this.orders.find((o) => o.id === b.order_id),
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async getBillById(tenantId: string, billId: string): Promise<Bill | null> {
    const b = this.bills.find((bill) => bill.tenant_id === tenantId && bill.id === billId);
    if (!b) return null;
    return {
      ...b,
      table: this.tables.find((t) => t.id === b.table_id),
      order: this.orders.find((o) => o.id === b.order_id),
    };
  }

  async getBillByOrderId(tenantId: string, orderId: string): Promise<Bill | null> {
    const b = this.bills.find((bill) => bill.tenant_id === tenantId && bill.order_id === orderId);
    if (!b) return null;
    return {
      ...b,
      table: this.tables.find((t) => t.id === b.table_id),
      order: this.orders.find((o) => o.id === b.order_id),
    };
  }

  async generateBill(tenantId: string, data: z.infer<typeof GenerateBillSchema>): Promise<Bill> {
    const settings = await this.getSettings(tenantId);
    const existing = this.bills.find(
      (b) => b.tenant_id === tenantId && b.order_id === data.orderId && b.status !== "CANCELLED"
    );

    let subtotal = 0;
    if (data.orderId) {
      const order = this.orders.find((o) => o.tenant_id === tenantId && o.id === data.orderId);
      if (order) subtotal = order.subtotal;
    } else {
      const tableOrders = this.orders.filter(
        (o) =>
          o.tenant_id === tenantId &&
          (o.table_id === data.tableId || o.session_id === data.sessionId) &&
          o.status !== "COMPLETED" &&
          o.status !== "CANCELLED" &&
          o.status !== "REJECTED"
      );
      if (tableOrders.length > 0) {
        subtotal = tableOrders.reduce((sum, o) => sum + o.subtotal, 0);
        data.orderId = tableOrders[0].id;
      }
    }

    const calculated = calculateOrderPricing(
      [{ unitPrice: subtotal, quantity: 1, optionsExtraPrice: 0 }],
      settings.tax_rate,
      settings.service_charge_rate,
      data.discountAmount || 0
    );

    if (existing) {
      existing.subtotal = calculated.subtotal;
      existing.tax = calculated.tax;
      existing.service_charge = calculated.serviceCharge;
      existing.discount = calculated.discount;
      existing.final_total = calculated.finalTotal;
      existing.split_type = data.splitType || existing.split_type;
      existing.split_count = data.splitCount || existing.split_count;
      existing.status = "GENERATED";
      existing.updated_at = new Date().toISOString();
      this.emit("bill.updated", existing, tenantId);
      return { ...existing };
    }

    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const seq = String(this.bills.filter((b) => b.tenant_id === tenantId).length + 1).padStart(4, "0");
    const billNumber = `INV-${datePrefix}-${seq}`;

    const newBill: Bill = {
      id: `bill-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      tenant_id: tenantId,
      bill_number: billNumber,
      order_id: data.orderId,
      table_id: data.tableId,
      session_id: data.sessionId,
      subtotal: calculated.subtotal,
      tax: calculated.tax,
      service_charge: calculated.serviceCharge,
      discount: calculated.discount,
      final_total: calculated.finalTotal,
      split_type: data.splitType || "NONE",
      split_count: data.splitCount || 1,
      status: "GENERATED",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (newBill.split_type === "EQUAL" && newBill.split_count > 1) {
      const splits = calculateEqualSplit(newBill.final_total, newBill.split_count);
      newBill.splits = splits.map((amt, idx) => ({
        id: `split-${newBill.id}-${idx}`,
        bill_id: newBill.id,
        split_index: idx + 1,
        person_label: `Person ${idx + 1}`,
        assigned_amount: amt,
        payment_status: "PENDING",
      }));
    }

    this.bills.unshift(newBill);

    // Update table status
    await this.updateTableStatus(tenantId, data.tableId, "BILL_REQUESTED");

    this.emit("bill.requested", newBill, tenantId);
    return { ...newBill };
  }

  async splitBill(tenantId: string, billId: string, splitType: SplitType, splitCount: number): Promise<Bill> {
    const bill = this.bills.find((b) => b.tenant_id === tenantId && b.id === billId);
    if (!bill) throw new Error("Bill not found");

    bill.split_type = splitType;
    bill.split_count = splitCount;

    if (splitType === "EQUAL" && splitCount > 1) {
      const splitAmounts = calculateEqualSplit(bill.final_total, splitCount);
      bill.splits = splitAmounts.map((amt, idx) => ({
        id: `split-${bill.id}-${idx}`,
        bill_id: bill.id,
        split_index: idx + 1,
        person_label: `Person ${idx + 1}`,
        assigned_amount: amt,
        payment_status: "PENDING",
      }));
    } else {
      bill.splits = undefined;
    }

    bill.updated_at = new Date().toISOString();
    this.emit("bill.updated", bill, tenantId);
    return { ...bill };
  }

  async recordPayment(tenantId: string, data: z.infer<typeof RecordPaymentSchema>): Promise<Payment> {
    const bill = this.bills.find((b) => b.tenant_id === tenantId && b.id === data.billId);
    if (!bill) throw new Error("Bill not found");

    if (bill.status === "PAID") {
      throw new Error("This bill has already been fully paid and settled");
    }

    const paymentId = `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newPayment: Payment = {
      id: paymentId,
      tenant_id: tenantId,
      bill_id: bill.id,
      amount: data.amount,
      payment_method: data.paymentMethod,
      transaction_ref: data.transactionRef || `TXN-${Date.now().toString().slice(-8)}`,
      status: "COMPLETED",
      recorded_by: data.recordedBy,
      created_at: new Date().toISOString(),
    };

    this.payments.push(newPayment);

    // If split payment
    if (bill.split_type === "EQUAL" && bill.splits && data.splitIndex !== undefined) {
      const sp = bill.splits.find((s) => s.split_index === data.splitIndex);
      if (sp) {
        sp.payment_status = "PAID";
        sp.payment_method = data.paymentMethod;
        sp.paid_at = new Date().toISOString();
      }

      // Check if all splits are settled
      const allPaid = bill.splits.every((s) => s.payment_status === "PAID");
      if (allPaid) {
        bill.status = "PAID";
        bill.updated_at = new Date().toISOString();
      }
    } else {
      // Single settlement
      bill.status = "PAID";
      bill.updated_at = new Date().toISOString();
    }

    // If bill is paid, complete order and mark table available
    if (bill.status === "PAID") {
      if (bill.order_id) {
        const order = this.orders.find((o) => o.id === bill.order_id);
        if (order && order.status !== "COMPLETED") {
          order.status = "COMPLETED";
          order.updated_at = new Date().toISOString();
          this.emit("order.completed", order, tenantId);
        }
      }
      await this.updateTableStatus(tenantId, bill.table_id, "PAID");

      // Conclude session upon full settlement
      if (bill.session_id) {
        const sess = this.sessions.find((s) => s.id === bill.session_id);
        if (sess) {
          sess.is_active = false;
          sess.ended_at = new Date().toISOString();
        }
      }
      const activeTableSession = this.sessions.find((s) => s.table_id === bill.table_id && s.is_active);
      if (activeTableSession) {
        activeTableSession.is_active = false;
        activeTableSession.ended_at = new Date().toISOString();
      }
    }

    this.emit("payment.completed", { payment: newPayment, bill }, tenantId);
    return { ...newPayment };
  }

  async getPayments(tenantId: string): Promise<Payment[]> {
    return this.payments
      .filter((p) => p.tenant_id === tenantId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  // Service Requests
  async getServiceRequests(tenantId: string, status?: ServiceRequestStatus): Promise<ServiceRequest[]> {
    return this.serviceRequests
      .filter((r) => {
        if (r.tenant_id !== tenantId) return false;
        if (status && r.status !== status) return false;
        return true;
      })
      .map((r) => ({
        ...r,
        table: this.tables.find((t) => t.id === r.table_id),
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async createServiceRequest(
    tenantId: string,
    data: z.infer<typeof CreateServiceRequestSchema>
  ): Promise<ServiceRequest> {
    const table = this.tables.find((t) => t.tenant_id === tenantId && t.id === data.tableId);
    if (!table) throw new Error("Table not found");

    const req: ServiceRequest = {
      id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      tenant_id: tenantId,
      table_id: data.tableId,
      session_id: data.sessionId,
      request_type: data.requestType,
      status: "PENDING",
      notes: data.notes,
      created_at: new Date().toISOString(),
      table: { ...table },
    };

    this.serviceRequests.unshift(req);
    this.emit("service_request.created", req, tenantId);
    return { ...req };
  }

  async updateServiceRequestStatus(
    tenantId: string,
    requestId: string,
    status: ServiceRequestStatus
  ): Promise<ServiceRequest> {
    const req = this.serviceRequests.find((r) => r.tenant_id === tenantId && r.id === requestId);
    if (!req) throw new Error("Service request not found");
    req.status = status;
    this.emit("service_request.updated", req, tenantId);
    return { ...req, table: this.tables.find((t) => t.id === req.table_id) };
  }

  // Reviews
  async getReviews(tenantId: string): Promise<Review[]> {
    return this.reviews
      .filter((r) => r.tenant_id === tenantId && r.is_approved)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async createReview(tenantId: string, data: z.infer<typeof CreateReviewSchema>): Promise<Review> {
    const review: Review = {
      id: `rev-${Date.now()}`,
      tenant_id: tenantId,
      menu_item_id: data.menuItemId,
      order_id: data.orderId,
      session_id: data.sessionId,
      customer_name: data.customerName || "Valued Guest",
      rating: data.rating,
      comment: data.comment,
      cafe_ambience_rating: data.cafeAmbienceRating,
      service_rating: data.serviceRating,
      is_approved: true,
      created_at: new Date().toISOString(),
    };
    this.reviews.unshift(review);
    return { ...review };
  }

  // Users / Staff
  async getUsers(tenantId: string): Promise<User[]> {
    return this.users.filter((u) => u.tenant_id === tenantId && u.is_active);
  }

  async getUserByEmail(tenantId: string, email: string): Promise<User | null> {
    return this.users.find((u) => u.tenant_id === tenantId && u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  async getUserByPin(tenantId: string, pin: string, clientIp?: string): Promise<User | null> {
    return this.users.find((u) => u.tenant_id === tenantId && u.pin_code === pin && u.is_active) || null;
  }

  async hasActiveOwner(tenantId: string): Promise<boolean> {
    return this.users.some((u) => u.tenant_id === tenantId && u.role === "OWNER" && u.is_active);
  }

  async provisionInitialOwner(
    tenantId: string,
    fullName: string,
    email: string,
    pin: string
  ): Promise<User> {
    const existing = this.users.find((u) => u.tenant_id === tenantId && u.role === "OWNER");
    if (existing) {
      throw new Error("Tenant already has an owner configured.");
    }
    const newUser: User = {
      id: `u-owner-${Date.now()}`,
      tenant_id: tenantId,
      full_name: fullName.trim(),
      email: email.trim().toLowerCase(),
      role: "OWNER",
      pin_code: pin.trim(),
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.users.push(newUser);
    return newUser;
  }

  // Live KPIs
  async getLiveKPIs(tenantId: string): Promise<LiveDashboardKPIs> {
    const tenantOrders = this.orders.filter((o) => o.tenant_id === tenantId);
    const tenantBills = this.bills.filter((b) => b.tenant_id === tenantId);
    const tenantTables = this.tables.filter((t) => t.tenant_id === tenantId);

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayOrders = tenantOrders.filter((o) => o.created_at.startsWith(todayStr));

    const pending = todayOrders.filter((o) => o.status === "PENDING").length;
    const accepted = todayOrders.filter((o) => o.status === "ACCEPTED").length;
    const preparing = todayOrders.filter((o) => o.status === "PREPARING").length;
    const ready = todayOrders.filter((o) => o.status === "READY").length;
    const served = todayOrders.filter((o) => o.status === "SERVED").length;
    const completed = todayOrders.filter((o) => o.status === "COMPLETED").length;
    const cancelled = todayOrders.filter((o) => o.status === "CANCELLED" || o.status === "REJECTED").length;

    const activeTables = tenantTables.filter((t) => t.status !== "AVAILABLE" && t.status !== "CLEANING").length;
    const outstandingBills = tenantBills.filter((b) => b.status === "REQUESTED").length;

    const paidBillsToday = tenantBills.filter(
      (b) => b.status === "PAID" && b.updated_at.startsWith(todayStr)
    );
    const revenueToday = paidBillsToday.reduce((sum, b) => sum + b.final_total, 0);

    const completedOrPaidOrders = todayOrders.filter((o) => o.status !== "CANCELLED" && o.status !== "REJECTED");
    const aov =
      completedOrPaidOrders.length > 0
        ? Math.round((completedOrPaidOrders.reduce((sum, o) => sum + o.total, 0) / completedOrPaidOrders.length) * 100) / 100
        : 0;

    // Delayed orders: in PREPARING for more than 20 mins
    const now = Date.now();
    const delayed = todayOrders.filter(
      (o) => o.status === "PREPARING" && now - new Date(o.created_at).getTime() > 20 * 60000
    ).length;

    return {
      orders_today: todayOrders.length,
      pending_orders: pending,
      accepted_orders: accepted,
      preparing_orders: preparing,
      ready_orders: ready,
      served_orders: served,
      completed_orders: completed,
      cancelled_orders: cancelled,
      active_tables: activeTables,
      outstanding_bill_requests: outstandingBills,
      revenue_today: Math.round(revenueToday * 100) / 100,
      average_order_value_today: aov,
      delayed_orders_count: delayed,
    };
  }

  // Rolling 15-Day Analytics
  async getRolling15DayAnalytics(tenantId: string): Promise<Rolling15DayAnalytics> {
    const tenantOrders = this.orders.filter((o) => o.tenant_id === tenantId);
    const tenantBills = this.bills.filter((b) => b.tenant_id === tenantId);
    const tenantReviews = this.reviews.filter((r) => r.tenant_id === tenantId);
    const tenantCategories = this.categories.filter((c) => c.tenant_id === tenantId);

    const now = new Date();
    const dailyMap: Map<string, DailyAnalytics> = new Map();

    // Initialize 15 calendar days
    for (let i = 14; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().slice(0, 10);
      dailyMap.set(dateKey, {
        date: dateKey,
        order_count: 0,
        revenue: 0,
        paid_bills_count: 0,
        unpaid_bills_count: 0,
        average_order_value: 0,
        avg_prep_time_minutes: 14 + (i % 4),
        cancellation_count: 0,
      });
    }

    // Populate from actual persisted orders
    let total15DayOrders = 0;
    let total15DayRevenue = 0;
    let total15DayCancellations = 0;

    const itemSalesMap: Map<string, { name: string; categoryId: string; qty: number; revenue: number }> = new Map();
    const hourlyCounts: number[] = new Array(24).fill(0);

    for (const order of tenantOrders) {
      const dateKey = order.created_at.slice(0, 10);
      if (dailyMap.has(dateKey)) {
        const entry = dailyMap.get(dateKey)!;
        entry.order_count += 1;
        total15DayOrders += 1;

        if (order.status === "CANCELLED" || order.status === "REJECTED") {
          entry.cancellation_count += 1;
          total15DayCancellations += 1;
        }

        // Tally items
        if (order.items && order.status !== "CANCELLED" && order.status !== "REJECTED") {
          for (const item of order.items) {
            const existing = itemSalesMap.get(item.menu_item_id) || {
              name: item.item_name,
              categoryId: "",
              qty: 0,
              revenue: 0,
            };
            existing.qty += item.quantity;
            existing.revenue += item.item_total;
            itemSalesMap.set(item.menu_item_id, existing);
          }
        }

        // Hourly breakdown
        const hour = new Date(order.created_at).getHours();
        if (hour >= 0 && hour < 24) {
          hourlyCounts[hour] += 1;
        }
      }
    }

    // Populate from actual payments
    for (const bill of tenantBills) {
      const dateKey = bill.created_at.slice(0, 10);
      if (dailyMap.has(dateKey)) {
        const entry = dailyMap.get(dateKey)!;
        if (bill.status === "PAID") {
          entry.paid_bills_count += 1;
          entry.revenue += bill.final_total;
          total15DayRevenue += bill.final_total;
        } else if (bill.status !== "CANCELLED") {
          entry.unpaid_bills_count += 1;
        }
      }
    }

    // Finalize daily averages
    const daily: DailyAnalytics[] = [];
    for (const [date, metrics] of dailyMap.entries()) {
      metrics.revenue = Math.round(metrics.revenue * 100) / 100;
      metrics.average_order_value =
        metrics.paid_bills_count > 0 ? Math.round((metrics.revenue / metrics.paid_bills_count) * 100) / 100 : 0;
      daily.push(metrics);
    }

    // Best and least selling items
    const rankedItems: ItemSalesPerformance[] = [];
    for (const [itemId, stats] of itemSalesMap.entries()) {
      const dbItem = this.menuItems.find((m) => m.id === itemId);
      const category = tenantCategories.find((c) => c.id === dbItem?.category_id);
      rankedItems.push({
        menu_item_id: itemId,
        item_name: stats.name,
        category_name: category?.name || "General",
        total_quantity: stats.qty,
        total_revenue: Math.round(stats.revenue * 100) / 100,
      });
    }

    rankedItems.sort((a, b) => b.total_quantity - a.total_quantity);
    const bestSelling = rankedItems.slice(0, 5);
    const leastSelling = [...rankedItems].reverse().slice(0, 5);

    // Category breakdown
    const categoryBreakdown: CategorySalesPerformance[] = tenantCategories.map((cat) => {
      const catItems = rankedItems.filter((ri) => ri.category_name === cat.name);
      return {
        category_id: cat.id,
        category_name: cat.name,
        item_count: catItems.reduce((sum, i) => sum + i.total_quantity, 0),
        total_revenue: Math.round(catItems.reduce((sum, i) => sum + i.total_revenue, 0) * 100) / 100,
      };
    });

    // Hourly distribution
    const hourlyDistribution: HourlyDistribution[] = hourlyCounts
      .map((count, hour) => ({
        hour,
        hour_label: `${hour === 0 ? "12" : hour > 12 ? hour - 12 : hour} ${hour >= 12 ? "PM" : "AM"}`,
        order_count: count,
      }))
      .filter((h) => h.hour >= 8 && h.hour <= 23); // Typical operating hours

    const avgRating =
      tenantReviews.length > 0
        ? Math.round((tenantReviews.reduce((sum, r) => sum + r.rating, 0) / tenantReviews.length) * 10) / 10
        : 5.0;

    return {
      daily,
      best_selling_items: bestSelling,
      least_selling_items: leastSelling,
      category_breakdown: categoryBreakdown,
      hourly_distribution: hourlyDistribution,
      total_15day_orders: total15DayOrders,
      total_15day_revenue: Math.round(total15DayRevenue * 100) / 100,
      average_15day_aov:
        total15DayOrders > 0 ? Math.round((total15DayRevenue / total15DayOrders) * 100) / 100 : 0,
      overall_cancellation_rate:
        total15DayOrders > 0 ? Math.round((total15DayCancellations / total15DayOrders) * 1000) / 10 : 0,
      average_customer_rating: avgRating,
      total_reviews_count: tenantReviews.length,
    };
  }
}

// Global singleton instance so memory state persists across hot-reloads and API calls
const globalForAdapter = globalThis as unknown as { localDbAdapterInstance?: LocalDatabaseAdapterImpl };
export const localDbAdapter = globalForAdapter.localDbAdapterInstance || new LocalDatabaseAdapterImpl();
if (process.env.NODE_ENV !== "production") {
  globalForAdapter.localDbAdapterInstance = localDbAdapter;
}

export { LocalDatabaseAdapterImpl as LocalDatabaseAdapter };
