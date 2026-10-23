import React from "react";
import { getDatabaseAdapter, getDefaultTenantId } from "@/lib/adapter";
import { OrderTrackingView } from "./OrderTrackingView";
import { OrderNotFoundView } from "./OrderNotFoundView";

interface PageProps {
  params: Promise<{ orderNumber: string }>;
}

export default async function OrderTrackPage({ params }: PageProps) {
  const { orderNumber } = await params;
  const adapter = getDatabaseAdapter();
  const tenantId = getDefaultTenantId();

  const order = await adapter.getOrderByNumber(tenantId, orderNumber);
  if (!order) {
    return <OrderNotFoundView searchedOrderNumber={orderNumber} />;
  }

  const bill = await adapter.getBillByOrderId(tenantId, order.id);

  return (
    <div className="min-h-screen bg-[#080808] text-[#F6EFE7] p-4">
      <OrderTrackingView initialOrder={order} initialBill={bill} />
    </div>
  );
}
