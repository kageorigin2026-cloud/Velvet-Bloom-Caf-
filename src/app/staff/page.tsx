import React from "react";
import { getDatabaseAdapter, getDefaultTenantId } from "@/lib/adapter";
import { StaffHeader } from "@/components/layout/StaffHeader";
import { ServiceBillingView } from "./ServiceBillingView";
import { NotificationProvider } from "@/lib/audio/notification-context";
import { NotificationBanner } from "@/components/ui/NotificationBanner";

export default async function StaffPage() {
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
        <StaffHeader currentRole="STAFF (SERVICE & BILLING)" staffName="Elena Rostova" />
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
