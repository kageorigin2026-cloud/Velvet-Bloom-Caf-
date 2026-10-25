import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";
import jsQR from "jsqr";

const supabaseUrl = "https://iwszvepliiqwaoetgaub.supabase.co";
const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3c3p2ZXBsaWlxd2FvZXRnYXViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjY4Mjk4MCwiZXhwIjoyMTA4MjU4OTgwfQ.LWLkmxoE1G7MXOIUbV4EUUIUOdDTP6L66rgLyY6Is5Q";
const tenantId = "00000000-0000-0000-0000-000000000001";
const PROD_BASE = "https://velvet-bloom-caf.vercel.app";

async function verifyAndDecodeAll12Tables() {
  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: tables, error } = await supabase
    .from("tables")
    .select("id, table_number, qr_code_token, status, capacity")
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("Database error:", error);
    process.exit(1);
  }

  tables.sort((a, b) => {
    const numA = parseInt(a.table_number.replace(/\D/g, ""), 10);
    const numB = parseInt(b.table_number.replace(/\D/g, ""), 10);
    return numA - numB;
  });

  console.log(`Auditing and decoding QR matrix for all ${tables.length} tables in Supabase V2...\n`);

  const results = [];
  for (const t of tables) {
    const targetUrl = `${PROD_BASE}/table/${t.qr_code_token}`;

    // 1. Generate QR Code Matrix
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

    // 2. Decode QR Code Matrix with jsQR
    const decoded = jsQR(pixelData, size, size);
    const decodedPayload = decoded ? decoded.data : "DECODE_FAILED";
    const matchesTarget = decodedPayload === targetUrl;
    const noLocalhost =
      !decodedPayload.includes("localhost") &&
      !decodedPayload.includes("127.0.0.1") &&
      !decodedPayload.includes(":3000");

    // 3. Test Live HTTP endpoint
    let liveStatus = 0;
    try {
      const res = await fetch(targetUrl);
      liveStatus = res.status;
    } catch (e) {
      liveStatus = 500;
    }

    results.push({
      "Table": t.table_number,
      "Token": t.qr_code_token,
      "Decoded QR URL": decodedPayload,
      "Matches Target": matchesTarget ? "YES" : "NO",
      "No Localhost": noLocalhost ? "PASSED" : "FAILED",
      "Live HTTP": liveStatus === 200 ? "200 OK" : `HTTP ${liveStatus}`,
    });
  }

  console.table(results);
}

verifyAndDecodeAll12Tables().catch(console.error);
