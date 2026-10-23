import React from "react";
import { Coffee, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon = Coffee,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center rounded-xl border border-[#242424] bg-[#171717]/40 backdrop-blur-sm",
        className
      )}
    >
      <div className="w-12 h-12 rounded-full bg-[#242424] flex items-center justify-center text-[#D8B58A] mb-3 border border-[#C99A8A]/20">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-base font-serif font-medium text-[#F6EFE7] mb-1">{title}</h3>
      {description && <p className="text-xs text-[#A8A29E] max-w-sm mb-4">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

