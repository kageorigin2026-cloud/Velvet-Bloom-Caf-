import { NextRequest, NextResponse } from "next/server";
import { getDatabaseAdapter, getDefaultTenantId } from "@/lib/adapter";
import { extractStaffToken, verifyStaffRole } from "@/lib/auth/staff-auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = getDefaultTenantId();
    const token = extractStaffToken(req);
    const auth = verifyStaffRole(token, ["OWNER", "ADMIN", "MANAGER", "CHEF"], tenantId);

    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error || "Staff permissions required to toggle menu availability" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();

    const isAvailable = Boolean(body.isAvailable);
    const adapter = getDatabaseAdapter();

    const updated = await adapter.updateMenuItemAvailability(tenantId, id, isAvailable);
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update item availability" }, { status: 400 });
  }
}

