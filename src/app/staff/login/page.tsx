"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CafeLogo } from "@/components/brand/CafeLogo";
import { Button } from "@/components/ui/Button";
import { Lock, Mail, KeyRound, Sparkles, UserCheck, CheckCircle2 } from "lucide-react";

export default function StaffLoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [activeMode, setActiveMode] = useState<"pin" | "email">("pin");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initial Owner Setup State (Active only when no owner exists in database)
  const [hasOwner, setHasOwner] = useState<boolean | null>(null);
  const [ownerName, setOwnerName] = useState("Alexander Vance");
  const [ownerEmail, setOwnerEmail] = useState("owner@velvetbloom.com");
  const [ownerPin, setOwnerPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [setupSuccess, setSetupSuccess] = useState(false);

  useEffect(() => {
    async function checkOwnerStatus() {
      try {
        const res = await fetch("/api/auth/owner-status");
        if (res.ok) {
          const data = await res.json();
          setHasOwner(Boolean(data.hasOwner));
        } else {
          setHasOwner(true);
        }
      } catch {
        setHasOwner(true);
      }
    }
    checkOwnerStatus();
  }, []);

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
          password: password || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Invalid staff credentials");
      }

      localStorage.setItem("vb_staff_token", data.token);
      localStorage.setItem("vb_staff_user", JSON.stringify(data.user));

      // Route based on role
      if (data.user.role === "CHEF") {
        router.push("/chef");
      } else if (data.user.role === "OWNER" || data.user.role === "ADMIN") {
        router.push("/admin");
      } else {
        router.push("/staff");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to authenticate");
      setIsLoading(false);
    }
  };

  const handleInitialOwnerSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!ownerPin || ownerPin.length < 4 || ownerPin.length > 6) {
      setErrorMessage("Please enter a private PIN of 4 to 6 numeric digits.");
      return;
    }

    if (ownerPin !== confirmPin) {
      setErrorMessage("PIN confirmation does not match. Please re-enter.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/setup-owner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: ownerName,
          email: ownerEmail,
          pin: ownerPin,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to provision owner account");
      }

      setSetupSuccess(true);
      localStorage.setItem("vb_staff_token", data.token);
      localStorage.setItem("vb_staff_user", JSON.stringify(data.user));

      setTimeout(() => {
        router.push("/admin");
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || "Owner setup failed");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080808] text-[#F6EFE7] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm p-6 sm:p-8 rounded-3xl border border-[#C99A8A]/30 bg-[#171717]/80 backdrop-blur-xl shadow-2xl shadow-black/80">
        <div className="text-center mb-6">
          <CafeLogo size="md" showTagline={true} showPoweredBy={true} />
          <h2 className="font-serif text-lg font-medium text-[#F6EFE7] mt-4">
            {hasOwner === false ? "First-Time Owner Setup" : "Staff Access Terminal"}
          </h2>
          <p className="text-xs text-[#A8A29E] mt-0.5">
            {hasOwner === false
              ? "Initialize your Master Owner profile to unlock this café"
              : "Enter your PIN code or sign in with your staff account"}
          </p>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-[#C96B6B]/15 border border-[#C96B6B]/40 text-xs text-[#C96B6B] text-center">
            {errorMessage}
          </div>
        )}

        {setupSuccess && (
          <div className="mb-4 p-3 rounded-xl bg-[#6FAF82]/15 border border-[#6FAF82]/40 text-xs text-[#6FAF82] text-center flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#6FAF82]" />
            <span>Owner account initialized! Opening Admin Portal...</span>
          </div>
        )}

        {/* CASE 1: INITIAL OWNER ONBOARDING (When database has no owner yet) */}
        {hasOwner === false ? (
          <form onSubmit={handleInitialOwnerSetup} className="space-y-3.5">
            <div className="p-2.5 rounded-xl bg-[#D8B58A]/10 border border-[#D8B58A]/30 text-[11px] text-[#D8B58A] flex items-start gap-2">
              <UserCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                No Owner is currently configured for this café. Please set your private Master PIN
                below to secure your administration terminal.
              </span>
            </div>

            <div>
              <label className="text-[11px] text-[#A8A29E] block mb-1">Owner Full Name</label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-[#080808] border border-[#242424] text-xs text-[#F6EFE7] focus:outline-none focus:border-[#C99A8A]"
              />
            </div>

            <div>
              <label className="text-[11px] text-[#A8A29E] block mb-1">Email Address</label>
              <input
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-[#080808] border border-[#242424] text-xs text-[#F6EFE7] focus:outline-none focus:border-[#C99A8A]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-[#A8A29E] block mb-1">Private PIN (4-6 digits)</label>
                <input
                  type="password"
                  maxLength={6}
                  value={ownerPin}
                  onChange={(e) => setOwnerPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-[#080808] border border-[#242424] font-mono text-center text-sm tracking-widest text-[#F6EFE7] focus:outline-none focus:border-[#C99A8A]"
                />
              </div>

              <div>
                <label className="text-[11px] text-[#A8A29E] block mb-1">Confirm PIN</label>
                <input
                  type="password"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-[#080808] border border-[#242424] font-mono text-center text-sm tracking-widest text-[#F6EFE7] focus:outline-none focus:border-[#C99A8A]"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full py-2.5 text-xs font-bold mt-2"
              isLoading={isLoading}
            >
              Complete Owner Onboarding
            </Button>
          </form>
        ) : (
          /* CASE 2: REGULAR STAFF LOGIN (Quick PIN or Email) */
          <div>
            {/* Tab switch */}
            <div className="flex rounded-xl bg-[#080808] p-1 border border-[#242424] mb-5">
              <button
                type="button"
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
                type="button"
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
                      placeholder="Enter Staff PIN"
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

                <div>
                  <label className="text-[11px] text-[#A8A29E] block mb-1">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A8A29E]" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
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
          </div>
        )}
      </div>
    </div>
  );
}
