import React from "react";
import { getDatabaseAdapter, getDefaultTenantId } from "@/lib/adapter";
import { StaffHeader } from "@/components/layout/StaffHeader";
import { AdminDashboardView } from "./AdminDashboardView";
import { NotificationProvider } from "@/lib/audio/notification-context";
import { NotificationBanner } from "@/components/ui/NotificationBanner";

export default async function AdminPage() {
  const adapter = getDatabaseAdapter();
  const tenantId = getDefaultTenantId();

  const [liveKpis, analytics15Day, menuItems, categories, tables, users, settings] =
    await Promise.all([
      adapter.getLiveKPIs(tenantId),
      adapter.getRolling15DayAnalytics(tenantId),
      adapter.getMenuItems(tenantId),
      adapter.getCategories(tenantId),
      adapter.getTables(tenantId),
      adapter.getUsers(tenantId),
      adapter.getSettings(tenantId),
    ]);

  return (
    <NotificationProvider role="ADMIN">
      <div className="min-h-screen bg-[#080808] text-[#F6EFE7] flex flex-col">
        <StaffHeader currentRole="OWNER" staffName="Alexander Vance" />
        <NotificationBanner />
        <AdminDashboardView
          initialKPIs={liveKpis}
          analytics={analytics15Day}
          menuItems={menuItems}
          categories={categories}
          tables={tables}
          users={users}
          settings={settings}
        />
      </div>
    </NotificationProvider>
  );
}
