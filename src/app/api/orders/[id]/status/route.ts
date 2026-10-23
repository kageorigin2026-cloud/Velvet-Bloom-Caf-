import { NextRequest, NextResponse } from "next/server";
import { getDatabaseAdapter, getDefaultTenantId } from "@/lib/adapter";
import { UpdateOrderStatusSchema } from "@/lib/validation/schemas";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parseResult = UpdateOrderStatusSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation error", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const adapter = getDatabaseAdapter();
    const tenantId = getDefaultTenantId();

    const updated = await adapter.updateOrderStatus(
      tenantId,
      id,
      parseResult.data.status,
      parseResult.data.actorType,
      parseResult.data.actorId,
      parseResult.data.notes
    );

    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update order status" }, { status: 400 });
  }
}

