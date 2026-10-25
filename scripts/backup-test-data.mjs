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
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

const supabase = createClient(supabaseUrl, supabaseKey);

async function backup() {
  console.log("=== V2 DATABASE BACKUP PRE-CLEANUP ===");
  console.log("Supabase URL:", supabaseUrl);
  console.log("Tenant ID:   ", tenantId);

  const tablesToBackup = [
    "orders",
    "order_items",
    "order_events",
    "bills",
    "bill_splits",
    "payments",
    "service_requests",
    "reviews",
    "table_sessions",
    "tables"
  ];

  const backupData = {
    exported_at: new Date().toISOString(),
    supabase_url: supabaseUrl,
    tenant_id: tenantId,
    records: {}
  };

  for (const tableName of tablesToBackup) {
    const { data, error } = await supabase
      .from(tableName)
      .select("*");

    if (error) {
      console.error(`Error backing up table ${tableName}:`, error.message);
      backupData.records[tableName] = { error: error.message };
    } else {
      console.log(`Backed up ${tableName}: ${data.length} records`);
      backupData.records[tableName] = data;
    }
  }

  // Ensure scratch dir exists
  const scratchDir = "C:\\Users\\rithv\\.gemini\\antigravity\\brain\\c6bb7c9f-2aa0-416b-8363-dcabb180ecc3\\scratch";
  if (!fs.existsSync(scratchDir)) {
    fs.mkdirSync(scratchDir, { recursive: true });
  }

  const backupPath = path.join(scratchDir, "backup-pre-cleanup.json");
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), "utf-8");
  console.log("\nBackup successfully saved to:", backupPath);

  // Also save a local workspace backup copy in scripts/backup-pre-cleanup.json for safety
  const localBackupPath = path.resolve(process.cwd(), "scripts", "backup-pre-cleanup.json");
  fs.writeFileSync(localBackupPath, JSON.stringify(backupData, null, 2), "utf-8");
  console.log("Local backup saved to:", localBackupPath);

  // Print details of test records
  console.log("\n=== TEST RECORDS SUMMARY ===");
  console.log("Orders:", backupData.records.orders?.map(o => ({ id: o.id, num: o.order_number, status: o.status, total: o.total })));
  console.log("Bills:", backupData.records.bills?.map(b => ({ id: b.id, num: b.bill_number, status: b.status, total: b.final_total })));
  console.log("Reviews:", backupData.records.reviews?.map(r => ({ id: r.id, rating: r.rating, customer: r.customer_name })));
  console.log("Sessions:", backupData.records.table_sessions?.length);
  console.log("Tables with non-AVAILABLE status:", backupData.records.tables?.filter(t => t.status !== "AVAILABLE").map(t => ({ id: t.id, num: t.table_number, status: t.status })));
}

backup().catch((err) => {
  console.error("Backup failed:", err);
  process.exit(1);
});

