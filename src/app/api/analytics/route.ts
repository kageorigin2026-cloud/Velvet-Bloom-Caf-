import { NextRequest, NextResponse } from "next/server";
import { getDatabaseAdapter, getDefaultTenantId } from "@/lib/adapter";

export async function GET() {
  try {
    const adapter = getDatabaseAdapter();
    const tenantId = getDefaultTenantId();

    const [kpis, analytics] = await Promise.all([
      adapter.getLiveKPIs(tenantId),
      adapter.getRolling15DayAnalytics(tenantId),
    ]);

    return NextResponse.json({ kpis, analytics });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch analytics" }, { status: 500 });
  }
}

