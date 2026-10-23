"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  LiveDashboardKPIs,
  Rolling15DayAnalytics,
  MenuItem,
  Category,
  CafeTable,
  User,
  CafeSettings,
} from "@/types/database.types";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  TrendingUp,
  Receipt,
  Users,
  Coffee,
  TableProperties,
  Settings,
  Sparkles,
  Clock,
  AlertTriangle,
  AlertCircle,
  QrCode,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Volume2,
  VolumeX,
  Play,
  Upload,
  Trash2,
  Sliders,
} from "lucide-react";
import { useNotification } from "@/lib/audio/notification-context";
import { SoundEventType, SOUND_EVENT_LABELS } from "@/lib/audio/sound-types";

interface AdminDashboardViewProps {
  initialKPIs: LiveDashboardKPIs;
  analytics: Rolling15DayAnalytics;
  menuItems: MenuItem[];
  categories: Category[];
  tables: CafeTable[];
  users: User[];
  settings: CafeSettings;
}

export function AdminDashboardView({
  initialKPIs,
  analytics,
  menuItems: initialMenuItems,
  categories,
  tables: initialTables,
  users,
  settings: initialSettings,
}: AdminDashboardViewProps) {
  const [activeTab, setActiveTab] = useState<
    "analytics" | "menu" | "tables" | "staff" | "sounds" | "settings"
  >("analytics");

  const {
    settings: audioSettings,
    updateSettings: updateAudioSettings,
    testSound,
    uploadCustomSound,
    removeCustomSound,
    unlockAudio,
  } = useNotification();

  const [testingType, setTestingType] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const [menuItems, setMenuItems] = useState<MenuItem[]>(initialMenuItems);
  const [tables] = useState<CafeTable[]>(initialTables);
  const [settings, setSettings] = useState<CafeSettings>(initialSettings);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSavedMessage, setSettingsSavedMessage] = useState(false);

  // Toggle item availability
  const handleToggleAvailability = async (itemId: string, current: boolean) => {
    try {
      const res = await fetch(`/api/menu/${itemId}/availability`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable: !current }),
      });
      if (res.ok) {
        setMenuItems((prev) =>
          prev.map((i) => (i.id === itemId ? { ...i, is_available: !current } : i))
        );
      }
    } catch {
      // Ignore
    }
  };

  // Save Settings
  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    setSettingsSavedMessage(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cafeName: settings.cafe_name,
          tagline: settings.tagline,
          taxRate: Number(settings.tax_rate),
          serviceChargeRate: Number(settings.service_charge_rate),
          currency: settings.currency,
          isOrderingPaused: settings.is_ordering_paused,
          busyMessage: settings.busy_message,
          averagePrepTimeMinutes: Number(settings.average_prep_time_minutes),
        }),
      });
      if (res.ok) {
        setSettingsSavedMessage(true);
        setTimeout(() => setSettingsSavedMessage(false), 2500);
      }
    } catch {
      // Ignore
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Format Recharts dates nicely (MM/DD)
  const chartData = analytics.daily.map((d) => ({
    date: d.date.slice(5),
    orders: d.order_count,
    revenue: d.revenue,
    paidBills: d.paid_bills_count,
  }));

  return (
    <div className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#242424] mb-6">
        <div>
          <h1 className="font-serif text-xl sm:text-2xl font-bold text-[#F6EFE7]">
            Velvet Bloom Owner Command Center
          </h1>
          <p className="text-xs text-[#A8A29E] mt-0.5">
            Operational telemetry and rolling 15-day financial performance. Powered by Kage Origin.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveTab("analytics")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "analytics"
                ? "bg-[#C99A8A]/20 border border-[#C99A8A]/40 text-[#DFB8AA]"
                : "bg-[#171717] text-[#A8A29E] hover:text-[#F6EFE7]"
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>15-Day Analytics</span>
          </button>

          <button
            onClick={() => setActiveTab("menu")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "menu"
                ? "bg-[#D8B58A]/20 border border-[#D8B58A]/40 text-[#D8B58A]"
                : "bg-[#171717] text-[#A8A29E] hover:text-[#F6EFE7]"
            }`}
          >
            <Coffee className="w-3.5 h-3.5" />
            <span>Menu & Pricing</span>
          </button>

          <button
            onClick={() => setActiveTab("tables")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "tables"
                ? "bg-[#C99A8A]/20 border border-[#C99A8A]/40 text-[#DFB8AA]"
                : "bg-[#171717] text-[#A8A29E] hover:text-[#F6EFE7]"
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Tables & QRs</span>
          </button>

          <button
            onClick={() => setActiveTab("staff")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "staff"
                ? "bg-[#D8B58A]/20 border border-[#D8B58A]/40 text-[#D8B58A]"
                : "bg-[#171717] text-[#A8A29E] hover:text-[#F6EFE7]"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Staff Accounts</span>
          </button>

          <button
            onClick={() => setActiveTab("sounds")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "sounds"
                ? "bg-[#C99A8A]/20 border border-[#C99A8A]/40 text-[#DFB8AA]"
                : "bg-[#171717] text-[#A8A29E] hover:text-[#F6EFE7]"
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Audio Alerts</span>
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "settings"
                ? "bg-[#242424] border border-[#3e3e3e] text-[#F6EFE7]"
                : "bg-[#171717] text-[#A8A29E] hover:text-[#F6EFE7]"
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* TAB 1: 15-DAY ANALYTICS & LIVE KPIS */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          {/* Live Daily KPIs Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3.5 rounded-xl border border-[#242424] bg-[#171717]/80">
              <span className="text-[10px] text-[#A8A29E] uppercase tracking-wider block">
                Orders Today
              </span>
              <span className="font-serif text-xl font-bold text-[#F6EFE7] mt-1 block">
                {initialKPIs.orders_today}
              </span>
              <span className="text-[10px] text-[#D8B58A]">
                {initialKPIs.pending_orders} pending · {initialKPIs.preparing_orders} prep
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-[#6FAF82]/30 bg-[#151c17]">
              <span className="text-[10px] text-[#6FAF82] uppercase tracking-wider block">
                Ready to Serve
              </span>
              <span className="font-serif text-xl font-bold text-[#6FAF82] mt-1 block">
                {initialKPIs.ready_orders}
              </span>
              <span className="text-[10px] text-[#A8A29E]">Awaiting delivery</span>
            </div>

            <div className="p-3.5 rounded-xl border border-[#242424] bg-[#171717]/80">
              <span className="text-[10px] text-[#A8A29E] uppercase tracking-wider block">
                Occupied Tables
              </span>
              <span className="font-serif text-xl font-bold text-[#F6EFE7] mt-1 block">
                {initialKPIs.active_tables}
              </span>
              <span className="text-[10px] text-[#A8A29E]">Active dining</span>
            </div>

            <div className="p-3.5 rounded-xl border border-[#D6A34A]/30 bg-[#1c1a17]">
              <span className="text-[10px] text-[#D6A34A] uppercase tracking-wider block">
                Bill Requests
              </span>
              <span className="font-serif text-xl font-bold text-[#D6A34A] mt-1 block">
                {initialKPIs.outstanding_bill_requests}
              </span>
              <span className="text-[10px] text-[#A8A29E]">Unsettled bills</span>
            </div>

            <div className="p-3.5 rounded-xl border border-[#C99A8A]/30 bg-[#171717]/80">
              <span className="text-[10px] text-[#DFB8AA] uppercase tracking-wider block">
                Revenue Today
              </span>
              <span className="font-serif text-xl font-bold text-[#D8B58A] mt-1 block">
                {formatCurrency(initialKPIs.revenue_today)}
              </span>
              <span className="text-[10px] text-[#A8A29E]">Paid settlements</span>
            </div>

            <div className="p-3.5 rounded-xl border border-[#242424] bg-[#171717]/80">
              <span className="text-[10px] text-[#A8A29E] uppercase tracking-wider block">
                Avg Order Value
              </span>
              <span className="font-serif text-xl font-bold text-[#F6EFE7] mt-1 block">
                {formatCurrency(initialKPIs.average_order_value_today)}
              </span>
              <span className="text-[10px] text-[#A8A29E]">AOV today</span>
            </div>
          </div>

          {/* Rolling 15-Day Revenue & Volume Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* 15-Day Revenue Trend */}
            <div className="p-5 rounded-2xl border border-[#242424] bg-[#171717]/90 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-serif font-bold text-sm text-[#F6EFE7]">
                    Rolling 15-Day Revenue (₹)
                  </h3>
                  <p className="text-[11px] text-[#A8A29E]">
                    Total: {formatCurrency(analytics.total_15day_revenue)} · Avg AOV:{" "}
                    {formatCurrency(analytics.average_15day_aov)}
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#C99A8A]/20 text-[#DFB8AA]">
                  15-Day Window
                </span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#C99A8A" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#C99A8A" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#242424" />
                    <XAxis dataKey="date" stroke="#A8A29E" fontSize={10} />
                    <YAxis stroke="#A8A29E" fontSize={10} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#171717",
                        borderColor: "#C99A8A",
                        borderRadius: "8px",
                        fontSize: "11px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#C99A8A"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#revenueGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 15-Day Orders Trend */}
            <div className="p-5 rounded-2xl border border-[#242424] bg-[#171717]/90 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-serif font-bold text-sm text-[#F6EFE7]">
                    Rolling 15-Day Order Volume
                  </h3>
                  <p className="text-[11px] text-[#A8A29E]">
                    Total Orders: {analytics.total_15day_orders} · Cancellation Rate:{" "}
                    {analytics.overall_cancellation_rate}%
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#D8B58A]/20 text-[#D8B58A]">
                  Volume
                </span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#242424" />
                    <XAxis dataKey="date" stroke="#A8A29E" fontSize={10} />
                    <YAxis stroke="#A8A29E" fontSize={10} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#171717",
                        borderColor: "#D8B58A",
                        borderRadius: "8px",
                        fontSize: "11px",
                      }}
                    />
                    <Bar dataKey="orders" fill="#D8B58A" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Best Selling Items & Hourly Peak Ordering */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Top 5 Best Selling Items */}
            <div className="p-5 rounded-2xl border border-[#242424] bg-[#171717] shadow-xl">
              <h3 className="font-serif font-bold text-sm text-[#F6EFE7] mb-3">
                Top Performing Artisan Offerings
              </h3>

              <div className="space-y-3">
                {analytics.best_selling_items.map((item, idx) => (
                  <div
                    key={item.menu_item_id}
                    className="flex items-center justify-between text-xs py-2 border-b border-[#242424]/60 last:border-0"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#242424] text-[#D8B58A] font-bold text-[10px] flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <div>
                        <span className="font-medium text-[#F6EFE7] block">
                          {item.item_name}
                        </span>
                        <span className="text-[10px] text-[#A8A29E]">
                          {item.category_name}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-bold text-[#F6EFE7] block">
                        {item.total_quantity} sold
                      </span>
                      <span className="text-[10px] text-[#D8B58A]">
                        {formatCurrency(item.total_revenue)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Peak Ordering Hours */}
            <div className="p-5 rounded-2xl border border-[#242424] bg-[#171717] shadow-xl">
              <h3 className="font-serif font-bold text-sm text-[#F6EFE7] mb-3">
                Peak Ordering Hours Distribution
              </h3>

              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.hourly_distribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#242424" />
                    <XAxis dataKey="hour_label" stroke="#A8A29E" fontSize={9} />
                    <YAxis stroke="#A8A29E" fontSize={9} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#171717",
                        borderColor: "#C99A8A",
                        borderRadius: "8px",
                        fontSize: "11px",
                      }}
                    />
                    <Bar dataKey="order_count" fill="#C99A8A" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MENU & PRICING MANAGEMENT */}
      {activeTab === "menu" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-medium text-[#F6EFE7]">
              Menu Catalog & Live Availability Controls
            </h2>
            <span className="text-xs text-[#A8A29E]">
              {menuItems.length} Offerings in Catalog
            </span>
          </div>

          <div className="p-4 rounded-2xl border border-[#242424] bg-[#171717] overflow-x-auto">
            <table className="w-full text-left text-xs text-[#A8A29E]">
              <thead className="border-b border-[#242424] text-[10px] uppercase tracking-wider text-[#D8B58A]">
                <tr>
                  <th className="py-2.5 px-3">Item Name</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Price</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242424]/60">
                {menuItems.map((item) => {
                  const category = categories.find((c) => c.id === item.category_id);
                  return (
                    <tr key={item.id} className="hover:bg-[#242424]/40">
                      <td className="py-3 px-3">
                        <span className="font-medium text-[#F6EFE7] block">{item.name}</span>
                        <span className="text-[10px] text-[#A8A29E]/60 line-clamp-1 max-w-xs">
                          {item.description}
                        </span>
                      </td>
                      <td className="py-3 px-3">{category?.name || "General"}</td>
                      <td className="py-3 px-3 font-serif font-bold text-[#F6EFE7]">
                        {formatCurrency(item.price)}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            item.is_veg
                              ? "bg-[#6FAF82]/20 text-[#6FAF82]"
                              : "bg-[#C96B6B]/20 text-[#C96B6B]"
                          }`}
                        >
                          {item.is_veg ? "Veg" : "Non-Veg"}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            item.is_available
                              ? "bg-[#6FAF82]/20 text-[#6FAF82]"
                              : "bg-[#C96B6B]/20 text-[#C96B6B]"
                          }`}
                        >
                          {item.is_available ? "Available" : "Sold Out"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Button
                          size="sm"
                          variant={item.is_available ? "secondary" : "primary"}
                          className="text-[10px] py-1"
                          onClick={() => handleToggleAvailability(item.id, item.is_available)}
                        >
                          {item.is_available ? "Mark Sold Out" : "Enable Item"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: TABLES & QR TOKENS */}
      {activeTab === "tables" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-medium text-[#F6EFE7]">
              Table Layout & Secure QR Code Tokens
            </h2>
            <span className="text-xs text-[#A8A29E]">
              {tables.length} Total Tables Configured
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {tables.map((tbl) => (
              <div
                key={tbl.id}
                className="p-4 rounded-2xl border border-[#242424] bg-[#171717] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-serif font-bold text-base text-[#F6EFE7]">
                      {tbl.table_number}
                    </span>
                    <span className="text-[10px] text-[#A8A29E]">
                      Seats {tbl.capacity}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#080808] border border-[#242424] font-mono text-[10px] text-[#D8B58A] break-all mb-3">
                    Token: {tbl.qr_code_token}
                  </div>
                </div>

                <div className="pt-2 border-t border-[#242424]">
                  <Link
                    href={`/table/${tbl.qr_code_token}`}
                    target="_blank"
                    className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg bg-[#242424] text-xs text-[#F6EFE7] hover:bg-[#2e2e2e] transition-colors"
                  >
                    <span>Launch Customer View</span>
                    <ExternalLink className="w-3 h-3 text-[#D8B58A]" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: STAFF ACCOUNTS */}
      {activeTab === "staff" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-medium text-[#F6EFE7]">
              Provisioned Staff & Terminal PINs
            </h2>
          </div>

          <div className="p-4 rounded-2xl border border-[#242424] bg-[#171717] overflow-x-auto">
            <table className="w-full text-left text-xs text-[#A8A29E]">
              <thead className="border-b border-[#242424] text-[10px] uppercase tracking-wider text-[#D8B58A]">
                <tr>
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Email</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">POS Quick PIN</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242424]/60">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-[#242424]/40">
                    <td className="py-3 px-3 font-medium text-[#F6EFE7]">{u.full_name}</td>
                    <td className="py-3 px-3 font-mono">{u.email}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#C99A8A]/20 text-[#DFB8AA]">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[#D8B58A]">
                      {u.pin_code || "—"}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#6FAF82]/20 text-[#6FAF82]">
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: AUDIO ALERTS CONFIGURATION */}
      {activeTab === "sounds" && (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-lg font-medium text-[#F6EFE7]">
                Loud Notification System & Audio Preferences
              </h2>
              <p className="text-xs text-[#A8A29E] mt-0.5">
                Configure operational chime alerts, test audio, and upload custom MP3/WAV files.
              </p>
            </div>
          </div>

          {uploadError && (
            <div className="p-3.5 rounded-xl bg-[#C96B6B]/20 border border-[#C96B6B]/40 text-xs text-[#C96B6B]">
              {uploadError}
            </div>
          )}

          {uploadSuccess && (
            <div className="p-3.5 rounded-xl bg-[#6FAF82]/20 border border-[#6FAF82]/40 text-xs text-[#6FAF82] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{uploadSuccess}</span>
            </div>
          )}

          {/* Master Volume Card */}
          <div className="p-5 rounded-2xl border border-[#242424] bg-[#171717] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-[#F6EFE7] block">Master Sound Engine</span>
                <span className="text-xs text-[#A8A29E]">Enable or mute all audible notification alerts</span>
              </div>
              <button
                onClick={async () => {
                  const next = !audioSettings.enabled;
                  if (next) await unlockAudio();
                  updateAudioSettings({ enabled: next });
                }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border ${
                  audioSettings.enabled
                    ? "bg-[#6FAF82]/20 border-[#6FAF82]/40 text-[#6FAF82]"
                    : "bg-[#242424] border-[#333] text-[#A8A29E]"
                }`}
              >
                {audioSettings.enabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                <span>{audioSettings.enabled ? "Enabled" : "Muted"}</span>
              </button>
            </div>

            {/* Volume Slider */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-[#A8A29E]">Alert Volume</span>
                <span className="font-mono font-bold text-[#D8B58A]">
                  {Math.round(audioSettings.volume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={audioSettings.volume}
                onChange={(e) => updateAudioSettings({ volume: parseFloat(e.target.value) })}
                className="w-full accent-[#C99A8A] cursor-pointer"
              />
            </div>
          </div>

          {/* Event sounds list */}
          <div className="space-y-3">
            {(Object.keys(SOUND_EVENT_LABELS) as SoundEventType[]).map((type) => {
              const info = SOUND_EVENT_LABELS[type];
              const isEnabled = audioSettings.enabledEvents[type] ?? true;
              const custom = audioSettings.customSounds[type];

              return (
                <div
                  key={type}
                  className="p-4 rounded-xl border border-[#242424] bg-[#171717] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={(e) =>
                        updateAudioSettings({
                          enabledEvents: {
                            ...audioSettings.enabledEvents,
                            [type]: e.target.checked,
                          },
                        })
                      }
                      className="w-4 h-4 mt-1 accent-[#C99A8A]"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#F6EFE7]">
                          {info.label}
                        </span>
                        <span className="text-[10px] bg-[#242424] px-1.5 py-0.5 rounded text-[#D8B58A]">
                          {info.role}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#A8A29E] mt-0.5 leading-relaxed">
                        {info.description}
                      </p>
                      {custom ? (
                        <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-[#D8B58A] bg-[#242424] px-2 py-0.5 rounded border border-[#C99A8A]/30">
                          <Sparkles className="w-3 h-3 text-[#C99A8A]" />
                          Custom File: {custom.fileName} ({(custom.fileSize / 1024).toFixed(0)} KB)
                        </span>
                      ) : (
                        <span className="mt-1 text-[10px] text-[#A8A29E]/60 italic block">
                          Using built-in synthesized chime
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 px-2.5 text-xs text-[#D8B58A]"
                      onClick={async () => {
                        setTestingType(type);
                        await testSound(type);
                        setTimeout(() => setTestingType(null), 800);
                      }}
                      disabled={testingType === type}
                    >
                      <Play className={`w-3 h-3 fill-current ${testingType === type ? "animate-spin" : ""}`} />
                      <span>Test Sound</span>
                    </Button>

                    <label className="cursor-pointer h-8 px-2.5 rounded-lg bg-[#242424] hover:bg-[#2e2e2e] text-xs text-[#F6EFE7] border border-[#3e3e3e] flex items-center gap-1.5 transition-colors">
                      <Upload className="w-3 h-3 text-[#A8A29E]" />
                      <span>Upload</span>
                      <input
                        type="file"
                        accept="audio/mp3,audio/wav,audio/ogg,audio/*"
                        className="hidden"
                        onChange={async (e) => {
                          setUploadError(null);
                          setUploadSuccess(null);
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const res = await uploadCustomSound(type, file);
                          if (!res.success) {
                            setUploadError(res.error || "Failed to upload audio file");
                          } else {
                            setUploadSuccess(`Custom audio uploaded for "${info.label}"`);
                            setTimeout(() => setUploadSuccess(null), 2500);
                          }
                          e.target.value = "";
                        }}
                      />
                    </label>

                    {custom && (
                      <button
                        onClick={() => removeCustomSound(type)}
                        className="p-2 rounded-lg text-[#C96B6B] hover:bg-[#C96B6B]/20 transition-colors"
                        title="Remove custom audio and restore built-in chime"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Architecture & Reliability Note */}
          <div className="p-4 rounded-xl bg-[#242424]/30 border border-[#242424] text-xs text-[#A8A29E] space-y-1.5">
            <h5 className="font-semibold text-[#D8B58A] flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              <span>Audio Reliability & Standards Compliance</span>
            </h5>
            <p className="text-[11px] leading-relaxed">
              Browser autoplay policies mandate a user interaction gesture before audio playback starts. Custom audio uploads are validated against MIME type and size (&le; 2 MB) and stored locally for development, designed to plug into Supabase Storage later.
            </p>
          </div>
        </div>
      )}

      {/* TAB 6: CAFE SETTINGS */}
      {activeTab === "settings" && (
        <div className="max-w-2xl mx-auto space-y-5">
          <h2 className="font-serif text-lg font-medium text-[#F6EFE7]">
            Café Configuration & Tax Policies
          </h2>

          <div className="p-5 rounded-2xl border border-[#242424] bg-[#171717] space-y-4">
            <div>
              <label className="text-xs text-[#A8A29E] block mb-1">Café Brand Name</label>
              <input
                type="text"
                value={settings.cafe_name}
                onChange={(e) => setSettings({ ...settings, cafe_name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#080808] border border-[#242424] text-xs text-[#F6EFE7] focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-[#A8A29E] block mb-1">Tagline</label>
              <input
                type="text"
                value={settings.tagline}
                onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#080808] border border-[#242424] text-xs text-[#F6EFE7] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-[#A8A29E] block mb-1">
                  Tax / GST Rate (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.tax_rate}
                  onChange={(e) =>
                    setSettings({ ...settings, tax_rate: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#080808] border border-[#242424] text-xs text-[#F6EFE7] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-[#A8A29E] block mb-1">Currency Symbol</label>
                <input
                  type="text"
                  value={settings.currency}
                  onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#080808] border border-[#242424] text-xs text-[#F6EFE7] focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-[#242424]">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.is_ordering_paused}
                  onChange={(e) =>
                    setSettings({ ...settings, is_ordering_paused: e.target.checked })
                  }
                  className="w-4 h-4 accent-[#C99A8A]"
                />
                <span className="text-xs font-semibold text-[#F6EFE7]">
                  Pause Customer Ordering (High Demand / Rush Mode)
                </span>
              </label>
            </div>

            {settings.is_ordering_paused && (
              <div>
                <label className="text-xs text-[#A8A29E] block mb-1">
                  Kitchen Busy Message Displayed to Diners
                </label>
                <textarea
                  value={settings.busy_message}
                  onChange={(e) => setSettings({ ...settings, busy_message: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-[#080808] border border-[#242424] text-xs text-[#F6EFE7] focus:outline-none resize-none"
                />
              </div>
            )}

            {settingsSavedMessage && (
              <div className="p-3 rounded-lg bg-[#6FAF82]/20 border border-[#6FAF82]/40 text-xs text-[#6FAF82] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Café configuration saved successfully.</span>
              </div>
            )}

            <Button
              variant="primary"
              className="w-full py-2.5 font-bold"
              onClick={handleSaveSettings}
              isLoading={isSavingSettings}
            >
              Save Configuration
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
