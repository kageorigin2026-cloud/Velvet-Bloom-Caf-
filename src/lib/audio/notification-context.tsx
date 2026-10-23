"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import {
  SoundEventType,
  RoleNotificationSettings,
  DEFAULT_CHEF_SETTINGS,
  DEFAULT_STAFF_SETTINGS,
  DEFAULT_ADMIN_SETTINGS,
  CustomSoundInfo,
  validateAudioFile,
} from "./sound-types";
import { soundEngine } from "./sound-engine";

export interface VisualNotification {
  id: string;
  type: SoundEventType;
  title: string;
  message: string;
  timestamp: string;
  actionUrl?: string;
}

export interface ActiveRepeatingAlert {
  alertId: string;
  title: string;
  subtitle: string;
  orderId?: string;
  soundType: SoundEventType;
}

interface NotificationContextType {
  role: "CHEF" | "STAFF" | "ADMIN";
  settings: RoleNotificationSettings;
  updateSettings: (partial: Partial<RoleNotificationSettings>) => void;
  isUnlocked: boolean;
  unlockAudio: () => Promise<boolean>;
  triggerSound: (
    type: SoundEventType,
    options?: {
      eventId?: string;
      title?: string;
      message?: string;
      force?: boolean;
    }
  ) => Promise<boolean>;
  testSound: (type: SoundEventType) => Promise<boolean>;
  uploadCustomSound: (type: SoundEventType, file: File) => Promise<{ success: boolean; error?: string }>;
  removeCustomSound: (type: SoundEventType) => void;
  activeRepeatingAlert: ActiveRepeatingAlert | null;
  startRepeatingAlert: (alert: ActiveRepeatingAlert) => void;
  acknowledgeRepeatingAlert: (alertId?: string) => void;
  visualNotifications: VisualNotification[];
  dismissVisualNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

function getStorageKey(role: "CHEF" | "STAFF" | "ADMIN") {
  return `vb_sound_settings_${role}`;
}

export function NotificationProvider({
  role = "STAFF",
  children,
}: {
  role?: "CHEF" | "STAFF" | "ADMIN";
  children: React.ReactNode;
}) {
  const [settings, setSettings] = useState<RoleNotificationSettings>(() => {
    switch (role) {
      case "CHEF":
        return DEFAULT_CHEF_SETTINGS;
      case "ADMIN":
        return DEFAULT_ADMIN_SETTINGS;
      default:
        return DEFAULT_STAFF_SETTINGS;
    }
  });

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [activeRepeatingAlert, setActiveRepeatingAlert] = useState<ActiveRepeatingAlert | null>(null);
  const [visualNotifications, setVisualNotifications] = useState<VisualNotification[]>([]);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Load role settings from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(getStorageKey(role));
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings((prev) => ({
          ...prev,
          ...parsed,
          role, // ensure role stays correct
        }));
      }
    } catch {
      // Ignore
    }
  }, [role]);

  // Sync state of audio engine unlock
  useEffect(() => {
    setIsUnlocked(soundEngine.getIsUnlocked());
  }, []);

  // Update Settings
  const updateSettings = useCallback(
    (partial: Partial<RoleNotificationSettings>) => {
      setSettings((prev) => {
        const updated = { ...prev, ...partial };
        try {
          localStorage.setItem(getStorageKey(role), JSON.stringify(updated));
        } catch {
          // Ignore
        }
        return updated;
      });
    },
    [role]
  );

  // Unlock Audio
  const unlockAudio = useCallback(async () => {
    const success = await soundEngine.unlockAudio();
    setIsUnlocked(success);
    return success;
  }, []);

  // Trigger Sound
  const triggerSound = useCallback(
    async (
      type: SoundEventType,
      options: {
        eventId?: string;
        title?: string;
        message?: string;
        force?: boolean;
      } = {}
    ) => {
      const current = settingsRef.current;

      // Add visual notification regardless of audio mute state so alerts are never sound-only
      if (options.title) {
        const visualId = `vis_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        setVisualNotifications((prev) => [
          {
            id: visualId,
            type,
            title: options.title!,
            message: options.message || "",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
          ...prev.slice(0, 4), // keep max 5 active
        ]);

        // Auto-dismiss visual notification after 7 seconds
        setTimeout(() => {
          setVisualNotifications((prev) => prev.filter((v) => v.id !== visualId));
        }, 7000);
      }

      // If sound is globally disabled or this specific event type is disabled in settings, skip audio
      if (!current.enabled && !options.force) return false;
      if (!current.enabledEvents[type] && !options.force) return false;

      const customSound = current.customSounds[type];

      return soundEngine.playSound(type, {
        volume: current.volume,
        eventId: options.eventId,
        customSound,
        force: options.force,
      });
    },
    []
  );

  // Test Sound
  const testSound = useCallback(
    async (type: SoundEventType) => {
      await unlockAudio();
      const current = settingsRef.current;
      const customSound = current.customSounds[type];
      return soundEngine.playSound(type, {
        volume: current.volume,
        customSound,
        force: true,
      });
    },
    [unlockAudio]
  );

  // Upload Custom Sound
  const uploadCustomSound = useCallback(
    async (type: SoundEventType, file: File): Promise<{ success: boolean; error?: string }> => {
      const validation = validateAudioFile(file);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const dataUrl = reader.result as string;
            const customInfo: CustomSoundInfo = {
              fileName: file.name,
              dataUrl,
              fileSize: file.size,
              mimeType: file.type,
              updatedAt: new Date().toISOString(),
            };

            setSettings((prev) => {
              const updated: RoleNotificationSettings = {
                ...prev,
                customSounds: {
                  ...prev.customSounds,
                  [type]: customInfo,
                },
              };
              try {
                localStorage.setItem(getStorageKey(role), JSON.stringify(updated));
              } catch (e) {
                console.warn("Storage quota exceeded for custom sound:", e);
              }
              return updated;
            });

            resolve({ success: true });
          } catch (err: any) {
            resolve({ success: false, error: err.message || "Failed to process audio file" });
          }
        };
        reader.onerror = () => {
          resolve({ success: false, error: "Error reading audio file" });
        };
        reader.readAsDataURL(file);
      });
    },
    [role]
  );

  // Remove Custom Sound
  const removeCustomSound = useCallback(
    (type: SoundEventType) => {
      setSettings((prev) => {
        const copy = { ...prev.customSounds };
        delete copy[type];
        const updated: RoleNotificationSettings = {
          ...prev,
          customSounds: copy,
        };
        try {
          localStorage.setItem(getStorageKey(role), JSON.stringify(updated));
        } catch {
          // Ignore
        }
        return updated;
      });
    },
    [role]
  );

  // Start Repeating Alert
  const startRepeatingAlert = useCallback(
    (alert: ActiveRepeatingAlert) => {
      setActiveRepeatingAlert(alert);

      const current = settingsRef.current;
      if (!current.repeatPendingAlert) return;

      soundEngine.startRepeatingAlert(
        alert.alertId,
        alert.soundType,
        current.repeatIntervalSeconds,
        () => {
          // Check if still repeating
          if (soundEngine.isAlertRepeating(alert.alertId)) {
            triggerSound(alert.soundType, {
              eventId: `${alert.alertId}_repeat_${Date.now()}`,
              force: true,
            });
          }
        }
      );
    },
    [triggerSound]
  );

  // Acknowledge Repeating Alert
  const acknowledgeRepeatingAlert = useCallback((alertId?: string) => {
    soundEngine.stopRepeatingAlert(alertId);
    setActiveRepeatingAlert(null);
  }, []);

  const dismissVisualNotification = useCallback((id: string) => {
    setVisualNotifications((prev) => prev.filter((v) => v.id !== id));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      soundEngine.stopRepeatingAlert();
    };
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        role,
        settings,
        updateSettings,
        isUnlocked,
        unlockAudio,
        triggerSound,
        testSound,
        uploadCustomSound,
        removeCustomSound,
        activeRepeatingAlert,
        startRepeatingAlert,
        acknowledgeRepeatingAlert,
        visualNotifications,
        dismissVisualNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used within a NotificationProvider");
  }
  return context;
}

