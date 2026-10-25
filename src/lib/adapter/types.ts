import {
  Tenant,
  CafeSettings,
  User,
  CafeTable,
  TableSession,
  Category,
  MenuItem,
  Order,
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
} from "@/types/database.types";
import {
  CreateOrderSchema,
  AddAdditionalItemSchema,
  GenerateBillSchema,
  RecordPaymentSchema,
  CreateServiceRequestSchema,
  CreateReviewSchema,
} from "@/lib/validation/schemas";
import { z } from "zod";

export interface DatabaseAdapter {
  readonly adapterName: "local" | "supabase";
  
  // Tenant & Cafe Info
  getTenant(tenantId: string): Promise<Tenant | null>;
  getSettings(tenantId: string): Promise<CafeSettings>;
  updateSettings(tenantId: string, settings: Partial<CafeSettings>): Promise<CafeSettings>;
  
  // Tables & Sessions
  getTables(tenantId: string): Promise<CafeTable[]>;
  getTableByQr(tenantId: string, qrToken: string): Promise<CafeTable | null>;
  updateTableStatus(tenantId: string, tableId: string, status: TableStatus): Promise<CafeTable>;
  getOrCreateSession(tenantId: string, tableId: string, customerName?: string, phone?: string, qrToken?: string): Promise<TableSession>;
  closeSession(tenantId: string, sessionId: string): Promise<TableSession>;
  getActiveSession(tenantId: string, tableId: string): Promise<TableSession | null>;
  
  // Menu & Categories
  getCategories(tenantId: string): Promise<Category[]>;
  getMenuItems(tenantId: string, categoryId?: string): Promise<MenuItem[]>;
  getMenuItemById(tenantId: string, itemId: string): Promise<MenuItem | null>;
  updateMenuItemAvailability(tenantId: string, itemId: string, isAvailable: boolean): Promise<MenuItem>;
  
  // Orders
  createOrder(tenantId: string, data: z.infer<typeof CreateOrderSchema>): Promise<Order>;
  getOrderById(tenantId: string, orderId: string): Promise<Order | null>;
  getOrderByNumber(tenantId: string, orderNumber: string): Promise<Order | null>;
  getOrders(tenantId: string, filter?: { status?: OrderStatus; tableId?: string }): Promise<Order[]>;
  updateOrderStatus(
    tenantId: string, 
    orderId: string, 
    newStatus: OrderStatus, 
    actorType: string, 
    actorId?: string, 
    notes?: string
  ): Promise<Order>;
  addAdditionalItem(tenantId: string, data: z.infer<typeof AddAdditionalItemSchema>): Promise<Order>;
  
  // Bills & Payments
  getBills(tenantId: string, status?: BillStatus): Promise<Bill[]>;
  getBillById(tenantId: string, billId: string): Promise<Bill | null>;
  getBillByOrderId(tenantId: string, orderId: string): Promise<Bill | null>;
  generateBill(tenantId: string, data: z.infer<typeof GenerateBillSchema>): Promise<Bill>;
  splitBill(tenantId: string, billId: string, splitType: SplitType, splitCount: number): Promise<Bill>;
  recordPayment(tenantId: string, data: z.infer<typeof RecordPaymentSchema>): Promise<Payment>;
  getPayments(tenantId: string): Promise<Payment[]>;
  
  // Service Requests
  getServiceRequests(tenantId: string, status?: ServiceRequestStatus): Promise<ServiceRequest[]>;
  createServiceRequest(tenantId: string, data: z.infer<typeof CreateServiceRequestSchema>): Promise<ServiceRequest>;
  updateServiceRequestStatus(tenantId: string, requestId: string, status: ServiceRequestStatus): Promise<ServiceRequest>;
  
  // Reviews
  getReviews(tenantId: string): Promise<Review[]>;
  createReview(tenantId: string, data: z.infer<typeof CreateReviewSchema>): Promise<Review>;
  
  // Users / Staff
  getUsers(tenantId: string): Promise<User[]>;
  getUserByEmail(tenantId: string, email: string): Promise<User | null>;
  getUserByPin(tenantId: string, pin: string, clientIp?: string): Promise<User | null>;
  hasActiveOwner(tenantId: string): Promise<boolean>;
  provisionInitialOwner(tenantId: string, fullName: string, email: string, pin: string, authUserId?: string | null): Promise<User>;
  
  // Operational Analytics
  getLiveKPIs(tenantId: string): Promise<LiveDashboardKPIs>;
  getRolling15DayAnalytics(tenantId: string): Promise<Rolling15DayAnalytics>;
}

