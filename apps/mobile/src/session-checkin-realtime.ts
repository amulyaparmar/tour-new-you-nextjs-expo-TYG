import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { getCurrentSession } from "./auth";
import { getSupabasePublicClient } from "./supabase";

type AgentCheckInPayload = {
  sessionId?: unknown;
};

export type AgentCheckInRealtimeStatus = "idle" | "connecting" | "live" | "unavailable";

export function useAgentCheckInRealtime(input: {
  userId: string | null | undefined;
  onCheckIn: (sessionId: string) => void;
  onStatusChange?: (status: AgentCheckInRealtimeStatus) => void;
}) {
  const onCheckInRef = useRef(input.onCheckIn);
  const onStatusChangeRef = useRef(input.onStatusChange);

  useEffect(() => {
    onCheckInRef.current = input.onCheckIn;
  }, [input.onCheckIn]);

  useEffect(() => {
    onStatusChangeRef.current = input.onStatusChange;
  }, [input.onStatusChange]);

  useEffect(() => {
    const userId = input.userId?.trim();
    if (!userId) {
      onStatusChangeRef.current?.("idle");
      return;
    }

    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    let realtimeClient: ReturnType<typeof getSupabasePublicClient> | null = null;

    const setStatus = (status: AgentCheckInRealtimeStatus) => {
      if (!cancelled) onStatusChangeRef.current?.(status);
    };

    const refreshAuth = () => {
      const accessToken = getCurrentSession()?.accessToken;
      if (accessToken && realtimeClient) {
        void realtimeClient.realtime.setAuth(accessToken).catch(() => {});
      }
    };

    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        if (nextState === "active") refreshAuth();
      },
    );

    void (async () => {
      try {
        const accessToken = getCurrentSession()?.accessToken;
        if (!accessToken) throw new Error("No authenticated Realtime session.");

        const supabase = getSupabasePublicClient();
        realtimeClient = supabase;
        setStatus("connecting");
        await supabase.realtime.setAuth(accessToken);
        if (cancelled) return;

        channel = supabase
          .channel(`agent-check-ins:${userId}`, {
            config: { private: true },
          })
          // The payload intentionally contains only a session ID. Session details
          // continue to come from the existing authenticated application API.
          .on("broadcast", { event: "session_checked_in" }, (event) => {
            const payload = event.payload as AgentCheckInPayload;
            if (typeof payload.sessionId === "string" && payload.sessionId) {
              onCheckInRef.current(payload.sessionId);
            }
          })
          .subscribe((status) => {
            if (status === "SUBSCRIBED") {
              setStatus("live");
              return;
            }
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
              setStatus("unavailable");
            }
          });
      } catch {
        setStatus("unavailable");
      }
    })();

    return () => {
      cancelled = true;
      appStateSubscription.remove();
      if (channel && realtimeClient) {
        void realtimeClient.removeChannel(channel);
      }
    };
  }, [input.userId]);
}
