import { z } from "zod";

export const OrderItemOptionSchema = z.object({
  groupName: z.string().min(1),
  optionName: z.string().min(1),
  extraPrice: z.number().min(0).default(0),
});

export const OrderItemInputSchema = z.object({
  menuItemId: z.string().uuid().or(z.string().min(1)),
  quantity: z.number().int().min(1).max(50),
  options: z.array(OrderItemOptionSchema).default([]),
  specialNotes: z.string().max(300).optional(),
});

export const CreateOrderSchema = z.object({
  tableId: z.string().min(1),
  sessionId: z.string().min(1),
  customerName: z.string().max(100).optional(),
  customerPhone: z.string().max(20).optional(),
  specialInstructions: z.string().max(500).optional(),
  items: z.array(OrderItemInputSchema).min(1, "Order must contain at least one item"),
});

export const AddAdditionalItemSchema = z.object({
  orderId: z.string().min(1),
  menuItemId: z.string().min(1),
  quantity: z.number().int().min(1).max(20).default(1),
  options: z.array(OrderItemOptionSchema).default([]),
  specialNotes: z.string().max(300).optional(),
  staffId: z.string().optional(),
});

export const ValidOrderTransitions: Record<string, string[]> = {
  PENDING: ['ACCEPTED', 'REJECTED', 'CANCELLED'],
  ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['SERVED'],
  SERVED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
};

export function isValidOrderTransition(currentStatus: string, nextStatus: string): boolean {
  const allowed = ValidOrderTransitions[currentStatus];
  if (!allowed) return false;
  return allowed.includes(nextStatus);
}

export const UpdateOrderStatusSchema = z.object({
  status: z.enum([
    'PENDING',
    'ACCEPTED',
    'PREPARING',
    'READY',
    'SERVED',
    'COMPLETED',
    'CANCELLED',
    'REJECTED',
  ]),
  notes: z.string().max(500).optional(),
  actorType: z.string().default('STAFF'),
  actorId: z.string().optional(),
});

export const GenerateBillSchema = z.object({
  orderId: z.string().optional(),
  tableId: z.string().min(1),
  sessionId: z.string().min(1),
  discountAmount: z.number().min(0).default(0),
  splitType: z.enum(['NONE', 'EQUAL', 'ITEM_WISE']).default('NONE'),
  splitCount: z.number().int().min(1).max(20).default(1),
});

export const RecordPaymentSchema = z.object({
  billId: z.string().min(1),
  amount: z.coerce.number().positive(),
  paymentMethod: z.enum(['CASH', 'CARD', 'UPI', 'ONLINE']),
  transactionRef: z.string().max(100).optional(),
  splitIndex: z.coerce.number().int().optional(),
  recordedBy: z.string().optional(),
});

export const CreateServiceRequestSchema = z.object({
  tableId: z.string().min(1),
  sessionId: z.string().min(1),
  requestType: z.enum(['WATER', 'CLEANING', 'WAITER_CALL', 'BILL', 'OTHER']),
  notes: z.string().max(300).optional(),
});

export const CreateReviewSchema = z.object({
  menuItemId: z.string().optional(),
  orderId: z.string().optional(),
  sessionId: z.string().optional(),
  customerName: z.string().min(1).max(80).default('Valued Guest'),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
  cafeAmbienceRating: z.number().int().min(1).max(5).optional(),
  serviceRating: z.number().int().min(1).max(5).optional(),
});

export const StaffLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).optional(),
  pin: z.string().min(4).max(6).optional(),
});

export const UpdateCafeSettingsSchema = z.object({
  cafeName: z.string().min(1).max(100),
  tagline: z.string().max(200),
  taxRate: z.number().min(0).max(50),
  serviceChargeRate: z.number().min(0).max(30),
  currency: z.string().max(10),
  isOrderingPaused: z.boolean(),
  busyMessage: z.string().max(500),
  averagePrepTimeMinutes: z.number().int().min(1).max(120),
});

