import { NextRequest, NextResponse } from "next/server";
import { getDatabaseAdapter, getDefaultTenantId } from "@/lib/adapter";
import { extractStaffToken, verifyStaffRole } from "@/lib/auth/staff-auth";
import { UserRole } from "@/types/database.types";

const ALLOWED_STAFF_ROLES: UserRole[] = ["MANAGER", "CHEF", "WAITER", "CASHIER", "STAFF"];

export async function GET(req: NextRequest) {
  try {
    const tenantId = getDefaultTenantId();
    const token = extractStaffToken(req);
    const auth = verifyStaffRole(token, ["OWNER", "ADMIN"], tenantId);

    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error || "Owner or Admin privileges required to view staff accounts" },
        { status: 403 }
      );
    }

    const adapter = getDatabaseAdapter();
    const staff = await adapter.getUsers(tenantId);

    // Ensure PIN hashes or passwords are never returned
    const sanitized = staff.map(({ pin_code, ...rest }) => rest);

    return NextResponse.json({ staff: sanitized });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load staff list" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenantId = getDefaultTenantId();
    const token = extractStaffToken(req);
    const auth = verifyStaffRole(token, ["OWNER", "ADMIN"], tenantId);

    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error || "Owner or Admin privileges required to create staff accounts" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { fullName, email, role, pin, phone } = body;

    // Validate name
    if (!fullName || typeof fullName !== "string" || fullName.trim().length < 2) {
      return NextResponse.json({ error: "Full name must be at least 2 characters" }, { status: 400 });
    }

    // Validate email
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
    }

    // Validate role: forbid self-provisioning/promoting to OWNER or ADMIN
    if (!role || !ALLOWED_STAFF_ROLES.includes(role as UserRole)) {
      return NextResponse.json(
        { error: `Invalid role: ${role}. Allowed roles: ${ALLOWED_STAFF_ROLES.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate PIN: strictly 4 to 6 numeric digits
    if (!pin || typeof pin !== "string" || !/^[0-9]{4,6}$/.test(pin.trim())) {
      return NextResponse.json({ error: "Quick PIN must be between 4 and 6 numeric digits" }, { status: 400 });
    }

    const adapter = getDatabaseAdapter();
    const newUser = await adapter.createStaffMember(tenantId, {
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      role: role as UserRole,
      pin: pin.trim(),
      phone: phone?.trim(),
    });

    const { pin_code, ...sanitized } = newUser;
    return NextResponse.json(sanitized, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create staff account" }, { status: 400 });
  }
}

