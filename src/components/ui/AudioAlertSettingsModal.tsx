"use client";

import React, { useState } from "react";
import { useNotification } from "@/lib/audio/notification-context";
import {
  SoundEventType,
  SOUND_EVENT_LABELS,
  validateAudioFile,
} from "@/lib/audio/sound-types";
import { Button } from "./Button";
import {
  Volume2,
  VolumeX,
  Play,
  Upload,
  Trash2,
  Check,
  X,
  AlertCircle,
  Sliders,
  Sparkles,
} from "lucide-react";

interface AudioAlertSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AudioAlertSettingsModal({ isOpen, onClose }: AudioAlertSettingsModalProps) {
  const {
    role,
    settings,
    updateSettings,
    testSound,
    uploadCustomSound,
    removeCustomSound,
    unlockAudio,
  } = useNotification();

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [testingType, setTestingType] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTest = async (type: SoundEventType) => {
    setTestingType(type);
    await testSound(type);
    setTimeout(() => setTestingType(null), 800);
  };

  const handleFileUpload = async (type: SoundEventType, e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    setUploadSuccess(null);

    const file = e.target.files?.[0];
    if (!file) return;

    const res = await uploadCustomSound(type, file);
    if (!res.success) {
      setUploadError(res.error || "Failed to upload audio file");
    } else {
      setUploadSuccess(`Custom sound saved for "${SOUND_EVENT_LABELS[type].label}"`);
      setTimeout(() => setUploadSuccess(null), 2500);
    }
    // Reset file input
    e.target.value = "";
  };

  const soundEventKeys = Object.keys(SOUND_EVENT_LABELS) as SoundEventType[];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-xl rounded-3xl border border-[#C99A8A]/30 bg-[#171717] p-6 shadow-2xl text-[#F6EFE7] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#242424]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#C99A8A]/20 flex items-center justify-center text-[#DFB8AA]">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-medium text-lg text-[#F6EFE7]">
                Audio & Notification Preferences
              </h3>
              <p className="text-xs text-[#A8A29E]">
                Configured for {role} Terminal
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-full text-[#A8A29E] hover:text-white hover:bg-[#242424]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {uploadError && (
          <div className="mt-4 p-3 rounded-xl bg-[#C96B6B]/20 border border-[#C96B6B]/40 text-xs text-[#C96B6B]">
            {uploadError}
          </div>
        )}

        {uploadSuccess && (
          <div className="mt-4 p-3 rounded-xl bg-[#6FAF82]/20 border border-[#6FAF82]/40 text-xs text-[#6FAF82] flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{uploadSuccess}</span>
          </div>
        )}

        <div className="py-4 space-y-6">
          {/* Master Toggle & Volume */}
          <div className="p-4 rounded-2xl bg-[#080808] border border-[#242424] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-[#F6EFE7] block">Master Sound Alerts</span>
                <span className="text-xs text-[#A8A29E]">Enable or mute all audible notification chimes</span>
              </div>
              <button
                onClick={async () => {
                  const next = !settings.enabled;
                  if (next) await unlockAudio();
                  updateSettings({ enabled: next });
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                  settings.enabled
                    ? "bg-[#6FAF82]/20 border-[#6FAF82]/40 text-[#6FAF82]"
                    : "bg-[#242424] border-[#333] text-[#A8A29E]"
                }`}
              >
                {settings.enabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                <span>{settings.enabled ? "Enabled" : "Muted"}</span>
              </button>
            </div>

            {/* Volume Slider */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-[#A8A29E]">Alert Volume</span>
                <span className="font-mono font-bold text-[#D8B58A]">
                  {Math.round(settings.volume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.volume}
                onChange={(e) => updateSettings({ volume: parseFloat(e.target.value) })}
                className="w-full accent-[#C99A8A] cursor-pointer"
              />
            </div>

            {/* Repeating Alerts for Chef */}
            {role === "CHEF" && (
              <div className="pt-3 border-t border-[#242424] space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-xs font-semibold text-[#F6EFE7] block">
                      Repeat Alerts for Unacknowledged Orders
                    </span>
                    <span className="text-[11px] text-[#A8A29E]">
                      Repeats chime periodically until the chef accepts or acknowledges the ticket
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.repeatPendingAlert}
                    onChange={(e) => updateSettings({ repeatPendingAlert: e.target.checked })}
                    className="w-4 h-4 accent-[#C99A8A]"
                  />
                </label>

                {settings.repeatPendingAlert && (
                  <div>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-[#A8A29E]">Repeat Frequency</span>
                      <span className="font-mono text-[#D8B58A]">
                        Every {settings.repeatIntervalSeconds} seconds
                      </span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={45}
                      step={5}
                      value={settings.repeatIntervalSeconds}
                      onChange={(e) =>
                        updateSettings({ repeatIntervalSeconds: parseInt(e.target.value) })
                      }
                      className="w-full accent-[#D8B58A] cursor-pointer"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sound Events & Custom Audio Uploads */}
          <div>
            <h4 className="font-serif text-sm font-semibold text-[#F6EFE7] mb-3">
              Event Sounds & Custom Audio
            </h4>

            <div className="space-y-3">
              {soundEventKeys.map((type) => {
                const info = SOUND_EVENT_LABELS[type];
                const isEnabled = settings.enabledEvents[type] ?? true;
                const custom = settings.customSounds[type];

                return (
                  <div
                    key={type}
                    className="p-3.5 rounded-xl border border-[#242424] bg-[#171717]/80 hover:bg-[#1f1f1f]/60 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={(e) =>
                            updateSettings({
                              enabledEvents: {
                                ...settings.enabledEvents,
                                [type]: e.target.checked,
                              },
                            })
                          }
                          className="w-4 h-4 mt-0.5 accent-[#C99A8A]"
                        />
                        <div>
                          <span className="text-xs font-semibold text-[#F6EFE7] block">
                            {info.label}
                          </span>
                          <span className="text-[11px] text-[#A8A29E] leading-relaxed">
                            {info.description}
                          </span>
                          {custom ? (
                            <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-[#D8B58A] bg-[#242424] px-2 py-0.5 rounded">
                              <Sparkles className="w-3 h-3 text-[#C99A8A]" />
                              Custom: {custom.fileName} ({(custom.fileSize / 1024).toFixed(0)} KB)
                            </span>
                          ) : (
                            <span className="mt-1 inline-block text-[10px] text-[#A8A29E]/70 italic">
                              Built-in synthesized audio
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 self-end sm:self-auto flex-shrink-0">
                        {/* Test button */}
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8 px-2.5 text-xs text-[#D8B58A]"
                          onClick={() => handleTest(type)}
                          disabled={testingType === type}
                        >
                          <Play className={`w-3 h-3 fill-current ${testingType === type ? "animate-spin" : ""}`} />
                          <span>Test</span>
                        </Button>

                        {/* Custom Upload Button */}
                        <label className="cursor-pointer h-8 px-2.5 rounded-lg bg-[#242424] hover:bg-[#2e2e2e] text-xs text-[#F6EFE7] border border-[#3e3e3e] flex items-center gap-1.5 transition-colors">
                          <Upload className="w-3 h-3 text-[#A8A29E]" />
                          <span>Upload</span>
                          <input
                            type="file"
                            accept="audio/mp3,audio/wav,audio/ogg,audio/*"
                            className="hidden"
                            onChange={(e) => handleFileUpload(type, e)}
                          />
                        </label>

                        {/* Remove custom sound */}
                        {custom && (
                          <button
                            onClick={() => removeCustomSound(type)}
                            className="p-1.5 rounded-lg text-[#C96B6B] hover:bg-[#C96B6B]/20 transition-colors"
                            title="Reset to default synthesized chime"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Accessibility & Device Volume Notice */}
          <div className="p-3.5 rounded-xl bg-[#242424]/30 border border-[#242424] text-[11px] text-[#A8A29E] leading-relaxed flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-[#D8B58A] flex-shrink-0 mt-0.5" />
            <p>
              Audible alarms respect operating system volume settings and physical device silent switches. Critical operational events are always paired with on-screen visual banners and toasts.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-[#242424] flex justify-end">
          <Button variant="primary" onClick={onClose} className="px-6 py-2 text-xs font-bold">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

