import { NextRequest, NextResponse } from "next/server";
import { getDatabaseAdapter, getDefaultTenantId } from "@/lib/adapter";
import { RecordPaymentSchema } from "@/lib/validation/schemas";

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

    const adapter = getDatabaseAdapter();
    const tenantId = getDefaultTenantId();

    const payment = await adapter.recordPayment(tenantId, parseResult.data);
    const updatedBill = await adapter.getBillById(tenantId, id);

    return NextResponse.json({ payment, bill: updatedBill });
  } catch (err: any) {
    console.error(`[Payment API] Failed to record payment:`, err.message || err);
    return NextResponse.json({ error: err.message || "Failed to record payment" }, { status: 400 });
  }
}

