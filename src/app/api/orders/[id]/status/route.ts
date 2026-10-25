import { NextRequest, NextResponse } from "next/server";
import { getDatabaseAdapter, getDefaultTenantId } from "@/lib/adapter";
import { UpdateOrderStatusSchema } from "@/lib/validation/schemas";
import { extractStaffToken, verifyStaffRole } from "@/lib/auth/staff-auth";

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

    const tenantId = getDefaultTenantId();
    const token = extractStaffToken(req);

    // If staff token is present, validate role against requested status transition
    if (token) {
      const auth = verifyStaffRole(
        token,
        ["OWNER", "ADMIN", "MANAGER", "CHEF", "WAITER", "CASHIER", "STAFF"],
        tenantId
      );
      if (!auth.authorized) {
        return NextResponse.json({ error: auth.error || "Forbidden" }, { status: 403 });
      }

      const role = auth.session?.role;
      const targetStatus = parseResult.data.status;

      // Role-specific transition boundaries
      if (role === "CHEF") {
        const allowedForChef = ["ACCEPTED", "PREPARING", "READY", "REJECTED", "CANCELLED"];
        if (!allowedForChef.includes(targetStatus)) {
          return NextResponse.json(
            { error: `Chef role is not permitted to transition order to status ${targetStatus}` },
            { status: 403 }
          );
        }
      } else if (role === "WAITER") {
        const allowedForWaiter = ["SERVED", "READY"];
        if (!allowedForWaiter.includes(targetStatus)) {
          return NextResponse.json(
            { error: `Waiter role is not permitted to transition order to status ${targetStatus}` },
            { status: 403 }
          );
        }
      }
    }

    const adapter = getDatabaseAdapter();

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

