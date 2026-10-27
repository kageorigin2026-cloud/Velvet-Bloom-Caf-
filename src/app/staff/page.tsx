import React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDatabaseAdapter, getDefaultTenantId } from "@/lib/adapter";
import { StaffHeader } from "@/components/layout/StaffHeader";
import { ServiceBillingView } from "./ServiceBillingView";
import { NotificationProvider } from "@/lib/audio/notification-context";
import { NotificationBanner } from "@/components/ui/NotificationBanner";
import { parseSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/staff-auth";

export default async function StaffPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  const session = sessionCookie ? parseSessionToken(sessionCookie.value) : null;

  if (!session) {
    redirect("/staff/login");
  }

  // Role restriction: Chefs are kitchen-only and redirected to /chef
  if (session.role === "CHEF") {
    redirect("/chef");
  }

  const adapter = getDatabaseAdapter();
  const tenantId = getDefaultTenantId();

  const [tables, orders, bills, serviceRequests, payments, menuItems, settings] =
    await Promise.all([
      adapter.getTables(tenantId),
      adapter.getOrders(tenantId),
      adapter.getBills(tenantId),
      adapter.getServiceRequests(tenantId),
      adapter.getPayments(tenantId),
      adapter.getMenuItems(tenantId),
      adapter.getSettings(tenantId),
    ]);

  return (
    <NotificationProvider role="STAFF">
      <div className="min-h-screen bg-[#080808] text-[#F6EFE7] flex flex-col">
        <StaffHeader
          currentRole={session.role}
          staffName={session.name || (session.role === "OWNER" ? "Alexander Vance (Owner)" : "Elena Rostova")}
        />
        <NotificationBanner />
        <ServiceBillingView
          initialTables={tables}
          initialOrders={orders}
          initialBills={bills}
          initialServiceRequests={serviceRequests}
          initialPayments={payments}
          menuItems={menuItems}
          settings={settings}
        />
      </div>
    </NotificationProvider>
  );
}
