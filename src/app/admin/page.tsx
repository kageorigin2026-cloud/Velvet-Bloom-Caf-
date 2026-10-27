import React from "react";
import { cookies } from "next/headers";
import { getDatabaseAdapter, getDefaultTenantId } from "@/lib/adapter";
import { StaffHeader } from "@/components/layout/StaffHeader";
import { AdminDashboardView } from "./AdminDashboardView";
import { NotificationProvider } from "@/lib/audio/notification-context";
import { NotificationBanner } from "@/components/ui/NotificationBanner";
import { parseSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/staff-auth";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  const session = sessionCookie ? parseSessionToken(sessionCookie.value) : null;

  const adapter = getDatabaseAdapter();
  const tenantId = getDefaultTenantId();

  const [liveKpis, analytics15Day, menuItems, categories, tables, users, settings] =
    await Promise.all([
      adapter.getLiveKPIs(tenantId),
      adapter.getRolling15DayAnalytics(tenantId),
      adapter.getMenuItems(tenantId, undefined, true),
      adapter.getCategories(tenantId),
      adapter.getTables(tenantId),
      adapter.getUsers(tenantId),
      adapter.getSettings(tenantId),
    ]);

  return (
    <NotificationProvider role="ADMIN">
      <div className="min-h-screen bg-[#080808] text-[#F6EFE7] flex flex-col">
        <StaffHeader
          currentRole={session?.role || "OWNER"}
          staffName={session?.name || "Alexander Vance (Owner)"}
        />
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
