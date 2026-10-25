import { NextRequest, NextResponse } from "next/server";
import { getDatabaseAdapter, getDefaultTenantId } from "@/lib/adapter";
import { extractStaffToken, verifyStaffRole } from "@/lib/auth/staff-auth";

export async function GET(req: NextRequest) {
  try {
    const tenantId = getDefaultTenantId();
    const token = extractStaffToken(req);
    const auth = verifyStaffRole(token, ["OWNER", "ADMIN", "MANAGER"], tenantId);

    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error || "Administrative permissions required to view analytics" },
        { status: 403 }
      );
    }

    const adapter = getDatabaseAdapter();

    const [kpis, analytics] = await Promise.all([
      adapter.getLiveKPIs(tenantId),
      adapter.getRolling15DayAnalytics(tenantId),
    ]);

    return NextResponse.json({ kpis, analytics });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch analytics" }, { status: 500 });
  }
}

