import React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDatabaseAdapter, getDefaultTenantId } from "@/lib/adapter";
import { StaffHeader } from "@/components/layout/StaffHeader";
import { ChefDisplayView } from "./ChefDisplayView";
import { NotificationProvider } from "@/lib/audio/notification-context";
import { NotificationBanner } from "@/components/ui/NotificationBanner";
import { parseSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/staff-auth";

export default async function ChefPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  const session = sessionCookie ? parseSessionToken(sessionCookie.value) : null;

  if (!session) {
    redirect("/staff/login");
  }

  // Role restriction: Chef, Owner, and Admin have kitchen access
  if (session.role !== "CHEF" && session.role !== "OWNER" && session.role !== "ADMIN") {
    redirect("/staff");
  }

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
        <StaffHeader
          currentRole={session.role}
          staffName={session.name || (session.role === "OWNER" ? "Alexander Vance (Owner)" : "Chef Marcus Chen")}
        />
        <NotificationBanner />
        <ChefDisplayView initialOrders={activeOrders} />
      </div>
    </NotificationProvider>
  );
}
