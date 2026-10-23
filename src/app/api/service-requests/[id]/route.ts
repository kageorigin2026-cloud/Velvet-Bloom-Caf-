import { NextRequest, NextResponse } from "next/server";
import { getDatabaseAdapter, getDefaultTenantId } from "@/lib/adapter";
import { ServiceRequestStatus } from "@/types/database.types";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const status = body.status as ServiceRequestStatus;
    if (!status) {
      return NextResponse.json({ error: "Missing status field" }, { status: 400 });
    }

    const adapter = getDatabaseAdapter();
    const tenantId = getDefaultTenantId();

    const updated = await adapter.updateServiceRequestStatus(tenantId, id, status);
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update service request" }, { status: 400 });
  }
}

