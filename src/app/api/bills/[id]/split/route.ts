import { NextRequest, NextResponse } from "next/server";
import { getDatabaseAdapter, getDefaultTenantId } from "@/lib/adapter";
import { SplitType } from "@/types/database.types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const splitType = (body.splitType as SplitType) || "EQUAL";
    const splitCount = Math.max(1, parseInt(body.splitCount) || 2);

    const adapter = getDatabaseAdapter();
    const tenantId = getDefaultTenantId();

    const updatedBill = await adapter.splitBill(tenantId, id, splitType, splitCount);
    return NextResponse.json(updatedBill);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to split bill" }, { status: 400 });
  }
}

