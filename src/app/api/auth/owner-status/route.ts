import { NextResponse } from "next/server";
import { getDatabaseAdapter, getDefaultTenantId } from "@/lib/adapter";

export async function GET() {
  try {
    const adapter = getDatabaseAdapter();
    const tenantId = getDefaultTenantId();

    const [hasOwner, settings] = await Promise.all([
      adapter.hasActiveOwner(tenantId),
      adapter.getSettings(tenantId).catch(() => null),
    ]);

    return NextResponse.json(
      {
        hasOwner,
        cafeName: settings?.cafe_name || "Velvet Bloom Café",
        tenantId,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to inspect owner status" },
      { status: 500 }
    );
  }
}
