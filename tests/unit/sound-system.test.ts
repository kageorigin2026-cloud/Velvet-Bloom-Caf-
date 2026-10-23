import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { soundEngine } from "@/lib/audio/sound-engine";
import {
  SoundEventType,
  SOUND_EVENT_LABELS,
  DEFAULT_CHEF_SETTINGS,
  DEFAULT_STAFF_SETTINGS,
  DEFAULT_ADMIN_SETTINGS,
  validateAudioFile,
  MAX_AUDIO_FILE_SIZE_BYTES,
} from "@/lib/audio/sound-types";

describe("Custom Loud Notification Sound System", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    soundEngine.stopRepeatingAlert();
  });

  afterEach(() => {
    soundEngine.stopRepeatingAlert();
    vi.restoreAllMocks();
  });

  describe("Event-to-Sound Mapping", () => {
    it("maps all operational events to distinctive sound definitions", () => {
      const requiredEvents: SoundEventType[] = [
        "new_order",
        "additional_item",
        "order_ready",
        "service_request",
        "bill_requested",
        "payment_confirmed",
        "alert_urgent",
      ];

      for (const ev of requiredEvents) {
        expect(SOUND_EVENT_LABELS[ev]).toBeDefined();
        expect(SOUND_EVENT_LABELS[ev].label.length).toBeGreaterThan(0);
        expect(SOUND_EVENT_LABELS[ev].description.length).toBeGreaterThan(0);
        expect(SOUND_EVENT_LABELS[ev].role.length).toBeGreaterThan(0);
      }
    });

    it("assigns appropriate sound events per staff role", () => {
      // Chef should have new_order, additional_item, and alert_urgent enabled
      expect(DEFAULT_CHEF_SETTINGS.enabledEvents.new_order).toBe(true);
      expect(DEFAULT_CHEF_SETTINGS.enabledEvents.additional_item).toBe(true);
      expect(DEFAULT_CHEF_SETTINGS.enabledEvents.alert_urgent).toBe(true);
      expect(DEFAULT_CHEF_SETTINGS.repeatPendingAlert).toBe(true);

      // Staff (Service & Billing) should have order_ready, service_request, bill_requested, payment_confirmed
      expect(DEFAULT_STAFF_SETTINGS.enabledEvents.order_ready).toBe(true);
      expect(DEFAULT_STAFF_SETTINGS.enabledEvents.service_request).toBe(true);
      expect(DEFAULT_STAFF_SETTINGS.enabledEvents.bill_requested).toBe(true);
      expect(DEFAULT_STAFF_SETTINGS.enabledEvents.payment_confirmed).toBe(true);
      expect(DEFAULT_STAFF_SETTINGS.repeatPendingAlert).toBe(false);

      // Admin has full operational events enabled
      expect(DEFAULT_ADMIN_SETTINGS.enabledEvents.new_order).toBe(true);
      expect(DEFAULT_ADMIN_SETTINGS.enabledEvents.payment_confirmed).toBe(true);
    });
  });

  describe("Duplicate Event Prevention", () => {
    it("permits playing an event sound on first occurrence", () => {
      const isDuplicate = soundEngine.hasEventBeenPlayed("order_unique_001");
      expect(isDuplicate).toBe(false);
    });

    it("suppresses duplicate sounds for the same event key within deduplication window", () => {
      const eventKey = "order_ready_tbl02_001";

      const firstCall = soundEngine.hasEventBeenPlayed(eventKey);
      expect(firstCall).toBe(false); // First time allowed

      const secondCall = soundEngine.hasEventBeenPlayed(eventKey);
      expect(secondCall).toBe(true); // Suppressed as duplicate

      const thirdCall = soundEngine.hasEventBeenPlayed(eventKey);
      expect(thirdCall).toBe(true); // Still suppressed
    });

    it("allows different events to play independently without cross-blocking", () => {
      expect(soundEngine.hasEventBeenPlayed("new_order_A")).toBe(false);
      expect(soundEngine.hasEventBeenPlayed("new_order_B")).toBe(false);
      expect(soundEngine.hasEventBeenPlayed("service_req_C")).toBe(false);
    });
  });

  describe("Repeating Alert Management & Cancellation", () => {
    it("starts a repeating alert and triggers periodically", () => {
      const tickFn = vi.fn();
      soundEngine.startRepeatingAlert("alert_ord_101", "alert_urgent", 10, tickFn);

      expect(soundEngine.isAlertRepeating("alert_ord_101")).toBe(true);
      expect(tickFn).not.toHaveBeenCalled();

      // Advance by 10 seconds
      vi.advanceTimersByTime(10000);
      expect(tickFn).toHaveBeenCalledTimes(1);

      // Advance another 10 seconds
      vi.advanceTimersByTime(10000);
      expect(tickFn).toHaveBeenCalledTimes(2);
    });

    it("stops repeating immediately when acknowledged or cancelled", () => {
      const tickFn = vi.fn();
      soundEngine.startRepeatingAlert("alert_ord_202", "alert_urgent", 15, tickFn);

      expect(soundEngine.isAlertRepeating("alert_ord_202")).toBe(true);

      // Acknowledge alert before interval fires
      soundEngine.stopRepeatingAlert("alert_ord_202");
      expect(soundEngine.isAlertRepeating("alert_ord_202")).toBe(false);

      // Advance time - callback should not be invoked
      vi.advanceTimersByTime(30000);
      expect(tickFn).not.toHaveBeenCalled();
    });

    it("clears all repeating alerts when calling cleanup", () => {
      const fn1 = vi.fn();
      const fn2 = vi.fn();
      soundEngine.startRepeatingAlert("alert_1", "alert_urgent", 5, fn1);
      soundEngine.startRepeatingAlert("alert_2", "alert_urgent", 5, fn2);

      expect(soundEngine.isAlertRepeating()).toBe(true);

      soundEngine.cleanup();
      expect(soundEngine.isAlertRepeating()).toBe(false);

      vi.advanceTimersByTime(10000);
      expect(fn1).not.toHaveBeenCalled();
      expect(fn2).not.toHaveBeenCalled();
    });
  });

  describe("Custom Audio File Validation", () => {
    it("accepts valid audio formats (MP3, WAV, OGG) within 2 MB", () => {
      expect(validateAudioFile({ size: 500 * 1024, type: "audio/mpeg" }).valid).toBe(true);
      expect(validateAudioFile({ size: 1024 * 1024, type: "audio/wav" }).valid).toBe(true);
      expect(validateAudioFile({ size: 250 * 1024, type: "audio/ogg" }).valid).toBe(true);
    });

    it("rejects files that exceed the 2 MB limit", () => {
      const oversized = { size: 3 * 1024 * 1024, type: "audio/mpeg" };
      const result = validateAudioFile(oversized);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceeds the maximum allowed limit of 2 MB");
    });

    it("rejects non-audio file types", () => {
      expect(validateAudioFile({ size: 100 * 1024, type: "image/png" }).valid).toBe(false);
      expect(validateAudioFile({ size: 100 * 1024, type: "application/pdf" }).valid).toBe(false);
      expect(validateAudioFile({ size: 100 * 1024, type: "video/mp4" }).valid).toBe(false);
    });
  });
});

