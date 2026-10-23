import { UserRole } from "@/types/database.types";

export type Permission =
  | "dashboard:view"
  | "orders:view"
  | "orders:kitchen_update"
  | "orders:mark_served"
  | "orders:add_items"
  | "orders:cancel"
  | "tables:view"
  | "tables:update_status"
  | "tables:edit"
  | "menu:view"
  | "menu:edit"
  | "menu:availability_toggle"
  | "bills:view"
  | "bills:generate"
  | "bills:split"
  | "payments:view"
  | "payments:record"
  | "payments:refund"
  | "service_requests:view"
  | "service_requests:update"
  | "staff:view"
  | "staff:edit"
  | "analytics:view"
  | "settings:view"
  | "settings:edit";

export const RolePermissions: Record<UserRole, Permission[]> = {
  OWNER: [
    "dashboard:view",
    "orders:view",
    "orders:kitchen_update",
    "orders:mark_served",
    "orders:add_items",
    "orders:cancel",
    "tables:view",
    "tables:update_status",
    "tables:edit",
    "menu:view",
    "menu:edit",
    "menu:availability_toggle",
    "bills:view",
    "bills:generate",
    "bills:split",
    "payments:view",
    "payments:record",
    "payments:refund",
    "service_requests:view",
    "service_requests:update",
    "staff:view",
    "staff:edit",
    "analytics:view",
    "settings:view",
    "settings:edit",
  ],
  ADMIN: [
    "dashboard:view",
    "orders:view",
    "orders:kitchen_update",
    "orders:mark_served",
    "orders:add_items",
    "orders:cancel",
    "tables:view",
    "tables:update_status",
    "tables:edit",
    "menu:view",
    "menu:edit",
    "menu:availability_toggle",
    "bills:view",
    "bills:generate",
    "bills:split",
    "payments:view",
    "payments:record",
    "service_requests:view",
    "service_requests:update",
    "staff:view",
    "staff:edit",
    "analytics:view",
    "settings:view",
    "settings:edit",
  ],
  CHEF: [
    "orders:view",
    "orders:kitchen_update",
    "menu:view",
    "menu:availability_toggle",
  ],
  STAFF: [
    "orders:view",
    "orders:mark_served",
    "orders:add_items",
    "tables:view",
    "tables:update_status",
    "bills:view",
    "bills:generate",
    "bills:split",
    "payments:view",
    "payments:record",
    "service_requests:view",
    "service_requests:update",
    "menu:view",
  ],
  WAITER: [
    "orders:view",
    "orders:mark_served",
    "orders:add_items",
    "tables:view",
    "tables:update_status",
    "service_requests:view",
    "service_requests:update",
    "menu:view",
  ],
  CASHIER: [
    "bills:view",
    "bills:generate",
    "bills:split",
    "payments:view",
    "payments:record",
    "orders:view",
    "tables:view",
  ],
  CUSTOMER: [
    "menu:view",
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  const allowed = RolePermissions[role];
  if (!allowed) return false;
  return allowed.includes(permission);
}

