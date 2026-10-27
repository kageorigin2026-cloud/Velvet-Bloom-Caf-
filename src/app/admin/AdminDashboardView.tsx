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
  UserRole,
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
  Plus,
  Edit2,
  Key,
  Search,
  Filter,
  X,
  Lock,
  UserCheck,
  UserX,
  ImageIcon,
  Check,
  Loader2,
  Leaf,
  Flame,
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

  // Staff Management State
  const [staffList, setStaffList] = useState<User[]>(users);
  const [staffSearch, setStaffSearch] = useState("");
  const [staffRoleFilter, setStaffRoleFilter] = useState<string>("ALL");
  const [staffStatusFilter, setStaffStatusFilter] = useState<string>("ALL");
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<User | null>(null);
  const [resetPinStaff, setResetPinStaff] = useState<User | null>(null);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffFeedback, setStaffFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // New Staff Form State
  const [newStaffForm, setNewStaffForm] = useState({
    fullName: "",
    email: "",
    role: "WAITER" as UserRole,
    pin: "",
    phone: "",
  });
  // Reset PIN Form State
  const [newPinValue, setNewPinValue] = useState("");
  const [confirmPinValue, setConfirmPinValue] = useState("");

  // Menu Management State
  const [menuSearch, setMenuSearch] = useState("");
  const [menuCategoryFilter, setMenuCategoryFilter] = useState<string>("ALL");
  const [menuAvailabilityFilter, setMenuAvailabilityFilter] = useState<string>("ALL");
  const [isAddDishOpen, setIsAddDishOpen] = useState(false);
  const [editingDish, setEditingDish] = useState<MenuItem | null>(null);
  const [archivingDish, setArchivingDish] = useState<MenuItem | null>(null);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuFeedback, setMenuFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // New Dish Form State
  const [newDishForm, setNewDishForm] = useState({
    name: "",
    categoryId: categories[0]?.id || "",
    price: "",
    description: "",
    imageUrl: "",
    isVeg: true,
    prepTimeMinutes: 15,
  });

  const showStaffFeedback = (type: "success" | "error", message: string) => {
    setStaffFeedback({ type, message });
    setTimeout(() => setStaffFeedback(null), 4000);
  };

  const showMenuFeedback = (type: "success" | "error", message: string) => {
    setMenuFeedback({ type, message });
    setTimeout(() => setMenuFeedback(null), 4000);
  };

  // Staff Handlers
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffForm.fullName.trim() || newStaffForm.fullName.trim().length < 2) {
      showStaffFeedback("error", "Full name must be at least 2 characters");
      return;
    }
    if (!newStaffForm.email.trim() || !newStaffForm.email.includes("@")) {
      showStaffFeedback("error", "Valid email is required");
      return;
    }
    if (!/^[0-9]{4,6}$/.test(newStaffForm.pin.trim())) {
      showStaffFeedback("error", "Quick PIN must be between 4 and 6 numeric digits");
      return;
    }

    setStaffLoading(true);
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newStaffForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create staff account");

      setStaffList((prev) => [...prev, data]);
      setNewStaffForm({ fullName: "", email: "", role: "WAITER", pin: "", phone: "" });
      setIsAddStaffOpen(false);
      showStaffFeedback("success", `Staff account created for ${data.full_name}`);
    } catch (err: any) {
      showStaffFeedback("error", err.message || "Failed to create staff account");
    } finally {
      setStaffLoading(false);
    }
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;

    setStaffLoading(true);
    try {
      const res = await fetch(`/api/staff/${editingStaff.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: editingStaff.full_name,
          email: editingStaff.email,
          role: editingStaff.role,
          phone: editingStaff.phone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update staff account");

      setStaffList((prev) => prev.map((u) => (u.id === data.id ? { ...u, ...data } : u)));
      setEditingStaff(null);
      showStaffFeedback("success", `Updated details for ${data.full_name}`);
    } catch (err: any) {
      showStaffFeedback("error", err.message || "Failed to update staff account");
    } finally {
      setStaffLoading(false);
    }
  };

  const handleResetStaffPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPinStaff) return;

    if (!/^[0-9]{4,6}$/.test(newPinValue.trim())) {
      showStaffFeedback("error", "New PIN must be 4 to 6 numeric digits");
      return;
    }
    if (newPinValue !== confirmPinValue) {
      showStaffFeedback("error", "PIN confirmation does not match");
      return;
    }

    setStaffLoading(true);
    try {
      const res = await fetch(`/api/staff/${resetPinStaff.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPin: newPinValue.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset PIN");

      setResetPinStaff(null);
      setNewPinValue("");
      setConfirmPinValue("");
      showStaffFeedback("success", `PIN updated for ${resetPinStaff.full_name}`);
    } catch (err: any) {
      showStaffFeedback("error", err.message || "Failed to reset PIN");
    } finally {
      setStaffLoading(false);
    }
  };

  const handleToggleStaffStatus = async (user: User) => {
    if (user.role === "OWNER") {
      showStaffFeedback("error", "The primary Owner account cannot be deactivated");
      return;
    }

    const nextStatus = !user.is_active;
    // Optimistic update
    setStaffList((prev) => prev.map((u) => (u.id === user.id ? { ...u, is_active: nextStatus } : u)));

    try {
      const res = await fetch(`/api/staff/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        setStaffList((prev) => prev.map((u) => (u.id === user.id ? { ...u, is_active: !nextStatus } : u)));
        showStaffFeedback("error", data.error || "Failed to update account status");
      } else {
        showStaffFeedback("success", `${user.full_name} is now ${nextStatus ? "Active" : "Deactivated"}`);
      }
    } catch {
      setStaffList((prev) => prev.map((u) => (u.id === user.id ? { ...u, is_active: !nextStatus } : u)));
      showStaffFeedback("error", "Network error updating staff status");
    }
  };

  // Menu Handlers
  const handleToggleAvailability = async (itemId: string, current: boolean) => {
    setMenuItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, is_available: !current } : i))
    );
    try {
      const res = await fetch(`/api/menu/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable: !current }),
      });
      if (!res.ok) {
        setMenuItems((prev) =>
          prev.map((i) => (i.id === itemId ? { ...i, is_available: current } : i))
        );
        const data = await res.json();
        showMenuFeedback("error", data.error || "Failed to update availability");
      }
    } catch {
      setMenuItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, is_available: current } : i))
      );
      showMenuFeedback("error", "Network error updating availability");
    }
  };

  const handleCreateDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDishForm.name.trim()) {
      showMenuFeedback("error", "Dish name is required");
      return;
    }
    const numPrice = Number(newDishForm.price);
    if (isNaN(numPrice) || numPrice < 0) {
      showMenuFeedback("error", "Price must be a valid non-negative number");
      return;
    }

    setMenuLoading(true);
    try {
      const res = await fetch("/api/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newDishForm,
          price: numPrice,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create dish");

      setMenuItems((prev) => [data, ...prev]);
      setNewDishForm({
        name: "",
        categoryId: categories[0]?.id || "",
        price: "",
        description: "",
        imageUrl: "",
        isVeg: true,
        prepTimeMinutes: 15,
      });
      setIsAddDishOpen(false);
      showMenuFeedback("success", `Dish "${data.name}" added to menu catalog`);
    } catch (err: any) {
      showMenuFeedback("error", err.message || "Failed to create dish");
    } finally {
      setMenuLoading(false);
    }
  };

  const handleUpdateDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDish) return;
    const numPrice = Number(editingDish.price);
    if (isNaN(numPrice) || numPrice < 0) {
      showMenuFeedback("error", "Price must be a valid non-negative number");
      return;
    }

    setMenuLoading(true);
    try {
      const res = await fetch(`/api/menu/${editingDish.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingDish.name,
          categoryId: editingDish.category_id,
          price: numPrice,
          description: editingDish.description,
          imageUrl: editingDish.image_url,
          isVeg: editingDish.is_veg,
          prepTimeMinutes: editingDish.preparation_time_minutes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update dish");

      setMenuItems((prev) => prev.map((item) => (item.id === data.id ? { ...item, ...data } : item)));
      setEditingDish(null);
      showMenuFeedback("success", `Dish "${data.name}" updated successfully`);
    } catch (err: any) {
      showMenuFeedback("error", err.message || "Failed to update dish");
    } finally {
      setMenuLoading(false);
    }
  };

  const handleArchiveDish = async () => {
    if (!archivingDish) return;

    setMenuLoading(true);
    try {
      const res = await fetch(`/api/menu/${archivingDish.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to archive dish");

      setMenuItems((prev) => prev.filter((item) => item.id !== archivingDish.id));
      showMenuFeedback("success", `Dish "${archivingDish.name}" safely archived`);
      setArchivingDish(null);
    } catch (err: any) {
      showMenuFeedback("error", err.message || "Failed to archive dish");
    } finally {
      setMenuLoading(false);
    }
  };

  const handleImageFileChange = async (
    file: File,
    onSuccess: (url: string) => void
  ) => {
    if (!file) return;
    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/menu/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upload image");
      onSuccess(data.url);
      showMenuFeedback("success", "Dish photo uploaded successfully");
    } catch (err: any) {
      showMenuFeedback("error", err.message || "Image upload failed");
    } finally {
      setIsUploadingImage(false);
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
          {menuFeedback && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
                menuFeedback.type === "success"
                  ? "bg-[#6FAF82]/15 border-[#6FAF82]/30 text-[#6FAF82]"
                  : "bg-[#C96B6B]/15 border-[#C96B6B]/30 text-[#C96B6B]"
              }`}
            >
              <div className="flex items-center gap-2">
                {menuFeedback.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{menuFeedback.message}</span>
              </div>
              <button
                onClick={() => setMenuFeedback(null)}
                className="opacity-70 hover:opacity-100 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Top Bar: Title & Add Dish Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[#171717] border border-[#242424]">
            <div>
              <h2 className="font-serif text-lg font-medium text-[#F6EFE7]">
                Menu Catalog & Live Availability
              </h2>
              <p className="text-xs text-[#A8A29E] mt-0.5">
                {menuItems.length} Offerings across {categories.length} culinary categories
              </p>
            </div>
            <button
              onClick={() => setIsAddDishOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#D8B58A] to-[#C99A8A] text-[#080808] font-bold text-xs shadow-lg shadow-black/40 hover:opacity-95 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Dish</span>
            </button>
          </div>

          {/* Search & Filter Controls */}
          <div className="p-4 rounded-2xl bg-[#171717] border border-[#242424] space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A8A29E]" />
                <input
                  type="text"
                  placeholder="Search dishes by name or ingredients..."
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  className="w-full bg-[#080808] border border-[#242424] rounded-xl pl-9 pr-4 py-2 text-xs text-[#F6EFE7] placeholder-[#A8A29E]/60 focus:outline-none focus:border-[#D8B58A]"
                />
              </div>

              {/* Availability Filter */}
              <div className="flex items-center gap-1 bg-[#080808] p-1 rounded-xl border border-[#242424]">
                {(["ALL", "AVAILABLE", "SOLD_OUT"] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setMenuAvailabilityFilter(filter)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                      menuAvailabilityFilter === filter
                        ? "bg-[#D8B58A]/20 text-[#D8B58A] border border-[#D8B58A]/30"
                        : "text-[#A8A29E] hover:text-[#F6EFE7]"
                    }`}
                  >
                    {filter === "ALL" ? "All" : filter === "AVAILABLE" ? "Available" : "Sold Out"}
                  </button>
                ))}
              </div>
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setMenuCategoryFilter("ALL")}
                className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap font-medium transition-all ${
                  menuCategoryFilter === "ALL"
                    ? "bg-[#D8B58A] text-[#080808] font-bold shadow-sm"
                    : "bg-[#080808] text-[#A8A29E] hover:text-[#F6EFE7] border border-[#242424]"
                }`}
              >
                All Categories ({menuItems.length})
              </button>
              {categories.map((c) => {
                const count = menuItems.filter((i) => i.category_id === c.id).length;
                return (
                  <button
                    key={c.id}
                    onClick={() => setMenuCategoryFilter(c.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap font-medium transition-all ${
                      menuCategoryFilter === c.id
                        ? "bg-[#D8B58A] text-[#080808] font-bold shadow-sm"
                        : "bg-[#080808] text-[#A8A29E] hover:text-[#F6EFE7] border border-[#242424]"
                    }`}
                  >
                    {c.name} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Menu Items Table */}
          {(() => {
            const filteredItems = menuItems.filter((item) => {
              if (
                menuSearch.trim() &&
                !item.name.toLowerCase().includes(menuSearch.toLowerCase()) &&
                !(item.description || "").toLowerCase().includes(menuSearch.toLowerCase())
              ) {
                return false;
              }
              if (menuCategoryFilter !== "ALL" && item.category_id !== menuCategoryFilter) {
                return false;
              }
              if (menuAvailabilityFilter === "AVAILABLE" && !item.is_available) return false;
              if (menuAvailabilityFilter === "SOLD_OUT" && item.is_available) return false;
              return true;
            });

            if (filteredItems.length === 0) {
              return (
                <div className="p-12 text-center rounded-2xl border border-[#242424] bg-[#171717]">
                  <Coffee className="w-8 h-8 text-[#A8A29E]/40 mx-auto mb-2" />
                  <p className="text-sm font-medium text-[#F6EFE7]">No dishes match your filters</p>
                  <p className="text-xs text-[#A8A29E] mt-1">Try adjusting your search query or category filter</p>
                </div>
              );
            }

            return (
              <div className="p-4 rounded-2xl border border-[#242424] bg-[#171717] overflow-x-auto">
                <table className="w-full text-left text-xs text-[#A8A29E]">
                  <thead className="border-b border-[#242424] text-[10px] uppercase tracking-wider text-[#D8B58A]">
                    <tr>
                      <th className="py-2.5 px-3">Dish / Offering</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Price</th>
                      <th className="py-2.5 px-3">Dietary</th>
                      <th className="py-2.5 px-3">Prep Time</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#242424]/60">
                    {filteredItems.map((item) => {
                      const category = categories.find((c) => c.id === item.category_id);
                      return (
                        <tr key={item.id} className="hover:bg-[#242424]/40 transition-colors">
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-3">
                              {item.image_url ? (
                                <img
                                  src={item.image_url}
                                  alt={item.name}
                                  className="w-10 h-10 rounded-lg object-cover border border-[#242424] shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-[#080808] border border-[#242424] flex items-center justify-center text-[#D8B58A] shrink-0">
                                  <Coffee className="w-5 h-5" />
                                </div>
                              )}
                              <div>
                                <span className="font-medium text-[#F6EFE7] block">{item.name}</span>
                                <span className="text-[10px] text-[#A8A29E]/60 line-clamp-1 max-w-xs">
                                  {item.description || "No description provided"}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded bg-[#242424] text-[10px] text-[#F6EFE7] font-medium">
                              {category?.name || "General"}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-serif font-bold text-[#F6EFE7]">
                            {formatCurrency(item.price)}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                                item.is_veg
                                  ? "bg-[#6FAF82]/20 text-[#6FAF82]"
                                  : "bg-[#C96B6B]/20 text-[#C96B6B]"
                              }`}
                            >
                              <Leaf className="w-2.5 h-2.5" />
                              <span>{item.is_veg ? "Veg" : "Non-Veg"}</span>
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="text-[11px] text-[#A8A29E] flex items-center gap-1">
                              <Clock className="w-3 h-3 text-[#D8B58A]" />
                              <span>{item.preparation_time_minutes || 15} min</span>
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <button
                              onClick={() => handleToggleAvailability(item.id, item.is_available)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border ${
                                item.is_available
                                  ? "bg-[#6FAF82]/15 border-[#6FAF82]/30 text-[#6FAF82] hover:bg-[#6FAF82]/25"
                                  : "bg-[#C96B6B]/15 border-[#C96B6B]/30 text-[#C96B6B] hover:bg-[#C96B6B]/25"
                              }`}
                            >
                              {item.is_available ? "Available" : "Sold Out"}
                            </button>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setEditingDish(item)}
                                className="p-1.5 rounded-lg text-[#A8A29E] hover:text-[#D8B58A] hover:bg-[#242424] transition-colors"
                                title="Edit Dish Details"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setArchivingDish(item)}
                                className="p-1.5 rounded-lg text-[#A8A29E] hover:text-[#C96B6B] hover:bg-[#242424] transition-colors"
                                title="Archive Dish"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {/* ADD DISH MODAL */}
          {isAddDishOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className="w-full max-w-lg rounded-2xl bg-[#171717] border border-[#242424] p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between pb-3 border-b border-[#242424]">
                  <div>
                    <h3 className="font-serif text-lg font-bold text-[#F6EFE7]">Add New Menu Dish</h3>
                    <p className="text-xs text-[#A8A29E]">Create a new offering in your café catalog</p>
                  </div>
                  <button
                    onClick={() => setIsAddDishOpen(false)}
                    className="p-1.5 text-[#A8A29E] hover:text-[#F6EFE7] rounded-lg hover:bg-[#242424]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleCreateDish} className="space-y-4">
                  <div>
                    <label className="text-xs text-[#A8A29E] block mb-1">Dish Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Pistachio Rose Latte"
                      value={newDishForm.name}
                      onChange={(e) => setNewDishForm({ ...newDishForm, name: e.target.value })}
                      className="w-full bg-[#080808] border border-[#242424] rounded-xl px-3 py-2 text-xs text-[#F6EFE7] focus:outline-none focus:border-[#D8B58A]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-[#A8A29E] block mb-1">Category *</label>
                      <select
                        value={newDishForm.categoryId}
                        onChange={(e) => setNewDishForm({ ...newDishForm, categoryId: e.target.value })}
                        className="w-full bg-[#080808] border border-[#242424] rounded-xl px-3 py-2 text-xs text-[#F6EFE7] focus:outline-none focus:border-[#D8B58A]"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-[#A8A29E] block mb-1">Price (₹) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        placeholder="e.g. 280.00"
                        value={newDishForm.price}
                        onChange={(e) => setNewDishForm({ ...newDishForm, price: e.target.value })}
                        className="w-full bg-[#080808] border border-[#242424] rounded-xl px-3 py-2 text-xs text-[#F6EFE7] focus:outline-none focus:border-[#D8B58A]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-[#A8A29E] block mb-1">Description</label>
                    <textarea
                      rows={2}
                      placeholder="Culinary notes, taste profile, ingredients..."
                      value={newDishForm.description}
                      onChange={(e) => setNewDishForm({ ...newDishForm, description: e.target.value })}
                      className="w-full bg-[#080808] border border-[#242424] rounded-xl px-3 py-2 text-xs text-[#F6EFE7] focus:outline-none focus:border-[#D8B58A]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-[#A8A29E] block mb-1">Dietary Preference</label>
                      <div className="flex items-center gap-2 pt-1">
                        <label className="flex items-center gap-1.5 text-xs text-[#F6EFE7] cursor-pointer">
                          <input
                            type="radio"
                            name="isVegNew"
                            checked={newDishForm.isVeg}
                            onChange={() => setNewDishForm({ ...newDishForm, isVeg: true })}
                            className="accent-[#6FAF82]"
                          />
                          <span>Vegetarian</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-[#F6EFE7] cursor-pointer">
                          <input
                            type="radio"
                            name="isVegNew"
                            checked={!newDishForm.isVeg}
                            onChange={() => setNewDishForm({ ...newDishForm, isVeg: false })}
                            className="accent-[#C96B6B]"
                          />
                          <span>Non-Veg</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-[#A8A29E] block mb-1">Prep Time (Minutes)</label>
                      <input
                        type="number"
                        min="1"
                        value={newDishForm.prepTimeMinutes}
                        onChange={(e) =>
                          setNewDishForm({ ...newDishForm, prepTimeMinutes: Number(e.target.value) })
                        }
                        className="w-full bg-[#080808] border border-[#242424] rounded-xl px-3 py-2 text-xs text-[#F6EFE7] focus:outline-none focus:border-[#D8B58A]"
                      />
                    </div>
                  </div>

                  {/* Image Upload / URL */}
                  <div>
                    <label className="text-xs text-[#A8A29E] block mb-1">Dish Photo</label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#242424] text-xs text-[#F6EFE7] cursor-pointer hover:bg-[#2e2e2e] transition-colors">
                          <Upload className="w-3.5 h-3.5 text-[#D8B58A]" />
                          <span>{isUploadingImage ? "Uploading..." : "Upload Photo"}</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            disabled={isUploadingImage}
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleImageFileChange(f, (url) => setNewDishForm((prev) => ({ ...prev, imageUrl: url })));
                            }}
                          />
                        </label>
                        <span className="text-[10px] text-[#A8A29E]">or direct URL:</span>
                      </div>
                      <input
                        type="url"
                        placeholder="https://..."
                        value={newDishForm.imageUrl}
                        onChange={(e) => setNewDishForm({ ...newDishForm, imageUrl: e.target.value })}
                        className="w-full bg-[#080808] border border-[#242424] rounded-xl px-3 py-2 text-xs text-[#F6EFE7] focus:outline-none focus:border-[#D8B58A]"
                      />
                      {newDishForm.imageUrl && (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-[#080808] border border-[#242424]">
                          <img
                            src={newDishForm.imageUrl}
                            alt="Preview"
                            className="w-12 h-12 rounded object-cover"
                          />
                          <span className="text-[10px] text-[#6FAF82]">Image preview loaded</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#242424]">
                    <button
                      type="button"
                      onClick={() => setIsAddDishOpen(false)}
                      className="px-4 py-2 rounded-xl bg-[#242424] text-xs text-[#A8A29E] hover:text-[#F6EFE7]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={menuLoading || isUploadingImage}
                      className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-[#D8B58A] to-[#C99A8A] text-[#080808] font-bold text-xs hover:opacity-95 disabled:opacity-50"
                    >
                      {menuLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Create Dish</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* EDIT DISH MODAL */}
          {editingDish && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className="w-full max-w-lg rounded-2xl bg-[#171717] border border-[#242424] p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between pb-3 border-b border-[#242424]">
                  <div>
                    <h3 className="font-serif text-lg font-bold text-[#F6EFE7]">Edit Dish</h3>
                    <p className="text-xs text-[#A8A29E]">{editingDish.name}</p>
                  </div>
                  <button
                    onClick={() => setEditingDish(null)}
                    className="p-1.5 text-[#A8A29E] hover:text-[#F6EFE7] rounded-lg hover:bg-[#242424]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleUpdateDish} className="space-y-4">
                  <div>
                    <label className="text-xs text-[#A8A29E] block mb-1">Dish Name *</label>
                    <input
                      type="text"
                      required
                      value={editingDish.name}
                      onChange={(e) => setEditingDish({ ...editingDish, name: e.target.value })}
                      className="w-full bg-[#080808] border border-[#242424] rounded-xl px-3 py-2 text-xs text-[#F6EFE7] focus:outline-none focus:border-[#D8B58A]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-[#A8A29E] block mb-1">Category *</label>
                      <select
                        value={editingDish.category_id}
                        onChange={(e) => setEditingDish({ ...editingDish, category_id: e.target.value })}
                        className="w-full bg-[#080808] border border-[#242424] rounded-xl px-3 py-2 text-xs text-[#F6EFE7] focus:outline-none focus:border-[#D8B58A]"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-[#A8A29E] block mb-1">Price (₹) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={editingDish.price}
                        onChange={(e) =>
                          setEditingDish({ ...editingDish, price: Number(e.target.value) })
                        }
                        className="w-full bg-[#080808] border border-[#242424] rounded-xl px-3 py-2 text-xs text-[#F6EFE7] focus:outline-none focus:border-[#D8B58A]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-[#A8A29E] block mb-1">Description</label>
                    <textarea
                      rows={2}
                      value={editingDish.description || ""}
                      onChange={(e) => setEditingDish({ ...editingDish, description: e.target.value })}
                      className="w-full bg-[#080808] border border-[#242424] rounded-xl px-3 py-2 text-xs text-[#F6EFE7] focus:outline-none focus:border-[#D8B58A]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-[#A8A29E] block mb-1">Dietary Preference</label>
                      <div className="flex items-center gap-2 pt-1">
                        <label className="flex items-center gap-1.5 text-xs text-[#F6EFE7] cursor-pointer">
                          <input
                            type="radio"
                            name="isVegEdit"
                            checked={editingDish.is_veg}
                            onChange={() => setEditingDish({ ...editingDish, is_veg: true })}
                            className="accent-[#6FAF82]"
                          />
                          <span>Vegetarian</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-[#F6EFE7] cursor-pointer">
                          <input
                            type="radio"
                            name="isVegEdit"
                            checked={!editingDish.is_veg}
                            onChange={() => setEditingDish({ ...editingDish, is_veg: false })}
                            className="accent-[#C96B6B]"
                          />
                          <span>Non-Veg</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-[#A8A29E] block mb-1">Prep Time (Minutes)</label>
                      <input
                        type="number"
                        min="1"
                        value={editingDish.preparation_time_minutes || 15}
                        onChange={(e) =>
                          setEditingDish({
                            ...editingDish,
                            preparation_time_minutes: Number(e.target.value),
                          })
                        }
                        className="w-full bg-[#080808] border border-[#242424] rounded-xl px-3 py-2 text-xs text-[#F6EFE7] focus:outline-none focus:border-[#D8B58A]"
                      />
                    </div>
                  </div>

                  {/* Photo Edit */}
                  <div>
                    <label className="text-xs text-[#A8A29E] block mb-1">Dish Photo</label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#242424] text-xs text-[#F6EFE7] cursor-pointer hover:bg-[#2e2e2e] transition-colors">
                          <Upload className="w-3.5 h-3.5 text-[#D8B58A]" />
                          <span>{isUploadingImage ? "Uploading..." : "Upload New Photo"}</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            disabled={isUploadingImage}
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleImageFileChange(f, (url) => setEditingDish((prev) => prev ? { ...prev, image_url: url } : null));
                            }}
                          />
                        </label>
                        <span className="text-[10px] text-[#A8A29E]">or edit URL:</span>
                      </div>
                      <input
                        type="url"
                        placeholder="https://..."
                        value={editingDish.image_url || ""}
                        onChange={(e) => setEditingDish({ ...editingDish, image_url: e.target.value })}
                        className="w-full bg-[#080808] border border-[#242424] rounded-xl px-3 py-2 text-xs text-[#F6EFE7] focus:outline-none focus:border-[#D8B58A]"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#242424]">
                    <button
                      type="button"
                      onClick={() => setEditingDish(null)}
                      className="px-4 py-2 rounded-xl bg-[#242424] text-xs text-[#A8A29E] hover:text-[#F6EFE7]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={menuLoading || isUploadingImage}
                      className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-[#D8B58A] to-[#C99A8A] text-[#080808] font-bold text-xs hover:opacity-95 disabled:opacity-50"
                    >
                      {menuLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Save Changes</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ARCHIVE DISH CONFIRMATION MODAL */}
          {archivingDish && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-2xl bg-[#171717] border border-[#242424] p-6 space-y-4">
                <div className="flex items-center gap-3 text-[#C96B6B]">
                  <div className="p-2.5 rounded-full bg-[#C96B6B]/20 border border-[#C96B6B]/40">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-serif text-base font-bold text-[#F6EFE7]">Archive Dish?</h3>
                    <p className="text-xs text-[#A8A29E] mt-0.5">{archivingDish.name}</p>
                  </div>
                </div>

                <p className="text-xs text-[#A8A29E] leading-relaxed">
                  Archiving removes this dish from the customer menu while safely preserving past order histories, receipts, and revenue analytics.
                </p>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#242424]">
                  <button
                    onClick={() => setArchivingDish(null)}
                    className="px-4 py-2 rounded-xl bg-[#242424] text-xs text-[#A8A29E] hover:text-[#F6EFE7]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleArchiveDish}
                    disabled={menuLoading}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#C96B6B] text-white font-bold text-xs hover:opacity-95 disabled:opacity-50"
                  >
                    {menuLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Confirm Archive</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: TABLES & QR TOKENS */}
      {activeTab === "tables" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[#171717] border border-[#C99A8A]/30">
            <div>
              <h2 className="font-serif text-lg font-medium text-[#F6EFE7]">
                Table Layout & Secure QR Code Tokens
              </h2>
              <p className="text-xs text-[#A8A29E] mt-0.5">
                {tables.length} production dining tables active for this café
              </p>
            </div>
            <Link
              href="/admin/qr-codes"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#D8B58A] to-[#C99A8A] text-[#080808] font-bold text-xs shadow-lg shadow-black/40 hover:opacity-95 transition-opacity"
            >
              <QrCode className="w-4 h-4" />
              <span>Launch QR Standee Generator</span>
            </Link>
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

      {/* TAB 4: STAFF ACCOUNTS & ROLE-BASED ACCESS */}
      {activeTab === "staff" && (
        <div className="space-y-4">
          {staffFeedback && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
                staffFeedback.type === "success"
                  ? "bg-[#6FAF82]/15 border-[#6FAF82]/30 text-[#6FAF82]"
                  : "bg-[#C96B6B]/15 border-[#C96B6B]/30 text-[#C96B6B]"
              }`}
            >
              <div className="flex items-center gap-2">
                {staffFeedback.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{staffFeedback.message}</span>
              </div>
              <button
                onClick={() => setStaffFeedback(null)}
                className="opacity-70 hover:opacity-100 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Top Bar: Title & Add Staff Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[#171717] border border-[#242424]">
            <div>
              <h2 className="font-serif text-lg font-medium text-[#F6EFE7]">
                Staff Directory & Terminal Access
              </h2>
              <p className="text-xs text-[#A8A29E] mt-0.5">
                {staffList.length} total staff accounts configured for Velvet Bloom Café
              </p>
            </div>
            <button
              onClick={() => setIsAddStaffOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#D8B58A] to-[#C99A8A] text-[#080808] font-bold text-xs shadow-lg shadow-black/40 hover:opacity-95 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              <span>Add Staff Member</span>
            </button>
          </div>

          {/* Search & Filters */}
          <div className="p-4 rounded-2xl bg-[#171717] border border-[#242424] space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A8A29E]" />
                <input
                  type="text"
                  placeholder="Search staff by full name or email..."
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  className="w-full bg-[#080808] border border-[#242424] rounded-xl pl-9 pr-4 py-2 text-xs text-[#F6EFE7] placeholder-[#A8A29E]/60 focus:outline-none focus:border-[#D8B58A]"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1 bg-[#080808] p-1 rounded-xl border border-[#242424]">
                {(["ALL", "ACTIVE", "INACTIVE"] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStaffStatusFilter(filter)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                      staffStatusFilter === filter
                        ? "bg-[#D8B58A]/20 text-[#D8B58A] border border-[#D8B58A]/30"
                        : "text-[#A8A29E] hover:text-[#F6EFE7]"
                    }`}
                  >
                    {filter === "ALL" ? "All" : filter === "ACTIVE" ? "Active" : "Inactive"}
                  </button>
                ))}
              </div>
            </div>

            {/* Role Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {(["ALL", "OWNER", "MANAGER", "CHEF", "WAITER", "CASHIER", "STAFF"] as const).map((role) => {
                const count =
                  role === "ALL"
                    ? staffList.length
                    : staffList.filter((u) => u.role === role).length;
                return (
                  <button
                    key={role}
                    onClick={() => setStaffRoleFilter(role)}
                    className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap font-medium transition-all ${
                      staffRoleFilter === role
                        ? "bg-[#D8B58A] text-[#080808] font-bold shadow-sm"
                        : "bg-[#080808] text-[#A8A29E] hover:text-[#F6EFE7] border border-[#242424]"
                    }`}
                  >
                    {role === "ALL" ? "All Roles" : role} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Staff Table */}
          {(() => {
            const filteredStaff = staffList.filter((u) => {
              if (
                staffSearch.trim() &&
                !u.full_name.toLowerCase().includes(staffSearch.toLowerCase()) &&
                !u.email.toLowerCase().includes(staffSearch.toLowerCase())
              ) {
                return false;
              }
              if (staffRoleFilter !== "ALL" && u.role !== staffRoleFilter) return false;
              if (staffStatusFilter === "ACTIVE" && !u.is_active) return false;
              if (staffStatusFilter === "INACTIVE" && u.is_active) return false;
              return true;
            });

            if (filteredStaff.length === 0) {
              return (
                <div className="p-12 text-center rounded-2xl border border-[#242424] bg-[#171717]">
                  <Users className="w-8 h-8 text-[#A8A29E]/40 mx-auto mb-2" />
                  <p className="text-sm font-medium text-[#F6EFE7]">No staff members found</p>
                  <p className="text-xs text-[#A8A29E] mt-1">Try adjusting your search query or role filter</p>
                </div>
              );
            }

            return (
              <div className="p-4 rounded-2xl border border-[#242424] bg-[#171717] overflow-x-auto">
                <table className="w-full text-left text-xs text-[#A8A29E]">
                  <thead className="border-b border-[#242424] text-[10px] uppercase tracking-wider text-[#D8B58A]">
                    <tr>
                      <th className="py-2.5 px-3">Staff Member</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Quick PIN</th>
                      <th className="py-2.5 px-3">Contact</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#242424]/60">
                    {filteredStaff.map((u) => {
                      const isOwner = u.role === "OWNER";
                      const initials = u.full_name
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase();

                      return (
                        <tr key={u.id} className="hover:bg-[#242424]/40 transition-colors">
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                  isOwner
                                    ? "bg-[#D8B58A] text-[#080808]"
                                    : "bg-[#242424] text-[#F6EFE7] border border-[#333]"
                                }`}
                              >
                                {initials}
                              </div>
                              <div>
                                <span className="font-medium text-[#F6EFE7] block">{u.full_name}</span>
                                <span className="text-[10px] text-[#A8A29E] font-mono">{u.email}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                u.role === "OWNER"
                                  ? "bg-[#D8B58A]/20 text-[#D8B58A] border border-[#D8B58A]/40"
                                  : u.role === "CHEF"
                                  ? "bg-[#C99A8A]/20 text-[#DFB8AA] border border-[#C99A8A]/40"
                                  : u.role === "WAITER"
                                  ? "bg-[#6FAF82]/20 text-[#6FAF82] border border-[#6FAF82]/40"
                                  : u.role === "CASHIER"
                                  ? "bg-[#4E9F90]/20 text-[#67C7B5] border border-[#4E9F90]/40"
                                  : "bg-[#242424] text-[#A8A29E] border border-[#333]"
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[#D8B58A] text-[11px] tracking-wider">
                                ••••
                              </span>
                              <button
                                onClick={() => setResetPinStaff(u)}
                                className="px-2 py-0.5 rounded bg-[#242424] hover:bg-[#2e2e2e] text-[10px] text-[#D8B58A] transition-colors"
                              >
                                Reset PIN
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="text-[11px] text-[#A8A29E] font-mono">
                              {u.phone || "—"}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <button
                              onClick={() => handleToggleStaffStatus(u)}
                              disabled={isOwner}
                              title={isOwner ? "Primary Owner account cannot be deactivated" : "Toggle active state"}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border ${
                                u.is_active
                                  ? "bg-[#6FAF82]/15 border-[#6FAF82]/30 text-[#6FAF82] hover:bg-[#6FAF82]/25"
                                  : "bg-[#C96B6B]/15 border-[#C96B6B]/30 text-[#C96B6B] hover:bg-[#C96B6B]/25"
                              } ${isOwner ? "cursor-not-allowed opacity-90" : "cursor-pointer"}`}
                            >
                              {u.is_active ? "Active" : "Deactivated"}
                            </button>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setEditingStaff(u)}
                                className="p-1.5 rounded-lg text-[#A8A29E] hover:text-[#D8B58A] hover:bg-[#242424] transition-colors"
                                title="Edit Staff Details"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setResetPinStaff(u)}
                                className="p-1.5 rounded-lg text-[#A8A29E] hover:text-[#D8B58A] hover:bg-[#242424] transition-colors"
                                title="Change Terminal PIN"
                              >
                                <Key className="w-3.5 h-3.5" />
                              </button>
                              {!isOwner && (
                                <button
                                  onClick={() => handleToggleStaffStatus(u)}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    u.is_active
                                      ? "text-[#A8A29E] hover:text-[#C96B6B] hover:bg-[#242424]"
                                      : "text-[#A8A29E] hover:text-[#6FAF82] hover:bg-[#242424]"
                                  }`}
                                  title={u.is_active ? "Deactivate Account" : "Activate Account"}
                                >
                                  {u.is_active ? (
                                    <UserX className="w-3.5 h-3.5" />
                                  ) : (
                                    <UserCheck className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {/* ADD STAFF MODAL */}
          {isAddStaffOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-2xl bg-[#171717] border border-[#242424] p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#242424]">
                  <div>
                    <h3 className="font-serif text-lg font-bold text-[#F6EFE7]">Add Staff Member</h3>
                    <p className="text-xs text-[#A8A29E]">Provision new team member with terminal Quick PIN</p>
                  </div>
                  <button
                    onClick={() => setIsAddStaffOpen(false)}
                    className="p-1.5 text-[#A8A29E] hover:text-[#F6EFE7] rounded-lg hover:bg-[#242424]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleCreateStaff} className="space-y-4">
                  <div>
                    <label className="text-xs text-[#A8A29E] block mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Maya Lin"
                      value={newStaffForm.fullName}
                      onChange={(e) => setNewStaffForm({ ...newStaffForm, fullName: e.target.value })}
                      className="w-full bg-[#080808] border border-[#242424] rounded-xl px-3 py-2 text-xs text-[#F6EFE7] focus:outline-none focus:border-[#D8B58A]"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-[#A8A29E] block mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="maya@velvetbloom.cafe"
                      value={newStaffForm.email}
                      onChange={(e) => setNewStaffForm({ ...newStaffForm, email: e.target.value })}
                      className="w-full bg-[#080808] border border-[#242424] rounded-xl px-3 py-2 text-xs text-[#F6EFE7] focus:outline-none focus:border-[#D8B58A]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-[#A8A29E] block mb-1">Operational Role *</label>
                      <select
                        value={newStaffForm.role}
                        onChange={(e) =>
                          setNewStaffForm({ ...newStaffForm, role: e.target.value as UserRole })
                        }
                        className="w-full bg-[#080808] border border-[#242424] rounded-xl px-3 py-2 text-xs text-[#F6EFE7] focus:outline-none focus:border-[#D8B58A]"
                      >
                        <option value="WAITER">WAITER (Floor)</option>
                        <option value="CHEF">CHEF (Kitchen)</option>
                        <option value="CASHIER">CASHIER (Billing)</option>
                        <option value="MANAGER">MANAGER (Operations)</option>
                        <option value="STAFF">GENERAL STAFF</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-[#A8A29E] block mb-1">Quick PIN (4-6 digits) *</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        required
                        placeholder="••••"
                        value={newStaffForm.pin}
                        onChange={(e) =>
                          setNewStaffForm({
                            ...newStaffForm,
                            pin: e.target.value.replace(/[^0-9]/g, ""),
                          })
                        }
                        className="w-full bg-[#080808] border border-[#242424] rounded-xl px-3 py-2 text-xs text-[#F6EFE7] font-mono tracking-widest focus:outline-none focus:border-[#D8B58A]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-[#A8A29E] block mb-1">Phone Number (Optional)</label>
                    <input
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={newStaffForm.phone}
                      onChange={(e) => setNewStaffForm({ ...newStaffForm, phone: e.target.value })}
                      className="w-full bg-[#080808] border border-[#242424] rounded-xl px-3 py-2 text-xs text-[#F6EFE7] focus:outline-none focus:border-[#D8B58A]"
                    />
                  </div>

                  <div className="p-3 rounded-xl bg-[#080808] border border-[#242424] text-[10px] text-[#A8A29E] flex items-start gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#6FAF82] shrink-0 mt-0.5" />
                    <span>
                      Quick PIN will be hashed with cryptographic bcrypt salt ($2b$08). Plaintext PIN is never stored or transmitted.
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#242424]">
                    <button
                      type="button"
                      onClick={() => setIsAddStaffOpen(false)}
                      className="px-4 py-2 rounded-xl bg-[#242424] text-xs text-[#A8A29E] hover:text-[#F6EFE7]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={staffLoading}
                      className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-[#D8B58A] to-[#C99A8A] text-[#080808] font-bold text-xs hover:opacity-95 disabled:opacity-50"
                    >
                      {staffLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Create Account</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* EDIT STAFF MODAL */}
          {editingStaff && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-2xl bg-[#171717] border border-[#242424] p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#242424]">
                  <div>
                    <h3 className="font-serif text-lg font-bold text-[#F6EFE7]">Edit Staff Member</h3>
                    <p className="text-xs text-[#A8A29E]">{editingStaff.full_name}</p>
                  </div>
                  <button
                    onClick={() => setEditingStaff(null)}
                    className="p-1.5 text-[#A8A29E] hover:text-[#F6EFE7] rounded-lg hover:bg-[#242424]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleUpdateStaff} className="space-y-4">
                  <div>
                    <label className="text-xs text-[#A8A29E] block mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={editingStaff.full_name}
                      onChange={(e) =>
                        setEditingStaff({ ...editingStaff, full_name: e.target.value })
                      }
                      className="w-full bg-[#080808] border border-[#242424] rounded-xl px-3 py-2 text-xs text-[#F6EFE7] focus:outline-none focus:border-[#D8B58A]"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-[#A8A29E] block mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={editingStaff.email}
                      onChange={(e) =>
                        setEditingStaff({ ...editingStaff, email: e.target.value })
                      }
                      className="w-full bg-[#080808] border border-[#242424] rounded-xl px-3 py-2 text-xs text-[#F6EFE7] focus:outline-none focus:border-[#D8B58A]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-[#A8A29E] block mb-1">Operational Role</label>
                      <select
                        disabled={editingStaff.role === "OWNER"}
                        value={editingStaff.role}
                        onChange={(e) =>
                          setEditingStaff({ ...editingStaff, role: e.target.value as UserRole })
                        }
                        className="w-full bg-[#080808] border border-[#242424] rounded-xl px-3 py-2 text-xs text-[#F6EFE7] focus:outline-none focus:border-[#D8B58A] disabled:opacity-50"
                      >
                        {editingStaff.role === "OWNER" && <option value="OWNER">OWNER</option>}
                        <option value="WAITER">WAITER</option>
                        <option value="CHEF">CHEF</option>
                        <option value="CASHIER">CASHIER</option>
                        <option value="MANAGER">MANAGER</option>
                        <option value="STAFF">GENERAL STAFF</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-[#A8A29E] block mb-1">Phone Number</label>
                      <input
                        type="tel"
                        value={editingStaff.phone || ""}
                        onChange={(e) =>
                          setEditingStaff({ ...editingStaff, phone: e.target.value })
                        }
                        className="w-full bg-[#080808] border border-[#242424] rounded-xl px-3 py-2 text-xs text-[#F6EFE7] focus:outline-none focus:border-[#D8B58A]"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#242424]">
                    <button
                      type="button"
                      onClick={() => setEditingStaff(null)}
                      className="px-4 py-2 rounded-xl bg-[#242424] text-xs text-[#A8A29E] hover:text-[#F6EFE7]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={staffLoading}
                      className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-[#D8B58A] to-[#C99A8A] text-[#080808] font-bold text-xs hover:opacity-95 disabled:opacity-50"
                    >
                      {staffLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Save Changes</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* RESET PIN MODAL */}
          {resetPinStaff && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className="w-full max-w-sm rounded-2xl bg-[#171717] border border-[#242424] p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#242424]">
                  <div>
                    <h3 className="font-serif text-lg font-bold text-[#F6EFE7]">Reset Quick PIN</h3>
                    <p className="text-xs text-[#A8A29E]">{resetPinStaff.full_name} ({resetPinStaff.role})</p>
                  </div>
                  <button
                    onClick={() => setResetPinStaff(null)}
                    className="p-1.5 text-[#A8A29E] hover:text-[#F6EFE7] rounded-lg hover:bg-[#242424]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleResetStaffPin} className="space-y-4">
                  <div>
                    <label className="text-xs text-[#A8A29E] block mb-1">New Quick PIN (4-6 digits) *</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      placeholder="••••"
                      value={newPinValue}
                      onChange={(e) => setNewPinValue(e.target.value.replace(/[^0-9]/g, ""))}
                      className="w-full bg-[#080808] border border-[#242424] rounded-xl px-3 py-2 text-xs text-[#F6EFE7] font-mono tracking-widest focus:outline-none focus:border-[#D8B58A]"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-[#A8A29E] block mb-1">Confirm New PIN *</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      placeholder="••••"
                      value={confirmPinValue}
                      onChange={(e) => setConfirmPinValue(e.target.value.replace(/[^0-9]/g, ""))}
                      className="w-full bg-[#080808] border border-[#242424] rounded-xl px-3 py-2 text-xs text-[#F6EFE7] font-mono tracking-widest focus:outline-none focus:border-[#D8B58A]"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#242424]">
                    <button
                      type="button"
                      onClick={() => setResetPinStaff(null)}
                      className="px-4 py-2 rounded-xl bg-[#242424] text-xs text-[#A8A29E] hover:text-[#F6EFE7]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={staffLoading || !newPinValue || newPinValue !== confirmPinValue}
                      className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-[#D8B58A] to-[#C99A8A] text-[#080808] font-bold text-xs hover:opacity-95 disabled:opacity-50"
                    >
                      {staffLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Update PIN</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
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
