import { NextRequest, NextResponse } from "next/server";
import { getDatabaseAdapter, getDefaultTenantId } from "@/lib/adapter";
import { createSessionToken } from "@/lib/auth/staff-auth";
import { z } from "zod";

const SetupOwnerSchema = z.object({
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters").max(100),
  email: z.string().trim().email("Please provide a valid email address").max(120),
  pin: z.string().trim().regex(/^\d{4,6}$/, "Owner PIN must be between 4 and 6 numeric digits"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = SetupOwnerSchema.safeParse(body);

    if (!parseResult.success) {
      const errorMsg = parseResult.error.errors.map((e) => e.message).join(". ");
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const { fullName, email, pin } = parseResult.data;
    const adapter = getDatabaseAdapter();
    const tenantId = getDefaultTenantId();

    // 1. Guard against duplicate owner initialization
    const alreadyHasOwner = await adapter.hasActiveOwner(tenantId);
    if (alreadyHasOwner) {
      return NextResponse.json(
        {
          error:
            "An active Owner account is already configured for this café. Please sign in using your existing Owner PIN.",
        },
        { status: 409 }
      );
    }

    // 2. Provision initial owner via atomic, bcrypt-salted procedure
    const newOwner = await adapter.provisionInitialOwner(tenantId, fullName, email, pin);

    // 3. Issue staff session token
    const session = createSessionToken(newOwner);

    const response = NextResponse.json(session, { status: 201 });
    response.cookies.set("vb_staff_session", session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 8 * 60 * 60, // 8 hours
      path: "/",
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to initialize owner account" },
      { status: 400 }
    );
  }
}
