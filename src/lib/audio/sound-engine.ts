import { SoundEventType, RoleNotificationSettings, CustomSoundInfo } from "./sound-types";

class SoundEngine {
  private audioCtx: AudioContext | null = null;
  private playedEvents = new Map<string, number>(); // eventKey -> timestamp
  private repeatingTimers = new Map<string, { timerId: any; soundType: SoundEventType }>();
  private customAudioElements = new Map<SoundEventType, HTMLAudioElement>();
  private isUnlocked = false;

  private deduplicationWindowMs = 12000; // 12 seconds deduplication window

  /**
   * Initializes or resumes the AudioContext upon user gesture.
   */
  public async unlockAudio(): Promise<boolean> {
    if (typeof window === "undefined") return false;

    try {
      if (!this.audioCtx) {
        const AudioContextClass =
          window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return false;
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === "suspended") {
        await this.audioCtx.resume();
      }

      // Play a short silent buffer to prime the audio pipeline
      const buffer = this.audioCtx.createBuffer(1, 1, 22050);
      const source = this.audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioCtx.destination);
      source.start(0);

      this.isUnlocked = this.audioCtx.state === "running";
      return this.isUnlocked;
    } catch (err) {
      console.warn("[SoundEngine] Audio unlock failed:", err);
      return false;
    }
  }

  public getIsUnlocked(): boolean {
    if (typeof window === "undefined") return false;
    if (!this.audioCtx) return false;
    return this.audioCtx.state === "running";
  }

  /**
   * Deduplication check to prevent playing the same sound for the same event repeatedly.
   */
  public hasEventBeenPlayed(eventKey: string): boolean {
    const now = Date.now();
    const lastPlayed = this.playedEvents.get(eventKey);

    if (lastPlayed && now - lastPlayed < this.deduplicationWindowMs) {
      return true;
    }

    this.playedEvents.set(eventKey, now);

    // Garbage collect old keys
    if (this.playedEvents.size > 200) {
      for (const [key, time] of this.playedEvents.entries()) {
        if (now - time > this.deduplicationWindowMs * 2) {
          this.playedEvents.delete(key);
        }
      }
    }

    return false;
  }

  /**
   * Plays the designated notification sound, checking custom audio first,
   * then falling back to high-fidelity synthesized Web Audio.
   */
  public async playSound(
    type: SoundEventType,
    options: {
      volume?: number;
      eventId?: string;
      customSound?: CustomSoundInfo;
      force?: boolean;
    } = {}
  ): Promise<boolean> {
    if (typeof window === "undefined") return false;

    // Check deduplication
    if (options.eventId && !options.force) {
      const eventKey = `${type}_${options.eventId}`;
      if (this.hasEventBeenPlayed(eventKey)) {
        return false;
      }
    }

    const volume = Math.max(0, Math.min(1, options.volume ?? 0.8));
    if (volume === 0) return false;

    // 1. Try playing custom sound if uploaded
    if (options.customSound?.dataUrl) {
      try {
        const playedCustom = await this.playCustomAudio(options.customSound.dataUrl, volume);
        if (playedCustom) return true;
      } catch (err) {
        console.warn("[SoundEngine] Custom audio playback failed, falling back to synthesizer:", err);
      }
    }

    // 2. Synthesized Web Audio fallback
    return this.playSynthesizedSound(type, volume);
  }

  private async playCustomAudio(dataUrl: string, volume: number): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const audio = new Audio(dataUrl);
        audio.volume = volume;
        audio.onended = () => resolve(true);
        audio.onerror = () => resolve(false);

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => resolve(true))
            .catch((err) => {
              console.warn("[SoundEngine] Autoplay restriction on custom sound:", err);
              resolve(false);
            });
        } else {
          resolve(true);
        }
      } catch {
        resolve(false);
      }
    });
  }

  /**
   * High-fidelity Web Audio synthesized chimes and bells.
   */
  public playSynthesizedSound(type: SoundEventType, volume: number): boolean {
    try {
      if (!this.audioCtx) {
        const AudioContextClass =
          window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return false;
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      const masterGain = this.audioCtx.createGain();
      masterGain.gain.setValueAtTime(volume, now);
      masterGain.connect(this.audioCtx.destination);

      switch (type) {
        case "new_order":
          this.synthesizeNewOrderChime(now, masterGain);
          break;
        case "additional_item":
          this.synthesizeAdditionalItemAlert(now, masterGain);
          break;
        case "order_ready":
          this.synthesizeServiceBell(now, masterGain);
          break;
        case "service_request":
          this.synthesizeServiceRequestChime(now, masterGain);
          break;
        case "bill_requested":
          this.synthesizeBillRequestedTone(now, masterGain);
          break;
        case "payment_confirmed":
          this.synthesizePaymentChord(now, masterGain);
          break;
        case "alert_urgent":
          this.synthesizeUrgentAlert(now, masterGain);
          break;
        default:
          this.synthesizeNewOrderChime(now, masterGain);
      }

      return true;
    } catch (err) {
      console.warn("[SoundEngine] Synthesizer error:", err);
      return false;
    }
  }

  // --- Acoustic Synthesis Generators ---

  /**
   * Loud, punchy A5 (880Hz) -> C#6 (1108Hz) -> E6 (1318Hz) triplet chime
   */
  private synthesizeNewOrderChime(now: number, masterGain: GainNode) {
    if (!this.audioCtx) return;
    const notes = [
      { freq: 880, start: 0, dur: 0.5 },
      { freq: 1108, start: 0.12, dur: 0.5 },
      { freq: 1318, start: 0.24, dur: 0.7 },
    ];

    notes.forEach((n) => {
      const osc = this.audioCtx!.createOscillator();
      const gain = this.audioCtx!.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(n.freq, now + n.start);

      gain.gain.setValueAtTime(0.001, now + n.start);
      gain.gain.exponentialRampToValueAtTime(0.6, now + n.start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.dur);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now + n.start);
      osc.stop(now + n.start + n.dur);
    });
  }

  /**
   * Fast high-pitch double-ping D6 (1174Hz) -> F#6 (1479Hz) for added items
   */
  private synthesizeAdditionalItemAlert(now: number, masterGain: GainNode) {
    if (!this.audioCtx) return;
    const notes = [
      { freq: 1174, start: 0, dur: 0.3 },
      { freq: 1479, start: 0.09, dur: 0.45 },
    ];

    notes.forEach((n) => {
      const osc = this.audioCtx!.createOscillator();
      const gain = this.audioCtx!.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(n.freq, now + n.start);

      gain.gain.setValueAtTime(0.001, now + n.start);
      gain.gain.exponentialRampToValueAtTime(0.7, now + n.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.dur);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now + n.start);
      osc.stop(now + n.start + n.dur);
    });
  }

  /**
   * Bright, ringing dinner service bell (784Hz + 1568Hz overtones)
   */
  private synthesizeServiceBell(now: number, masterGain: GainNode) {
    if (!this.audioCtx) return;
    const harmonics = [784, 1568, 2352];

    harmonics.forEach((freq, idx) => {
      const osc = this.audioCtx!.createOscillator();
      const gain = this.audioCtx!.createGain();

      osc.type = idx === 0 ? "sine" : "triangle";
      osc.frequency.setValueAtTime(freq, now);

      const amp = idx === 0 ? 0.6 : 0.25 / (idx + 1);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(amp, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now);
      osc.stop(now + 1.2);
    });
  }

  /**
   * Warm gentle service request chime F5 (698Hz) -> A5 (880Hz)
   */
  private synthesizeServiceRequestChime(now: number, masterGain: GainNode) {
    if (!this.audioCtx) return;
    const notes = [
      { freq: 698, start: 0, dur: 0.4 },
      { freq: 880, start: 0.15, dur: 0.55 },
    ];

    notes.forEach((n) => {
      const osc = this.audioCtx!.createOscillator();
      const gain = this.audioCtx!.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(n.freq, now + n.start);

      gain.gain.setValueAtTime(0.001, now + n.start);
      gain.gain.exponentialRampToValueAtTime(0.5, now + n.start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.dur);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now + n.start);
      osc.stop(now + n.start + n.dur);
    });
  }

  /**
   * Register / bill requested tone B5 (987Hz) -> D6 (1174Hz)
   */
  private synthesizeBillRequestedTone(now: number, masterGain: GainNode) {
    if (!this.audioCtx) return;
    const notes = [
      { freq: 987, start: 0, dur: 0.35 },
      { freq: 1174, start: 0.12, dur: 0.5 },
    ];

    notes.forEach((n) => {
      const osc = this.audioCtx!.createOscillator();
      const gain = this.audioCtx!.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(n.freq, now + n.start);

      gain.gain.setValueAtTime(0.001, now + n.start);
      gain.gain.exponentialRampToValueAtTime(0.55, now + n.start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.dur);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now + n.start);
      osc.stop(now + n.start + n.dur);
    });
  }

  /**
   * Celebratory ascending major chord fanfare for settled payments (C5-E5-G5-C6)
   */
  private synthesizePaymentChord(now: number, masterGain: GainNode) {
    if (!this.audioCtx) return;
    const chord = [
      { freq: 523, start: 0, dur: 0.6 },
      { freq: 659, start: 0.08, dur: 0.6 },
      { freq: 784, start: 0.16, dur: 0.7 },
      { freq: 1046, start: 0.24, dur: 0.9 },
    ];

    chord.forEach((n) => {
      const osc = this.audioCtx!.createOscillator();
      const gain = this.audioCtx!.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(n.freq, now + n.start);

      gain.gain.setValueAtTime(0.001, now + n.start);
      gain.gain.exponentialRampToValueAtTime(0.4, now + n.start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.dur);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now + n.start);
      osc.stop(now + n.start + n.dur);
    });
  }

  /**
   * Loud repeating attention alert (urgent pulse)
   */
  private synthesizeUrgentAlert(now: number, masterGain: GainNode) {
    if (!this.audioCtx) return;
    const pulses = [
      { freq: 880, start: 0, dur: 0.2 },
      { freq: 880, start: 0.25, dur: 0.2 },
      { freq: 659, start: 0.5, dur: 0.35 },
    ];

    pulses.forEach((n) => {
      const osc = this.audioCtx!.createOscillator();
      const gain = this.audioCtx!.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(n.freq, now + n.start);

      gain.gain.setValueAtTime(0.001, now + n.start);
      gain.gain.exponentialRampToValueAtTime(0.65, now + n.start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.dur);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now + n.start);
      osc.stop(now + n.start + n.dur);
    });
  }

  // --- Repeating Alert Manager ---

  /**
   * Starts a repeating interval alert until cancelled or acknowledged.
   */
  public startRepeatingAlert(
    alertId: string,
    soundType: SoundEventType,
    intervalSeconds: number,
    onTick: () => void
  ) {
    this.stopRepeatingAlert(alertId);

    const intervalMs = Math.max(5, intervalSeconds) * 1000;
    const timerId = setInterval(() => {
      onTick();
    }, intervalMs);

    this.repeatingTimers.set(alertId, { timerId, soundType });
  }

  public stopRepeatingAlert(alertId?: string) {
    if (alertId) {
      const timer = this.repeatingTimers.get(alertId);
      if (timer) {
        clearInterval(timer.timerId);
        this.repeatingTimers.delete(alertId);
      }
    } else {
      // Clear all
      for (const [id, timer] of this.repeatingTimers.entries()) {
        clearInterval(timer.timerId);
      }
      this.repeatingTimers.clear();
    }
  }

  public isAlertRepeating(alertId?: string): boolean {
    if (alertId) return this.repeatingTimers.has(alertId);
    return this.repeatingTimers.size > 0;
  }

  public cleanup() {
    this.stopRepeatingAlert();
    if (this.audioCtx && this.audioCtx.state !== "closed") {
      try {
        this.audioCtx.close();
      } catch {
        // Ignore
      }
      this.audioCtx = null;
    }
    this.isUnlocked = false;
  }
}

// Global singleton instance so sound engine persists across hot-reloads and route switches
const globalForAudio = globalThis as unknown as { soundEngineInstance?: SoundEngine };
export const soundEngine = globalForAudio.soundEngineInstance || new SoundEngine();
if (process.env.NODE_ENV !== "production") {
  globalForAudio.soundEngineInstance = soundEngine;
}

