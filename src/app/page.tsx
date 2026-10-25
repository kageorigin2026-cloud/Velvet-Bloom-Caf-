import React from "react";
import Link from "next/link";
import { getDatabaseAdapter, getDefaultTenantId } from "@/lib/adapter";
import { CafeLogo } from "@/components/brand/CafeLogo";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import {
  QrCode,
  Sparkles,
  ArrowRight,
  Clock,
  Search,
  Coffee,
  Shield,
  UtensilsCrossed,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const adapter = getDatabaseAdapter();
  const tenantId = getDefaultTenantId();

  let tables: any[] = [];
  let settings: any = null;
  let loadError: string | null = null;

  try {
    [tables, settings] = await Promise.all([
      adapter.getTables(tenantId),
      adapter.getSettings(tenantId),
    ]);
  } catch (err: any) {
    console.error("[HomePage] Failed to fetch cafe data:", err.message);
    loadError = "Unable to connect to the café dining network. Please speak with floor staff.";
  }

  // Sort tables by table number naturally
  const sortedTables = [...tables].sort((a, b) => {
    const numA = parseInt(a.table_number.replace(/\D/g, ""), 10) || 0;
    const numB = parseInt(b.table_number.replace(/\D/g, ""), 10) || 0;
    return numA - numB;
  });

  return (
    <main className="min-h-screen bg-[#080808] text-[#F6EFE7] flex flex-col justify-between selection:bg-[#C99A8A]/30">
      {/* Top Brand Bar */}
      <header className="border-b border-[#242424]/80 px-4 py-4 sm:px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <CafeLogo size="md" showTagline={false} showPoweredBy={false} href="/" />
          <Link
            href="/track"
            className="text-xs text-[#D8B58A] hover:text-[#F6EFE7] transition-colors flex items-center gap-1.5 font-medium border border-[#D8B58A]/30 px-3 py-1.5 rounded-full hover:border-[#D8B58A]"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Track Live Order</span>
          </Link>
        </div>
      </header>

      {/* Hero Atmosphere Section */}
      <section className="relative overflow-hidden pt-12 pb-10 px-4 text-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#C99A8A]/15 via-[#171717]/40 to-transparent pointer-events-none" />

        <div className="relative max-w-2xl mx-auto flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1c1c1c] border border-[#C99A8A]/30 text-[11px] text-[#D8B58A] font-medium mb-5 shadow-lg shadow-black/50">
            <Sparkles className="w-3 h-3 text-[#D8B58A]" />
            <span>Artisanal Coffee & Culinary Craft</span>
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#F6EFE7] leading-tight">
            Sip. Savor. Bloom.
          </h1>

          <p className="mt-4 text-xs sm:text-sm text-[#A8A29E] max-w-lg font-light leading-relaxed">
            Welcome to Velvet Bloom Café. Immerse yourself in botanical aromas, handcrafted single-origin roasts, and culinary creations prepared to order.
          </p>
        </div>
      </section>

      {/* Main Customer Interaction Section */}
      <div className="max-w-4xl mx-auto w-full px-4 py-4 flex-1 space-y-8">
        {loadError && (
          <div className="p-4 rounded-2xl bg-[#C96B6B]/10 border border-[#C96B6B]/30 text-center text-xs text-[#C96B6B]">
            {loadError}
          </div>
        )}

        {/* Primary Flow: Seated Customer QR Instruction */}
        <div className="p-6 sm:p-8 rounded-3xl border border-[#C99A8A]/30 bg-gradient-to-b from-[#1c1c1c] via-[#141414] to-[#0d0d0d] shadow-2xl text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[#080808] border border-[#C99A8A]/40 flex items-center justify-center text-[#D8B58A] mx-auto shadow-xl shadow-black/60">
            <QrCode className="w-8 h-8" />
          </div>

          <div className="max-w-md mx-auto space-y-1.5">
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#F6EFE7]">
              Seated at a Table?
            </h2>
            <p className="text-xs text-[#A8A29E] leading-relaxed">
              Scan the elegant QR stand placed at your table with your phone camera to browse the menu, customize selections, and send orders directly to our kitchen brigade.
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-4 text-[11px] text-[#A8A29E]">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#6FAF82]" />
              No App Download Required
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D8B58A]" />
              Real-Time Kitchen Tracking
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C99A8A]" />
              Instant Bill Settlement
            </span>
          </div>
        </div>

        {/* Explicit Alternative: Manual Table Selector */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[#242424] pb-3">
            <div>
              <h3 className="font-serif text-base sm:text-lg font-medium text-[#F6EFE7]">
                Manual Table Selection
              </h3>
              <p className="text-[11px] text-[#A8A29E]">
                If your camera cannot scan, select the table number you are seated at:
              </p>
            </div>
            <span className="text-[10px] text-[#A8A29E]/60 uppercase tracking-wider self-start sm:self-auto">
              {sortedTables.length} Tables Registered
            </span>
          </div>

          {sortedTables.length === 0 && !loadError ? (
            <div className="py-12 text-center rounded-2xl border border-[#242424] bg-[#171717]/40 text-xs text-[#A8A29E]">
              No tables are currently configured. Please speak with floor staff.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {sortedTables.map((tbl) => {
                const isPaid = tbl.status === "PAID";
                return (
                  <Link
                    key={tbl.id}
                    href={`/table/${tbl.qr_code_token}`}
                    className="group p-3.5 rounded-xl border border-[#242424] bg-[#171717]/60 hover:bg-[#1f1f1f] hover:border-[#C99A8A]/50 transition-all text-center flex flex-col items-center justify-between shadow-lg shadow-black/40"
                  >
                    <div className="w-9 h-9 rounded-full bg-[#080808] flex items-center justify-center text-[#D8B58A] mb-2 border border-[#2e2e2e] group-hover:border-[#C99A8A]/50 group-hover:scale-105 transition-all">
                      <Coffee className="w-4 h-4" />
                    </div>

                    <div>
                      <span className="text-xs font-semibold text-[#F6EFE7] group-hover:text-[#D8B58A] transition-colors block">
                        {tbl.table_number}
                      </span>
                      <span className="text-[10px] text-[#A8A29E]/70 block mt-0.5">
                        Capacity: {tbl.capacity}
                      </span>
                    </div>

                    <div className="mt-2 pt-2 border-t border-[#242424]/60 w-full">
                      <span
                        className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full inline-block ${
                          tbl.status === "AVAILABLE"
                            ? "bg-[#6FAF82]/15 text-[#6FAF82] border border-[#6FAF82]/30"
                            : tbl.status === "OCCUPIED"
                            ? "bg-[#D6A34A]/15 text-[#D6A34A] border border-[#D6A34A]/30"
                            : "bg-[#242424] text-[#A8A29E] border border-[#333]"
                        }`}
                      >
                        {tbl.status}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Discreet Footer & Staff Link */}
      <footer className="mt-12 border-t border-[#242424] px-4 py-6 text-xs text-[#A8A29E]/70">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>
            © {new Date().getFullYear()} Velvet Bloom Café · Powered by Kage Origin Multi-Tenant Architecture
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/staff/login"
              className="text-[#A8A29E] hover:text-[#D8B58A] transition-colors flex items-center gap-1"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Staff Portal</span>
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
