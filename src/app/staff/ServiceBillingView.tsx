"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  CafeTable,
  Order,
  Bill,
  ServiceRequest,
  Payment,
  MenuItem,
  CafeSettings,
  OrderStatus,
  SplitType,
  PaymentMethod,
} from "@/types/database.types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatFullDateTime } from "@/lib/utils";
import { useNotification } from "@/lib/audio/notification-context";
import { useSupabaseRealtime } from "@/lib/supabase/realtime";
import {
  LayoutDashboard,
  CheckCircle2,
  TableProperties,
  Utensils,
  Bell,
  Receipt,
  History,
  Plus,
  CreditCard,
  Split,
  Search,
  Check,
  Printer,
  X,
  AlertCircle,
} from "lucide-react";

interface ServiceBillingViewProps {
  initialTables: CafeTable[];
  initialOrders: Order[];
  initialBills: Bill[];
  initialServiceRequests: ServiceRequest[];
  initialPayments: Payment[];
  menuItems: MenuItem[];
  settings: CafeSettings;
}

export function ServiceBillingView({
  initialTables,
  initialOrders,
  initialBills,
  initialServiceRequests,
  initialPayments,
  menuItems,
  settings,
}: ServiceBillingViewProps) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "ready" | "tables" | "orders" | "service" | "bills" | "transactions"
  >("overview");

  const [tables, setTables] = useState<CafeTable[]>(initialTables);
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [bills, setBills] = useState<Bill[]>(initialBills);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>(initialServiceRequests);
  const [payments, setPayments] = useState<Payment[]>(initialPayments);

  // Modals state
  const [addItemOrderId, setAddItemOrderId] = useState<string | null>(null);
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<string>(menuItems[0]?.id || "");
  const [addItemQuantity, setAddItemQuantity] = useState<number>(1);
  const [addItemNotes, setAddItemNotes] = useState<string>("");
  const [isAddingItem, setIsAddingItem] = useState(false);

  // Settle bill modal
  const [settleBill, setSettleBill] = useState<Bill | null>(null);
  const [selectedSplitId, setSelectedSplitId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("UPI");
  const [isSettling, setIsSettling] = useState(false);

  // Split bill modal
  const [splitBillTarget, setSplitBillTarget] = useState<Bill | null>(null);
  const [splitCount, setSplitCount] = useState<number>(2);

  // Receipt Modal
  const [viewReceiptBill, setViewReceiptBill] = useState<Bill | null>(null);

  // Search filter
  const [searchFilter, setSearchFilter] = useState("");

  const { triggerSound } = useNotification();

  const knownReadyOrderIdsRef = useRef<Set<string>>(
    new Set(initialOrders.filter((o) => o.status === "READY").map((o) => o.id))
  );
  const knownServiceReqIdsRef = useRef<Set<string>>(
    new Set(initialServiceRequests.filter((r) => r.status === "PENDING").map((r) => r.id))
  );
  const knownBillReqIdsRef = useRef<Set<string>>(
    new Set(initialBills.filter((b) => b.status === "REQUESTED").map((b) => b.id))
  );
  const knownPaidBillIdsRef = useRef<Set<string>>(
    new Set(initialBills.filter((b) => b.status === "PAID").map((b) => b.id))
  );

  // Fetch latest staff data with sound alerts and deduplication
  const fetchStaffData = useCallback(async () => {
    try {
      const [resOrders, resBills, resReqs, resTables] = await Promise.all([
        fetch("/api/orders"),
        fetch("/api/bills"),
        fetch("/api/service-requests"),
        fetch("/api/tables"),
      ]);

      if (resOrders.ok) {
        const freshOrders = await resOrders.json();
        for (const fo of freshOrders) {
          if (fo.status === "READY" && !knownReadyOrderIdsRef.current.has(fo.id)) {
            knownReadyOrderIdsRef.current.add(fo.id);
            triggerSound("order_ready", {
              eventId: `ready_${fo.id}`,
              title: "Order Ready to Serve!",
              message: `${fo.table?.table_number || "Table"} — #${fo.order_number}`,
            });
          }
        }
        setOrders(freshOrders);
      }

      if (resBills.ok) {
        const freshBills = await resBills.json();
        for (const fb of freshBills) {
          if (fb.status === "REQUESTED" && !knownBillReqIdsRef.current.has(fb.id)) {
            knownBillReqIdsRef.current.add(fb.id);
            triggerSound("bill_requested", {
              eventId: `bill_req_${fb.id}`,
              title: "Bill Requested",
              message: `${fb.table?.table_number || "Table"} requested bill #${fb.bill_number}`,
            });
          } else if (fb.status === "PAID" && !knownPaidBillIdsRef.current.has(fb.id)) {
            knownPaidBillIdsRef.current.add(fb.id);
            triggerSound("payment_confirmed", {
              eventId: `pay_${fb.id}`,
              title: "Payment Settled",
              message: `${fb.table?.table_number || "Table"}: ${formatCurrency(fb.final_total)} settled`,
            });
          }
        }
        setBills(freshBills);
      }

      if (resReqs.ok) {
        const freshReqs = await resReqs.json();
        for (const fr of freshReqs) {
          if (fr.status === "PENDING" && !knownServiceReqIdsRef.current.has(fr.id)) {
            knownServiceReqIdsRef.current.add(fr.id);
            triggerSound("service_request", {
              eventId: `sr_${fr.id}`,
              title: "Service Assistance Call",
              message: `${fr.table?.table_number || "Table"} requests ${fr.request_type}`,
            });
          }
        }
        setServiceRequests(freshReqs);
      }

      if (resTables.ok) setTables(await resTables.json());
    } catch {
      // Ignore
    }
  }, [triggerSound]);

  // Realtime subscriptions across key operational tables
  useSupabaseRealtime({ table: "orders", onEvent: fetchStaffData });
  useSupabaseRealtime({ table: "bills", onEvent: fetchStaffData });
  useSupabaseRealtime({ table: "service_requests", onEvent: fetchStaffData });

  // Live polling for staff updates (fallback and reconciliation)
  useEffect(() => {
    fetchStaffData();
    const interval = setInterval(fetchStaffData, 3500);
    return () => clearInterval(interval);
  }, [fetchStaffData]);

  // Mark order served
  const handleMarkServed = async (orderId: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "SERVED",
          actorType: "STAFF",
          actorId: "user-staff-01",
          notes: "Served to table by floor staff",
        }),
      });
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: "SERVED" } : o))
        );
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(`Failed to update order: ${errorData.error || "Order update failed"}`);
      }
    } catch (err: any) {
      console.error("[Service Billing] Error updating order:", err);
      alert("Network error: Failed to update order status.");
    }
  };

  // Add additional item
  const handleConfirmAddItem = async () => {
    if (!addItemOrderId || !selectedMenuItemId) return;
    setIsAddingItem(true);
    try {
      const res = await fetch(`/api/orders/${addItemOrderId}/additional-item`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: addItemOrderId,
          menuItemId: selectedMenuItemId,
          quantity: addItemQuantity,
          specialNotes: addItemNotes,
          staffId: "user-staff-01",
        }),
      });

      if (res.ok) {
        const updatedOrder = await res.json();
        setOrders((prev) =>
          prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
        );
        setAddItemOrderId(null);
        setAddItemNotes("");
        setAddItemQuantity(1);
      }
    } catch {
      // Ignore
    } finally {
      setIsAddingItem(false);
    }
  };

  // Compute accurate outstanding balance on a bill
  const getBillOutstandingBalance = useCallback(
    (targetBill: Bill): number => {
      if (targetBill.status === "PAID") return 0;

      // If EQUAL split bill with defined splits, sum pending splits
      if (targetBill.split_type === "EQUAL" && targetBill.splits && targetBill.splits.length > 0) {
        const pendingAmount = targetBill.splits
          .filter((s) => s.payment_status === "PENDING")
          .reduce((sum, s) => sum + Number(s.assigned_amount || 0), 0);
        return Math.max(0, Math.round(pendingAmount * 100) / 100);
      }

      // Check completed payments tracked for this bill
      const billPayments = payments.filter(
        (p) => p.bill_id === targetBill.id && p.status === "COMPLETED"
      );
      if (billPayments.length > 0) {
        const paidSum = billPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        const rem = Number(targetBill.final_total || 0) - paidSum;
        return Math.max(0, Math.round(rem * 100) / 100);
      }

      return Math.max(0, Number(targetBill.final_total || 0));
    },
    [payments]
  );

  // Generate Bill
  const handleGenerateBill = async (tableId: string, orderId?: string) => {
    try {
      const table = tables.find((t) => t.id === tableId);
      // Resolve active order for table if not provided
      const resolvedOrderId =
        orderId ||
        orders.find(
          (o) =>
            o.table_id === tableId &&
            o.status !== "CANCELLED" &&
            o.status !== "REJECTED" &&
            o.status !== "COMPLETED"
        )?.id;

      const res = await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: resolvedOrderId,
          tableId,
          sessionId: table?.current_session_id || "sess-01",
        }),
      });
      if (res.ok) {
        const newBill = await res.json();
        setBills((prev) => [newBill, ...prev.filter((b) => b.id !== newBill.id)]);
        setActiveTab("bills");
      }
    } catch {
      // Ignore
    }
  };

  // Settle Bill Payment
  const handleSettlePayment = async () => {
    if (!settleBill) return;

    const outstanding = getBillOutstandingBalance(settleBill);
    let amountToPay = outstanding;
    let splitIndex: number | undefined = undefined;

    if (settleBill.split_type === "EQUAL" && settleBill.splits && selectedSplitId) {
      const sp = settleBill.splits.find((s) => s.id === selectedSplitId);
      if (sp) {
        amountToPay = Number(sp.assigned_amount || 0);
        splitIndex = sp.split_index;
      }
    }

    if (!amountToPay || amountToPay <= 0) {
      alert("Payment amount must be greater than 0. This bill has no remaining balance.");
      return;
    }

    setIsSettling(true);
    try {
      const res = await fetch(`/api/bills/${settleBill.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billId: settleBill.id,
          amount: amountToPay,
          paymentMethod,
          splitIndex,
          recordedBy: "user-staff-01",
        }),
      });

      if (res.ok) {
        const result = await res.json();
        const updatedBill: Bill = result.bill || settleBill;

        if (updatedBill.status === "PAID") {
          knownPaidBillIdsRef.current.add(settleBill.id);
          triggerSound("payment_confirmed", {
            eventId: `pay_settled_${settleBill.id}`,
            title: "Payment Received & Settled",
            message: `${settleBill.table?.table_number || "Table"}: ${formatCurrency(amountToPay)} received via ${paymentMethod}`,
          });
        }

        setBills((prev) =>
          prev.map((b) => (b.id === settleBill.id ? updatedBill : b))
        );
        if (result.payment) {
          setPayments((prev) => [result.payment, ...prev]);
        }
        if (updatedBill.status === "PAID") {
          setViewReceiptBill(updatedBill);
        }
        setSettleBill(null);
        setSelectedSplitId(null);
      } else {
        const errorData = await res.json().catch(() => ({}));
        const msg = errorData.error || "Failed to record payment";
        console.error("[Service Billing] Payment recording failed:", msg);
        alert(`Payment Failed: ${msg}`);
      }
    } catch (err: any) {
      console.error("[Service Billing] Network error during payment:", err);
      alert("Network error: Unable to connect to payment service. Please try again.");
    } finally {
      setIsSettling(false);
    }
  };

  // Split bill
  const handleApplySplit = async () => {
    if (!splitBillTarget) return;
    try {
      const res = await fetch(`/api/bills/${splitBillTarget.id}/split`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billId: splitBillTarget.id,
          splitType: "EQUAL",
          splitCount,
        }),
      });

      if (res.ok) {
        const updatedBill = await res.json();
        setBills((prev) =>
          prev.map((b) => (b.id === updatedBill.id ? updatedBill : b))
        );
        setSplitBillTarget(null);
      }
    } catch {
      // Ignore
    }
  };

  // Resolve Service Request
  const handleResolveRequest = async (reqId: string) => {
    try {
      const res = await fetch(`/api/service-requests/${reqId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      if (res.ok) {
        setServiceRequests((prev) =>
          prev.map((r) => (r.id === reqId ? { ...r, status: "COMPLETED" } : r))
        );
      }
    } catch {
      // Ignore
    }
  };

  // Filtered Ready orders
  const readyOrders = orders.filter((o) => o.status === "READY");
  const pendingRequests = serviceRequests.filter((r) => r.status === "PENDING");
  const billRequests = bills.filter((b) => b.status === "REQUESTED");
  const occupiedTables = tables.filter((t) => t.status !== "AVAILABLE" && t.status !== "CLEANING");

  const todaySettledRevenue = bills
    .filter((b) => b.status === "PAID")
    .reduce((sum, b) => sum + b.final_total, 0);

  return (
    <div className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6">
      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-[#242424] mb-6 scrollbar-none">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === "overview"
              ? "bg-[#C99A8A]/20 border border-[#C99A8A]/40 text-[#DFB8AA]"
              : "text-[#A8A29E] hover:text-[#F6EFE7] hover:bg-[#171717]"
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Floor Overview</span>
        </button>

        <button
          onClick={() => setActiveTab("ready")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === "ready"
              ? "bg-[#6FAF82]/20 border border-[#6FAF82]/40 text-[#6FAF82]"
              : "text-[#A8A29E] hover:text-[#F6EFE7] hover:bg-[#171717]"
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Ready to Serve</span>
          {readyOrders.length > 0 && (
            <span className="w-4 h-4 rounded-full bg-[#6FAF82] text-[#080808] text-[10px] font-bold flex items-center justify-center">
              {readyOrders.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("tables")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === "tables"
              ? "bg-[#D8B58A]/20 border border-[#D8B58A]/40 text-[#D8B58A]"
              : "text-[#A8A29E] hover:text-[#F6EFE7] hover:bg-[#171717]"
          }`}
        >
          <TableProperties className="w-4 h-4" />
          <span>Active Tables</span>
          <span className="text-[10px] text-[#A8A29E]">({occupiedTables.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("orders")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === "orders"
              ? "bg-[#C99A8A]/20 border border-[#C99A8A]/40 text-[#DFB8AA]"
              : "text-[#A8A29E] hover:text-[#F6EFE7] hover:bg-[#171717]"
          }`}
        >
          <Utensils className="w-4 h-4" />
          <span>All Orders</span>
        </button>

        <button
          onClick={() => setActiveTab("service")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === "service"
              ? "bg-[#D6A34A]/20 border border-[#D6A34A]/40 text-[#D6A34A]"
              : "text-[#A8A29E] hover:text-[#F6EFE7] hover:bg-[#171717]"
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Service Calls</span>
          {pendingRequests.length > 0 && (
            <span className="w-4 h-4 rounded-full bg-[#D6A34A] text-[#080808] text-[10px] font-bold flex items-center justify-center">
              {pendingRequests.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("bills")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === "bills"
              ? "bg-[#D8B58A]/20 border border-[#D8B58A]/40 text-[#D8B58A]"
              : "text-[#A8A29E] hover:text-[#F6EFE7] hover:bg-[#171717]"
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Bills & Settlement</span>
          {billRequests.length > 0 && (
            <span className="w-4 h-4 rounded-full bg-[#C99A8A] text-[#080808] text-[10px] font-bold flex items-center justify-center">
              {billRequests.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("transactions")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === "transactions"
              ? "bg-[#242424] border border-[#3e3e3e] text-[#F6EFE7]"
              : "text-[#A8A29E] hover:text-[#F6EFE7] hover:bg-[#171717]"
          }`}
        >
          <History className="w-4 h-4" />
          <span>History</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              onClick={() => setActiveTab("ready")}
              className="p-5 rounded-2xl border border-[#6FAF82]/30 bg-[#171717]/80 hover:bg-[#1f1f1f] cursor-pointer transition-all shadow-lg"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-medium text-[#A8A29E]">Ready to Serve</span>
                <CheckCircle2 className="w-4 h-4 text-[#6FAF82]" />
              </div>
              <div className="mt-2 text-2xl font-serif font-bold text-[#6FAF82]">
                {readyOrders.length}
              </div>
              <p className="text-[11px] text-[#A8A29E] mt-1">Plated and awaiting delivery</p>
            </div>

            <div
              onClick={() => setActiveTab("tables")}
              className="p-5 rounded-2xl border border-[#C99A8A]/30 bg-[#171717]/80 hover:bg-[#1f1f1f] cursor-pointer transition-all shadow-lg"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-medium text-[#A8A29E]">Active Occupied Tables</span>
                <TableProperties className="w-4 h-4 text-[#D8B58A]" />
              </div>
              <div className="mt-2 text-2xl font-serif font-bold text-[#F6EFE7]">
                {occupiedTables.length} / {tables.length}
              </div>
              <p className="text-[11px] text-[#A8A29E] mt-1">Currently dining guests</p>
            </div>

            <div
              onClick={() => setActiveTab("bills")}
              className="p-5 rounded-2xl border border-[#D6A34A]/30 bg-[#171717]/80 hover:bg-[#1f1f1f] cursor-pointer transition-all shadow-lg"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-medium text-[#A8A29E]">Bill Requests</span>
                <Receipt className="w-4 h-4 text-[#D6A34A]" />
              </div>
              <div className="mt-2 text-2xl font-serif font-bold text-[#D6A34A]">
                {billRequests.length}
              </div>
              <p className="text-[11px] text-[#A8A29E] mt-1">Awaiting bill settlement</p>
            </div>

            <div
              onClick={() => setActiveTab("transactions")}
              className="p-5 rounded-2xl border border-[#242424] bg-[#171717]/80 hover:bg-[#1f1f1f] cursor-pointer transition-all shadow-lg"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-medium text-[#A8A29E]">Settled Collections</span>
                <CreditCard className="w-4 h-4 text-[#D8B58A]" />
              </div>
              <div className="mt-2 text-2xl font-serif font-bold text-[#D8B58A]">
                {formatCurrency(todaySettledRevenue)}
              </div>
              <p className="text-[11px] text-[#A8A29E] mt-1">Total revenue collected today</p>
            </div>
          </div>

          {/* Quick Action Ready List in Overview */}
          {readyOrders.length > 0 && (
            <div className="p-5 rounded-2xl border border-[#6FAF82]/30 bg-[#151c17] shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-[#6FAF82]">
                  <CheckCircle2 className="w-5 h-5" />
                  <h3 className="font-serif font-bold text-base">
                    Orders Ready for Delivery ({readyOrders.length})
                  </h3>
                </div>
                <Button size="sm" variant="outline" onClick={() => setActiveTab("ready")}>
                  View All
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {readyOrders.slice(0, 4).map((order) => (
                  <div
                    key={order.id}
                    className="p-3.5 rounded-xl border border-[#242424] bg-[#171717] flex items-center justify-between gap-3"
                  >
                    <div>
                      <span className="font-serif text-sm font-bold text-[#F6EFE7]">
                        {order.table?.table_number || "Table"}
                      </span>
                      <span className="text-xs text-[#A8A29E] block">
                        {order.items?.length || 0} dishes ready
                      </span>
                    </div>

                    <Button
                      size="sm"
                      variant="primary"
                      className="bg-gradient-to-r from-[#6FAF82] to-[#86efac] text-[#080808]"
                      onClick={() => handleMarkServed(order.id)}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Mark Served</span>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: READY TO SERVE */}
      {activeTab === "ready" && (
        <div className="space-y-4">
          <h2 className="font-serif text-lg font-medium text-[#F6EFE7]">
            Kitchen Dispatch — Ready to Serve Queue
          </h2>

          {readyOrders.length === 0 ? (
            <div className="py-20 text-center border border-[#242424] rounded-2xl bg-[#171717]/40 text-[#A8A29E] text-xs">
              No orders waiting to be served right now. The kitchen queue is clear!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {readyOrders.map((order) => (
                <div
                  key={order.id}
                  className="p-4 rounded-2xl border border-[#6FAF82]/40 bg-[#171717] shadow-xl flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-[#242424]">
                      <div>
                        <span className="font-serif text-base font-bold text-[#F6EFE7]">
                          {order.table?.table_number || "Table"}
                        </span>
                        <span className="text-[10px] text-[#A8A29E] block font-mono">
                          {order.order_number}
                        </span>
                      </div>
                      <StatusBadge status="READY" />
                    </div>

                    <div className="mt-3 space-y-1 text-xs">
                      {order.items?.map((item) => (
                        <div key={item.id} className="flex justify-between py-0.5">
                          <span>
                            {item.quantity}x {item.item_name}
                          </span>
                          <span className="text-[#A8A29E]">
                            {formatCurrency(item.item_total)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-[#242424]">
                    <Button
                      variant="primary"
                      className="w-full py-2.5 font-bold bg-gradient-to-r from-[#6FAF82] to-[#86efac] text-[#080808]"
                      onClick={() => handleMarkServed(order.id)}
                    >
                      <Check className="w-4 h-4" />
                      <span>Deliver & Mark Served</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ACTIVE TABLES FLOOR MAP */}
      {activeTab === "tables" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-medium text-[#F6EFE7]">
              Café Floor Map & Table Status
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {tables.map((table) => {
              const tableOrder = orders.find(
                (o) =>
                  o.table_id === table.id &&
                  o.status !== "COMPLETED" &&
                  o.status !== "CANCELLED" &&
                  o.status !== "REJECTED"
              );

              return (
                <div
                  key={table.id}
                  className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                    table.status === "OCCUPIED"
                      ? "border-[#f59e0b]/40 bg-[#1c1a17]"
                      : table.status === "BILL_REQUESTED"
                      ? "border-[#C99A8A]/50 bg-[#1f1917]"
                      : table.status === "PAID"
                      ? "border-[#6FAF82]/40 bg-[#151c17]"
                      : "border-[#242424] bg-[#171717]/60"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-serif font-bold text-sm text-[#F6EFE7]">
                        {table.table_number}
                      </span>
                      <span className="text-[10px] text-[#A8A29E]">
                        {table.capacity}p
                      </span>
                    </div>

                    <StatusBadge status={table.status} type="table" />

                    {tableOrder && (
                      <div className="mt-2 text-[10px] text-[#D8B58A] line-clamp-1 font-medium">
                        Order #{tableOrder.order_number.slice(-4)} · {formatCurrency(tableOrder.total)}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-2 border-t border-[#242424]/60 flex flex-col gap-1">
                    {table.status !== "AVAILABLE" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="text-[10px] py-1 h-auto"
                        onClick={() => handleGenerateBill(table.id, tableOrder?.id)}
                      >
                        Generate Bill
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: ALL ORDERS & ADD ITEMS */}
      {activeTab === "orders" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <h2 className="font-serif text-lg font-medium text-[#F6EFE7]">
              Order Management & Additional Item Entry
            </h2>
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#A8A29E]" />
              <input
                type="text"
                placeholder="Search order or table..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#171717] border border-[#242424] text-xs text-[#F6EFE7] placeholder-[#A8A29E]/50 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-3">
            {orders
              .filter(
                (o) =>
                  !searchFilter ||
                  o.order_number.toLowerCase().includes(searchFilter.toLowerCase()) ||
                  o.table?.table_number?.toLowerCase().includes(searchFilter.toLowerCase()) ||
                  o.customer_name?.toLowerCase().includes(searchFilter.toLowerCase())
              )
              .slice(0, 15)
              .map((order) => (
                <div
                  key={order.id}
                  className="p-4 rounded-xl border border-[#242424] bg-[#171717]/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-serif font-bold text-sm text-[#F6EFE7]">
                        {order.table?.table_number || "Table"}
                      </span>
                      <span className="text-xs font-mono text-[#D8B58A]">
                        {order.order_number}
                      </span>
                      <StatusBadge status={order.status} />
                    </div>

                    <div className="mt-1 flex items-center gap-3 text-xs text-[#A8A29E]">
                      <span>Guest: {order.customer_name || "Valued Guest"}</span>
                      <span>·</span>
                      <span>Total: {formatCurrency(order.total)}</span>
                      <span>·</span>
                      <span>{order.items?.length || 0} items</span>
                    </div>

                    {/* Display item list preview */}
                    <div className="mt-2 text-[11px] text-[#A8A29E]/80 flex flex-wrap gap-1.5">
                      {order.items?.map((item) => (
                        <span
                          key={item.id}
                          className={`px-1.5 py-0.5 rounded ${
                            item.is_additional ? "bg-[#C99A8A]/20 text-[#DFB8AA]" : "bg-[#242424]"
                          }`}
                        >
                          {item.quantity}x {item.item_name}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-auto">
                    {order.status !== "COMPLETED" && order.status !== "CANCELLED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAddItemOrderId(order.id)}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Item</span>
                      </Button>
                    )}

                    {order.status === "READY" && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleMarkServed(order.id)}
                      >
                        Mark Served
                      </Button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* TAB 5: SERVICE CALLS */}
      {activeTab === "service" && (
        <div className="space-y-4">
          <h2 className="font-serif text-lg font-medium text-[#F6EFE7]">
            Active Customer Service Inquiries
          </h2>

          {serviceRequests.length === 0 ? (
            <div className="py-20 text-center border border-[#242424] rounded-2xl bg-[#171717]/40 text-[#A8A29E] text-xs">
              No outstanding service calls.
            </div>
          ) : (
            <div className="space-y-3">
              {serviceRequests.map((req) => (
                <div
                  key={req.id}
                  className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
                    req.status === "PENDING"
                      ? "border-[#D6A34A]/40 bg-[#1c1a17]"
                      : "border-[#242424] bg-[#171717]/50"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-serif font-bold text-sm text-[#F6EFE7]">
                        {req.table?.table_number || "Table"}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#242424] text-[#D8B58A]">
                        {req.request_type}
                      </span>
                      <StatusBadge status={req.status} />
                    </div>
                    {req.notes && (
                      <p className="text-xs text-[#A8A29E] mt-1">{req.notes}</p>
                    )}
                    <span className="text-[10px] text-[#A8A29E]/60 mt-0.5 block">
                      {formatFullDateTime(req.created_at)}
                    </span>
                  </div>

                  {req.status === "PENDING" && (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleResolveRequest(req.id)}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Resolve</span>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: BILLS & SETTLEMENT */}
      {activeTab === "bills" && (
        <div className="space-y-4">
          <h2 className="font-serif text-lg font-medium text-[#F6EFE7]">
            Bills & Payment Processing
          </h2>

          <div className="space-y-3">
            {bills.map((bill) => (
              <div
                key={bill.id}
                className="p-4 rounded-xl border border-[#242424] bg-[#171717] flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-serif font-bold text-sm text-[#F6EFE7]">
                      {bill.table?.table_number || "Table"}
                    </span>
                    <span className="font-mono text-xs text-[#D8B58A]">
                      {bill.bill_number}
                    </span>
                    <StatusBadge status={bill.status} type="bill" />
                  </div>

                  <div className="mt-1 flex items-center gap-3 text-xs text-[#A8A29E]">
                    <span>Subtotal: {formatCurrency(bill.subtotal)}</span>
                    <span>·</span>
                    <span>GST ({settings.tax_rate}%): {formatCurrency(bill.tax)}</span>
                    <span>·</span>
                    <span className="font-bold text-[#F6EFE7]">
                      Final Total: {formatCurrency(bill.final_total)}
                    </span>
                  </div>

                  {bill.split_type === "EQUAL" && bill.splits && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {bill.splits.map((sp) => (
                        <span
                          key={sp.id}
                          className={`text-[10px] px-2 py-0.5 rounded border ${
                            sp.payment_status === "PAID"
                              ? "bg-[#6FAF82]/20 border-[#6FAF82]/40 text-[#6FAF82]"
                              : "bg-[#242424] border-[#333] text-[#A8A29E]"
                          }`}
                        >
                          {sp.person_label}: {formatCurrency(sp.assigned_amount)} (
                          {sp.payment_status})
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end md:self-auto">
                  {bill.status !== "PAID" && (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setSplitBillTarget(bill)}
                      >
                        <Split className="w-3.5 h-3.5" />
                        <span>Split Bill</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => setSettleBill(bill)}
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Record Payment</span>
                      </Button>
                    </>
                  )}

                  {bill.status === "PAID" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setViewReceiptBill(bill)}
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Receipt</span>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: TRANSACTION HISTORY */}
      {activeTab === "transactions" && (
        <div className="space-y-4">
          <h2 className="font-serif text-lg font-medium text-[#F6EFE7]">
            Settled Transaction History
          </h2>

          <div className="p-4 rounded-2xl border border-[#242424] bg-[#171717] overflow-x-auto">
            <table className="w-full text-left text-xs text-[#A8A29E]">
              <thead className="border-b border-[#242424] text-[10px] uppercase tracking-wider text-[#D8B58A]">
                <tr>
                  <th className="py-2.5 px-3">Transaction Ref</th>
                  <th className="py-2.5 px-3">Bill Number</th>
                  <th className="py-2.5 px-3">Method</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242424]/60">
                {payments.slice(0, 20).map((pay) => (
                  <tr key={pay.id} className="hover:bg-[#242424]/40">
                    <td className="py-2.5 px-3 font-mono text-[#F6EFE7]">
                      {pay.transaction_ref || pay.id.slice(0, 12)}
                    </td>
                    <td className="py-2.5 px-3 font-mono">{pay.bill_id.slice(0, 12)}</td>
                    <td className="py-2.5 px-3 font-semibold text-[#DFB8AA]">
                      {pay.payment_method}
                    </td>
                    <td className="py-2.5 px-3 font-serif font-bold text-[#F6EFE7]">
                      {formatCurrency(pay.amount)}
                    </td>
                    <td className="py-2.5 px-3">{formatFullDateTime(pay.created_at)}</td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={pay.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: ADD ADDITIONAL ITEM */}
      {addItemOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-[#C99A8A]/30 bg-[#171717] p-5 shadow-2xl text-[#F6EFE7]">
            <div className="flex items-center justify-between pb-3 border-b border-[#242424]">
              <h3 className="font-serif font-medium text-base text-[#F6EFE7]">
                Add Additional Item to Order
              </h3>
              <button
                onClick={() => setAddItemOrderId(null)}
                className="text-[#A8A29E] hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-3">
              <div>
                <label className="text-xs text-[#A8A29E] block mb-1">Select Menu Item</label>
                <select
                  value={selectedMenuItemId}
                  onChange={(e) => setSelectedMenuItemId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#080808] border border-[#242424] text-xs text-[#F6EFE7] focus:outline-none"
                >
                  {menuItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} — {formatCurrency(item.price)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-[#A8A29E] block mb-1">Quantity</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={addItemQuantity}
                  onChange={(e) => setAddItemQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 rounded-lg bg-[#080808] border border-[#242424] text-xs text-[#F6EFE7] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-[#A8A29E] block mb-1">Special Notes</label>
                <textarea
                  value={addItemNotes}
                  onChange={(e) => setAddItemNotes(e.target.value)}
                  placeholder="e.g. Extra napkins, less sugar..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-[#080808] border border-[#242424] text-xs text-[#F6EFE7] focus:outline-none resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setAddItemOrderId(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleConfirmAddItem}
                  isLoading={isAddingItem}
                >
                  Commit Additional Item
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SETTLE PAYMENT */}
      {settleBill && (() => {
        const outstanding = getBillOutstandingBalance(settleBill);
        const selectedSplit = settleBill.splits?.find((s) => s.id === selectedSplitId);
        const currentAmountToPay = selectedSplit
          ? Number(selectedSplit.assigned_amount || 0)
          : outstanding;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-sm rounded-2xl border border-[#C99A8A]/30 bg-[#171717] p-5 shadow-2xl text-[#F6EFE7]">
              <div className="flex items-center justify-between pb-3 border-b border-[#242424]">
                <h3 className="font-serif font-medium text-base text-[#F6EFE7]">
                  Record Payment Settlement
                </h3>
                <button
                  onClick={() => {
                    setSettleBill(null);
                    setSelectedSplitId(null);
                  }}
                  className="text-[#A8A29E] hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="py-4 space-y-3">
                <div className="p-3.5 rounded-xl bg-[#080808] border border-[#242424] space-y-1.5 text-center">
                  <div className="flex justify-between text-xs text-[#A8A29E]">
                    <span>Total Bill:</span>
                    <span>{formatCurrency(settleBill.final_total)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-[#A8A29E]">
                    <span>Outstanding Balance:</span>
                    <span className="font-semibold text-[#D8B58A]">{formatCurrency(outstanding)}</span>
                  </div>
                  <div className="pt-2 border-t border-[#242424]">
                    <span className="text-[10px] text-[#A8A29E] uppercase tracking-wider block">
                      Amount to Collect
                    </span>
                    <span className="font-serif text-2xl font-bold text-[#6FAF82]">
                      {formatCurrency(currentAmountToPay)}
                    </span>
                  </div>
                </div>

                {/* Split selection if EQUAL split */}
                {settleBill.split_type === "EQUAL" && settleBill.splits && settleBill.splits.length > 0 && (
                  <div>
                    <label className="text-xs text-[#A8A29E] block mb-1.5">Select Settlement Target</label>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      <button
                        type="button"
                        onClick={() => setSelectedSplitId(null)}
                        className={`w-full p-2 rounded-lg border text-xs text-left flex items-center justify-between transition-all ${
                          selectedSplitId === null
                            ? "bg-[#D8B58A]/20 border-[#D8B58A] text-[#F6EFE7] font-semibold"
                            : "bg-[#080808] border-[#242424] text-[#A8A29E]"
                        }`}
                      >
                        <span>Settle All Remaining ({formatCurrency(outstanding)})</span>
                        <Check className={`w-3.5 h-3.5 ${selectedSplitId === null ? "opacity-100 text-[#D8B58A]" : "opacity-0"}`} />
                      </button>

                      {settleBill.splits.map((sp) => (
                        <button
                          key={sp.id}
                          type="button"
                          disabled={sp.payment_status === "PAID"}
                          onClick={() => setSelectedSplitId(sp.id)}
                          className={`w-full p-2 rounded-lg border text-xs text-left flex items-center justify-between transition-all ${
                            sp.payment_status === "PAID"
                              ? "opacity-40 cursor-not-allowed bg-[#111] border-[#222] text-[#6FAF82]"
                              : selectedSplitId === sp.id
                              ? "bg-[#D8B58A]/20 border-[#D8B58A] text-[#F6EFE7] font-semibold"
                              : "bg-[#080808] border-[#242424] text-[#A8A29E]"
                          }`}
                        >
                          <span>{sp.person_label} ({formatCurrency(sp.assigned_amount)})</span>
                          <span className={`text-[10px] uppercase font-bold ${sp.payment_status === "PAID" ? "text-[#6FAF82]" : "text-[#D6A34A]"}`}>
                            {sp.payment_status}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs text-[#A8A29E] block mb-1.5">Payment Method</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["UPI", "CARD", "CASH", "ONLINE"] as PaymentMethod[]).map((method) => (
                      <button
                        key={method}
                        onClick={() => setPaymentMethod(method)}
                        className={`p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                          paymentMethod === method
                            ? "bg-[#C99A8A]/20 border-[#C99A8A] text-[#DFB8AA]"
                            : "bg-[#080808] border-[#242424] text-[#A8A29E]"
                        }`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  variant="primary"
                  className="w-full py-2.5 mt-3 font-bold"
                  onClick={handleSettlePayment}
                  isLoading={isSettling}
                  disabled={currentAmountToPay <= 0 || isSettling}
                >
                  {currentAmountToPay <= 0
                    ? "Bill Already Settled"
                    : `Confirm Settle Payment (${formatCurrency(currentAmountToPay)})`}
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: SPLIT BILL */}
      {splitBillTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-[#C99A8A]/30 bg-[#171717] p-5 shadow-2xl text-[#F6EFE7]">
            <div className="flex items-center justify-between pb-3 border-b border-[#242424]">
              <h3 className="font-serif font-medium text-base text-[#F6EFE7]">
                Equal Bill Split
              </h3>
              <button
                onClick={() => setSplitBillTarget(null)}
                className="text-[#A8A29E] hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-3">
              <p className="text-xs text-[#A8A29E]">
                Split total of{" "}
                <span className="font-bold text-[#F6EFE7]">
                  {formatCurrency(splitBillTarget.final_total)}
                </span>{" "}
                equally among guests.
              </p>

              <div>
                <label className="text-xs text-[#A8A29E] block mb-1">
                  Number of Guests
                </label>
                <div className="flex items-center gap-3 bg-[#080808] border border-[#242424] rounded-lg p-2 justify-center">
                  {[2, 3, 4, 5, 6].map((num) => (
                    <button
                      key={num}
                      onClick={() => setSplitCount(num)}
                      className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${
                        splitCount === num
                          ? "bg-gradient-to-r from-[#C99A8A] to-[#D8B58A] text-[#080808]"
                          : "text-[#A8A29E] hover:text-[#F6EFE7]"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#242424]/40 text-center text-xs">
                <span>Per person: </span>
                <span className="font-bold text-[#D8B58A]">
                  {formatCurrency(splitBillTarget.final_total / splitCount)}
                </span>
              </div>

              <Button variant="primary" className="w-full mt-2" onClick={handleApplySplit}>
                Generate Equal Splits
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RECEIPT PREVIEW */}
      {viewReceiptBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-[#242424] bg-[#0d0d0d] p-6 shadow-2xl text-[#F6EFE7] font-mono text-xs">
            <div className="text-center pb-4 border-b border-dashed border-[#333]">
              <h2 className="font-serif text-lg font-bold text-[#F6EFE7]">
                VELVET BLOOM CAFÉ
              </h2>
              <p className="text-[10px] text-[#A8A29E]">Sip. Savor. Bloom.</p>
              <p className="text-[9px] text-[#A8A29E]/60 mt-1">Powered by Kage Origin</p>
            </div>

            <div className="py-3 border-b border-dashed border-[#333] space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span>Bill #:</span>
                <span className="text-[#F6EFE7]">{viewReceiptBill.bill_number}</span>
              </div>
              <div className="flex justify-between">
                <span>Table:</span>
                <span className="text-[#F6EFE7]">
                  {viewReceiptBill.table?.table_number || "Table"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{new Date(viewReceiptBill.updated_at).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="py-3 border-b border-dashed border-[#333] space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatCurrency(viewReceiptBill.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>GST ({settings.tax_rate}%):</span>
                <span>{formatCurrency(viewReceiptBill.tax)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-[#D8B58A] pt-1">
                <span>PAID TOTAL:</span>
                <span>{formatCurrency(viewReceiptBill.final_total)}</span>
              </div>
            </div>

            <div className="text-center pt-4">
              <span className="px-3 py-1 rounded bg-[#6FAF82]/20 text-[#6FAF82] text-[10px] font-bold uppercase tracking-widest inline-block">
                PAID & SETTLED
              </span>
              <p className="text-[10px] text-[#A8A29E] mt-3">Thank you for visiting us!</p>
            </div>

            <Button
              variant="secondary"
              className="w-full mt-4 text-xs"
              onClick={() => setViewReceiptBill(null)}
            >
              Close Receipt
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

