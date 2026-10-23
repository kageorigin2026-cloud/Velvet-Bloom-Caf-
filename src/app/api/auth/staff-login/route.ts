import { NextRequest, NextResponse } from "next/server";
import { authenticateStaff, createSessionToken } from "@/lib/auth/staff-auth";
import { getDefaultTenantId } from "@/lib/adapter";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantId = getDefaultTenantId();

    const user = await authenticateStaff(tenantId, {
      pin: body.pin,
      email: body.email,
      password: body.password,
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials or account inactive" }, { status: 401 });
    }

    const session = createSessionToken(user);

    const response = NextResponse.json(session);
    response.cookies.set("vb_staff_session", session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Authentication failed" }, { status: 400 });
  }
}

