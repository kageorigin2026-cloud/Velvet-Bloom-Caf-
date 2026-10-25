import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Load .env.local if present
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

console.log("=== V2 DATABASE INSPECTION ===");
console.log("Project URL:", supabaseUrl);
console.log("Tenant ID:  ", tenantId);

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  const tables = [
    "tenants",
    "cafe_settings",
    "tables",
    "table_sessions",
    "categories",
    "menu_items",
    "orders",
    "order_items",
    "order_events",
    "bills",
    "bill_splits",
    "payments",
    "service_requests",
    "reviews",
    "users"
  ];

  const report = {};

  for (const tbl of tables) {
    try {
      const { count, error } = await supabase
        .from(tbl)
        .select("*", { count: "exact", head: true });

      if (error) {
        report[tbl] = `Error: ${error.message}`;
      } else {
        report[tbl] = count;
      }
    } catch (err) {
      report[tbl] = `Exception: ${err.message}`;
    }
  }

  console.log("\nTable Record Counts:");
  console.table(report);

  // Inspect recent orders
  const { data: recentOrders } = await supabase
    .from("orders")
    .select("id, order_number, status, total, customer_name, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  console.log("\nRecent Orders (up to 10):");
  console.log(recentOrders);

  // Inspect active sessions
  const { data: sessions } = await supabase
    .from("table_sessions")
    .select("id, table_id, is_active, created_at, ended_at")
    .limit(10);

  console.log("\nRecent Sessions (up to 10):");
  console.log(sessions);

  // Inspect payments
  const { data: payments } = await supabase
    .from("payments")
    .select("id, bill_id, amount, payment_method, status, created_at")
    .limit(10);

  console.log("\nRecent Payments (up to 10):");
  console.log(payments);
}

inspect().catch((err) => {
  console.error("Inspection failed:", err);
  process.exit(1);
});

