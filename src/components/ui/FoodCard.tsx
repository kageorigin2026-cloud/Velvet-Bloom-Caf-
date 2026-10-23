"use client";

import React, { useState } from "react";
import Image from "next/image";
import { MenuItem, OrderItemOption } from "@/types/database.types";
import { formatCurrency } from "@/lib/utils";
import { FoodCustomizerModal } from "./FoodCustomizerModal";
import { useCart } from "@/lib/store/cart-context";
import { Plus, Star } from "lucide-react";

interface FoodCardProps {
  item: MenuItem;
}

export function FoodCard({ item }: FoodCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const { addItem } = useCart();

  const handleAddToCart = (
    menuItem: MenuItem,
    quantity: number,
    options: OrderItemOption[],
    specialNotes?: string
  ) => {
    addItem(menuItem, quantity, options, specialNotes);
  };

  const hasCustomizations = item.customization_groups && item.customization_groups.length > 0;

  const handleQuickAdd = () => {
    if (hasCustomizations) {
      setModalOpen(true);
    } else {
      addItem(item, 1, []);
    }
  };

  return (
    <>
      <div className="group relative flex flex-col justify-between rounded-2xl border border-[#242424] bg-[#171717]/60 p-3 sm:p-4 backdrop-blur-md transition-all duration-300 hover:border-[#C99A8A]/30 hover:bg-[#1f1f1f]/80 shadow-lg shadow-black/40">
        <div>
          {/* Image & Badges */}
          <div className="relative w-full h-36 sm:h-44 rounded-xl overflow-hidden mb-3 bg-[#080808]">
            {item.image_url ? (
              <Image
                src={item.image_url}
                alt={item.name}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#A8A29E]/30 text-xs font-serif">
                Velvet Bloom
              </div>
            )}

            {/* Badges Overlay */}
            <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
              {item.is_chef_special && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-gradient-to-r from-[#D8B58A] to-[#E8CDAC] text-[#080808] shadow-md">
                  Chef's Special
                </span>
              )}
              {item.is_bestseller && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-gradient-to-r from-[#C99A8A] to-[#DFB8AA] text-[#080808] shadow-md">
                  Bestseller
                </span>
              )}
            </div>

            {/* Veg / Non-veg indicator */}
            <div className="absolute top-2 right-2 z-10 w-4 h-4 rounded bg-[#080808]/80 backdrop-blur-sm flex items-center justify-center border border-[#242424]">
              <span
                className={`w-2 h-2 rounded-full ${
                  item.is_veg ? "bg-[#6FAF82]" : "bg-[#C96B6B]"
                }`}
              />
            </div>
          </div>

          {/* Title & Info */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-serif font-medium text-sm sm:text-base text-[#F6EFE7] leading-snug group-hover:text-[#D8B58A] transition-colors line-clamp-1">
              {item.name}
            </h3>
            {item.average_rating > 0 && (
              <div className="flex items-center gap-1 text-[11px] text-[#D8B58A] font-semibold flex-shrink-0">
                <Star className="w-3 h-3 fill-current" />
                <span>{item.average_rating}</span>
              </div>
            )}
          </div>

          <p className="text-xs text-[#A8A29E] mt-1 line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        </div>

        {/* Footer: Price & Add Button */}
        <div className="mt-4 pt-3 border-t border-[#242424] flex items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-[#A8A29E]/70 font-sans">
              Price
            </span>
            <span className="font-serif text-sm sm:text-base font-semibold text-[#F6EFE7]">
              {formatCurrency(item.price)}
            </span>
          </div>

          <button
            onClick={handleQuickAdd}
            disabled={!item.is_available}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              item.is_available
                ? "bg-gradient-to-r from-[#C99A8A] to-[#D8B58A] text-[#080808] hover:from-[#DFB8AA] hover:to-[#E8CDAC] shadow-md shadow-black/40 active:scale-95"
                : "bg-[#242424] text-[#A8A29E] cursor-not-allowed opacity-50"
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{item.is_available ? "Add" : "Sold Out"}</span>
          </button>
        </div>
      </div>

      <FoodCustomizerModal
        item={item}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onAddToCart={handleAddToCart}
      />
    </>
  );
}

