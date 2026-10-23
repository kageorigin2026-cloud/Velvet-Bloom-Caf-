import React from "react";
import { notFound } from "next/navigation";
import { getDatabaseAdapter, getDefaultTenantId } from "@/lib/adapter";
import { SessionClosedView } from "@/components/ui/SessionClosedView";
import { CartReviewView } from "./CartReviewView";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function CartPage({ params }: PageProps) {
  const { token } = await params;
  const adapter = getDatabaseAdapter();
  const tenantId = getDefaultTenantId();

  const table = await adapter.getTableByQr(tenantId, token);
  if (!table) {
    notFound();
  }

  // Concluded session guard: If table is currently marked PAID, checkout is disabled
  if (table.status === "PAID") {
    return <SessionClosedView table={table} token={token} />;
  }

  const session = await adapter.getOrCreateSession(tenantId, table.id);
  const settings = await adapter.getSettings(tenantId);

  return (
    <div className="min-h-screen bg-[#080808] text-[#F6EFE7] p-4">
      <CartReviewView table={table} session={session} token={token} settings={settings} />
    </div>
  );
}

