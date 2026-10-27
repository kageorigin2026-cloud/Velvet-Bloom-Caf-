import React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { parseSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/staff-auth";

interface AdminLayoutProps {
  children: React.ReactNode;
}

/**
 * Server-side authorization guard for the entire /admin subtree.
 * Ensures unauthenticated or non-admin users cannot access administrative views or QR standees.
 */
export default async function AdminLayout({ children }: AdminLayoutProps) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  const session = sessionCookie ? parseSessionToken(sessionCookie.value) : null;
  const role = session?.role?.toString().trim().toUpperCase();

  if (!session || (role !== "OWNER" && role !== "ADMIN")) {
    redirect("/staff/login");
  }

  return <>{children}</>;
}

