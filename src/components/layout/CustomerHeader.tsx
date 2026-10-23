"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CafeLogo } from "@/components/brand/CafeLogo";
import { useCart } from "@/lib/store/cart-context";
import { ShoppingBag, Bell, Check, Clock, Search, ArrowRight, Utensils } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface CustomerHeaderProps {
  tableNumber?: string;
  tableToken?: string;
  tableId?: string;
  sessionId?: string;
}

export function CustomerHeader({
  tableNumber = "Table 1",
  tableToken,
  tableId,
  sessionId,
}: CustomerHeaderProps) {
  const router = useRouter();
  const { itemCount, activeOrderNumber } = useCart();
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showTrackModal, setShowTrackModal] = useState(false);
  const [manualOrderInput, setManualOrderInput] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [storedOrder, setStoredOrder] = useState<string | null>(null);
  const [requestSent, setRequestSent] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    try {
      const fromLocal =
        (tableToken ? localStorage.getItem(`vb_last_order_${tableToken}`) : null) ||
        localStorage.getItem("vb_active_order_number");
      if (fromLocal) setStoredOrder(fromLocal);
    } catch {
      // Ignore
    }
  }, [tableToken, activeOrderNumber]);

  const effectiveActiveOrder = activeOrderNumber || storedOrder;

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = manualOrderInput.trim();
    if (!trimmed) {
      setManualError("Please enter a valid order number");
      return;
    }
    setManualError(null);
    setShowTrackModal(false);
    router.push(`/track/${trimmed}`);
  };

  const handleServiceRequest = async (type: string, label: string) => {
    setIsSending(true);
    try {
      await fetch("/api/service-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId: tableId || "tbl-01",
          sessionId: sessionId || "sess-01",
          requestType: type,
          notes: `Customer requested ${label}`,
        }),
      });
      setRequestSent(label);
      setTimeout(() => {
        setRequestSent(null);
        setShowServiceModal(false);
      }, 1800);
    } catch {
      setRequestSent("Request received");
      setTimeout(() => setShowServiceModal(false), 1500);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-[#242424] bg-[#080808]/90 backdrop-blur-md px-3 sm:px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
          <CafeLogo size="sm" showTagline={false} showPoweredBy={false} />

          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* Table Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#171717] border border-[#C99A8A]/30 text-xs font-semibold text-[#D8B58A]">
              <span>{tableNumber}</span>
            </div>

            {/* Track Order Button */}
            <button
              onClick={() => setShowTrackModal(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all ${
                effectiveActiveOrder
                  ? "bg-[#D8B58A]/10 border-[#D8B58A]/40 text-[#D8B58A] hover:bg-[#D8B58A]/20"
                  : "bg-[#171717] border-[#242424] text-[#A8A29E] hover:text-[#D8B58A] hover:border-[#C99A8A]/40"
              }`}
              title="Track Order"
            >
              <Clock className="w-3.5 h-3.5 text-[#D8B58A]" />
              <span className="inline">
                Track<span className="hidden sm:inline"> Order</span>
              </span>
              {effectiveActiveOrder && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#6FAF82] animate-pulse" />
              )}
            </button>

            {/* Service Bell */}
            <button
              onClick={() => setShowServiceModal(true)}
              className="p-2 rounded-full bg-[#171717] border border-[#242424] text-[#A8A29E] hover:text-[#D8B58A] hover:border-[#C99A8A]/40 transition-colors"
              title="Call Waiter or Request Service"
            >
              <Bell className="w-4 h-4" />
            </button>

            {/* Cart Link */}
            <Link
              href={tableToken ? `/table/${tableToken}/cart` : "/cart"}
              className="relative p-2 rounded-full bg-gradient-to-r from-[#C99A8A] to-[#D8B58A] text-[#080808] font-bold shadow-md shadow-black/40 hover:opacity-95 transition-all"
              title="View Cart"
            >
              <ShoppingBag className="w-4 h-4" />
              {itemCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-[#C96B6B] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#080808]">
                  {itemCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* Track Order Modal */}
      {showTrackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-[#C99A8A]/30 bg-[#171717] p-5 shadow-2xl text-[#F6EFE7] animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#242424]">
              <div className="flex items-center gap-2 text-[#D8B58A]">
                <Clock className="w-4 h-4 text-[#C99A8A]" />
                <h3 className="font-serif font-medium text-base">Track Your Order</h3>
              </div>
              <button
                onClick={() => {
                  setShowTrackModal(false);
                  setManualError(null);
                }}
                className="text-[#A8A29E] hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-4">
              {effectiveActiveOrder ? (
                /* Customer has an active order */
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl border border-[#C99A8A]/40 bg-[#080808]/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider text-[#A8A29E]">
                        Active Order
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-[#6FAF82] font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#6FAF82] animate-pulse" />
                        In Progress
                      </span>
                    </div>

                    <div className="font-mono font-bold text-sm text-[#F6EFE7]">
                      {effectiveActiveOrder}
                    </div>

                    <p className="text-[11px] text-[#A8A29E]">
                      Placed for <span className="text-[#D8B58A]">{tableNumber}</span>. Track preparation, kitchen progress, and bill status in real time.
                    </p>

                    <Link
                      href={`/track/${effectiveActiveOrder}`}
                      onClick={() => setShowTrackModal(false)}
                      className="block pt-1"
                    >
                      <Button
                        variant="primary"
                        className="w-full py-2.5 text-xs font-bold flex items-center justify-center gap-1.5"
                      >
                        <span>Open Live Tracker</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  </div>

                  {/* Secondary Lookup */}
                  <div className="pt-2 border-t border-[#242424]">
                    <span className="text-[11px] text-[#A8A29E] block mb-2">
                      Tracking a different order?
                    </span>
                    <form onSubmit={handleTrackSubmit} className="flex gap-2">
                      <input
                        type="text"
                        value={manualOrderInput}
                        onChange={(e) => setManualOrderInput(e.target.value)}
                        placeholder="e.g. VB-20261022-..."
                        className="flex-1 px-3 py-1.5 rounded-lg bg-[#080808] border border-[#242424] text-xs text-[#F6EFE7] placeholder-[#A8A29E]/40 focus:outline-none focus:border-[#C99A8A]/50"
                      />
                      <Button type="submit" variant="secondary" className="text-xs px-3 py-1.5">
                        Track
                      </Button>
                    </form>
                    {manualError && (
                      <p className="text-[10px] text-[#C96B6B] mt-1.5">{manualError}</p>
                    )}
                  </div>
                </div>
              ) : (
                /* No active order in session - Graceful Empty State */
                <div className="text-center py-2 space-y-4">
                  <div className="w-12 h-12 rounded-full bg-[#D8B58A]/10 border border-[#D8B58A]/20 text-[#D8B58A] flex items-center justify-center mx-auto">
                    <Utensils className="w-5 h-5" />
                  </div>

                  <div>
                    <h4 className="font-serif font-medium text-sm text-[#F6EFE7]">
                      No Active Order Found
                    </h4>
                    <p className="text-xs text-[#A8A29E] mt-1 px-2">
                      You haven't placed an order at this table yet. Place an order from the menu or enter an existing order number below.
                    </p>
                  </div>

                  <form onSubmit={handleTrackSubmit} className="space-y-2 text-left pt-1">
                    <label className="text-[11px] text-[#A8A29E] block">
                      Order Reference Number
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={manualOrderInput}
                        onChange={(e) => setManualOrderInput(e.target.value)}
                        placeholder="e.g. VB-20261022-0001"
                        className="flex-1 px-3 py-2 rounded-lg bg-[#080808] border border-[#242424] text-xs text-[#F6EFE7] placeholder-[#A8A29E]/40 focus:outline-none focus:border-[#C99A8A]/50 font-mono"
                      />
                      <Button type="submit" variant="primary" className="text-xs px-3.5 py-2">
                        <Search className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    {manualError && (
                      <p className="text-[10px] text-[#C96B6B] mt-1">{manualError}</p>
                    )}
                  </form>

                  <Button
                    variant="outline"
                    className="w-full text-xs py-2 text-[#A8A29E] hover:text-[#F6EFE7]"
                    onClick={() => {
                      setShowTrackModal(false);
                      setManualError(null);
                    }}
                  >
                    Browse Menu
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Service Request Modal */}
      {showServiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-[#C99A8A]/30 bg-[#171717] p-5 shadow-2xl text-[#F6EFE7]">
            <div className="flex items-center justify-between pb-3 border-b border-[#242424]">
              <div className="flex items-center gap-2 text-[#D8B58A]">
                <Bell className="w-4 h-4 text-[#C99A8A]" />
                <h3 className="font-serif font-medium text-base">Service Assistance</h3>
              </div>
              <button
                onClick={() => setShowServiceModal(false)}
                className="text-[#A8A29E] hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {requestSent ? (
              <div className="py-8 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-[#6FAF82]/20 text-[#6FAF82] flex items-center justify-center mb-3">
                  <Check className="w-6 h-6" />
                </div>
                <h4 className="font-medium text-sm text-[#F6EFE7]">{requestSent}</h4>
                <p className="text-xs text-[#A8A29E] mt-1">Staff has been notified and is on the way.</p>
              </div>
            ) : (
              <div className="py-4 space-y-2.5">
                <p className="text-xs text-[#A8A29E] mb-3">
                  How can our team assist you at <span className="text-[#D8B58A] font-semibold">{tableNumber}</span>?
                </p>

                <Button
                  variant="secondary"
                  className="w-full justify-start text-xs py-2.5"
                  onClick={() => handleServiceRequest("WATER", "Drinking Water")}
                  disabled={isSending}
                >
                  💧 Request Drinking Water
                </Button>

                <Button
                  variant="secondary"
                  className="w-full justify-start text-xs py-2.5"
                  onClick={() => handleServiceRequest("CLEANING", "Table Clearing")}
                  disabled={isSending}
                >
                  ✨ Request Table Clearing
                </Button>

                <Button
                  variant="secondary"
                  className="w-full justify-start text-xs py-2.5"
                  onClick={() => handleServiceRequest("WAITER_CALL", "Staff Call")}
                  disabled={isSending}
                >
                  🛎️ Call Staff to Table
                </Button>

                <Button
                  variant="primary"
                  className="w-full justify-start text-xs py-2.5 mt-2"
                  onClick={() => handleServiceRequest("BILL", "Bill Request")}
                  disabled={isSending}
                >
                  🧾 Request My Bill
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

