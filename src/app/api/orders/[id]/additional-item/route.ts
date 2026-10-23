import { NextRequest, NextResponse } from "next/server";
import { getDatabaseAdapter, getDefaultTenantId } from "@/lib/adapter";
import { AddAdditionalItemSchema } from "@/lib/validation/schemas";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const parseResult = AddAdditionalItemSchema.safeParse({ ...body, orderId: id });
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation error", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const adapter = getDatabaseAdapter();
    const tenantId = getDefaultTenantId();

    const updated = await adapter.addAdditionalItem(tenantId, parseResult.data);
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to add additional item" }, { status: 400 });
  }
}

