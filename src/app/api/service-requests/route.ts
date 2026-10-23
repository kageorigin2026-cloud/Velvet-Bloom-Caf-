import { NextRequest, NextResponse } from "next/server";
import { getDatabaseAdapter, getDefaultTenantId } from "@/lib/adapter";
import { CreateServiceRequestSchema } from "@/lib/validation/schemas";

export async function GET() {
  try {
    const adapter = getDatabaseAdapter();
    const tenantId = getDefaultTenantId();

    const requests = await adapter.getServiceRequests(tenantId);
    return NextResponse.json(requests);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch service requests" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = CreateServiceRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation error", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const adapter = getDatabaseAdapter();
    const tenantId = getDefaultTenantId();

    const serviceReq = await adapter.createServiceRequest(tenantId, parseResult.data);
    return NextResponse.json(serviceReq, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create service request" }, { status: 400 });
  }
}

