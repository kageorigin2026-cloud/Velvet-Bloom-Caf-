import { NextRequest, NextResponse } from "next/server";
import { getDatabaseAdapter, getDefaultTenantId } from "@/lib/adapter";
import { extractStaffToken, verifyStaffRole } from "@/lib/auth/staff-auth";

export async function GET() {
  try {
    const adapter = getDatabaseAdapter();
    const tenantId = getDefaultTenantId();

    const settings = await adapter.getSettings(tenantId);
    return NextResponse.json(settings);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const tenantId = getDefaultTenantId();
    const token = extractStaffToken(req);
    const auth = verifyStaffRole(token, ["OWNER", "ADMIN"], tenantId);

    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error || "Administrative permissions required to modify cafe settings" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const adapter = getDatabaseAdapter();

    const updated = await adapter.updateSettings(tenantId, {
      cafe_name: body.cafeName,
      tagline: body.tagline,
      tax_rate: body.taxRate,
      service_charge_rate: body.serviceChargeRate,
      currency: body.currency,
      is_ordering_paused: body.isOrderingPaused,
      busy_message: body.busyMessage,
      average_prep_time_minutes: body.averagePrepTimeMinutes,
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update settings" }, { status: 400 });
  }
}

