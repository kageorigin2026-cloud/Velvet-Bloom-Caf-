import { NextRequest, NextResponse } from "next/server";
import { getDatabaseAdapter, getDefaultTenantId } from "@/lib/adapter";
import { RecordPaymentSchema } from "@/lib/validation/schemas";
import { extractStaffToken, verifyStaffRole } from "@/lib/auth/staff-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const parseResult = RecordPaymentSchema.safeParse({ ...body, billId: id });
    if (!parseResult.success) {
      console.warn(`[Payment API] Validation error on bill ${id}:`, parseResult.error.format());
      return NextResponse.json(
        { error: "Validation error", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const tenantId = getDefaultTenantId();

    // If recorded by staff terminal, verify staff role
    const token = extractStaffToken(req);
    if (token) {
      const auth = verifyStaffRole(token, ["OWNER", "ADMIN", "MANAGER", "CASHIER", "STAFF"], tenantId);
      if (!auth.authorized) {
        return NextResponse.json(
          { error: auth.error || "Staff permissions required to record cashier settlements" },
          { status: 403 }
        );
      }
    }

    const adapter = getDatabaseAdapter();

    const payment = await adapter.recordPayment(tenantId, parseResult.data);
    const updatedBill = await adapter.getBillById(tenantId, id);

    return NextResponse.json({ payment, bill: updatedBill });
  } catch (err: any) {
    console.error(`[Payment API] Failed to record payment:`, err.message || err);
    return NextResponse.json({ error: err.message || "Failed to record payment" }, { status: 400 });
  }
}

