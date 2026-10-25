"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CafeLogo } from "@/components/brand/CafeLogo";
import { Button } from "@/components/ui/Button";
import { Search, Clock, ArrowLeft, UtensilsCrossed } from "lucide-react";

export default function TrackOrderSearchPage() {
  const router = useRouter();
  const [orderInput, setOrderInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = orderInput.trim();
    if (!trimmed) {
      setError("Please enter your order number (e.g., VB-20261023-0001)");
      return;
    }
    setError(null);
    router.push(`/track/${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="min-h-screen bg-[#080808] text-[#F6EFE7] p-4 flex flex-col items-center justify-center selection:bg-[#C99A8A]/30">
      <div className="w-full max-w-md mx-auto space-y-6">
        {/* Brand Header */}
        <div className="flex justify-center">
          <CafeLogo size="md" showTagline={false} showPoweredBy={false} href="/" />
        </div>

        {/* Tracking Card */}
        <div className="p-6 sm:p-8 rounded-2xl border border-[#C99A8A]/25 bg-gradient-to-b from-[#1c1c1c] to-[#121212] shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-[#C99A8A]/10 border border-[#C99A8A]/30 text-[#D8B58A] flex items-center justify-center mx-auto shadow-inner">
              <Clock className="w-6 h-6" />
            </div>
            <h1 className="font-serif text-2xl font-bold text-[#F6EFE7]">
              Track Your Order
            </h1>
            <p className="text-xs text-[#A8A29E] leading-relaxed">
              Enter your order reference number from your digital receipt to view real-time kitchen and preparation updates.
            </p>
          </div>

          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label className="text-[11px] text-[#A8A29E] block mb-1.5 font-medium uppercase tracking-wider">
                Order Number
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={orderInput}
                  onChange={(e) => {
                    setOrderInput(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="e.g. VB-20261023-0001"
                  className="w-full bg-[#080808] border border-[#242424] rounded-xl px-4 py-3 text-sm text-[#F6EFE7] placeholder-[#A8A29E]/40 focus:outline-none focus:border-[#C99A8A] font-mono transition-colors"
                  autoFocus
                />
              </div>
              {error && (
                <p className="text-[11px] text-[#C96A5A] mt-1.5 flex items-center gap-1 font-medium">
                  {error}
                </p>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full justify-center py-3 text-sm font-semibold rounded-xl"
            >
              <Search className="w-4 h-4 mr-2" />
              <span>Lookup Order</span>
            </Button>
          </form>

          <div className="pt-4 border-t border-[#242424]/80 flex items-center justify-between text-xs text-[#A8A29E]">
            <Link
              href="/"
              className="flex items-center gap-1.5 hover:text-[#D8B58A] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Café</span>
            </Link>
            <div className="flex items-center gap-1 text-[#A8A29E]/60">
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span>Kitchen Live Sync</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

