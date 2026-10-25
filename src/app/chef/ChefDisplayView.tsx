"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Order, OrderStatus } from "@/types/database.types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { useNotification } from "@/lib/audio/notification-context";
import { useSupabaseRealtime } from "@/lib/supabase/realtime";
import { formatCurrency } from "@/lib/utils";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
  Check,
  XCircle,
  Bell,
  Utensils,
  BellRing,
  VolumeX,
} from "lucide-react";

interface ChefDisplayViewProps {
  initialOrders: Order[];
}

export function ChefDisplayView({ initialOrders }: ChefDisplayViewProps) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const {
    triggerSound,
    startRepeatingAlert,
    acknowledgeRepeatingAlert,
    activeRepeatingAlert,
  } = useNotification();

  // Known item IDs to detect new additional items
  const knownItemIdsRef = useRef<Set<string>>(
    new Set(initialOrders.flatMap((o) => (o.items || []).map((i) => i.id)))
  );

  // Known order IDs to detect brand new orders
  const knownOrderIdsRef = useRef<Set<string>>(
    new Set(initialOrders.map((o) => o.id))
  );

  const fetchKitchenOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders");
      if (res.ok) {
        const freshOrders: Order[] = await res.json();
        const activeKitchenOrders = freshOrders.filter(
          (o) =>
            o.status === "PENDING" ||
            o.status === "ACCEPTED" ||
            o.status === "PREPARING" ||
            o.status === "READY"
        );

        // 1. Detect Brand New Pending Orders
        for (const order of activeKitchenOrders) {
          if (order.status === "PENDING" && !knownOrderIdsRef.current.has(order.id)) {
            knownOrderIdsRef.current.add(order.id);

            triggerSound("new_order", {
              eventId: `new_${order.id}`,
              title: "New Incoming Order!",
              message: `${order.table?.table_number || "Table"} — #${order.order_number}`,
            });

            // Start optional repeating alarm until acknowledged
            startRepeatingAlert({
              alertId: order.id,
              title: "New Order Pending",
              subtitle: `${order.table?.table_number || "Table"} — #${order.order_number}`,
              orderId: order.id,
              soundType: "alert_urgent",
            });
          } else {
            knownOrderIdsRef.current.add(order.id);
          }

          // 2. Detect New Additional Items Added to this order
          if (order.items) {
            for (const item of order.items) {
              if (item.is_additional && !knownItemIdsRef.current.has(item.id)) {
                knownItemIdsRef.current.add(item.id);

                triggerSound("additional_item", {
                  eventId: `add_${item.id}`,
                  title: "Additional Item Added!",
                  message: `${order.table?.table_number || "Table"}: +${item.quantity}x ${item.item_name}`,
                });
              } else {
                knownItemIdsRef.current.add(item.id);
              }
            }
          }
        }

        // 3. If currently repeating alert order is no longer PENDING, stop repeating immediately
        if (activeRepeatingAlert?.orderId) {
          const activeOrder = activeKitchenOrders.find((o) => o.id === activeRepeatingAlert.orderId);
          if (!activeOrder || activeOrder.status !== "PENDING") {
            acknowledgeRepeatingAlert(activeRepeatingAlert.orderId);
          }
        }

        setOrders(activeKitchenOrders);
      }
    } catch {
      // Ignore network glitches
    }
  }, [triggerSound, startRepeatingAlert, acknowledgeRepeatingAlert, activeRepeatingAlert]);

  // Subscribe to live Supabase Realtime changes
  useSupabaseRealtime({
    table: "orders",
    onEvent: () => {
      fetchKitchenOrders();
    },
  });

  // Reconciliation polling interval (10s fallback when Realtime is active; immediate refresh on window focus)
  useEffect(() => {
    fetchKitchenOrders();
    const interval = setInterval(fetchKitchenOrders, 10000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchKitchenOrders();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchKitchenOrders]);

  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    // Stop repeating alert when chef accepts, prepares, or rejects
    acknowledgeRepeatingAlert(orderId);

    setLoadingAction(`${orderId}-${newStatus}`);
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          actorType: "CHEF",
          actorId: "user-chef-01",
          notes: `Chef updated status to ${newStatus}`,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: updated.status } : o))
        );
        if (newStatus === "READY") {
          triggerSound("order_ready", {
            eventId: `ready_${orderId}`,
            title: "Order Plated & Ready",
            message: `${updated.table?.table_number || "Table"} ready for server pickup`,
          });
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        const msg = errorData.error || `Failed to update order status to ${newStatus}`;
        console.error("[Chef Dashboard] Order update error:", msg);
        alert(`Order update failed: ${msg}`);
      }
    } catch (err: any) {
      console.error("[Chef Dashboard] Network error updating order status:", err);
      alert("Network error: Unable to update order status. Please check your connection.");
    } finally {
      setLoadingAction(null);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (statusFilter === "ALL") return true;
    return o.status === statusFilter;
  });

  const getElapsedTime = (createdStr: string) => {
    return Math.floor((Date.now() - new Date(createdStr).getTime()) / 60000);
  };

  const countPending = orders.filter((o) => o.status === "PENDING").length;
  const countPreparing = orders.filter((o) => o.status === "PREPARING").length;
  const countReady = orders.filter((o) => o.status === "READY").length;

  return (
    <div className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6">
      {/* Top Bar with Counters & Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#242424] mb-6">
        <div>
          <h1 className="font-serif text-xl sm:text-2xl font-bold text-[#F6EFE7]">
            Kitchen Display System (KDS)
          </h1>
          <p className="text-xs text-[#A8A29E] mt-0.5">
            Real-time live queue for culinary preparation and plating.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            onClick={() => setStatusFilter("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              statusFilter === "ALL"
                ? "bg-[#C99A8A]/20 border border-[#C99A8A]/40 text-[#DFB8AA] font-bold"
                : "bg-[#171717] text-[#A8A29E] hover:text-[#F6EFE7]"
            }`}
          >
            All Active ({orders.length})
          </button>

          <button
            onClick={() => setStatusFilter("PENDING")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              statusFilter === "PENDING"
                ? "bg-[#D6A34A]/20 border border-[#D6A34A]/40 text-[#D6A34A] font-bold"
                : "bg-[#171717] text-[#A8A29E] hover:text-[#F6EFE7]"
            }`}
          >
            <span>New Pending</span>
            {countPending > 0 && (
              <span className="w-4 h-4 rounded-full bg-[#D6A34A] text-[#080808] text-[10px] font-bold flex items-center justify-center">
                {countPending}
              </span>
            )}
          </button>

          <button
            onClick={() => setStatusFilter("PREPARING")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              statusFilter === "PREPARING"
                ? "bg-[#f59e0b]/20 border border-[#f59e0b]/40 text-[#f59e0b] font-bold"
                : "bg-[#171717] text-[#A8A29E] hover:text-[#F6EFE7]"
            }`}
          >
            Preparing ({countPreparing})
          </button>

          <button
            onClick={() => setStatusFilter("READY")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              statusFilter === "READY"
                ? "bg-[#6FAF82]/20 border border-[#6FAF82]/40 text-[#6FAF82] font-bold"
                : "bg-[#171717] text-[#A8A29E] hover:text-[#F6EFE7]"
            }`}
          >
            Ready to Serve ({countReady})
          </button>
        </div>
      </div>

      {/* Orders Grid */}
      {filteredOrders.length === 0 ? (
        <div className="py-24 text-center border border-[#242424] rounded-2xl bg-[#171717]/30">
          <Utensils className="w-10 h-10 text-[#333] mx-auto mb-3" />
          <h3 className="font-serif text-base text-[#F6EFE7]">No Active Orders in Queue</h3>
          <p className="text-xs text-[#A8A29E] mt-1">
            New table orders will appear here automatically with audible and visual alerts.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map((order) => {
            const elapsed = getElapsedTime(order.created_at);
            const isDelayed = elapsed > 20;
            const isThisOrderRepeating = activeRepeatingAlert?.orderId === order.id;

            return (
              <div
                key={order.id}
                className={`flex flex-col justify-between rounded-2xl border bg-[#171717] p-4 shadow-xl transition-all ${
                  isThisOrderRepeating
                    ? "border-[#C96B6B] ring-2 ring-[#C96B6B]/50 bg-[#221616] animate-pulse"
                    : order.status === "PENDING"
                    ? "border-[#D6A34A]/50 ring-1 ring-[#D6A34A]/30 bg-[#1c1a17]"
                    : order.status === "READY"
                    ? "border-[#6FAF82]/40 bg-[#151c17]"
                    : isDelayed
                    ? "border-[#C96B6B]/40 bg-[#1c1616]"
                    : "border-[#242424]"
                }`}
              >
                <div>
                  {/* Card Header: Table + Time + Status */}
                  <div className="flex items-start justify-between pb-3 border-b border-[#242424]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-serif text-lg font-bold text-[#F6EFE7]">
                          {order.table?.table_number || "Table"}
                        </span>
                        <span className="text-[10px] font-mono text-[#A8A29E] bg-[#242424] px-1.5 py-0.5 rounded">
                          {order.order_number.slice(-9)}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#A8A29E] mt-0.5 block">
                        Guest: {order.customer_name || "Valued Guest"}
                      </span>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge status={order.status} />
                      <div
                        className={`flex items-center gap-1 text-[11px] font-mono font-medium ${
                          isDelayed ? "text-[#C96B6B] font-bold animate-pulse" : "text-[#A8A29E]"
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        <span>{elapsed}m ago</span>
                      </div>
                    </div>
                  </div>

                  {/* Repeating alert banner inside card */}
                  {isThisOrderRepeating && (
                    <div className="mt-2.5 p-2 rounded-lg bg-[#C96B6B]/25 border border-[#C96B6B]/50 flex items-center justify-between text-[11px] text-[#F6EFE7]">
                      <span className="flex items-center gap-1 text-[#DFB8AA] font-bold">
                        <BellRing className="w-3.5 h-3.5 animate-bounce" />
                        Alert Repeating
                      </span>
                      <button
                        onClick={() => acknowledgeRepeatingAlert(order.id)}
                        className="text-[10px] px-2 py-0.5 rounded bg-[#C96B6B] hover:bg-[#d87c7c] text-white font-semibold flex items-center gap-1"
                      >
                        <VolumeX className="w-3 h-3" />
                        <span>Silence</span>
                      </button>
                    </div>
                  )}

                  {/* Special Instructions Alert */}
                  {order.special_instructions && (
                    <div className="mt-2.5 p-2 rounded-lg bg-[#D6A34A]/10 border border-[#D6A34A]/30 text-[11px] text-[#D6A34A] leading-snug">
                      <span className="font-semibold uppercase tracking-wider block text-[9px]">
                        Guest Note:
                      </span>
                      {order.special_instructions}
                    </div>
                  )}

                  {/* Order Items List */}
                  <div className="mt-3 space-y-2.5 divide-y divide-[#242424]/60">
                    {order.items?.map((item) => (
                      <div key={item.id} className="pt-2 first:pt-0">
                        <div className="flex items-start justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#242424] text-[#D8B58A] font-bold flex items-center justify-center text-[11px]">
                              {item.quantity}
                            </span>
                            <span className="font-medium text-[#F6EFE7]">
                              {item.item_name}
                            </span>
                          </div>
                          {item.is_additional && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-[#C99A8A]/25 text-[#DFB8AA] font-bold border border-[#C99A8A]/50 animate-pulse">
                              + Additional Item
                            </span>
                          )}
                        </div>

                        {/* Customization Options */}
                        {item.options && item.options.length > 0 && (
                          <div className="mt-1 pl-7 flex flex-wrap gap-1">
                            {item.options.map((opt, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] bg-[#242424] px-1.5 py-0.5 rounded text-[#D8B58A]"
                              >
                                {opt.group_name}: {opt.option_name}
                              </span>
                            ))}
                          </div>
                        )}

                        {item.special_notes && (
                          <p className="mt-1 pl-7 text-[10px] text-[#A8A29E] italic">
                            "{item.special_notes}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="mt-5 pt-3 border-t border-[#242424] flex items-center gap-2">
                  {order.status === "PENDING" && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="text-[#C96B6B] hover:bg-[#C96B6B]/20"
                        onClick={() => handleUpdateStatus(order.id, "REJECTED")}
                        isLoading={loadingAction === `${order.id}-REJECTED`}
                      >
                        Reject
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        className="flex-1 font-bold"
                        onClick={() => handleUpdateStatus(order.id, "ACCEPTED")}
                        isLoading={loadingAction === `${order.id}-ACCEPTED`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Accept Order</span>
                      </Button>
                    </>
                  )}

                  {order.status === "ACCEPTED" && (
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full font-bold bg-gradient-to-r from-[#f59e0b] to-[#fbbf24] text-[#080808]"
                      onClick={() => handleUpdateStatus(order.id, "PREPARING")}
                      isLoading={loadingAction === `${order.id}-PREPARING`}
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Start Preparation</span>
                    </Button>
                  )}

                  {order.status === "PREPARING" && (
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full font-bold bg-gradient-to-r from-[#6FAF82] to-[#86efac] text-[#080808]"
                      onClick={() => handleUpdateStatus(order.id, "READY")}
                      isLoading={loadingAction === `${order.id}-READY`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Mark Ready for Pickup</span>
                    </Button>
                  )}

                  {order.status === "READY" && (
                    <div className="w-full text-center py-1 text-xs font-semibold text-[#6FAF82] flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Awaiting Server Pickup</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
