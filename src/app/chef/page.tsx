import React from "react";
import { getDatabaseAdapter, getDefaultTenantId } from "@/lib/adapter";
import { StaffHeader } from "@/components/layout/StaffHeader";
import { ChefDisplayView } from "./ChefDisplayView";
import { NotificationProvider } from "@/lib/audio/notification-context";
import { NotificationBanner } from "@/components/ui/NotificationBanner";

export default async function ChefPage() {
  const adapter = getDatabaseAdapter();
  const tenantId = getDefaultTenantId();

  // Load all active kitchen orders
  const orders = await adapter.getOrders(tenantId);
  const activeOrders = orders.filter(
    (o) =>
      o.status === "PENDING" ||
      o.status === "ACCEPTED" ||
      o.status === "PREPARING" ||
      o.status === "READY"
  );

  return (
    <NotificationProvider role="CHEF">
      <div className="min-h-screen bg-[#080808] text-[#F6EFE7] flex flex-col">
        <StaffHeader currentRole="CHEF" staffName="Chef Marcus Chen" />
        <NotificationBanner />
        <ChefDisplayView initialOrders={activeOrders} />
      </div>
    </NotificationProvider>
  );
}
