import Link from "next/link";
import { CafeLogo } from "@/components/brand/CafeLogo";
import { DevModeIndicator } from "@/components/ui/DevModeIndicator";
import { INITIAL_TABLES } from "@/lib/adapter/seed-data";
import { Utensils, Receipt, ShieldCheck, QrCode, ArrowRight, Sparkles } from "lucide-react";

export default function HomePage() {
  const activeTables = INITIAL_TABLES.filter((t) => t.tenant_id === "tenant-velvet-bloom-01");

  return (
    <main className="min-h-screen bg-[#080808] text-[#F6EFE7] flex flex-col justify-between selection:bg-[#C99A8A]/30">
      <DevModeIndicator />

      {/* Hero Header */}
      <div className="relative overflow-hidden pt-12 pb-10 px-4 text-center border-b border-[#242424]/80">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-[#C99A8A]/15 via-transparent to-transparent pointer-events-none" />

        <div className="relative max-w-3xl mx-auto flex flex-col items-center">
          <CafeLogo size="xl" showTagline={true} showPoweredBy={true} />

          <p className="mt-4 text-sm sm:text-base text-[#A8A29E] max-w-xl font-light leading-relaxed">
            Welcome to the Next-Generation Dining Experience. Seamless QR ordering, real-time kitchen orchestration, and unified billing powered by Kage Origin.
          </p>
        </div>
      </div>

      {/* Main Role & Table Launch Grid */}
      <div className="max-w-6xl mx-auto w-full px-4 py-8 flex-1">
        {/* Staff Workspaces Section */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-[#D8B58A]" />
            <h2 className="font-serif text-lg font-medium text-[#F6EFE7]">
              Staff & Management Workspaces
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Chef Kitchen Display */}
            <Link
              href="/chef"
              className="group p-5 rounded-2xl border border-[#242424] bg-[#171717]/60 hover:bg-[#1f1f1f] hover:border-[#D8B58A]/40 transition-all shadow-xl shadow-black/40 flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#242424] flex items-center justify-center text-[#D8B58A] mb-3 group-hover:scale-105 transition-transform border border-[#C99A8A]/20">
                  <Utensils className="w-5 h-5" />
                </div>
                <h3 className="font-serif font-medium text-base text-[#F6EFE7] group-hover:text-[#D8B58A] transition-colors">
                  Kitchen Display System
                </h3>
                <p className="text-xs text-[#A8A29E] mt-1 leading-relaxed">
                  Real-time order queue for chef. Audio alerts, preparation timers, and order status transitions.
                </p>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-xs text-[#D8B58A] font-semibold">
                <span>Enter Kitchen</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* Combined Service & Billing Staff */}
            <Link
              href="/staff"
              className="group p-5 rounded-2xl border border-[#C99A8A]/30 bg-[#171717]/80 hover:bg-[#1f1f1f] hover:border-[#C99A8A]/60 transition-all shadow-xl shadow-black/50 flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#C99A8A]/20 flex items-center justify-center text-[#DFB8AA] mb-3 group-hover:scale-105 transition-transform border border-[#C99A8A]/40">
                  <Receipt className="w-5 h-5" />
                </div>
                <div className="flex items-center gap-2">
                  <h3 className="font-serif font-medium text-base text-[#F6EFE7] group-hover:text-[#D8B58A] transition-colors">
                    Service & Billing
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[#C99A8A]/20 text-[#DFB8AA] border border-[#C99A8A]/30">
                    Unified
                  </span>
                </div>
                <p className="text-xs text-[#A8A29E] mt-1 leading-relaxed">
                  Combined Waiter & Cashier workspace. Ready to serve queue, active table floor map, bill splitting, and instant payments.
                </p>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-xs text-[#DFB8AA] font-semibold">
                <span>Open Staff Workspace</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* Main Admin / Owner */}
            <Link
              href="/admin"
              className="group p-5 rounded-2xl border border-[#242424] bg-[#171717]/60 hover:bg-[#1f1f1f] hover:border-[#D8B58A]/40 transition-all shadow-xl shadow-black/40 flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#242424] flex items-center justify-center text-[#D8B58A] mb-3 group-hover:scale-105 transition-transform border border-[#C99A8A]/20">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="font-serif font-medium text-base text-[#F6EFE7] group-hover:text-[#D8B58A] transition-colors">
                  Main Admin & Analytics
                </h3>
                <p className="text-xs text-[#A8A29E] mt-1 leading-relaxed">
                  Owner command center. Live operational KPIs, rolling 15-day financial analytics, menu pricing, and café settings.
                </p>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-xs text-[#D8B58A] font-semibold">
                <span>View Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </div>
        </div>

        {/* Customer QR Simulator Section */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-[#D8B58A]" />
              <h2 className="font-serif text-lg font-medium text-[#F6EFE7]">
                Customer QR Ordering (Simulate Table Scan)
              </h2>
            </div>
            <span className="text-xs text-[#A8A29E]">Select any table below:</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {activeTables.map((tbl) => (
              <Link
                key={tbl.id}
                href={`/table/${tbl.qr_code_token}`}
                className="group p-3.5 rounded-xl border border-[#242424] bg-[#171717]/50 hover:bg-[#242424]/60 hover:border-[#C99A8A]/40 transition-all text-center flex flex-col items-center"
              >
                <div className="w-8 h-8 rounded-full bg-[#080808] flex items-center justify-center text-[#D8B58A] mb-2 border border-[#333] group-hover:border-[#C99A8A]/40">
                  <QrCode className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-[#F6EFE7] group-hover:text-[#D8B58A]">
                  {tbl.table_number}
                </span>
                <span className="text-[10px] text-[#A8A29E]/80 mt-0.5">
                  Seats {tbl.capacity}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-6 border-t border-[#242424] text-center text-xs text-[#A8A29E]/70">
        <p>Velvet Bloom Café V2 · Powered by Kage Origin Multi-Tenant Architecture</p>
      </footer>
    </main>
  );
}

