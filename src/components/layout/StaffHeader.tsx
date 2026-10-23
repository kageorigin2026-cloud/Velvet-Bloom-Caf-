"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CafeLogo } from "@/components/brand/CafeLogo";
import { AudioAlertPlayer } from "@/components/ui/AudioAlertPlayer";
import { UtensilsCrossed, Receipt, ShieldCheck, LogOut, Radio } from "lucide-react";

interface StaffHeaderProps {
  currentRole?: string;
  staffName?: string;
}

export function StaffHeader({ currentRole = "STAFF", staffName = "Staff Member" }: StaffHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/staff-logout", { method: "POST" });
    } catch {
      // Ignore network errors
    }
    localStorage.removeItem("vb_staff_token");
    localStorage.removeItem("vb_staff_user");
    router.push("/staff/login");
  };

  const navLinks = [
    { href: "/chef", label: "Kitchen Display", icon: UtensilsCrossed, roles: ["CHEF", "OWNER", "ADMIN", "STAFF"] },
    { href: "/staff", label: "Service & Billing", icon: Receipt, roles: ["STAFF", "OWNER", "ADMIN", "WAITER", "CASHIER"] },
    { href: "/admin", label: "Admin & Analytics", icon: ShieldCheck, roles: ["OWNER", "ADMIN"] },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#242424] bg-[#080808]/90 backdrop-blur-md px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <CafeLogo size="sm" showTagline={false} showPoweredBy={false} href="/" />

          <nav className="hidden md:flex items-center gap-1.5" aria-label="Staff roles navigation">
            {navLinks.map((link) => {
              const isActive = pathname.startsWith(link.href);
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-[#C99A8A]/15 text-[#D8B58A] border border-[#C99A8A]/30 shadow-sm"
                      : "text-[#A8A29E] hover:text-[#F6EFE7] hover:bg-[#171717]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {/* Live Sync Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#171717] border border-[#242424] text-[10px] text-[#A8A29E]">
            <Radio className="w-3 h-3 text-[#6FAF82] animate-pulse" />
            <span className="text-[#6FAF82] font-semibold">Live Synced</span>
          </div>

          {/* Sound alert player with Web Audio API chime */}
          <AudioAlertPlayer />

          {/* User info & Logout */}
          <div className="flex items-center gap-2 pl-2 border-l border-[#242424]">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-medium text-[#F6EFE7] leading-tight">{staffName}</span>
              <span className="text-[10px] text-[#C99A8A] uppercase tracking-wider font-semibold">
                {currentRole}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-[#A8A29E] hover:text-[#C96B6B] hover:bg-[#242424]/60 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

