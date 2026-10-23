"use client";

import React, { useState } from "react";
import { AlertCircle, ChevronDown, ChevronUp, Database } from "lucide-react";

export function DevModeIndicator() {
  const [expanded, setExpanded] = useState(false);

  return (
    <aside
      aria-label="Development mode notice"
      className="fixed bottom-3 right-3 z-50 max-w-sm rounded-lg border border-[#C99A8A]/30 bg-[#171717]/95 p-2.5 shadow-xl shadow-black/80 backdrop-blur-md text-xs text-[#F6EFE7]"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[#D8B58A]">
          <Database className="w-3.5 h-3.5 text-[#C99A8A] animate-pulse" />
          <span className="font-semibold tracking-wide uppercase text-[10px]">
            Local Dev Mode (Mock Data)
          </span>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[#A8A29E] hover:text-[#F6EFE7] p-0.5 rounded transition-colors"
          title={expanded ? "Collapse details" : "Expand details"}
        >
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-2 pt-2 border-t border-[#242424] space-y-1.5 text-[11px] text-[#A8A29E]">
          <p>
            Operating with in-memory persistence. Analytics and records shown are simulated development data.
          </p>
          <div className="rounded bg-[#080808]/60 p-1.5 font-mono text-[10px] text-[#D8B58A]">
            Switch to Supabase: <span className="text-white">DATA_ADAPTER=supabase</span> in .env.local
          </div>
          <p className="text-[10px] text-[#A8A29E]/80">
            Powered by Kage Origin multi-tenant architecture.
          </p>
        </div>
      )}
    </aside>
  );
}

