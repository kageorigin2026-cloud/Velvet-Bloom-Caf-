import React from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export function Button({
  children,
  className,
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#C99A8A]/50 disabled:opacity-50 disabled:cursor-not-allowed select-none";

  const sizeStyles = {
    sm: "px-2.5 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
    lg: "px-5 py-2.5 text-base gap-2.5",
  };

  const variantStyles = {
    primary:
      "bg-gradient-to-r from-[#C99A8A] to-[#D8B58A] text-[#080808] font-semibold hover:from-[#DFB8AA] hover:to-[#E8CDAC] shadow-md shadow-black/40 border border-[#D8B58A]/30 active:scale-[0.98]",
    secondary:
      "bg-[#242424] text-[#F6EFE7] hover:bg-[#2e2e2e] border border-[#3e3e3e] active:scale-[0.98]",
    outline:
      "border border-[#C99A8A]/40 text-[#D8B58A] hover:bg-[#C99A8A]/10 active:scale-[0.98]",
    danger:
      "bg-[#C96B6B]/20 text-[#C96B6B] border border-[#C96B6B]/40 hover:bg-[#C96B6B]/30 active:scale-[0.98]",
    ghost:
      "text-[#A8A29E] hover:text-[#F6EFE7] hover:bg-[#242424]/50",
  };

  return (
    <button
      className={cn(baseStyles, sizeStyles[size], variantStyles[variant], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}

