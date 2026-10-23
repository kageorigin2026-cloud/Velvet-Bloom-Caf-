"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { MenuItem, OrderItemOption } from "@/types/database.types";
import { calculateOrderPricing } from "@/lib/pricing";

export interface CartItem {
  id: string;
  menuItem: MenuItem;
  quantity: number;
  selectedOptions: OrderItemOption[];
  specialNotes?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (menuItem: MenuItem, quantity: number, options: OrderItemOption[], specialNotes?: string) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  clearSessionOrderingState: () => void;
  subtotal: number;
  tax: number;
  total: number;
  itemCount: number;
  tableToken: string | null;
  setTableToken: (token: string) => void;
  customerName: string;
  setCustomerName: (name: string) => void;
  customerPhone: string;
  setCustomerPhone: (phone: string) => void;
  activeOrderNumber: string | null;
  setActiveOrderNumber: (orderNumber: string | null) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [tableToken, setTableToken] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [activeOrderNumber, setActiveOrderNumberState] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("vb_cart_items");
      if (saved) setItems(JSON.parse(saved));
      const savedToken = localStorage.getItem("vb_table_token");
      if (savedToken) setTableToken(savedToken);
      const savedName = localStorage.getItem("vb_customer_name");
      if (savedName) setCustomerName(savedName);
      const savedOrder = localStorage.getItem("vb_active_order_number");
      if (savedOrder) setActiveOrderNumberState(savedOrder);
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("vb_cart_items", JSON.stringify(items));
    } catch {
      // Ignore
    }
  }, [items]);

  const addItem = (
    menuItem: MenuItem,
    quantity: number,
    options: OrderItemOption[],
    specialNotes?: string
  ) => {
    setItems((prev) => {
      // Check if exact same item with same options already in cart
      const optionsKey = (options || [])
        .map((o) => `${o.group_name}:${o.option_name}`)
        .sort()
        .join("|");

      const existingIndex = prev.findIndex(
        (i) =>
          i.menuItem.id === menuItem.id &&
          (i.selectedOptions || [])
            .map((o) => `${o.group_name}:${o.option_name}`)
            .sort()
            .join("|") === optionsKey &&
          (i.specialNotes || "") === (specialNotes || "")
      );

      if (existingIndex > -1) {
        const next = [...prev];
        next[existingIndex].quantity += quantity;
        return next;
      }

      const newItem: CartItem = {
        id: `cart-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        menuItem,
        quantity,
        selectedOptions: options,
        specialNotes,
      };
      return [...prev, newItem];
    });
  };

  const removeItem = (cartItemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== cartItemId));
  };

  const updateQuantity = (cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(cartItemId);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.id === cartItemId ? { ...i, quantity } : i))
    );
  };

  const clearCart = () => {
    setItems([]);
    try {
      localStorage.removeItem("vb_cart_items");
    } catch {
      // Ignore
    }
  };

  const clearSessionOrderingState = () => {
    setItems([]);
    setActiveOrderNumberState(null);
    setCustomerName("");
    setCustomerPhone("");
    try {
      localStorage.removeItem("vb_cart_items");
      localStorage.removeItem("vb_active_order_number");
      localStorage.removeItem("vb_customer_name");
      if (tableToken) {
        localStorage.removeItem(`vb_last_order_${tableToken}`);
        localStorage.setItem(`vb_session_settled_${tableToken}`, "true");
      }
    } catch {
      // Ignore
    }
  };

  const setActiveOrderNumber = (orderNumber: string | null) => {
    setActiveOrderNumberState(orderNumber);
    try {
      if (orderNumber) {
        localStorage.setItem("vb_active_order_number", orderNumber);
      } else {
        localStorage.removeItem("vb_active_order_number");
      }
    } catch {
      // Ignore
    }
  };

  const pricingInputs = items.map((i) => ({
    unitPrice: i.menuItem.price,
    quantity: i.quantity,
    optionsExtraPrice: (i.selectedOptions || []).reduce((acc, opt) => acc + (opt.extra_price || 0), 0),
  }));

  const pricing = calculateOrderPricing(pricingInputs, 5, 0, 0);

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        clearSessionOrderingState,
        subtotal: pricing.subtotal,
        tax: pricing.tax,
        total: pricing.finalTotal,
        itemCount,
        tableToken,
        setTableToken: (t) => {
          setTableToken(t);
          localStorage.setItem("vb_table_token", t);
        },
        customerName,
        setCustomerName: (n) => {
          setCustomerName(n);
          localStorage.setItem("vb_customer_name", n);
        },
        customerPhone,
        setCustomerPhone,
        activeOrderNumber,
        setActiveOrderNumber,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}

