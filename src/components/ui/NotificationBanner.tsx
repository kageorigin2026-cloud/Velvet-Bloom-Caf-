"use client";

import React from "react";
import { useNotification } from "@/lib/audio/notification-context";
import {
  Volume2,
  VolumeX,
  BellRing,
  AlertCircle,
  Check,
  X,
  CheckCircle2,
  Utensils,
  Receipt,
} from "lucide-react";
import { Button } from "./Button";

export function NotificationBanner() {
  const {
    isUnlocked,
    unlockAudio,
    activeRepeatingAlert,
    acknowledgeRepeatingAlert,
    visualNotifications,
    dismissVisualNotification,
    settings,
  } = useNotification();

  return (
    <>
      {/* 1. Autoplay Unlock Banner (if sound enabled in settings but browser audio not unlocked with gesture) */}
      {settings.enabled && !isUnlocked && (
        <div className="w-full bg-gradient-to-r from-[#D8B58A]/20 via-[#C99A8A]/20 to-[#D8B58A]/20 border-b border-[#C99A8A]/40 px-4 py-2 text-xs text-[#F6EFE7] backdrop-blur-md">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <VolumeX className="w-4 h-4 text-[#D8B58A] animate-pulse flex-shrink-0" />
              <span>
                <strong className="text-[#D8B58A]">Audio Alerts Inactive:</strong> Browser autoplay restrictions require a single gesture to enable loud kitchen & service notifications.
              </span>
            </div>
            <button
              onClick={() => unlockAudio()}
              className="px-3 py-1 rounded-lg bg-gradient-to-r from-[#C99A8A] to-[#D8B58A] text-[#080808] font-bold shadow-md hover:opacity-95 transition-all text-xs flex items-center gap-1.5 flex-shrink-0"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Enable Notifications & Sound</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. Urgent Repeating Alert Bar (Chef unacknowledged orders) */}
      {activeRepeatingAlert && (
        <div className="w-full bg-[#C96B6B]/25 border-b border-[#C96B6B]/60 px-4 py-2.5 text-xs text-[#F6EFE7] backdrop-blur-lg animate-pulse">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <BellRing className="w-4 h-4 text-[#C96B6B] animate-bounce flex-shrink-0" />
              <div>
                <span className="font-bold text-[#F6EFE7] uppercase tracking-wide">
                  {activeRepeatingAlert.title}:
                </span>{" "}
                <span className="text-[#DFB8AA]">{activeRepeatingAlert.subtitle}</span>
                <span className="text-[10px] text-[#A8A29E] block sm:inline sm:ml-2">
                  (Audible alert repeating until acknowledged)
                </span>
              </div>
            </div>

            <Button
              size="sm"
              variant="primary"
              className="bg-[#C96B6B] hover:bg-[#d87c7c] text-white font-bold flex-shrink-0 text-xs py-1"
              onClick={() => acknowledgeRepeatingAlert(activeRepeatingAlert.alertId)}
            >
              <Check className="w-3.5 h-3.5" />
              <span>Acknowledge & Silence</span>
            </Button>
          </div>
        </div>
      )}

      {/* 3. Floating Visual Notifications Toast Stack */}
      {visualNotifications.length > 0 && (
        <div className="fixed top-16 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
          {visualNotifications.map((notif) => (
            <div
              key={notif.id}
              className="pointer-events-auto p-3.5 rounded-xl border border-[#C99A8A]/40 bg-[#171717]/95 shadow-2xl shadow-black/80 backdrop-blur-md text-xs text-[#F6EFE7] animate-in slide-in-from-top-2 duration-200"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-[#242424] flex items-center justify-center text-[#D8B58A] flex-shrink-0 border border-[#C99A8A]/30">
                    {notif.type === "new_order" || notif.type === "additional_item" ? (
                      <Utensils className="w-3.5 h-3.5" />
                    ) : notif.type === "payment_confirmed" || notif.type === "bill_requested" ? (
                      <Receipt className="w-3.5 h-3.5" />
                    ) : (
                      <BellRing className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-[#D8B58A]">{notif.title}</h5>
                    <p className="text-[11px] text-[#A8A29E] mt-0.5 leading-snug">{notif.message}</p>
                    <span className="text-[9px] text-[#A8A29E]/60 mt-1 block font-mono">
                      {notif.timestamp}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => dismissVisualNotification(notif.id)}
                  className="text-[#A8A29E] hover:text-[#F6EFE7] p-1 rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

