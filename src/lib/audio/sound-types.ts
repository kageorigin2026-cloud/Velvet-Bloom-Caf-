export type SoundEventType =
  | "new_order"
  | "additional_item"
  | "order_ready"
  | "service_request"
  | "bill_requested"
  | "payment_confirmed"
  | "alert_urgent";

export interface CustomSoundInfo {
  fileName: string;
  dataUrl: string;
  fileSize: number;
  mimeType: string;
  updatedAt: string;
}

export interface RoleNotificationSettings {
  role: "CHEF" | "STAFF" | "ADMIN";
  enabled: boolean;
  volume: number; // 0.0 to 1.0
  repeatPendingAlert: boolean; // Chef specific: repeat until accepted
  repeatIntervalSeconds: number; // e.g. 10 or 15 seconds
  enabledEvents: Record<SoundEventType, boolean>;
  customSounds: Partial<Record<SoundEventType, CustomSoundInfo>>;
}

export const SOUND_EVENT_LABELS: Record<SoundEventType, { label: string; description: string; role: string }> = {
  new_order: {
    label: "New Incoming Order",
    description: "Loud, attention-grabbing chime played when a customer sends a new order",
    role: "Chef & Admin",
  },
  additional_item: {
    label: "Additional Item Added",
    description: "Distinctive double-tone played when floor staff appends items to an active ticket",
    role: "Chef",
  },
  order_ready: {
    label: "Order Plated & Ready",
    description: "Bright service bell played when the kitchen marks food ready for floor pickup",
    role: "Service & Billing",
  },
  service_request: {
    label: "Customer Service Call",
    description: "Gentle alert chime for table assistance (water, clearing, staff call)",
    role: "Service & Billing",
  },
  bill_requested: {
    label: "Bill Requested",
    description: "Cashier alert chime when a dining table requests their check",
    role: "Service & Billing",
  },
  payment_confirmed: {
    label: "Payment Settled",
    description: "Harmonic confirmation tone when a transaction is recorded and bill paid",
    role: "Service & Billing & Admin",
  },
  alert_urgent: {
    label: "Urgent Reminder",
    description: "High-visibility repeating chime for unacknowledged orders or kitchen delays",
    role: "Chef & Admin",
  },
};

export const DEFAULT_CHEF_SETTINGS: RoleNotificationSettings = {
  role: "CHEF",
  enabled: true,
  volume: 0.85,
  repeatPendingAlert: true,
  repeatIntervalSeconds: 15,
  enabledEvents: {
    new_order: true,
    additional_item: true,
    order_ready: false,
    service_request: false,
    bill_requested: false,
    payment_confirmed: false,
    alert_urgent: true,
  },
  customSounds: {},
};

export const DEFAULT_STAFF_SETTINGS: RoleNotificationSettings = {
  role: "STAFF",
  enabled: true,
  volume: 0.8,
  repeatPendingAlert: false,
  repeatIntervalSeconds: 15,
  enabledEvents: {
    new_order: false,
    additional_item: false,
    order_ready: true,
    service_request: true,
    bill_requested: true,
    payment_confirmed: true,
    alert_urgent: false,
  },
  customSounds: {},
};

export const DEFAULT_ADMIN_SETTINGS: RoleNotificationSettings = {
  role: "ADMIN",
  enabled: true,
  volume: 0.75,
  repeatPendingAlert: false,
  repeatIntervalSeconds: 20,
  enabledEvents: {
    new_order: true,
    additional_item: true,
    order_ready: true,
    service_request: true,
    bill_requested: true,
    payment_confirmed: true,
    alert_urgent: true,
  },
  customSounds: {},
};

export const MAX_AUDIO_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB limit
export const ALLOWED_AUDIO_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/ogg",
  "audio/aac",
  "audio/m4a",
];

export function validateAudioFile(file: { size: number; type: string }): { valid: boolean; error?: string } {
  if (file.size > MAX_AUDIO_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds the maximum allowed limit of 2 MB.`,
    };
  }

  // If MIME type is empty or generic, check extension or allowed list
  const lowerType = file.type.toLowerCase();
  const isAllowed =
    ALLOWED_AUDIO_MIME_TYPES.includes(lowerType) ||
    lowerType.startsWith("audio/");

  if (!isAllowed) {
    return {
      valid: false,
      error: `Unsupported file type (${file.type || "unknown"}). Please upload an MP3, WAV, or OGG audio file.`,
    };
  }

  return { valid: true };
}

