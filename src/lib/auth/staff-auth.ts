import { User, UserRole } from "@/types/database.types";
import { getDatabaseAdapter, isLocalAdapter } from "@/lib/adapter";

export interface StaffSession {
  user: User;
  token: string;
  expiresAt: string;
}

export const SESSION_COOKIE_NAME = "vb_staff_session";

export async function authenticateStaff(
  tenantId: string,
  credentials: { email?: string; pin?: string; password?: string; clientIp?: string }
): Promise<User | null> {
  const adapter = getDatabaseAdapter();

  // 1. PIN-based Terminal Login
  if (credentials.pin) {
    // In Supabase mode, the PIN is validated strictly against the tenant's users in PostgreSQL
    // In local mode, the local adapter validates against seeded users
    const user = await adapter.getUserByPin(tenantId, credentials.pin, credentials.clientIp);
    if (user && user.is_active && user.tenant_id === tenantId) {
      return user;
    }
    return null;
  }

  // 2. Email & Password Authentication
  if (credentials.email) {
    const normalizedEmail = credentials.email.trim().toLowerCase();

    if (!isLocalAdapter()) {
      // Production Supabase Mode: Require real password authentication via Supabase Auth
      if (!credentials.password) {
        return null;
      }

      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!url || !anonKey) {
        throw new Error("Supabase credentials not configured in server environment.");
      }

      const { createClient } = await import("@supabase/supabase-js");
      const client = createClient(url, anonKey);

      const { data: authData, error: authErr } = await client.auth.signInWithPassword({
        email: normalizedEmail,
        password: credentials.password,
      });

      if (authErr || !authData.user) {
        return null;
      }

      const user = await adapter.getUserByEmail(tenantId, normalizedEmail);
      if (user && user.is_active && user.tenant_id === tenantId) {
        return user;
      }
      return null;
    }

    // Local Development Mode: Look up user in local memory store
    const user = await adapter.getUserByEmail(tenantId, normalizedEmail);
    if (user && user.is_active) {
      return user;
    }
  }

  return null;
}

export function createSessionToken(user: User): StaffSession {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const tokenPayload = {
    userId: user.id,
    tenantId: user.tenant_id,
    role: user.role,
    email: user.email,
    exp: Date.now() + 24 * 60 * 60 * 1000,
  };
  const token = Buffer.from(JSON.stringify(tokenPayload)).toString("base64");

  return {
    user,
    token,
    expiresAt,
  };
}

export function parseSessionToken(token: string): { userId: string; tenantId: string; role: UserRole } | null {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const parsed = JSON.parse(decoded);
    if (parsed.exp && parsed.exp < Date.now()) return null;
    return {
      userId: parsed.userId,
      tenantId: parsed.tenantId,
      role: parsed.role,
    };
  } catch {
    return null;
  }
}

export function extractStaffToken(req: { cookies: { get: (name: string) => { value: string } | undefined }; headers: { get: (name: string) => string | null } }): string | null {
  const cookieToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (cookieToken) return cookieToken;

  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  return null;
}

/**
 * Server-side authorization guard.
 * Validates staff session token, tenant isolation, and role permissions.
 */
export function verifyStaffRole(
  token: string | null | undefined,
  allowedRoles: UserRole[],
  targetTenantId?: string
): { authorized: boolean; error?: string; session?: { userId: string; tenantId: string; role: UserRole } } {
  if (!token) {
    return { authorized: false, error: "Authentication required" };
  }

  const session = parseSessionToken(token);
  if (!session) {
    return { authorized: false, error: "Invalid or expired session token" };
  }

  if (targetTenantId && session.tenantId !== targetTenantId) {
    return { authorized: false, error: "Cross-tenant access forbidden" };
  }

  if (session.role === "OWNER" || session.role === "ADMIN") {
    return { authorized: true, session };
  }

  if (!allowedRoles.includes(session.role)) {
    return { authorized: false, error: "Insufficient permissions for this operation" };
  }

  return { authorized: true, session };
}
