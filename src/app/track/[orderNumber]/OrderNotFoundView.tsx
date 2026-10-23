"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CafeLogo } from "@/components/brand/CafeLogo";
import { Button } from "@/components/ui/Button";
import { Search, AlertCircle, ArrowLeft, Utensils } from "lucide-react";

interface OrderNotFoundViewProps {
  searchedOrderNumber: string;
}

export function OrderNotFoundView({ searchedOrderNumber }: OrderNotFoundViewProps) {
  const router = useRouter();
  const [orderInput, setOrderInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = orderInput.trim();
    if (!trimmed) {
      setError("Please enter an order number");
      return;
    }
    setError(null);
    router.push(`/track/${trimmed}`);
  };

  return (
    <div className="min-h-screen bg-[#080808] text-[#F6EFE7] p-4 flex flex-col items-center justify-center">
      <div className="w-full max-w-md mx-auto">
        {/* Header */}
        <div className="flex justify-center mb-8">
          <CafeLogo size="md" showTagline={false} showPoweredBy={false} href="/" />
        </div>

        {/* Card */}
        <div className="p-6 rounded-2xl border border-[#C99A8A]/30 bg-gradient-to-b from-[#1c1c1c] to-[#121212] shadow-2xl text-center space-y-5">
          <div className="w-14 h-14 rounded-full bg-[#D6A34A]/10 border border-[#D6A34A]/30 text-[#D6A34A] flex items-center justify-center mx-auto shadow-inner">
            <AlertCircle className="w-7 h-7" />
          </div>

          <div>
            <h1 className="font-serif text-xl sm:text-2xl font-bold text-[#F6EFE7]">
              Order Not Found
            </h1>
            <p className="text-xs text-[#A8A29E] mt-2 leading-relaxed">
              We could not find an active or historical order matching reference:
            </p>
            <div className="mt-2 inline-block px-3 py-1 rounded-lg bg-[#080808] border border-[#242424] font-mono text-xs font-bold text-[#D8B58A]">
              {searchedOrderNumber}
            </div>
          </div>

          {/* Search Alternate Order */}
          <div className="pt-2 border-t border-[#242424] text-left">
            <label className="text-[11px] text-[#A8A29E] block mb-1.5 font-medium">
              Check a Different Order Number
            </label>
            <form onSubmit={handleSearch} className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={orderInput}
                  onChange={(e) => setOrderInput(e.target.value)}
                  placeholder="e.g. VB-20261022-XXXX"
                  className="flex-1 px-3 py-2 rounded-lg bg-[#080808] border border-[#242424] text-xs text-[#F6EFE7] placeholder-[#A8A29E]/40 focus:outline-none focus:border-[#C99A8A]/50 font-mono"
                />
                <Button type="submit" variant="primary" className="text-xs px-3.5 py-2">
                  <Search className="w-3.5 h-3.5" />
                </Button>
              </div>
              {error && <p className="text-[10px] text-[#C96B6B]">{error}</p>}
            </form>
          </div>

          {/* Navigation CTA */}
          <div className="pt-2 space-y-2">
            <Link href="/" className="block w-full">
              <Button
                variant="outline"
                className="w-full py-2.5 text-xs text-[#A8A29E] hover:text-[#F6EFE7] flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Café Home</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

