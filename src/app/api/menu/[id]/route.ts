import { NextRequest, NextResponse } from "next/server";
import { getDatabaseAdapter, getDefaultTenantId } from "@/lib/adapter";
import { extractStaffToken, verifyStaffRole } from "@/lib/auth/staff-auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = getDefaultTenantId();
    const { id } = await params;
    const adapter = getDatabaseAdapter();

    const item = await adapter.getMenuItemById(tenantId, id);
    if (!item) {
      return NextResponse.json({ error: "Menu item not found" }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch menu item" }, { status: 400 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = getDefaultTenantId();
    const token = extractStaffToken(req);
    // Allow CHEF/MANAGER to toggle availability, but only OWNER/ADMIN can edit details/prices
    const auth = verifyStaffRole(token, ["OWNER", "ADMIN", "MANAGER", "CHEF"], tenantId);

    if (!auth.authorized || !auth.session) {
      return NextResponse.json(
        { error: auth.error || "Staff permissions required" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const adapter = getDatabaseAdapter();

    const isElevated = auth.session.role === "OWNER" || auth.session.role === "ADMIN";

    // If non-elevated (e.g. CHEF), only allow isAvailable toggling
    if (!isElevated) {
      if (body.isAvailable !== undefined) {
        const updated = await adapter.updateMenuItemAvailability(tenantId, id, Boolean(body.isAvailable));
        return NextResponse.json(updated);
      }
      return NextResponse.json(
        { error: "Only Owners and Admins can modify item details, pricing, or categories" },
        { status: 403 }
      );
    }

    // Elevated update: validate pricing if passed
    if (body.price !== undefined) {
      const numPrice = Number(body.price);
      if (isNaN(numPrice) || numPrice < 0) {
        return NextResponse.json({ error: "Price must be a valid non-negative number" }, { status: 400 });
      }
    }

    const updated = await adapter.updateMenuItem(tenantId, id, {
      name: body.name !== undefined ? String(body.name).trim() : undefined,
      categoryId: body.categoryId !== undefined ? String(body.categoryId) : undefined,
      description: body.description !== undefined ? String(body.description).trim() : undefined,
      price: body.price !== undefined ? Number(body.price) : undefined,
      imageUrl: body.imageUrl !== undefined ? String(body.imageUrl).trim() : undefined,
      isVeg: body.isVeg !== undefined ? Boolean(body.isVeg) : undefined,
      isAvailable: body.isAvailable !== undefined ? Boolean(body.isAvailable) : undefined,
      isArchived: body.isArchived !== undefined ? Boolean(body.isArchived) : undefined,
      prepTimeMinutes: body.prepTimeMinutes !== undefined ? Number(body.prepTimeMinutes) : undefined,
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update menu item" }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = getDefaultTenantId();
    const token = extractStaffToken(req);
    const auth = verifyStaffRole(token, ["OWNER", "ADMIN"], tenantId);

    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error || "Owner or Admin privileges required to archive menu items" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const adapter = getDatabaseAdapter();

    // Safely archive item so past orders and bills remain intact
    const archived = await adapter.archiveMenuItem(tenantId, id);

    return NextResponse.json({
      success: true,
      message: "Menu item archived successfully",
      item: archived,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to archive menu item" }, { status: 400 });
  }
}

