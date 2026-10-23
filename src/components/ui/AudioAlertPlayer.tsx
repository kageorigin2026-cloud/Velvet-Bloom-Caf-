"use client";

import React, { useState } from "react";
import { Volume2, VolumeX, BellRing, SlidersHorizontal } from "lucide-react";
import { useNotification } from "@/lib/audio/notification-context";
import { AudioAlertSettingsModal } from "./AudioAlertSettingsModal";
import { soundEngine } from "@/lib/audio/sound-engine";
import { SoundEventType } from "@/lib/audio/sound-types";

// Retain legacy export for backward compatibility
export function playSynthesizedChime(tone: "new_order" | "ready" | "service" = "new_order") {
  const map: Record<string, SoundEventType> = {
    new_order: "new_order",
    ready: "order_ready",
    service: "service_request",
  };
  soundEngine.playSound(map[tone] || "new_order", { force: true });
}

interface AudioAlertPlayerProps {
  className?: string;
}

export function AudioAlertPlayer({ className }: AudioAlertPlayerProps) {
  const { role, settings, updateSettings, testSound, unlockAudio } = useNotification();
  const [modalOpen, setModalOpen] = useState(false);
  const [testing, setTesting] = useState(false);

  const toggleSound = async () => {
    const nextState = !settings.enabled;
    if (nextState) {
      await unlockAudio();
    }
    updateSettings({ enabled: nextState });
  };

  const handleQuickTest = async () => {
    setTesting(true);
    const testType = role === "CHEF" ? "new_order" : role === "ADMIN" ? "alert_urgent" : "order_ready";
    await testSound(testType);
    setTimeout(() => setTesting(false), 800);
  };

  return (
    <>
      <div className={`flex items-center gap-1.5 ${className || ""}`}>
        {/* Toggle Sound Button */}
        <button
          onClick={toggleSound}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
            settings.enabled
              ? "border-[#6FAF82]/40 bg-[#6FAF82]/10 text-[#6FAF82] hover:bg-[#6FAF82]/20"
              : "border-[#A8A29E]/30 bg-[#242424]/40 text-[#A8A29E] hover:text-[#F6EFE7]"
          }`}
          title={settings.enabled ? `Audio on (${Math.round(settings.volume * 100)}%) - Click to mute` : "Audio muted - Click to enable"}
        >
          {settings.enabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">
            {settings.enabled ? `${Math.round(settings.volume * 100)}%` : "Muted"}
          </span>
        </button>

        {/* Quick Test Button */}
        {settings.enabled && (
          <button
            onClick={handleQuickTest}
            disabled={testing}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-[#D8B58A] bg-[#242424]/60 border border-[#D8B58A]/30 hover:bg-[#242424] transition-colors"
            title="Test alert sound"
          >
            <BellRing className={`w-3 h-3 ${testing ? "animate-spin" : ""}`} />
            <span className="hidden md:inline">Test</span>
          </button>
        )}

        {/* Audio Preferences Modal Trigger */}
        <button
          onClick={() => setModalOpen(true)}
          className="p-1.5 rounded-lg text-[#A8A29E] hover:text-[#D8B58A] hover:bg-[#242424]/60 border border-transparent hover:border-[#242424] transition-colors"
          title="Audio & Notification Settings"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>

      <AudioAlertSettingsModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
