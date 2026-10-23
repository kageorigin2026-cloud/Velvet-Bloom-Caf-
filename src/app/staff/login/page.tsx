"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { CafeLogo } from "@/components/brand/CafeLogo";
import { Button } from "@/components/ui/Button";
import { Lock, Mail, KeyRound, Sparkles } from "lucide-react";

export default function StaffLoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState("");
  const [activeMode, setActiveMode] = useState<"pin" | "email">("pin");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (overridePin?: string, overrideEmail?: string) => {
    setIsLoading(true);
    setErrorMessage(null);

    const targetPin = overridePin !== undefined ? overridePin : pin;
    const targetEmail = overrideEmail !== undefined ? overrideEmail : email;

    try {
      const res = await fetch("/api/auth/staff-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin: targetPin.trim() || undefined,
          email: targetEmail.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Invalid staff credentials");
      }

      const session = await res.json();
      localStorage.setItem("vb_staff_token", session.token);
      localStorage.setItem("vb_staff_user", JSON.stringify(session.user));

      // Route based on role
      if (session.user.role === "CHEF") {
        router.push("/chef");
      } else if (session.user.role === "OWNER" || session.user.role === "ADMIN") {
        router.push("/admin");
      } else {
        router.push("/staff");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to authenticate");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080808] text-[#F6EFE7] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm p-6 sm:p-8 rounded-3xl border border-[#C99A8A]/30 bg-[#171717]/80 backdrop-blur-xl shadow-2xl shadow-black/80">
        <div className="text-center mb-6">
          <CafeLogo size="md" showTagline={true} showPoweredBy={true} />
          <h2 className="font-serif text-lg font-medium text-[#F6EFE7] mt-4">
            Staff Access Terminal
          </h2>
          <p className="text-xs text-[#A8A29E] mt-0.5">
            Enter your PIN code or sign in with your account
          </p>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-[#C96B6B]/15 border border-[#C96B6B]/40 text-xs text-[#C96B6B] text-center">
            {errorMessage}
          </div>
        )}

        {/* Tab switch */}
        <div className="flex rounded-xl bg-[#080808] p-1 border border-[#242424] mb-5">
          <button
            onClick={() => setActiveMode("pin")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeMode === "pin"
                ? "bg-[#242424] text-[#D8B58A] shadow"
                : "text-[#A8A29E] hover:text-[#F6EFE7]"
            }`}
          >
            Quick PIN
          </button>
          <button
            onClick={() => setActiveMode("email")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeMode === "email"
                ? "bg-[#242424] text-[#D8B58A] shadow"
                : "text-[#A8A29E] hover:text-[#F6EFE7]"
            }`}
          >
            Email Login
          </button>
        </div>

        {activeMode === "pin" ? (
          <div className="space-y-4">
            <div>
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A8A29E]" />
                <input
                  type="password"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Enter 4-digit PIN"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#080808] border border-[#242424] text-center font-mono text-lg tracking-widest text-[#F6EFE7] focus:outline-none focus:border-[#C99A8A]"
                />
              </div>
            </div>

            <Button
              variant="primary"
              className="w-full py-2.5 text-xs font-bold"
              onClick={() => handleLogin()}
              isLoading={isLoading}
            >
              Sign In to Terminal
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-[11px] text-[#A8A29E] block mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A8A29E]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@velvetbloom.com"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#080808] border border-[#242424] text-xs text-[#F6EFE7] focus:outline-none focus:border-[#C99A8A]"
                />
              </div>
            </div>

            <Button
              variant="primary"
              className="w-full py-2.5 text-xs font-bold"
              onClick={() => handleLogin()}
              isLoading={isLoading}
            >
              Authenticate Account
            </Button>
          </div>
        )}

        {/* Demo Fast Logins for Local Testing */}
        <div className="mt-6 pt-5 border-t border-[#242424]">
          <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-[#A8A29E]/80 mb-2.5">
            <Sparkles className="w-3 h-3 text-[#D8B58A]" />
            <span>Fast Test Logins (Development)</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleLogin("1111", "")}
              className="p-2 rounded-lg bg-[#080808] border border-[#242424] text-center hover:border-[#C99A8A]/50 transition-colors"
            >
              <span className="text-[11px] font-semibold text-[#DFB8AA] block">Owner</span>
              <span className="text-[9px] text-[#A8A29E] font-mono">PIN: 1111</span>
            </button>

            <button
              onClick={() => handleLogin("2222", "")}
              className="p-2 rounded-lg bg-[#080808] border border-[#242424] text-center hover:border-[#D8B58A]/50 transition-colors"
            >
              <span className="text-[11px] font-semibold text-[#D8B58A] block">Chef</span>
              <span className="text-[9px] text-[#A8A29E] font-mono">PIN: 2222</span>
            </button>

            <button
              onClick={() => handleLogin("3333", "")}
              className="p-2 rounded-lg bg-[#080808] border border-[#242424] text-center hover:border-[#6FAF82]/50 transition-colors"
            >
              <span className="text-[11px] font-semibold text-[#6FAF82] block">Service</span>
              <span className="text-[9px] text-[#A8A29E] font-mono">PIN: 3333</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

