"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CafeTable } from "@/types/database.types";
import { CafeLogo } from "@/components/brand/CafeLogo";
import { Button } from "@/components/ui/Button";
import { CheckCircle2, Clock, Home, BellRing, Receipt, Check } from "lucide-react";

interface SessionClosedViewProps {
  table: CafeTable;
  token: string;
}

export function SessionClosedView({ table, token }: SessionClosedViewProps) {
  const [assistanceRequested, setAssistanceRequested] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  const handleRequestStaff = async () => {
    setIsRequesting(true);
    try {
      await fetch("/api/service-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId: table.id,
          sessionId: table.current_session_id || "00000000-0000-0000-0000-000000000001",
          requestType: "WAITER_CALL",
          notes: "Customer requesting assistance at concluded table",
        }),
      });
      setAssistanceRequested(true);
    } catch {
      // Ignore
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080808] text-[#F6EFE7] flex flex-col justify-between p-4 sm:p-6">
      {/* Top Bar */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between pb-4 border-b border-[#242424]">
        <CafeLogo size="sm" showTagline={false} showPoweredBy={false} href="/" />
        <span className="text-xs px-2.5 py-1 rounded-full bg-[#D8B58A]/10 text-[#D8B58A] border border-[#D8B58A]/20 font-semibold">
          {table.table_number}
        </span>
      </div>

      {/* Main Card */}
      <div className="max-w-md w-full mx-auto my-auto py-8">
        <div className="p-6 sm:p-8 rounded-3xl border border-[#C99A8A]/30 bg-gradient-to-b from-[#1c1c1c] via-[#141414] to-[#0d0d0d] shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#D8B58A]/20 to-[#6FAF82]/20 border border-[#D8B58A]/40 text-[#D8B58A] flex items-center justify-center mx-auto shadow-lg shadow-black/60">
            <CheckCircle2 className="w-8 h-8 text-[#6FAF82]" />
          </div>

          <div className="space-y-2">
            <span className="text-[11px] uppercase tracking-widest text-[#D8B58A] font-bold">
              Session Concluded
            </span>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#F6EFE7]">
              Table Session Closed
            </h1>
            <p className="text-xs text-[#A8A29E] leading-relaxed max-w-xs mx-auto">
              The dining bill for <span className="text-[#F6EFE7] font-semibold">{table.table_number}</span> has been settled and the ordering session is complete.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#080808]/70 border border-[#242424] text-xs text-[#A8A29E] space-y-2 text-left">
            <div className="flex items-center gap-2 text-[#D8B58A] font-medium">
              <Clock className="w-3.5 h-3.5" />
              <span>Ordering is Concluded</span>
            </div>
            <p className="text-[11px] leading-normal">
              Thank you for dining with Velvet Bloom Café. To start a new dining session or order additional culinary items, please speak with our floor staff.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            {assistanceRequested ? (
              <div className="p-3 rounded-xl bg-[#6FAF82]/15 border border-[#6FAF82]/30 text-xs text-[#6FAF82] flex items-center justify-center gap-2">
                <Check className="w-4 h-4" />
                <span>Floor staff has been notified to assist you</span>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full py-2.5 text-xs text-[#D8B58A] border-[#D8B58A]/30 hover:bg-[#D8B58A]/10 flex items-center justify-center gap-2"
                onClick={handleRequestStaff}
                isLoading={isRequesting}
              >
                <BellRing className="w-4 h-4" />
                <span>Call Floor Staff for Assistance</span>
              </Button>
            )}

            <Link href="/" className="block w-full">
              <Button
                variant="primary"
                className="w-full py-3 text-xs sm:text-sm font-bold shadow-lg shadow-black/60 flex items-center justify-center gap-2"
              >
                <Home className="w-4 h-4" />
                <span>Return to Café Home</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="max-w-md w-full mx-auto text-center pt-4 border-t border-[#242424]/40">
        <p className="text-[10px] text-[#A8A29E]/60 tracking-wider">
          VELVET BLOOM CAFÉ · POWERED BY KAGE ORIGIN
        </p>
      </div>
    </div>
  );
}

