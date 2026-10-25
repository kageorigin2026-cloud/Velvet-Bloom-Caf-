import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Load .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        process.env[key] = val;
      }
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://iwszvepliiqwaoetgaub.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function fetchWithRetry(url, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "VB-Table-Verifier" } });
      const text = await res.text();
      return { status: res.status, text };
    } catch (e) {
      if (attempt === maxRetries) throw e;
      await new Promise((r) => setTimeout(r, 600 * attempt));
    }
  }
}

async function verifyAll12Tables() {
  const { data: tables, error } = await supabase
    .from("tables")
    .select("id, table_number, qr_code_token, status, capacity")
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("DB error:", error);
    process.exit(1);
  }

  tables.sort((a, b) => {
    const numA = parseInt(a.table_number.replace(/\D/g, ""), 10);
    const numB = parseInt(b.table_number.replace(/\D/g, ""), 10);
    return numA - numB;
  });

  console.log(`Verifying all ${tables.length} tables in Supabase V2...`);

  const results = [];
  for (const t of tables) {
    const liveUrl = `https://velvet-bloom-caf.vercel.app/table/${t.qr_code_token}`;
    const res = await fetchWithRetry(liveUrl);
    const isValid = res.status === 200 && (res.text.includes("Velvet Bloom") || res.text.includes("Table"));
    results.push({
      "Table Name": t.table_number,
      "QR Token": t.qr_code_token,
      "Capacity": t.capacity,
      "Status": t.status,
      "HTTP Status": res.status,
      "Valid Destination": isValid ? "YES (200 OK)" : "NO"
    });
    await new Promise((r) => setTimeout(r, 250));
  }

  console.table(results);
}

verifyAll12Tables().catch(console.error);
