"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { CafeTable, TableSession, Category, MenuItem, CafeSettings } from "@/types/database.types";
import { FoodCard } from "@/components/ui/FoodCard";
import { useCart } from "@/lib/store/cart-context";
import { formatCurrency } from "@/lib/utils";
import { Search, ArrowRight, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface TableMenuViewProps {
  table: CafeTable;
  token: string;
  session: TableSession;
  categories: Category[];
  menuItems: MenuItem[];
  settings: CafeSettings;
}

export function TableMenuView({
  table,
  token,
  session,
  categories,
  menuItems,
  settings,
}: TableMenuViewProps) {
  const { itemCount, total, setTableToken, activeOrderNumber } = useCart();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [vegOnly, setVegOnly] = useState(false);
  const [storedOrder, setStoredOrder] = useState<string | null>(null);
  const [isSessionSettled, setIsSessionSettled] = useState(false);

  useEffect(() => {
    if (token) setTableToken(token);
    try {
      const isSettled = localStorage.getItem(`vb_session_settled_${token}`);
      if (isSettled === "true" || !session.is_active || table.status === "PAID") {
        setIsSessionSettled(true);
      }
      const fromLocal =
        localStorage.getItem(`vb_last_order_${token}`) ||
        localStorage.getItem("vb_active_order_number");
      if (fromLocal) setStoredOrder(fromLocal);
    } catch {
      // Ignore
    }
  }, [token, setTableToken, activeOrderNumber, session.is_active, table.status]);

  if (isSessionSettled) {
    return (
      <div className="max-w-md mx-auto pt-12 pb-24 text-center px-4 space-y-4">
        <div className="p-6 rounded-2xl border border-[#C99A8A]/30 bg-[#141414] shadow-xl text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#6FAF82]/20 text-[#6FAF82] flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h2 className="font-serif text-xl font-bold text-[#F6EFE7]">
            Dining Session Concluded
          </h2>
          <p className="text-xs text-[#A8A29E] leading-relaxed">
            Your dining bill for {table.table_number} has been settled and the table ordering session is complete. Thank you for dining with Velvet Bloom Café.
          </p>
          <div className="pt-2 space-y-2">
            <Link href="/" className="block w-full">
              <Button variant="primary" className="w-full py-2.5 text-xs font-bold">
                Return to Café Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const effectiveActiveOrder = activeOrderNumber || storedOrder;

  const filteredItems = menuItems.filter((item) => {
    if (!item.is_available) return false;
    if (selectedCategory !== "all" && item.category_id !== selectedCategory) return false;
    if (vegOnly && !item.is_veg) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchDesc = item.description?.toLowerCase().includes(q);
      if (!matchName && !matchDesc) return false;
    }
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 pt-4">
      {/* Ordering paused or busy notice */}
      {settings.is_ordering_paused && (
        <div className="mb-4 p-3 rounded-xl bg-[#D6A34A]/10 border border-[#D6A34A]/30 flex items-center gap-2.5 text-xs text-[#D6A34A]">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{settings.busy_message || "The kitchen is currently experiencing high demand."}</span>
        </div>
      )}

      {/* Active Order Banner */}
      {effectiveActiveOrder && (
        <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-[#1c1917] via-[#171717] to-[#1a1714] border border-[#C99A8A]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#D8B58A]/10 border border-[#D8B58A]/20 flex items-center justify-center text-[#D8B58A] flex-shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#F6EFE7]">
                  Order in Progress:{" "}
                  <span className="font-mono text-[#D8B58A]">{effectiveActiveOrder}</span>
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#6FAF82] animate-pulse" />
              </div>
              <p className="text-[11px] text-[#A8A29E]">
                Track preparation and kitchen status in real time.
              </p>
            </div>
          </div>

          <Link
            href={`/track/${effectiveActiveOrder}`}
            className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#C99A8A] to-[#D8B58A] text-[#080808] font-bold text-xs hover:opacity-95 transition-all whitespace-nowrap shadow-sm self-stretch sm:self-auto"
          >
            <span>Track Order</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Search & Veg Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A8A29E]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search our artisan coffees, pizzas, burgers..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#171717] border border-[#242424] text-xs text-[#F6EFE7] placeholder-[#A8A29E]/50 focus:outline-none focus:border-[#C99A8A]/50 transition-colors"
          />
        </div>

        <button
          onClick={() => setVegOnly(!vegOnly)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors self-start sm:self-auto ${
            vegOnly
              ? "bg-[#6FAF82]/15 border-[#6FAF82]/40 text-[#6FAF82]"
              : "bg-[#171717] border-[#242424] text-[#A8A29E] hover:text-[#F6EFE7]"
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-[#6FAF82]" />
          <span>Vegetarian Only</span>
        </button>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none mb-6">
        <button
          onClick={() => setSelectedCategory("all")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
            selectedCategory === "all"
              ? "bg-gradient-to-r from-[#C99A8A] to-[#D8B58A] text-[#080808] font-bold shadow-md shadow-black/40"
              : "bg-[#171717] text-[#A8A29E] border border-[#242424] hover:text-[#F6EFE7]"
          }`}
        >
          All Offerings
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              selectedCategory === cat.id
                ? "bg-gradient-to-r from-[#C99A8A] to-[#D8B58A] text-[#080808] font-bold shadow-md shadow-black/40"
                : "bg-[#171717] text-[#A8A29E] border border-[#242424] hover:text-[#F6EFE7]"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Food Items Grid */}
      {filteredItems.length === 0 ? (
        <div className="py-16 text-center text-[#A8A29E] text-xs">
          No artisan selections found matching your criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredItems.map((item) => (
            <FoodCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* Floating Cart Bar */}
      {itemCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 max-w-md mx-auto">
          <Link
            href={`/table/${token}/cart`}
            className="flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-[#C99A8A] to-[#D8B58A] text-[#080808] shadow-2xl shadow-black/80 font-semibold border border-[#D8B58A]/50 active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-2 text-xs">
              <span className="w-6 h-6 rounded-full bg-[#080808] text-[#F6EFE7] flex items-center justify-center font-bold text-[11px]">
                {itemCount}
              </span>
              <span>View Cart Order</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-serif text-sm font-bold">{formatCurrency(total)}</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}

