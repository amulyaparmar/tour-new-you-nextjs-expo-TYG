import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import type {
  CoachingEagerness,
  CoachingItem,
  LiveCoachingRequest,
  LiveCoachingResponse,
} from "@tour/shared";
import { authenticatedFetch } from "../auth";
import {
  coachingHttpError,
  LiveCoachingController,
  type CoachingTip,
  type CoachingTurn,
} from "./liveCoachingController";

async function requestCoaching(
  sessionId: string,
  payload: LiveCoachingRequest,
  signal: AbortSignal,
): Promise<LiveCoachingResponse> {
  const response = await authenticatedFetch(`/api/sessions/${sessionId}/live-coaching`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  if (!response.ok) throw coachingHttpError(response.status, response.headers.get("Retry-After"));
  return response.json();
}

async function recordInteraction(
  sessionId: string,
  event: "shown" | "tap" | "dismiss",
  item: CoachingItem,
) {
  if (!item.coachingId || !item.moveKind) return;
  await authenticatedFetch(`/api/sessions/${sessionId}/live-coaching/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, kind: item.moveKind, suggestionId: item.coachingId }),
    signal: AbortSignal.timeout(3000),
  });
}

export function useLiveCoaching(input: {
  sessionId: string | null;
  recordingId: string | null;
  enabled: boolean;
  turns: CoachingTurn[];
  elapsed: number;
  notes: string;
  eagerness: CoachingEagerness;
}) {
  const current = useRef(input);
  current.current = input;
  const engine = useRef<LiveCoachingController | null>(null);
  const [tip, setTip] = useState<CoachingTip | null>(null);
  const [history, setHistory] = useState<CoachingTip[]>([]);

  useEffect(() => {
    if (!input.sessionId) return;
    let foreground = AppState.currentState === "active";
    setTip(null);
    setHistory([]);
    const controller = new LiveCoachingController({
      now: () => Date.now(),
      request: (payload, signal) => requestCoaching(input.sessionId!, payload, signal),
      change: (next, _unavailable, tips) => {
        setTip(next);
        setHistory(tips);
      },
      interaction: (event, item) => {
        const sessionId = current.current.sessionId;
        if (sessionId) void recordInteraction(sessionId, event, item).catch(() => {});
      },
    });
    engine.current = controller;
    const update = () => {
      const latest = current.current;
      controller.configure(
        Boolean(latest.sessionId && latest.enabled && foreground),
        latest.turns,
        latest.elapsed,
        latest.notes,
        latest.eagerness,
      );
      controller.tick();
    };
    const appState = AppState.addEventListener("change", (state) => {
      foreground = state === "active";
      update();
    });
    const timer = setInterval(update, 200);
    update();
    return () => {
      controller.dispose();
      appState.remove();
      clearInterval(timer);
      engine.current = null;
    };
  }, [input.recordingId, input.sessionId]);

  return {
    tip,
    history,
    dismiss: () => engine.current?.dismiss(),
    interaction: (event: "tap" | "dismiss", item: CoachingItem) => {
      engine.current?.interaction(event, item);
    },
  };
}
