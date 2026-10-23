"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CafeTable, TableSession, CafeSettings, Order } from "@/types/database.types";
import { useCart } from "@/lib/store/cart-context";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft, Trash2, Plus, Minus, Clock, ShieldCheck, CheckCircle2 } from "lucide-react";
import { SessionClosedView } from "@/components/ui/SessionClosedView";

interface CartReviewViewProps {
  table: CafeTable;
  session: TableSession;
  token: string;
  settings: CafeSettings;
}

export function CartReviewView({ table, session, token, settings }: CartReviewViewProps) {
  const router = useRouter();
  const {
    items,
    updateQuantity,
    removeItem,
    clearCart,
    subtotal,
    tax,
    total,
    customerName,
    setCustomerName,
    customerPhone,
    setCustomerPhone,
    setActiveOrderNumber,
  } = useCart();

  const [specialInstructions, setSpecialInstructions] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const [isSessionSettled, setIsSessionSettled] = useState(false);

  React.useEffect(() => {
    try {
      if (
        localStorage.getItem(`vb_session_settled_${token}`) === "true" ||
        table.status === "PAID" ||
        !session.is_active
      ) {
        setIsSessionSettled(true);
      }
    } catch {
      // Ignore
    }
  }, [token, table.status, session.is_active]);

  if (isSessionSettled) {
    return <SessionClosedView table={table} token={token} />;
  }

  if (confirmedOrder) {
    return (
      <div className="max-w-md mx-auto pt-4 pb-12 animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 rounded-2xl border border-[#C99A8A]/40 bg-gradient-to-b from-[#1c1c1c] to-[#121212] shadow-2xl text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-[#6FAF82]/20 border border-[#6FAF82]/40 text-[#6FAF82] flex items-center justify-center mx-auto shadow-lg shadow-black/40">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <span className="text-[11px] uppercase tracking-wider text-[#D8B58A] font-semibold">
              Order Placed Successfully
            </span>
            <h2 className="font-serif text-2xl font-bold text-[#F6EFE7] mt-1">
              Sent to Kitchen
            </h2>
            <p className="text-xs text-[#A8A29E] mt-1.5">
              Your culinary selection has been dispatched directly to the kitchen brigade.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#080808]/80 border border-[#242424] text-left space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#A8A29E]">Order Number</span>
              <span className="font-mono font-bold text-[#F6EFE7]">
                {confirmedOrder.order_number}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-[#A8A29E]">Table</span>
              <span className="font-semibold text-[#D8B58A]">{table.table_number}</span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-[#A8A29E]">Order Status</span>
              <StatusBadge status={confirmedOrder.status} />
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-[#A8A29E]">Estimated Time</span>
              <span className="text-[#F6EFE7]">
                ~{settings.average_prep_time_minutes || 15} mins
              </span>
            </div>

            <div className="pt-2 border-t border-[#242424] flex items-center justify-between text-xs">
              <span className="text-[#A8A29E]">Total Amount</span>
              <span className="font-serif font-bold text-sm text-[#D8B58A]">
                {formatCurrency(confirmedOrder.total)}
              </span>
            </div>
          </div>

          <div className="space-y-2.5 pt-2">
            <Link href={`/track/${confirmedOrder.order_number}`} className="block w-full">
              <Button
                variant="primary"
                className="w-full py-3 text-xs sm:text-sm font-bold shadow-lg shadow-black/60 flex items-center justify-center gap-2"
              >
                <Clock className="w-4 h-4" />
                <span>Track Order</span>
              </Button>
            </Link>

            <Link href={`/table/${token}`} className="block w-full">
              <Button
                variant="outline"
                className="w-full py-2.5 text-xs text-[#A8A29E] hover:text-[#F6EFE7]"
              >
                <span>Continue Ordering</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-md mx-auto pt-16 text-center">
        <h2 className="font-serif text-xl font-medium text-[#F6EFE7] mb-2">
          Your Cart is Empty
        </h2>
        <p className="text-xs text-[#A8A29E] mb-6">
          You haven't added any artisan dishes or beverages yet.
        </p>
        <Link href={`/table/${token}`}>
          <Button variant="primary">Return to Menu</Button>
        </Link>
      </div>
    );
  }

  const handlePlaceOrder = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = {
        tableId: table.id,
        sessionId: session.id,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        specialInstructions: specialInstructions.trim() || undefined,
        items: items.map((i) => ({
          menuItemId: i.menuItem.id,
          quantity: i.quantity,
          options: (i.selectedOptions || []).map((o) => ({
            groupName: o.group_name,
            optionName: o.option_name,
            extraPrice: o.extra_price,
          })),
          specialNotes: i.specialNotes,
        })),
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to place order");
      }

      const createdOrder: Order = await res.json();
      setActiveOrderNumber(createdOrder.order_number);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("vb_active_order_number", createdOrder.order_number);
          if (token) {
            localStorage.setItem(`vb_last_order_${token}`, createdOrder.order_number);
          }
        } catch {
          // Ignore
        }
      }
      clearCart();
      setConfirmedOrder(createdOrder);
      setIsSubmitting(false);
    } catch (err: any) {
      const msg = err.message || "An unexpected error occurred while placing your order.";
      setErrorMessage(msg);
      if (
        msg.toLowerCase().includes("closed") ||
        msg.toLowerCase().includes("completed") ||
        msg.toLowerCase().includes("inactive")
      ) {
        setIsSessionSettled(true);
      }
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#242424] mb-4">
        <Link
          href={`/table/${token}`}
          className="flex items-center gap-1.5 text-xs text-[#A8A29E] hover:text-[#F6EFE7]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Menu</span>
        </Link>
        <div className="text-right">
          <span className="text-xs font-semibold text-[#D8B58A]">{table.table_number}</span>
        </div>
      </div>

      <h1 className="font-serif text-xl font-medium text-[#F6EFE7] mb-4">
        Review Your Order
      </h1>

      {errorMessage && (
        <div className="mb-4 p-3 rounded-xl bg-[#C96B6B]/15 border border-[#C96B6B]/40 text-xs text-[#C96B6B]">
          {errorMessage}
        </div>
      )}

      {/* Cart Items List */}
      <div className="space-y-3 mb-6">
        {items.map((cartItem) => {
          const optionsExtra = (cartItem.selectedOptions || []).reduce(
            (acc, opt) => acc + (opt.extra_price || 0),
            0
          );
          const lineTotal = (cartItem.menuItem.price + optionsExtra) * cartItem.quantity;

          return (
            <div
              key={cartItem.id}
              className="p-3.5 rounded-xl border border-[#242424] bg-[#171717]/70 flex items-start justify-between gap-3"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      cartItem.menuItem.is_veg ? "bg-[#6FAF82]" : "bg-[#C96B6B]"
                    }`}
                  />
                  <h4 className="font-medium text-xs text-[#F6EFE7]">
                    {cartItem.menuItem.name}
                  </h4>
                </div>

                {cartItem.selectedOptions && cartItem.selectedOptions.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {cartItem.selectedOptions.map((opt, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] bg-[#242424] px-1.5 py-0.5 rounded text-[#D8B58A]"
                      >
                        {opt.option_name}
                      </span>
                    ))}
                  </div>
                )}

                {cartItem.specialNotes && (
                  <p className="text-[10px] text-[#A8A29E] mt-1 italic">
                    "{cartItem.specialNotes}"
                  </p>
                )}

                <span className="text-xs font-semibold text-[#D8B58A] mt-2 block">
                  {formatCurrency(lineTotal)}
                </span>
              </div>

              {/* Quantity Controls */}
              <div className="flex items-center gap-2 bg-[#080808] border border-[#242424] rounded-lg px-2 py-1">
                <button
                  onClick={() => updateQuantity(cartItem.id, cartItem.quantity - 1)}
                  className="text-[#A8A29E] hover:text-[#F6EFE7]"
                >
                  {cartItem.quantity === 1 ? (
                    <Trash2 className="w-3.5 h-3.5 text-[#C96B6B]" />
                  ) : (
                    <Minus className="w-3.5 h-3.5" />
                  )}
                </button>
                <span className="text-xs font-medium w-4 text-center">
                  {cartItem.quantity}
                </span>
                <button
                  onClick={() => updateQuantity(cartItem.id, cartItem.quantity + 1)}
                  className="text-[#A8A29E] hover:text-[#F6EFE7]"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Guest Details Form */}
      <div className="p-4 rounded-xl border border-[#242424] bg-[#171717]/50 space-y-3 mb-6">
        <h3 className="font-serif text-sm font-medium text-[#F6EFE7]">
          Guest Details & Instructions
        </h3>

        <div>
          <label className="text-[11px] text-[#A8A29E] block mb-1">
            Your Name (Optional)
          </label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="e.g. Eleanor Vance"
            className="w-full px-3 py-2 rounded-lg bg-[#080808] border border-[#242424] text-xs text-[#F6EFE7] placeholder-[#A8A29E]/40 focus:outline-none focus:border-[#C99A8A]/50"
          />
        </div>

        <div>
          <label className="text-[11px] text-[#A8A29E] block mb-1">
            Phone Number (For digital receipt)
          </label>
          <input
            type="tel"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="+91 98765 43210"
            className="w-full px-3 py-2 rounded-lg bg-[#080808] border border-[#242424] text-xs text-[#F6EFE7] placeholder-[#A8A29E]/40 focus:outline-none focus:border-[#C99A8A]/50"
          />
        </div>

        <div>
          <label className="text-[11px] text-[#A8A29E] block mb-1">
            Kitchen Preparation Notes
          </label>
          <textarea
            value={specialInstructions}
            onChange={(e) => setSpecialInstructions(e.target.value)}
            placeholder="Any food allergies or specific preferences..."
            rows={2}
            className="w-full px-3 py-2 rounded-lg bg-[#080808] border border-[#242424] text-xs text-[#F6EFE7] placeholder-[#A8A29E]/40 focus:outline-none focus:border-[#C99A8A]/50 resize-none"
          />
        </div>
      </div>

      {/* Bill Breakdown */}
      <div className="p-4 rounded-xl border border-[#242424] bg-[#171717]/80 space-y-2 mb-6 text-xs">
        <div className="flex items-center justify-between text-[#A8A29E]">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between text-[#A8A29E]">
          <span>GST ({settings.tax_rate}%)</span>
          <span>{formatCurrency(tax)}</span>
        </div>
        <div className="pt-2 border-t border-[#242424] flex items-center justify-between font-serif text-sm font-semibold text-[#F6EFE7]">
          <span>Grand Total</span>
          <span className="text-[#D8B58A]">{formatCurrency(total)}</span>
        </div>

        <div className="pt-2 flex items-center gap-1.5 text-[11px] text-[#A8A29E]/80">
          <Clock className="w-3.5 h-3.5 text-[#D8B58A]" />
          <span>Estimated preparation: ~{settings.average_prep_time_minutes || 15} minutes</span>
        </div>
      </div>

      {/* Place Order CTA */}
      <Button
        variant="primary"
        className="w-full py-3 text-sm font-bold shadow-xl shadow-black/80"
        onClick={handlePlaceOrder}
        isLoading={isSubmitting}
      >
        <ShieldCheck className="w-4 h-4" />
        <span>Confirm & Send to Kitchen</span>
      </Button>
    </div>
  );
}

