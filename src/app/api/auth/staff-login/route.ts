import { NextRequest, NextResponse } from "next/server";
import { authenticateStaff, createSessionToken } from "@/lib/auth/staff-auth";
import { getDefaultTenantId } from "@/lib/adapter";

// In-memory login rate limiter: ip -> { count, lockedUntil }
const loginAttempts = new Map<string, { count: number; lockedUntil?: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minute cooldown

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const now = Date.now();
    const attemptRecord = loginAttempts.get(ip);

    if (attemptRecord?.lockedUntil && now < attemptRecord.lockedUntil) {
      const remainingSeconds = Math.ceil((attemptRecord.lockedUntil - now) / 1000);
      return NextResponse.json(
        {
          error: `Too many failed login attempts. Terminal locked for security. Please try again in ${remainingSeconds} seconds.`,
        },
        {
          status: 429,
          headers: { "Retry-After": remainingSeconds.toString() },
        }
      );
    }

    const body = await req.json();
    const tenantId = getDefaultTenantId();

    const user = await authenticateStaff(tenantId, {
      pin: body.pin,
      email: body.email,
      password: body.password,
    });

    if (!user) {
      const currentCount = (attemptRecord?.count || 0) + 1;
      if (currentCount >= MAX_ATTEMPTS) {
        loginAttempts.set(ip, { count: currentCount, lockedUntil: now + LOCKOUT_MS });
      } else {
        loginAttempts.set(ip, { count: currentCount });
      }

      return NextResponse.json(
        {
          error: "Invalid credentials or account inactive",
          remainingAttempts: Math.max(0, MAX_ATTEMPTS - currentCount),
        },
        { status: 401 }
      );
    }

    // Clear rate limit on successful authentication
    loginAttempts.delete(ip);

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

