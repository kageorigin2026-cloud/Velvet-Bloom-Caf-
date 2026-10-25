import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  resolveServerBaseUrl,
  isLocalhostUrl,
  buildCustomerTableQrUrl,
  CANONICAL_PRODUCTION_URL,
} from "@/lib/server/url-resolver";
import QRCode from "qrcode";
import jsQR from "jsqr";

describe("Production QR URL Resolution & Invariants", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("correctly identifies localhost, loopback, and dev-port URLs", () => {
    expect(isLocalhostUrl("http://localhost:3000")).toBe(true);
    expect(isLocalhostUrl("http://localhost")).toBe(true);
    expect(isLocalhostUrl("http://127.0.0.1:3000")).toBe(true);
    expect(isLocalhostUrl("http://127.0.0.1")).toBe(true);
    expect(isLocalhostUrl("http://0.0.0.0:3000")).toBe(true);
    expect(isLocalhostUrl("https://my-app.local")).toBe(true);

    expect(isLocalhostUrl("https://velvet-bloom-caf.vercel.app")).toBe(false);
    expect(isLocalhostUrl("https://velvetbloom.cafe")).toBe(false);
  });

  it("never returns localhost or loopback in production even if NEXT_PUBLIC_APP_URL is localhost", () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

    const resolved = resolveServerBaseUrl();
    expect(resolved).not.toContain("localhost");
    expect(resolved).not.toContain("127.0.0.1");
    expect(resolved).not.toContain(":3000");
    expect(resolved).toBe(CANONICAL_PRODUCTION_URL);
  });

  it("never returns localhost when VERCEL environment is active", () => {
    delete process.env.NODE_ENV;
    process.env.VERCEL = "1";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

    const resolved = resolveServerBaseUrl();
    expect(resolved).not.toContain("localhost");
    expect(resolved).not.toContain("127.0.0.1");
    expect(resolved).not.toContain(":3000");
    expect(resolved).toBe(CANONICAL_PRODUCTION_URL);
  });

  it("preserves explicitly configured non-localhost public domain in production", () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_APP_URL = "https://velvet-bloom-caf.vercel.app";

    const resolved = resolveServerBaseUrl();
    expect(resolved).toBe("https://velvet-bloom-caf.vercel.app");
  });

  it("allows localhost when explicitly running in local development mode", () => {
    process.env.NODE_ENV = "development";
    delete process.env.VERCEL;
    delete process.env.VERCEL_ENV;
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

    const resolved = resolveServerBaseUrl();
    expect(resolved).toBe("http://localhost:3000");
  });

  it("generates production table QR URLs strictly matching https://velvet-bloom-caf.vercel.app/table/<token>", () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000"; // Simulation of misconfigured env

    const tokens = [
      "vb_tbl_01_tok99a",
      "vb_tbl_02_tok88b",
      "vb_tbl_09_tok11i",
      "vb_tbl_12_tok87l",
    ];

    for (const token of tokens) {
      const url = buildCustomerTableQrUrl(token);
      expect(url).toBe(`https://velvet-bloom-caf.vercel.app/table/${token}`);
      expect(url).not.toContain("localhost");
      expect(url).not.toContain("127.0.0.1");
      expect(url).not.toContain(":3000");
    }
  });

  it("verifies generated QR codes by decoding pixel contents with jsQR", async () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

    const testTables = [
      { name: "Table 1", token: "vb_tbl_01_tok99a" },
      { name: "Table 5", token: "vb_tbl_05_tok55e" },
      { name: "Table 9 (Terrace)", token: "vb_tbl_09_tok11i" },
      { name: "Table 12 (VIP Lounge)", token: "vb_tbl_12_tok87l" },
    ];

    for (const t of testTables) {
      const targetUrl = buildCustomerTableQrUrl(t.token);

      // Generate the raw QR code matrix
      const qr = QRCode.create(targetUrl, { errorCorrectionLevel: "H" });
      const size = qr.modules.size;
      const pixelData = new Uint8ClampedArray(size * size * 4);

      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const idx = (r * size + c) * 4;
          const isDark = qr.modules.get(r, c);
          pixelData[idx] = isDark ? 0 : 255;
          pixelData[idx + 1] = isDark ? 0 : 255;
          pixelData[idx + 2] = isDark ? 0 : 255;
          pixelData[idx + 3] = 255;
        }
      }

      // Decode the raw QR code matrix using jsQR
      const decoded = jsQR(pixelData, size, size);
      expect(decoded).not.toBeNull();
      expect(decoded?.data).toBe(targetUrl);
      expect(decoded?.data).toBe(`https://velvet-bloom-caf.vercel.app/table/${t.token}`);

      // Explicit security assertions
      expect(decoded?.data).not.toContain("localhost");
      expect(decoded?.data).not.toContain("127.0.0.1");
      expect(decoded?.data).not.toContain(":3000");
      expect(decoded?.data.startsWith("https://velvet-bloom-caf.vercel.app/table/")).toBe(true);
    }
  });
});
