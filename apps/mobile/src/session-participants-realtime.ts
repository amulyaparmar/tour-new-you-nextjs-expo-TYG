import type { RealtimeChannel } from "@supabase/supabase-js";
import type { SessionLead } from "@tour/shared";
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { fetchSession } from "./api";
import { getCurrentSession } from "./auth";
import { getSupabasePublicClient } from "./supabase";

export type SessionParticipantRealtimeStatus =
  | "idle"
  | "connecting"
  | "live"
  | "fallback";

type ParticipantRefreshSource = "initial" | "realtime" | "poll" | "foreground";

const FALLBACK_REFRESH_MS = 12_000;
const PENDING_SESSION_REFRESH_MS = 1_500;

export function useSessionParticipantRealtime(input: {
  sessionId: string | null;
  onParticipants: (participants: SessionLead[], source: ParticipantRefreshSource) => void;
  onStatusChange?: (status: SessionParticipantRealtimeStatus) => void;
}) {
  const onParticipantsRef = useRef(input.onParticipants);
  const onStatusChangeRef = useRef(input.onStatusChange);

  useEffect(() => {
    onParticipantsRef.current = input.onParticipants;
  }, [input.onParticipants]);

  useEffect(() => {
    onStatusChangeRef.current = input.onStatusChange;
  }, [input.onStatusChange]);

  useEffect(() => {
    const sessionId = input.sessionId;
    if (!sessionId) {
      onStatusChangeRef.current?.("idle");
      return;
    }

    let cancelled = false;
    let refreshInFlight = false;
    let refreshQueued = false;
    let channel: RealtimeChannel | null = null;
    let realtimeClient: ReturnType<typeof getSupabasePublicClient> | null = null;
    let realtimeSubscribed = false;
    let pendingSessionTimer: ReturnType<typeof setInterval> | undefined;

    const setStatus = (status: SessionParticipantRealtimeStatus) => {
      if (!cancelled) onStatusChangeRef.current?.(status);
    };

    const refreshParticipants = async (source: ParticipantRefreshSource) => {
      if (refreshInFlight) {
        refreshQueued = true;
        return;
      }
      refreshInFlight = true;
      try {
        const { session } = await fetchSession(sessionId);
        if (!cancelled) {
          if (pendingSessionTimer) {
            clearInterval(pendingSessionTimer);
            pendingSessionTimer = undefined;
          }
          if (realtimeSubscribed) setStatus("live");
          onParticipantsRef.current(session.leads ?? [], source);
        }
      } catch {
        if (source === "realtime") setStatus("fallback");
      } finally {
        refreshInFlight = false;
        if (refreshQueued && !cancelled) {
          refreshQueued = false;
          void refreshParticipants("poll");
        }
      }
    };

    setStatus("connecting");
    void refreshParticipants("initial");

    // A new QR reserves its session ID before the first guest creates the
    // session row. Refresh briefly until that row exists; later guests use the
    // session-scoped Realtime broadcast.
    pendingSessionTimer = setInterval(() => {
      void refreshParticipants("poll");
    }, PENDING_SESSION_REFRESH_MS);

    const fallbackTimer = setInterval(() => {
      void refreshParticipants("poll");
    }, FALLBACK_REFRESH_MS);

    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        if (nextState !== "active") return;
        const latestToken = getCurrentSession()?.accessToken;
        if (latestToken && realtimeClient) {
          void realtimeClient.realtime.setAuth(latestToken).catch(() => {});
        }
        void refreshParticipants("foreground");
      },
    );

    void (async () => {
      try {
        const accessToken = getCurrentSession()?.accessToken;
        if (!accessToken) throw new Error("No authenticated Realtime session.");

        const supabase = getSupabasePublicClient();
        realtimeClient = supabase;
        await supabase.realtime.setAuth(accessToken);
        if (cancelled) return;

        channel = supabase
          .channel(`session-participants:${sessionId}`, {
            config: { private: true },
          })
          .on("broadcast", { event: "participants_changed" }, () => {
            void refreshParticipants("realtime");
          })
          .subscribe((status) => {
            if (status === "SUBSCRIBED") {
              realtimeSubscribed = true;
              setStatus("live");
              void refreshParticipants("realtime");
              return;
            }
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
              realtimeSubscribed = false;
              setStatus("fallback");
            }
          });
      } catch {
        setStatus("fallback");
      }
    })();

    return () => {
      cancelled = true;
      clearInterval(fallbackTimer);
      if (pendingSessionTimer) clearInterval(pendingSessionTimer);
      appStateSubscription.remove();
      if (channel && realtimeClient) {
        void realtimeClient.removeChannel(channel);
      }
    };
  }, [input.sessionId]);
}
