import { NextRequest, NextResponse } from "next/server";
import { getDatabaseAdapter, getDefaultTenantId } from "@/lib/adapter";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const isAvailable = Boolean(body.isAvailable);
    const adapter = getDatabaseAdapter();
    const tenantId = getDefaultTenantId();

    const updated = await adapter.updateMenuItemAvailability(tenantId, id, isAvailable);
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update item availability" }, { status: 400 });
  }
}

