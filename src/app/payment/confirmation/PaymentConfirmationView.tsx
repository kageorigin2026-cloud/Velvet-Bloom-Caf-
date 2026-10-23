"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CafeLogo } from "@/components/brand/CafeLogo";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatFullDateTime } from "@/lib/utils";
import {
  CheckCircle2,
  Home,
  Receipt,
  Star,
  Check,
  CreditCard,
  QrCode,
  Banknote,
  Sparkles,
} from "lucide-react";

interface PaymentConfirmationViewProps {
  orderNumber?: string;
  billNumber?: string;
  amount?: number;
  paymentMethod?: string;
  tableNumber?: string;
}

export function PaymentConfirmationView({
  orderNumber = "VB-20261023-0001",
  billNumber = "BILL-0001",
  amount = 0,
  paymentMethod = "ONLINE",
  tableNumber = "Table",
}: PaymentConfirmationViewProps) {
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const getMethodIcon = (method: string) => {
    switch (method.toUpperCase()) {
      case "UPI":
        return <QrCode className="w-4 h-4 text-[#D8B58A]" />;
      case "CARD":
        return <CreditCard className="w-4 h-4 text-[#D8B58A]" />;
      case "CASH":
        return <Banknote className="w-4 h-4 text-[#D8B58A]" />;
      default:
        return <CreditCard className="w-4 h-4 text-[#D8B58A]" />;
    }
  };

  const handleSubmitReview = async () => {
    setIsSubmittingReview(true);
    try {
      await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber,
          rating,
          comment,
          customerName: "Valued Guest",
        }),
      });
      setReviewSubmitted(true);
      setTimeout(() => setShowReviewModal(false), 1600);
    } catch {
      // Ignore
    } finally {
      setIsSubmittingReview(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080808] text-[#F6EFE7] flex flex-col justify-between p-4 sm:p-6">
      {/* Top Header */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between pb-4 border-b border-[#242424]">
        <CafeLogo size="sm" showTagline={false} showPoweredBy={false} href="/" />
        <span className="text-xs px-2.5 py-1 rounded-full bg-[#6FAF82]/15 text-[#6FAF82] border border-[#6FAF82]/30 font-semibold flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5" />
          <span>Settled</span>
        </span>
      </div>

      {/* Main Confirmation Content */}
      <div className="max-w-md w-full mx-auto my-auto py-8">
        <div className="p-6 sm:p-8 rounded-3xl border border-[#C99A8A]/30 bg-gradient-to-b from-[#1c1c1c] via-[#141414] to-[#0c0c0c] shadow-2xl text-center space-y-6">
          {/* Animated Celebration Icon */}
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#D8B58A]/30 to-[#6FAF82]/30 blur-xl animate-pulse" />
            <div className="relative w-20 h-20 rounded-full bg-gradient-to-b from-[#262626] to-[#121212] border-2 border-[#6FAF82]/60 text-[#6FAF82] flex items-center justify-center shadow-xl shadow-black/80">
              <CheckCircle2 className="w-10 h-10" />
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] uppercase tracking-widest text-[#D8B58A] font-bold">
              Transaction Completed
            </span>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#F6EFE7]">
              Payment Successful
            </h1>
            <p className="text-xs text-[#A8A29E] leading-relaxed max-w-xs mx-auto">
              Your dining bill has been settled in full.
            </p>
          </div>

          {/* Payment Receipt Summary Card */}
          <div className="p-5 rounded-2xl bg-[#080808]/80 border border-[#242424] text-left space-y-3.5">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-[#242424]/60">
              <span className="text-[#A8A29E]">Amount Paid</span>
              <span className="font-serif font-bold text-base text-[#D8B58A]">
                {formatCurrency(amount)}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-[#A8A29E]">Bill Number</span>
              <span className="font-mono font-semibold text-[#F6EFE7]">{billNumber}</span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-[#A8A29E]">Order Reference</span>
              <span className="font-mono text-[#D8B58A]">{orderNumber}</span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-[#A8A29E]">Table</span>
              <span className="font-semibold text-[#F6EFE7]">{tableNumber}</span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-[#A8A29E]">Payment Method</span>
              <span className="flex items-center gap-1.5 font-semibold text-[#F6EFE7] uppercase text-[11px] px-2 py-0.5 rounded bg-[#1c1c1c] border border-[#333]">
                {getMethodIcon(paymentMethod)}
                <span>{paymentMethod}</span>
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pt-1 border-t border-[#242424]/60 text-[#A8A29E]/80">
              <span>Date & Time</span>
              <span className="text-[11px]">{formatFullDateTime(new Date().toISOString())}</span>
            </div>
          </div>

          {/* Gracious Hospitality Farewell */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-[#D8B58A]/10 via-[#C99A8A]/10 to-[#D8B58A]/10 border border-[#D8B58A]/20 text-center">
            <div className="flex items-center justify-center gap-1.5 text-[#D8B58A] mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="text-xs font-serif font-semibold">Sip. Savor. Bloom.</span>
            </div>
            <p className="text-xs text-[#F6EFE7] font-serif font-medium">
              Thank you for dining with Velvet Bloom Café
            </p>
            <p className="text-[10px] text-[#A8A29E] mt-0.5">
              We look forward to curating your next culinary journey.
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3 pt-2">
            <Button
              variant="outline"
              className="w-full py-2.5 text-xs text-[#D8B58A] border-[#D8B58A]/30 hover:bg-[#D8B58A]/10 flex items-center justify-center gap-2"
              onClick={() => setShowReviewModal(true)}
            >
              <Star className="w-3.5 h-3.5" />
              <span>Leave a Dining Experience Review</span>
            </Button>

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
                <h4 className="font-medium text-sm">Thank You for Your Review!</h4>
                <p className="text-xs text-[#A8A29E] mt-1">
                  We look forward to welcoming you back to Velvet Bloom Café.
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
                  <label className="text-xs text-[#A8A29E] block mb-1">Feedback Comments</label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Share your culinary impressions..."
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-[#080808] border border-[#242424] text-xs text-[#F6EFE7] placeholder-[#A8A29E]/40 focus:outline-none focus:border-[#C99A8A]/50 resize-none"
                  />
                </div>

                <Button
                  variant="primary"
                  className="w-full mt-2"
                  onClick={handleSubmitReview}
                  isLoading={isSubmittingReview}
                >
                  Submit Review
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer Branding */}
      <div className="max-w-md w-full mx-auto text-center pt-4 border-t border-[#242424]/40">
        <p className="text-[10px] text-[#A8A29E]/60 tracking-wider">
          VELVET BLOOM CAFÉ · POWERED BY KAGE ORIGIN
        </p>
      </div>
    </div>
  );
}

