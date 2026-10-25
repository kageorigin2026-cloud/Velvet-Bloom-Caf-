"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Order, Bill, PaymentMethod } from "@/types/database.types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatFullDateTime } from "@/lib/utils";
import { CafeLogo } from "@/components/brand/CafeLogo";
import { useSupabaseRealtime } from "@/lib/supabase/realtime";
import { useCart } from "@/lib/store/cart-context";
import {
  CheckCircle2,
  Clock,
  Utensils,
  BellRing,
  Receipt,
  PlusCircle,
  Star,
  Check,
  ArrowLeft,
  CreditCard,
  QrCode,
  Sparkles,
  Home,
  AlertCircle,
} from "lucide-react";

interface OrderTrackingViewProps {
  initialOrder: Order;
  initialBill: Bill | null;
}

const STEPS = [
  { status: "PENDING", label: "Received", desc: "Order queued" },
  { status: "ACCEPTED", label: "Accepted", desc: "Chef reviewed" },
  { status: "PREPARING", label: "Preparing", desc: "In the kitchen" },
  { status: "READY", label: "Ready", desc: "Ready to serve" },
  { status: "SERVED", label: "Served", desc: "Delivered to table" },
  { status: "COMPLETED", label: "Settled", desc: "Payment complete" },
];

export function OrderTrackingView({ initialOrder, initialBill }: OrderTrackingViewProps) {
  const router = useRouter();
  const { clearSessionOrderingState } = useCart();

  const [order, setOrder] = useState<Order>(initialOrder);
  const [bill, setBill] = useState<Bill | null>(initialBill);
  const [isRequestingBill, setIsRequestingBill] = useState(false);
  const [billRequestedMessage, setBillRequestedMessage] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  // Customer bill settlement states
  const [isPaying, setIsPaying] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"UPI" | "CARD" | "ONLINE">("UPI");
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Guard against redirect loops if user visits page after settlement or presses Back
  const wasAlreadyPaidOnMount = useRef(
    initialBill?.status === "PAID" || initialOrder.status === "COMPLETED"
  );
  const hasRedirectedRef = useRef(false);

  // Sync to local storage for quick return navigation
  useEffect(() => {
    try {
      localStorage.setItem("vb_active_order_number", initialOrder.order_number);
      if (initialOrder.table?.qr_code_token) {
        localStorage.setItem(
          `vb_last_order_${initialOrder.table.qr_code_token}`,
          initialOrder.order_number
        );
      }
    } catch {
      // Ignore
    }
  }, [initialOrder.order_number, initialOrder.table?.qr_code_token]);

  // Safe redirect helper
  const triggerSettlementRedirect = useCallback(
    (settledBill: Bill, methodUsed?: string) => {
      if (hasRedirectedRef.current) return;
      hasRedirectedRef.current = true;
      setIsRedirecting(true);

      // Clear customer cart and active session ordering state
      clearSessionOrderingState();

      const qrToken = order.table?.qr_code_token;
      if (qrToken) {
        try {
          localStorage.setItem(`vb_session_settled_${qrToken}`, "true");
        } catch {
          // Ignore
        }
      }

      const method = methodUsed || settledBill.splits?.[0]?.payment_method || "ONLINE";
      const queryParams = new URLSearchParams({
        orderNumber: order.order_number,
        billNumber: settledBill.bill_number,
        amount: settledBill.final_total.toString(),
        method,
        table: order.table?.table_number || "Table",
      });

      // Brief transition delay for pleasant UX
      setTimeout(() => {
        router.replace(`/payment/confirmation?${queryParams.toString()}`);
      }, 700);
    },
    [clearSessionOrderingState, order.order_number, order.table, router]
  );

  // Poll for live status reconciliation and subscribe to Supabase Realtime
  const refreshOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${order.id}`);
      if (res.ok) {
        const data = await res.json();
        setOrder(data.order);
        if (data.bill) {
          setBill(data.bill);

          // Detect remote settlement by staff while customer is waiting on page
          if (
            data.bill.status === "PAID" &&
            !wasAlreadyPaidOnMount.current &&
            !hasRedirectedRef.current
          ) {
            triggerSettlementRedirect(data.bill);
          }
        }
      }
    } catch {
      // Ignore network hiccups
    }
  }, [order.id, triggerSettlementRedirect]);

  useSupabaseRealtime({
    table: "orders",
    onEvent: () => {
      refreshOrder();
    },
  });

  useSupabaseRealtime({
    table: "bills",
    onEvent: () => {
      refreshOrder();
    },
  });

  useEffect(() => {
    // If order is settled or cancelled, stop polling
    if (order.status === "COMPLETED" || order.status === "CANCELLED" || bill?.status === "PAID") {
      return;
    }

    const interval = setInterval(refreshOrder, 10000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshOrder();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshOrder, order.status, bill?.status]);

  const getStepIndex = (status: string) => {
    switch (status) {
      case "PENDING":
        return 0;
      case "ACCEPTED":
        return 1;
      case "PREPARING":
        return 2;
      case "READY":
        return 3;
      case "SERVED":
        return 4;
      case "COMPLETED":
        return 5;
      default:
        return 0;
    }
  };

  const currentStepIdx = getStepIndex(order.status);
  const isCancelled = order.status === "CANCELLED" || order.status === "REJECTED";
  const isSessionConcluded = bill?.status === "PAID" || order.status === "COMPLETED";

  const getStatusDescription = (status: string) => {
    switch (status) {
      case "PENDING":
        return "Your order has been queued and is awaiting chef confirmation.";
      case "ACCEPTED":
        return "The chef has accepted your order and queued ingredient preparation.";
      case "PREPARING":
        return "Our culinary brigade is actively preparing your artisan selections.";
      case "READY":
        return "Your order is plated and ready! Floor staff is bringing it to your table.";
      case "SERVED":
        return "Your order has been served. Enjoy your dining experience!";
      case "COMPLETED":
        return "Order and payment settled. Thank you for dining with Velvet Bloom Café.";
      case "CANCELLED":
      case "REJECTED":
        return "This order was cancelled. Please speak with café staff.";
      default:
        return "Order status updated.";
    }
  };

  const handleRequestBill = async () => {
    setIsRequestingBill(true);
    setPaymentError(null);
    try {
      const res = await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          tableId: order.table_id,
          sessionId: order.session_id,
        }),
      });
      if (res.ok) {
        const newBill = await res.json();
        setBill(newBill);
        setBillRequestedMessage(true);
      }
    } catch {
      // Ignore
    } finally {
      setIsRequestingBill(false);
    }
  };

  const handleCustomerPayBill = async () => {
    if (!bill || isPaying || isRedirecting) return;
    setIsPaying(true);
    setPaymentError(null);

    try {
      const res = await fetch(`/api/bills/${bill.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billId: bill.id,
          amount: bill.final_total,
          paymentMethod,
          recordedBy: "Customer Self-Checkout",
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.error || "Payment verification failed. Please check details or speak with staff."
        );
      }

      const result = await res.json();
      const updatedBill: Bill = result.bill || bill;

      // Ensure bill outstanding balance is fully zero / status is PAID
      if (updatedBill.status === "PAID") {
        setBill(updatedBill);
        triggerSettlementRedirect(updatedBill, paymentMethod);
      } else {
        // Split or partial settlement: keep customer on page
        setBill(updatedBill);
      }
    } catch (err: any) {
      setPaymentError(err.message || "Unable to complete payment. Please try again.");
    } finally {
      setIsPaying(false);
    }
  };

  const handleSubmitReview = async () => {
    try {
      await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          sessionId: order.session_id,
          customerName: order.customer_name || "Valued Guest",
          rating,
          comment: reviewComment,
        }),
      });
      setReviewSubmitted(true);
      setTimeout(() => setShowReviewModal(false), 1500);
    } catch {
      // Ignore
    }
  };

  return (
    <div className="max-w-xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between py-3 border-b border-[#242424] mb-6">
        <div className="flex items-center gap-3">
          {!isSessionConcluded && order.table?.qr_code_token && (
            <Link
              href={`/table/${order.table.qr_code_token}`}
              className="flex items-center gap-1.5 text-xs text-[#A8A29E] hover:text-[#F6EFE7] transition-colors pr-3 border-r border-[#242424]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Menu</span>
            </Link>
          )}
          <CafeLogo size="sm" showTagline={false} showPoweredBy={false} href="/" />
        </div>
        <div className="text-right">
          <span className="text-[10px] text-[#A8A29E] block uppercase tracking-wider">
            Table
          </span>
          <span className="text-xs font-semibold text-[#D8B58A]">
            {order.table?.table_number || "Table"}
          </span>
        </div>
      </div>

      {/* Redirecting Banner Overlay */}
      {isRedirecting && (
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-[#D8B58A]/20 via-[#6FAF82]/20 to-[#D8B58A]/20 border border-[#6FAF82]/40 text-center animate-pulse">
          <div className="flex items-center justify-center gap-2 text-[#6FAF82] font-semibold text-sm">
            <CheckCircle2 className="w-5 h-5" />
            <span>Payment Confirmed & Settled!</span>
          </div>
          <p className="text-xs text-[#A8A29E] mt-1">
            Navigating to your payment confirmation receipt...
          </p>
        </div>
      )}

      {/* Order Identity Card */}
      <div className="p-5 rounded-2xl border border-[#C99A8A]/30 bg-gradient-to-b from-[#1f1f1f] to-[#171717] shadow-xl shadow-black/60 mb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-[#A8A29E]">
              Order Number
            </span>
            <h1 className="font-serif text-lg sm:text-xl font-bold text-[#F6EFE7] mt-0.5">
              {order.order_number}
            </h1>
            <p className="text-[11px] text-[#A8A29E] mt-1">
              Placed at {formatFullDateTime(order.created_at)}
            </p>
          </div>

          <StatusBadge status={order.status} className="text-xs px-3 py-1" />
        </div>

        {isCancelled ? (
          <div className="mt-4 p-3 rounded-xl bg-[#C96B6B]/20 border border-[#C96B6B]/40 text-xs text-[#C96B6B]">
            This order has been cancelled or rejected. Please speak with floor staff.
          </div>
        ) : (
          /* Live Progress Timeline */
          <div className="mt-6 pt-5 border-t border-[#242424]">
            <div className="grid grid-cols-6 gap-1 relative">
              {STEPS.map((step, idx) => {
                const isPassed = idx <= currentStepIdx;
                const isCurrent = idx === currentStepIdx;

                return (
                  <div key={step.status} className="flex flex-col items-center text-center">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        isPassed
                          ? "bg-gradient-to-r from-[#C99A8A] to-[#D8B58A] text-[#080808] shadow-md shadow-black/40"
                          : "bg-[#242424] text-[#A8A29E] border border-[#333]"
                      } ${isCurrent ? "ring-2 ring-[#D8B58A] ring-offset-2 ring-offset-[#171717] animate-pulse" : ""}`}
                    >
                      {isPassed ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                    </div>
                    <span
                      className={`text-[10px] mt-2 font-medium leading-tight ${
                        isCurrent
                          ? "text-[#D8B58A] font-bold"
                          : isPassed
                          ? "text-[#F6EFE7]"
                          : "text-[#A8A29E]/50"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Current Step Description */}
            <div className="mt-4 p-2.5 rounded-xl bg-[#080808]/70 border border-[#242424] text-center">
              <p className="text-xs text-[#D8B58A] font-medium">
                {getStatusDescription(order.status)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Items Summary */}
      <div className="p-5 rounded-2xl border border-[#242424] bg-[#171717]/60 mb-6">
        <div className="flex items-center justify-between pb-3 border-b border-[#242424] mb-3">
          <div className="flex items-center gap-2">
            <Utensils className="w-4 h-4 text-[#D8B58A]" />
            <h3 className="font-serif text-sm font-medium text-[#F6EFE7]">
              Order Items
            </h3>
          </div>
          <span className="text-xs text-[#A8A29E]">
            {order.items?.length || 0} item(s)
          </span>
        </div>

        <div className="space-y-3">
          {order.items?.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between text-xs py-1 border-b border-[#242424]/40 last:border-0"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#D8B58A]">{item.quantity}x</span>
                  <span className="text-[#F6EFE7] font-medium">{item.item_name}</span>
                  {item.is_additional && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-[#C99A8A]/20 text-[#DFB8AA] font-bold border border-[#C99A8A]/40">
                      Added Item
                    </span>
                  )}
                </div>

                {item.special_notes && (
                  <p className="text-[10px] text-[#A8A29E] mt-0.5 italic">
                    "{item.special_notes}"
                  </p>
                )}
              </div>

              <span className="font-medium text-[#F6EFE7]">
                {formatCurrency(item.item_total)}
              </span>
            </div>
          ))}
        </div>

        {/* Bill Total */}
        <div className="mt-4 pt-3 border-t border-[#242424] space-y-1.5 text-xs">
          <div className="flex justify-between text-[#A8A29E]">
            <span>Subtotal</span>
            <span>{formatCurrency(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-[#A8A29E]">
            <span>GST Tax</span>
            <span>{formatCurrency(order.tax)}</span>
          </div>
          <div className="flex justify-between font-serif text-sm font-bold text-[#F6EFE7] pt-1">
            <span>Total Payable</span>
            <span className="text-[#D8B58A]">{formatCurrency(order.total)}</span>
          </div>
        </div>
      </div>

      {/* Action / Payment Area */}
      <div className="space-y-4">
        {/* If session is not concluded, show "Order More Items" */}
        {!isSessionConcluded && order.table?.qr_code_token && (
          <Link href={`/table/${order.table.qr_code_token}`}>
            <Button variant="outline" className="w-full py-2.5 text-xs mb-3">
              <PlusCircle className="w-4 h-4" />
              <span>Order More Artisan Items</span>
            </Button>
          </Link>
        )}

        {/* Settled State: session is finished */}
        {isSessionConcluded ? (
          <div className="space-y-3">
            <div className="p-5 rounded-2xl bg-gradient-to-b from-[#1c1c1c] to-[#121212] border border-[#6FAF82]/40 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-[#6FAF82]/20 text-[#6FAF82] flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-base font-bold text-[#F6EFE7]">
                Payment Received & Session Settled
              </h3>
              <p className="text-xs text-[#A8A29E] max-w-sm mx-auto">
                Thank you for dining with Velvet Bloom Café. Your dining session has concluded.
              </p>
            </div>

            <Link
              href={`/payment/confirmation?orderNumber=${encodeURIComponent(order.order_number)}&billNumber=${encodeURIComponent(bill?.bill_number || "BILL-SETTLED")}&amount=${bill?.final_total || order.total}&method=${bill?.splits?.[0]?.payment_method || "ONLINE"}&table=${encodeURIComponent(order.table?.table_number || "Table")}`}
              className="block w-full"
            >
              <Button
                variant="primary"
                className="w-full py-3 text-xs sm:text-sm font-bold shadow-lg shadow-black/60 flex items-center justify-center gap-2"
              >
                <Receipt className="w-4 h-4" />
                <span>View Payment Confirmation Receipt</span>
              </Button>
            </Link>

            <Link href="/" className="block w-full">
              <Button variant="secondary" className="w-full py-2 text-xs flex items-center justify-center gap-1.5">
                <Home className="w-3.5 h-3.5" />
                <span>Return to Café Home</span>
              </Button>
            </Link>
          </div>
        ) : bill ? (
          /* Bill Settlement Box */
          <div className="p-5 rounded-2xl border border-[#D8B58A]/30 bg-gradient-to-b from-[#1c1c1c] to-[#141414] shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#242424]">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#D8B58A]" />
                <span className="text-xs font-semibold text-[#F6EFE7]">
                  Final Dining Bill #{bill.bill_number}
                </span>
              </div>
              <span className="font-serif text-base font-bold text-[#D8B58A]">
                {formatCurrency(bill.final_total)}
              </span>
            </div>

            {/* Split Breakdown notification if applicable */}
            {bill.split_type === "EQUAL" && bill.splits && (
              <div className="p-3 rounded-xl bg-[#242424]/60 border border-[#333] text-xs space-y-1.5">
                <span className="font-medium text-[#D8B58A] block">
                  Bill split equally ({bill.split_count} guests):
                </span>
                <div className="space-y-1">
                  {bill.splits.map((s) => (
                    <div key={s.id} className="flex justify-between text-[11px] text-[#A8A29E]">
                      <span>{s.person_label}</span>
                      <span className={s.payment_status === "PAID" ? "text-[#6FAF82]" : "text-[#F6EFE7]"}>
                        {formatCurrency(s.assigned_amount)} ({s.payment_status})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Payment Method Selector */}
            <div>
              <label className="text-[11px] text-[#A8A29E] block mb-2 font-medium">
                Select Payment Method
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["UPI", "CARD", "ONLINE"] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    disabled={isPaying || isRedirecting}
                    onClick={() => setPaymentMethod(method)}
                    className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all ${
                      paymentMethod === method
                        ? "bg-gradient-to-r from-[#D8B58A] to-[#C99A8A] text-[#080808] border-[#D8B58A] font-bold shadow-md shadow-black/40"
                        : "bg-[#242424]/80 text-[#A8A29E] border-[#333] hover:text-[#F6EFE7]"
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            {paymentError && (
              <div className="p-3 rounded-xl bg-[#C96B6B]/20 border border-[#C96B6B]/40 text-xs text-[#C96B6B] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{paymentError}</span>
              </div>
            )}

            <Button
              variant="primary"
              className="w-full py-3 text-xs sm:text-sm font-bold shadow-lg shadow-black/60 flex items-center justify-center gap-2"
              onClick={handleCustomerPayBill}
              isLoading={isPaying || isRedirecting}
              disabled={isPaying || isRedirecting}
            >
              <CreditCard className="w-4 h-4" />
              <span>
                {isPaying
                  ? "Processing Secure Payment..."
                  : isRedirecting
                  ? "Settled! Redirecting..."
                  : `Pay ${formatCurrency(bill.final_total)} (${paymentMethod})`}
              </span>
            </Button>

            <p className="text-[10px] text-center text-[#A8A29E]/80">
              Floor staff can also accept cash or card terminal payment at your table.
            </p>
          </div>
        ) : (
          <Button
            variant="primary"
            className="w-full py-3 text-xs font-bold flex items-center justify-center gap-2"
            onClick={handleRequestBill}
            isLoading={isRequestingBill}
          >
            <Receipt className="w-4 h-4" />
            <span>Request Final Bill</span>
          </Button>
        )}

        {/* Rate experience button */}
        <Button
          variant="secondary"
          className="w-full py-2.5 text-xs text-[#A8A29E] hover:text-[#F6EFE7] flex items-center justify-center gap-1.5"
          onClick={() => setShowReviewModal(true)}
        >
          <Star className="w-3.5 h-3.5 text-[#D8B58A]" />
          <span>Leave a Review & Rating</span>
        </Button>
      </div>

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-[#C99A8A]/30 bg-[#171717] p-5 shadow-2xl text-[#F6EFE7]">
            <div className="flex items-center justify-between pb-3 border-b border-[#242424]">
              <h3 className="font-serif font-medium text-base text-[#F6EFE7]">
                Your Dining Experience
              </h3>
              <button
                onClick={() => setShowReviewModal(false)}
                className="text-[#A8A29E] hover:text-white"
              >
                ✕
              </button>
            </div>

            {reviewSubmitted ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="w-10 h-10 text-[#6FAF82] mx-auto mb-2" />
                <h4 className="font-medium text-sm">Thank You for Your Feedback!</h4>
                <p className="text-xs text-[#A8A29E] mt-1">
                  We look forward to welcoming you back.
                </p>
              </div>
            ) : (
              <div className="py-4 space-y-3">
                <div>
                  <label className="text-xs text-[#A8A29E] block mb-2">Overall Rating</label>
                  <div className="flex items-center justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setRating(star)}
                        className={`p-1.5 transition-transform hover:scale-110 ${
                          rating >= star ? "text-[#D8B58A]" : "text-[#333]"
                        }`}
                      >
                        <Star className="w-6 h-6 fill-current" />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-[#A8A29E] block mb-1">Comments</label>
                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Tell us what you enjoyed..."
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-[#080808] border border-[#242424] text-xs text-[#F6EFE7] placeholder-[#A8A29E]/40 focus:outline-none focus:border-[#C99A8A]/50 resize-none"
                  />
                </div>

                <Button variant="primary" className="w-full mt-2" onClick={handleSubmitReview}>
                  Submit Feedback
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
