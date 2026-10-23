import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface CafeLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showTagline?: boolean;
  showPoweredBy?: boolean;
  href?: string;
}

export function CafeLogo({
  className,
  size = "md",
  showTagline = true,
  showPoweredBy = true,
  href,
}: CafeLogoProps) {
  const sizeClasses = {
    sm: "text-base",
    md: "text-xl",
    lg: "text-2xl",
    xl: "text-3xl",
  };

  const iconSizes = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-10 h-10",
    xl: "w-12 h-12",
  };

  const content = (
    <div className={cn("inline-flex flex-col items-center select-none text-center", className)}>
      <div className="flex items-center gap-2.5">
        {/* Botanical Rose Bloom Icon in Champagne / Rose Gold */}
        <div
          className={cn(
            "relative flex items-center justify-center rounded-full bg-gradient-to-tr from-[#171717] to-[#242424] border border-[#C99A8A]/40 p-1.5 shadow-md shadow-black/80",
            iconSizes[size]
          )}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="w-full h-full text-[#D8B58A]"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3a6 6 0 0 0 6 6c0 3.314-2.686 6-6 6s-6-2.686-6-6a6 6 0 0 0 6-6z" />
            <path d="M12 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
            <path d="M12 15v6" />
            <path d="M9 18c3 .5 6 .5 6 0" />
            <path d="M7 11c-2 1-3 3-2 5s4 3 7 2" />
            <path d="M17 11c2 1 3 3 2 5s-4 3-7 2" />
          </svg>
        </div>

        <div className="flex flex-col text-left">
          <span className={cn("font-serif tracking-wider font-medium text-[#F6EFE7]", sizeClasses[size])}>
            VELVET <span className="text-[#C99A8A] font-normal">BLOOM</span>
          </span>
          <span className="text-[9px] uppercase tracking-[0.25em] text-[#D8B58A]/90 font-sans font-medium">
            Café & Lounge
          </span>
        </div>
      </div>

      {showTagline && (
        <span className="text-[10px] tracking-[0.16em] text-[#A8A29E] font-light mt-0.5 italic">
          "Sip. Savor. Bloom."
        </span>
      )}

      {showPoweredBy && (
        <div className="mt-0.5 flex items-center gap-1 text-[8.5px] uppercase tracking-[0.15em] text-[#A8A29E]/70">
          <span>Powered by</span>
          <span className="text-[#D8B58A] font-semibold">Kage Origin</span>
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="focus:outline-none hover:opacity-95 transition-opacity">
        {content}
      </Link>
    );
  }

  return content;
}

