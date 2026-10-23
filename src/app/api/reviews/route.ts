import { NextRequest, NextResponse } from "next/server";
import { getDatabaseAdapter, getDefaultTenantId } from "@/lib/adapter";
import { CreateReviewSchema } from "@/lib/validation/schemas";

export async function GET() {
  try {
    const adapter = getDatabaseAdapter();
    const tenantId = getDefaultTenantId();

    const reviews = await adapter.getReviews(tenantId);
    return NextResponse.json(reviews);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch reviews" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = CreateReviewSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation error", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const adapter = getDatabaseAdapter();
    const tenantId = getDefaultTenantId();

    const review = await adapter.createReview(tenantId, parseResult.data);
    return NextResponse.json(review, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to submit review" }, { status: 400 });
  }
}

