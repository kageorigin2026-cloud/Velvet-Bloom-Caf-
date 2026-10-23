"use client";

import React, { useState } from "react";
import Image from "next/image";
import { MenuItem, OrderItemOption } from "@/types/database.types";
import { Button } from "./Button";
import { formatCurrency } from "@/lib/utils";
import { Plus, Minus, X } from "lucide-react";

interface FoodCustomizerModalProps {
  item: MenuItem;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (
    item: MenuItem,
    quantity: number,
    selectedOptions: OrderItemOption[],
    specialNotes?: string
  ) => void;
}

export function FoodCustomizerModal({
  item,
  isOpen,
  onClose,
  onAddToCart,
}: FoodCustomizerModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, OrderItemOption>>({});
  const [specialNotes, setSpecialNotes] = useState("");

  if (!isOpen) return null;

  const handleOptionChange = (
    groupName: string,
    optionName: string,
    extraPrice: number
  ) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [groupName]: { group_name: groupName, option_name: optionName, extra_price: extraPrice },
    }));
  };

  const optionsExtraTotal = Object.values(selectedOptions).reduce(
    (acc, opt) => acc + (opt.extra_price || 0),
    0
  );

  const finalItemPrice = (item.price + optionsExtraTotal) * quantity;

  const handleConfirm = () => {
    onAddToCart(item, quantity, Object.values(selectedOptions), specialNotes);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl border border-[#C99A8A]/30 bg-[#171717] p-5 shadow-2xl text-[#F6EFE7] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-[#242424]">
          <div className="flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full border ${
                item.is_veg
                  ? "border-[#6FAF82] bg-[#6FAF82]/20"
                  : "border-[#C96B6B] bg-[#C96B6B]/20"
              }`}
            />
            <h3 className="font-serif font-medium text-lg text-[#F6EFE7]">{item.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-[#A8A29E] hover:text-white hover:bg-[#242424]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {item.image_url && (
          <div className="relative w-full h-44 rounded-xl overflow-hidden mt-3 border border-[#242424]">
            <Image
              src={item.image_url}
              alt={item.name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 480px"
            />
          </div>
        )}

        <p className="text-xs text-[#A8A29E] mt-3 leading-relaxed">{item.description}</p>

        {/* Customization Groups */}
        {item.customization_groups && item.customization_groups.length > 0 && (
          <div className="mt-4 space-y-4">
            {item.customization_groups.map((group) => (
              <div key={group.id} className="p-3 rounded-xl bg-[#242424]/40 border border-[#2e2e2e]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[#D8B58A]">{group.name}</span>
                  {group.is_required && (
                    <span className="text-[10px] text-[#C99A8A] uppercase font-bold tracking-wider">
                      Required
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {(group.options || []).map((option) => {
                    const isSelected = selectedOptions[group.name]?.option_name === option.name;
                    return (
                      <label
                        key={option.id}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer border text-xs transition-all ${
                          isSelected
                            ? "bg-[#C99A8A]/15 border-[#C99A8A]/40 text-[#F6EFE7]"
                            : "bg-[#171717]/60 border-[#242424] text-[#A8A29E] hover:text-[#F6EFE7]"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={group.name}
                            checked={isSelected}
                            onChange={() =>
                              handleOptionChange(group.name, option.name, option.extra_price)
                            }
                            className="accent-[#C99A8A]"
                          />
                          <span>{option.name}</span>
                        </div>
                        {option.extra_price > 0 && (
                          <span className="text-[#D8B58A] font-medium">
                            +{formatCurrency(option.extra_price)}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Special Instructions */}
        <div className="mt-4">
          <label className="text-xs font-medium text-[#A8A29E] block mb-1">
            Special Preparation Instructions
          </label>
          <textarea
            value={specialNotes}
            onChange={(e) => setSpecialNotes(e.target.value)}
            placeholder="e.g. Extra hot, serve on the side..."
            rows={2}
            className="w-full rounded-lg bg-[#080808]/70 border border-[#242424] p-2.5 text-xs text-[#F6EFE7] placeholder-[#A8A29E]/40 focus:outline-none focus:border-[#C99A8A]/50 resize-none"
          />
        </div>

        {/* Quantity and Add Button */}
        <div className="mt-5 pt-3 border-t border-[#242424] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 bg-[#080808] border border-[#242424] rounded-lg px-2.5 py-1">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="text-[#A8A29E] hover:text-[#F6EFE7] p-1"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="text-sm font-semibold text-[#F6EFE7] w-6 text-center">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="text-[#A8A29E] hover:text-[#F6EFE7] p-1"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <Button variant="primary" className="flex-1 py-2.5" onClick={handleConfirm}>
            <span>Add to Order</span>
            <span className="opacity-80">·</span>
            <span className="font-bold">{formatCurrency(finalItemPrice)}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

