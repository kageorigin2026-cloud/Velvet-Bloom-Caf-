import React from "react";
import { notFound } from "next/navigation";
import { getDatabaseAdapter, getDefaultTenantId } from "@/lib/adapter";
import { CustomerHeader } from "@/components/layout/CustomerHeader";
import { FoodCard } from "@/components/ui/FoodCard";
import { SessionClosedView } from "@/components/ui/SessionClosedView";
import { TableMenuView } from "./TableMenuView";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function TablePage({ params }: PageProps) {
  const { token } = await params;
  const adapter = getDatabaseAdapter();
  const tenantId = getDefaultTenantId();

  const table = await adapter.getTableByQr(tenantId, token);
  if (!table) {
    notFound();
  }

  // Concluded session guard: If table is currently marked PAID, ordering is ended
  if (table.status === "PAID") {
    return <SessionClosedView table={table} token={token} />;
  }

  // Parallelize session creation, menu loading, and cafe settings for fast response times
  const [session, categories, menuItems, settings] = await Promise.all([
    adapter.getOrCreateSession(tenantId, table.id),
    adapter.getCategories(tenantId),
    adapter.getMenuItems(tenantId),
    adapter.getSettings(tenantId),
  ]);

  return (
    <div className="min-h-screen bg-[#080808] pb-24 text-[#F6EFE7]">
      <CustomerHeader
        tableNumber={table.table_number}
        tableToken={token}
        tableId={table.id}
        sessionId={session.id}
      />

      <TableMenuView
        table={table}
        token={token}
        session={session}
        categories={categories}
        menuItems={menuItems}
        settings={settings}
      />
    </div>
  );
}

