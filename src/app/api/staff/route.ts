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
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!cleanEmail || !cleanEmail.includes("@")) {
      return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
    }

    // Validate role: forbid self-provisioning/promoting to OWNER or ADMIN
    const normalizedRole = role ? (role.toString().trim().toUpperCase() as UserRole) : undefined;
    if (!normalizedRole || !ALLOWED_STAFF_ROLES.includes(normalizedRole)) {
      return NextResponse.json(
        { error: `Invalid role: ${role}. Allowed roles: ${ALLOWED_STAFF_ROLES.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate PIN: strictly 4 to 6 numeric digits
    const cleanPin = typeof pin === "string" ? pin.trim() : "";
    if (!cleanPin || !/^[0-9]{4,6}$/.test(cleanPin)) {
      return NextResponse.json({ error: "Quick PIN must be between 4 and 6 numeric digits" }, { status: 400 });
    }

    const adapter = getDatabaseAdapter();
    const newUser = await adapter.createStaffMember(tenantId, {
      fullName: fullName.trim(),
      email: cleanEmail,
      role: normalizedRole,
      pin: cleanPin,
      phone: typeof phone === "string" ? phone.trim() : undefined,
    });

    const { pin_code, ...sanitized } = newUser;
    return NextResponse.json(sanitized, { status: 201 });
  } catch (err: any) {
    const errorMsg = err.message || "Failed to create staff account";
    if (errorMsg.toLowerCase().includes("already in use")) {
      return NextResponse.json(
        { error: `Email address is already in use by another staff member in this café.` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }
}
