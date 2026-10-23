import { NextRequest, NextResponse } from "next/server";
import { getDatabaseAdapter, getDefaultTenantId } from "@/lib/adapter";
import { TableStatus } from "@/types/database.types";

export async function GET() {
  try {
    const adapter = getDatabaseAdapter();
    const tenantId = getDefaultTenantId();

    const tables = await adapter.getTables(tenantId);
    return NextResponse.json(tables);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch tables" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { tableId, status } = body;

    if (!tableId || !status) {
      return NextResponse.json(
        { error: "tableId and status are required" },
        { status: 400 }
      );
    }

    const adapter = getDatabaseAdapter();
    const tenantId = getDefaultTenantId();

    const updatedTable = await adapter.updateTableStatus(
      tenantId,
      tableId,
      status as TableStatus
    );

    return NextResponse.json(updatedTable);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update table status" },
      { status: 500 }
    );
  }
}
