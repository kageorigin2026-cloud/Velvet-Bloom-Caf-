import React from "react";
import { OrderStatus, TableStatus, BillStatus } from "@/types/database.types";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: OrderStatus | TableStatus | BillStatus | string;
  type?: "order" | "table" | "bill";
  className?: string;
}

export function StatusBadge({ status, type = "order", className }: StatusBadgeProps) {
  let colorClasses = "bg-[#242424] text-[#A8A29E] border-[#2e2e2e]";

  switch (status) {
    case "PENDING":
    case "REQUESTED":
      colorClasses = "bg-[#D6A34A]/10 text-[#D6A34A] border-[#D6A34A]/30";
      break;
    case "ACCEPTED":
      colorClasses = "bg-[#38bdf8]/10 text-[#38bdf8] border-[#38bdf8]/30";
      break;
    case "PREPARING":
    case "OCCUPIED":
      colorClasses = "bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30";
      break;
    case "READY":
    case "BILL_REQUESTED":
      colorClasses = "bg-[#C99A8A]/15 text-[#DFB8AA] border-[#C99A8A]/40";
      break;
    case "SERVED":
      colorClasses = "bg-[#818cf8]/10 text-[#a5b4fc] border-[#818cf8]/30";
      break;
    case "COMPLETED":
    case "PAID":
    case "AVAILABLE":
      colorClasses = "bg-[#6FAF82]/15 text-[#6FAF82] border-[#6FAF82]/30";
      break;
    case "CANCELLED":
    case "REJECTED":
      colorClasses = "bg-[#C96B6B]/15 text-[#C96B6B] border-[#C96B6B]/30";
      break;
    case "CLEANING":
      colorClasses = "bg-[#a8a29e]/15 text-[#a8a29e] border-[#a8a29e]/30";
      break;
  }

  const formatText = (s: string) => {
    return s.replace(/_/g, " ").toUpperCase();
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider border select-none",
        colorClasses,
        className
      )}
    >
      {formatText(status)}
    </span>
  );
}

