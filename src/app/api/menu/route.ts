import { NextRequest, NextResponse } from "next/server";
import { getDatabaseAdapter, getDefaultTenantId } from "@/lib/adapter";
import { extractStaffToken, verifyStaffRole } from "@/lib/auth/staff-auth";

export async function GET(req: NextRequest) {
  try {
    const tenantId = getDefaultTenantId();
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("categoryId") || undefined;
    const includeArchived = searchParams.get("includeArchived") === "true";

    const adapter = getDatabaseAdapter();
    const items = await adapter.getMenuItems(tenantId, categoryId, includeArchived);

    return NextResponse.json(items);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch menu items" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenantId = getDefaultTenantId();
    const token = extractStaffToken(req);
    const auth = verifyStaffRole(token, ["OWNER", "ADMIN"], tenantId);

    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error || "Owner or Admin privileges required to add menu items" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, categoryId, price, description, imageUrl, isVeg, prepTimeMinutes } = body;

    // Validate name
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Item name is required" }, { status: 400 });
    }

    // Validate category
    if (!categoryId || typeof categoryId !== "string") {
      return NextResponse.json({ error: "Category is required" }, { status: 400 });
    }

    // Validate price: must be a finite non-negative number
    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) {
      return NextResponse.json({ error: "Price must be a valid non-negative number" }, { status: 400 });
    }

    // Validate prep time if given
    const prepMinutes = prepTimeMinutes !== undefined ? Number(prepTimeMinutes) : 15;
    if (isNaN(prepMinutes) || prepMinutes < 1) {
      return NextResponse.json({ error: "Preparation time must be at least 1 minute" }, { status: 400 });
    }

    const adapter = getDatabaseAdapter();
    const newItem = await adapter.createMenuItem(tenantId, {
      name: name.trim(),
      categoryId,
      price: numPrice,
      description: typeof description === "string" ? description.trim() : undefined,
      imageUrl: typeof imageUrl === "string" ? imageUrl.trim() : undefined,
      isVeg: Boolean(isVeg),
      prepTimeMinutes: prepMinutes,
    });

    return NextResponse.json(newItem, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create menu item" }, { status: 400 });
  }
}

