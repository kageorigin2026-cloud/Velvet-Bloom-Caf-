/**
 * Velvet Bloom Café V2 - Canonical URL & QR Destination Resolver
 *
 * Security & Environment Resolution Rules:
 * 1. Priority 1: Explicitly configured NEXT_PUBLIC_APP_URL (validated: must NOT be localhost in production)
 * 2. Priority 2: Validated Vercel production deployment URL if configured
 * 3. Priority 3: Canonical production URL: https://velvet-bloom-caf.vercel.app
 * 4. Priority 4: Localhost ONLY when strictly in local development (NODE_ENV !== "production")
 *
 * Security: NEVER trusts incoming Host or Forwarded headers to construct permanent QR URLs.
 */

export const CANONICAL_PRODUCTION_URL = "https://velvet-bloom-caf.vercel.app";

/**
 * Checks if a URL points to localhost or loopback development address.
 */
export function isLocalhostUrl(urlStr: string): boolean {
  if (!urlStr) return false;
  const trimmed = urlStr.trim().toLowerCase();
  try {
    const parsed = new URL(trimmed.startsWith("http") ? trimmed : `http://${trimmed}`);
    return (
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "0.0.0.0" ||
      parsed.hostname.endsWith(".local") ||
      parsed.port === "3000" ||
      parsed.port === "3001"
    );
  } catch {
    return (
      trimmed.includes("localhost") ||
      trimmed.includes("127.0.0.1") ||
      trimmed.includes(":3000") ||
      trimmed.includes(":3001")
    );
  }
}

/**
 * Single server-side base-URL resolver.
 */
export function resolveServerBaseUrl(): string {
  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL === "1" ||
    process.env.VERCEL_ENV === "production";

  // Check explicitly configured URL
  const configured = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL)?.trim();

  if (configured) {
    const isLocal = isLocalhostUrl(configured);
    if (!isProduction) {
      // In local dev, localhost is valid
      return configured.replace(/\/+$/, "");
    }
    // In production, reject localhost/loopback configuration artifacts
    if (!isLocal) {
      return configured.replace(/\/+$/, "");
    }
  }

  // Check Vercel production deployment URL if provided by hosting environment
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    const vUrl = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`.trim();
    if (!isLocalhostUrl(vUrl)) {
      return vUrl.replace(/\/+$/, "");
    }
  }

  // In production mode, always enforce the verified production origin
  if (isProduction) {
    return CANONICAL_PRODUCTION_URL;
  }

  // Local development fallback
  return "http://localhost:3000";
}

/**
 * Builds the canonical customer table URL for physical QR standees.
 */
export function buildCustomerTableQrUrl(token: string, baseUrl?: string): string {
  const base = (baseUrl || resolveServerBaseUrl()).replace(/\/+$/, "");
  return `${base}/table/${token.trim()}`;
}
