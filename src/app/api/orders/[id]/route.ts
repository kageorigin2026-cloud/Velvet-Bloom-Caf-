import { NextRequest, NextResponse } from "next/server";
import { getDatabaseAdapter, getDefaultTenantId } from "@/lib/adapter";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const adapter = getDatabaseAdapter();
    const tenantId = getDefaultTenantId();

    let order = await adapter.getOrderById(tenantId, id);
    if (!order) {
      order = await adapter.getOrderByNumber(tenantId, id);
    }

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const bill = await adapter.getBillByOrderId(tenantId, order.id);

    return NextResponse.json({ order, bill });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch order" }, { status: 500 });
  }
}

