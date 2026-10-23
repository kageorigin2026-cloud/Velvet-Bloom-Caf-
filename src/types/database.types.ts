export type UserRole = 'OWNER' | 'ADMIN' | 'CHEF' | 'STAFF' | 'WAITER' | 'CASHIER' | 'CUSTOMER';

export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'BILL_REQUESTED' | 'PAYMENT_PENDING' | 'PAID' | 'CLEANING';

export type OrderStatus = 
  | 'PENDING' 
  | 'ACCEPTED' 
  | 'PREPARING' 
  | 'READY' 
  | 'SERVED' 
  | 'COMPLETED' 
  | 'CANCELLED' 
  | 'REJECTED';

export type SplitType = 'NONE' | 'EQUAL' | 'ITEM_WISE';

export type BillStatus = 'REQUESTED' | 'GENERATED' | 'PAID' | 'CANCELLED';

export type PaymentMethod = 'CASH' | 'CARD' | 'UPI' | 'ONLINE';

export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

export type ServiceRequestType = 'WATER' | 'CLEANING' | 'WAITER_CALL' | 'BILL' | 'OTHER';

export type ServiceRequestStatus = 'PENDING' | 'ATTENDED' | 'COMPLETED';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  tech_brand: string;
  currency: string;
  tax_rate: number;
  service_charge_rate: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CafeSettings {
  id: string;
  tenant_id: string;
  cafe_name: string;
  tagline: string;
  tech_brand: string;
  tax_rate: number;
  service_charge_rate: number;
  currency: string;
  is_ordering_paused: boolean;
  busy_message: string;
  average_prep_time_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  tenant_id: string;
  auth_user_id?: string | null;
  full_name: string;
  email: string;
  role: UserRole;
  pin_code?: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CafeTable {
  id: string;
  tenant_id: string;
  table_number: string;
  qr_code_token: string;
  capacity: number;
  status: TableStatus;
  current_session_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TableSession {
  id: string;
  tenant_id: string;
  table_id: string;
  session_token: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  guest_count: number;
  is_active: boolean;
  started_at: string;
  ended_at?: string | null;
  created_at: string;
}

export interface Category {
  id: string;
  tenant_id: string;
  name: string;
  display_order: number;
  icon: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomizationOption {
  id: string;
  group_id: string;
  name: string;
  extra_price: number;
  is_available: boolean;
  display_order: number;
  created_at: string;
}

export interface CustomizationGroup {
  id: string;
  menu_item_id: string;
  name: string;
  min_selectable: number;
  max_selectable: number;
  is_required: boolean;
  display_order: number;
  created_at: string;
  options?: CustomizationOption[];
}

export interface MenuTranslation {
  id: string;
  menu_item_id: string;
  language_code: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface MenuItem {
  id: string;
  tenant_id: string;
  category_id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  is_veg: boolean;
  is_available: boolean;
  is_bestseller: boolean;
  is_chef_special: boolean;
  preparation_time_minutes: number;
  calories?: number;
  average_rating: number;
  total_reviews: number;
  created_at: string;
  updated_at: string;
  translations?: MenuTranslation[];
  customization_groups?: CustomizationGroup[];
}

export interface OrderItemOption {
  id?: string;
  order_item_id?: string;
  group_name: string;
  option_name: string;
  extra_price: number;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  item_name: string;
  item_price: number;
  quantity: number;
  options_price: number;
  item_total: number;
  special_notes?: string;
  is_additional?: boolean;
  added_by_staff_id?: string | null;
  created_at: string;
  options?: OrderItemOption[];
}

export interface OrderEvent {
  id: string;
  order_id: string;
  previous_status?: OrderStatus | null;
  new_status: OrderStatus;
  actor_type: string;
  actor_id?: string | null;
  notes?: string;
  created_at: string;
}

export interface Order {
  id: string;
  tenant_id: string;
  order_number: string;
  table_id: string;
  session_id: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  status: OrderStatus;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  special_instructions?: string;
  estimated_time_minutes?: number;
  eta_timestamp?: string | null;
  is_manual?: boolean;
  created_by_staff_id?: string | null;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
  events?: OrderEvent[];
  table?: CafeTable;
}

export interface BillSplit {
  id: string;
  bill_id: string;
  split_index: number;
  person_label: string;
  assigned_amount: number;
  item_details?: any;
  payment_status: 'PENDING' | 'PAID';
  payment_method?: PaymentMethod | null;
  paid_at?: string | null;
}

export interface Bill {
  id: string;
  tenant_id: string;
  bill_number: string;
  order_id?: string | null;
  table_id: string;
  session_id: string;
  subtotal: number;
  tax: number;
  service_charge: number;
  discount: number;
  final_total: number;
  split_type: SplitType;
  split_count: number;
  status: BillStatus;
  created_at: string;
  updated_at: string;
  splits?: BillSplit[];
  table?: CafeTable;
  order?: Order;
}

export interface Payment {
  id: string;
  tenant_id: string;
  bill_id: string;
  amount: number;
  payment_method: PaymentMethod;
  transaction_ref?: string;
  status: PaymentStatus;
  recorded_by?: string | null;
  created_at: string;
}

export interface Review {
  id: string;
  tenant_id: string;
  menu_item_id?: string | null;
  order_id?: string | null;
  session_id?: string | null;
  customer_name: string;
  rating: number;
  comment?: string;
  cafe_ambience_rating?: number;
  service_rating?: number;
  is_approved: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  tenant_id: string;
  recipient_role?: UserRole | null;
  recipient_user_id?: string | null;
  title: string;
  message: string;
  type: 'ORDER_NEW' | 'ORDER_STATUS' | 'ADDITIONAL_ITEM' | 'BILL_REQUEST' | 'SERVICE_REQUEST';
  link?: string;
  is_read: boolean;
  metadata?: any;
  created_at: string;
}

export interface ServiceRequest {
  id: string;
  tenant_id: string;
  table_id: string;
  session_id: string;
  request_type: ServiceRequestType;
  status: ServiceRequestStatus;
  notes?: string;
  created_at: string;
  table?: CafeTable;
}

export interface StaffActivity {
  id: string;
  tenant_id: string;
  staff_id?: string | null;
  action_type: string;
  details?: any;
  created_at: string;
}

export interface DailyAnalytics {
  date: string;
  order_count: number;
  revenue: number;
  paid_bills_count: number;
  unpaid_bills_count: number;
  average_order_value: number;
  avg_prep_time_minutes: number;
  cancellation_count: number;
}

export interface ItemSalesPerformance {
  menu_item_id: string;
  item_name: string;
  category_name: string;
  total_quantity: number;
  total_revenue: number;
}

export interface CategorySalesPerformance {
  category_id: string;
  category_name: string;
  item_count: number;
  total_revenue: number;
}

export interface HourlyDistribution {
  hour: number;
  hour_label: string;
  order_count: number;
}

export interface Rolling15DayAnalytics {
  daily: DailyAnalytics[];
  best_selling_items: ItemSalesPerformance[];
  least_selling_items: ItemSalesPerformance[];
  category_breakdown: CategorySalesPerformance[];
  hourly_distribution: HourlyDistribution[];
  total_15day_orders: number;
  total_15day_revenue: number;
  average_15day_aov: number;
  overall_cancellation_rate: number;
  average_customer_rating: number;
  total_reviews_count: number;
}

export interface LiveDashboardKPIs {
  orders_today: number;
  pending_orders: number;
  accepted_orders: number;
  preparing_orders: number;
  ready_orders: number;
  served_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  active_tables: number;
  outstanding_bill_requests: number;
  revenue_today: number;
  average_order_value_today: number;
  delayed_orders_count: number;
}

