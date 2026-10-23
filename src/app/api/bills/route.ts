import { NextRequest, NextResponse } from "next/server";
import { getDatabaseAdapter, getDefaultTenantId } from "@/lib/adapter";
import { GenerateBillSchema } from "@/lib/validation/schemas";
import { BillStatus } from "@/types/database.types";

export async function GET(req: NextRequest) {
  try {
    const adapter = getDatabaseAdapter();
    const tenantId = getDefaultTenantId();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as BillStatus | undefined;

    const bills = await adapter.getBills(tenantId, status);
    return NextResponse.json(bills);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch bills" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = GenerateBillSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation error", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const adapter = getDatabaseAdapter();
    const tenantId = getDefaultTenantId();

    const bill = await adapter.generateBill(tenantId, parseResult.data);
    return NextResponse.json(bill, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to generate bill" }, { status: 400 });
  }
}

