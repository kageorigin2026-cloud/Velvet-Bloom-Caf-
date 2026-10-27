import { NextRequest, NextResponse } from "next/server";
import { getDatabaseAdapter, getDefaultTenantId } from "@/lib/adapter";
import { extractStaffToken, verifyStaffRole } from "@/lib/auth/staff-auth";
import { UserRole } from "@/types/database.types";

const ALLOWED_STAFF_ROLES: UserRole[] = ["MANAGER", "CHEF", "WAITER", "CASHIER", "STAFF"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = getDefaultTenantId();
    const token = extractStaffToken(req);
    const auth = verifyStaffRole(token, ["OWNER", "ADMIN"], tenantId);

    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error || "Owner or Admin privileges required to update staff accounts" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const adapter = getDatabaseAdapter();

    // 1. PIN Update check
    if (body.newPin) {
      const pinStr = String(body.newPin).trim();
      if (!/^[0-9]{4,6}$/.test(pinStr)) {
        return NextResponse.json(
          { error: "New PIN must be between 4 and 6 numeric digits" },
          { status: 400 }
        );
      }
      await adapter.updateStaffPin(tenantId, id, pinStr);
    }

    // 2. Profile Details Update
    const { fullName, email, role, phone, isActive } = body;
    const normalizedRole = role ? (String(role).trim().toUpperCase() as UserRole) : undefined;
    const hasProfileUpdates =
      fullName !== undefined ||
      email !== undefined ||
      role !== undefined ||
      phone !== undefined ||
      isActive !== undefined;

    let updatedUser;
    if (hasProfileUpdates) {
      if (normalizedRole && !ALLOWED_STAFF_ROLES.includes(normalizedRole) && normalizedRole !== "OWNER") {
        return NextResponse.json(
          { error: `Invalid role: ${role}. Permitted: ${ALLOWED_STAFF_ROLES.join(", ")}` },
          { status: 400 }
        );
      }

      updatedUser = await adapter.updateStaffMember(tenantId, id, {
        fullName: typeof fullName === "string" ? fullName.trim() : undefined,
        email: typeof email === "string" ? email.trim().toLowerCase() : undefined,
        role: normalizedRole,
        phone: typeof phone === "string" ? phone.trim() : undefined,
        isActive: typeof isActive === "boolean" ? isActive : undefined,
      });
    } else {
      // Re-fetch user if only PIN was updated
      const users = await adapter.getUsers(tenantId);
      updatedUser = users.find((u) => u.id === id);
    }

    if (!updatedUser) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    }

    const { pin_code, ...sanitized } = updatedUser;
    return NextResponse.json(sanitized);
  } catch (err: any) {
    if (err.code === "23505" || err.message?.includes("duplicate key") || err.message?.includes("already exists")) {
      return NextResponse.json(
        { error: "A staff member with this email address already exists." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: err.message || "Failed to update staff account" }, { status: 400 });
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
        { error: auth.error || "Owner or Admin privileges required to deactivate staff accounts" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const adapter = getDatabaseAdapter();

    const deactivated = await adapter.deleteStaffMember(tenantId, id);
    const { pin_code, ...sanitized } = deactivated;

    return NextResponse.json({
      success: true,
      message: "Staff member deactivated successfully",
      user: sanitized,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to deactivate staff account" }, { status: 400 });
  }
}

