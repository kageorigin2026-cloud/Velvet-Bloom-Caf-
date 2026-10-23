import { NextRequest, NextResponse } from "next/server";
import { getDatabaseAdapter, getDefaultTenantId } from "@/lib/adapter";
import { CreateOrderSchema } from "@/lib/validation/schemas";
import { OrderStatus } from "@/types/database.types";

export async function GET(req: NextRequest) {
  try {
    const adapter = getDatabaseAdapter();
    const tenantId = getDefaultTenantId();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as OrderStatus | undefined;
    const tableId = searchParams.get("tableId") || undefined;

    const orders = await adapter.getOrders(tenantId, { status, tableId });
    return NextResponse.json(orders);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch orders" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = CreateOrderSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation error", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const adapter = getDatabaseAdapter();
    const tenantId = getDefaultTenantId();

    const order = await adapter.createOrder(tenantId, parseResult.data);
    return NextResponse.json(order, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create order" }, { status: 400 });
  }
}

