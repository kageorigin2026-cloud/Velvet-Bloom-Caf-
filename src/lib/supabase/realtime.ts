"use client";

import { useEffect, useRef } from "react";
import { getBrowserSupabaseClient } from "./client";

interface RealtimeOptions {
  table: "orders" | "bills" | "service_requests" | "tables";
  tenantId?: string;
  onEvent?: (payload: any) => void;
  enabled?: boolean;
}

/**
 * Universal hook for subscribing to Supabase Realtime changes on a specific tenant table.
 * Cleans up listeners on unmount. Does nothing if Supabase is unconfigured or in local mode.
 */
export function useSupabaseRealtime({
  table,
  tenantId,
  onEvent,
  enabled = true,
}: RealtimeOptions) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled) return;

    const supabase = getBrowserSupabaseClient();
    if (!supabase) return;

    const channelName = `realtime-${table}-${tenantId || "all"}-${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase.channel(channelName);

    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: table,
          filter: tenantId ? `tenant_id=eq.${tenantId}` : undefined,
        },
        (payload) => {
          if (onEventRef.current) {
            onEventRef.current(payload);
          }
        }
      )
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR") {
          console.warn(`[Supabase Realtime] Channel error on ${table}:`, err?.message || status);
        } else if (status === "TIMED_OUT") {
          console.warn(`[Supabase Realtime] Subscription timed out on ${table}`);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, tenantId, enabled]);
}

