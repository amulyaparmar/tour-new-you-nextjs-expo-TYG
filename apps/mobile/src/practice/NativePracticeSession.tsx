import "react-native-get-random-values";

import { authenticatedFetch } from "@/auth";
import { LoadingDots } from "@/components/loading-dots";
import { TourBackButton as BackBtn, TourEmptyState as EmptyState } from "@/components/tour";
import { tourColors as C } from "@/theme/tour-brand";
import Daily from "@daily-co/react-native-daily-js";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PracticeSessionSkeleton } from "./practice-loading";

type Scenario = {
  id: string;
  name: string;
  description?: string;
  difficulty?: "easy" | "medium" | "hard";
};

type Waypoint = { id: string; title: string; cue?: string; type?: string };
type TranscriptLine = { id: string; role: "agent" | "prospect"; text: string; seconds: number };

type Launch = {
  success: true;
  vapiPublicKey: string;
  assistantId: string;
  assistantOverrides: Record<string, unknown>;
  traineeName: string;
  scenario: Scenario & { waypoints?: Waypoint[]; passThreshold?: number };
};

type Scorecard = {
  score: number | null;
  status: "passed" | "not-passed" | "needs-review";
  summary: string | null;
  saved: boolean;
};

// Vapi finalizes post-call analysis asynchronously. We start with shorter
// retries, then continue at a calm interval while the result screen is open.
const POLL_DELAYS_MS = [2000, 3000, 5000, 8000, 10000, 15000, 20000, 30000, 45000];
const SLOW_ANALYSIS_POLL_DELAY_MS = 30000;

const elapsed = (startedAt: number | null) =>
  startedAt ? Math.max(0, Math.round((Date.now() - startedAt) / 1000)) : 0;

const timeLabel = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

const textFromMessage = (message: any) => {
  const value =
    message?.transcript ??
    message?.text ??
    message?.message?.content ??
    message?.message?.text ??
    message?.content;
  return typeof value === "string" ? value.trim() : "";
};

const roleFromMessage = (message: any): TranscriptLine["role"] | null => {
  const role = String(message?.role ?? message?.message?.role ?? "").toLowerCase();
  if (["user", "customer", "human", "agent"].includes(role)) return "agent";
  if (["assistant", "bot", "ai", "prospect"].includes(role)) return "prospect";
  return null;
};

const toolWaypointIds = (message: any) => {
  const calls = [
    ...(Array.isArray(message?.toolCallList) ? message.toolCallList : []),
    ...(Array.isArray(message?.toolCalls) ? message.toolCalls : []),
    ...(Array.isArray(message?.toolWithToolCallList)
      ? message.toolWithToolCallList.map((entry: any) => ({
          ...(entry?.toolCall ?? entry),
          name: entry?.toolCall?.name ?? entry?.name,
        }))
      : []),
    ...(message?.type === "function-call" ? [message?.functionCall ?? message] : []),
  ];
  return calls.flatMap((call) => {
    const name = String(
      call?.function?.name ??
        call?.name ??
        call?.toolCall?.function?.name ??
        call?.toolCall?.name ??
        call?.functionName ??
        ""
    );
    if (name !== "WaypointComplete") return [];
    const raw =
      call?.function?.arguments ??
      call?.arguments ??
      call?.parameters ??
      call?.toolCall?.function?.arguments ??
      call?.toolCall?.arguments ??
      call?.toolCall?.parameters ??
      {};
    let args = raw;
    if (typeof raw === "string") {
      try { args = JSON.parse(raw); } catch { return []; }
    }
    const id = args?.waypointId ?? args?.id ?? args?.waypoint_id;
    return typeof id === "string" && id.trim() ? [id.trim()] : [];
  });
};

export function NativePracticeSession({ scenario, onBack }: { scenario: Scenario | null; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [launch, setLaunch] = useState<Launch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [callState, setCallState] = useState<"ready" | "connecting" | "live" | "ended">("ready");
  const [muted, setMuted] = useState(false);
  const [assistantSpeaking, setAssistantSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [completedWaypointIds, setCompletedWaypointIds] = useState<string[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [grading, setGrading] = useState(false);
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [goalsOpen, setGoalsOpen] = useState(false);

  const dailyCallRef = useRef<any>(null);
  const callIdRef = useRef<string | null>(null);
  const endedRef = useRef(false);
  const mutedRef = useRef(false);
  const transcriptRef = useRef<TranscriptLine[]>([]);
  const connectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const agentReadyRef = useRef(false);
  const assistantSpeakingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptScrollRef = useRef<ScrollView>(null);
  const analysisCancelledRef = useRef(false);

  const prepare = useCallback(async () => {
    if (!scenario?.id) {
      setError("Choose a practice scenario before starting.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await authenticatedFetch("/api/roleplay/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId: scenario.id }),
      });
      const body = await response.json().catch(() => null) as Launch | { message?: string; success?: false } | null;
      if (!response.ok || !body || !body.success) {
        throw new Error((body as { message?: string } | null)?.message ?? "Could not prepare this practice session.");
      }
      setLaunch(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not prepare this practice session.");
    } finally {
      setLoading(false);
    }
  }, [scenario?.id]);

  useEffect(() => { void prepare(); }, [prepare]);

  useEffect(() => {
    if (!startedAt || callState !== "live") return;
    const timer = setInterval(() => setSeconds(elapsed(startedAt)), 1000);
    return () => clearInterval(timer);
  }, [callState, startedAt]);

  const appendTranscript = useCallback((message: any) => {
    const text = textFromMessage(message);
    const role = roleFromMessage(message);
    const isFinal = !message?.transcriptType || String(message.transcriptType).toLowerCase() === "final";
    // Daily may deliver a final local transcript shortly after its audio track
    // is disabled. Do not render that stale event as a trainee response.
    if (!text || !role || !isFinal || (role === "agent" && mutedRef.current)) return;
    const next: TranscriptLine = {
      id: `${role}:${text}:${Date.now()}`,
      role,
      text,
      seconds: elapsed(startedAt),
    };
    const previous = transcriptRef.current;
    const last = previous[previous.length - 1];
    if (last?.role === next.role && last.text === next.text) return;
    const merged = [...previous, next];
    transcriptRef.current = merged;
    setTranscript(merged);
  }, [startedAt]);

  const saveAttempt = useCallback(async (call: any, structuredData: any, resolvedLaunch: Launch) => {
    const score = Number(structuredData?.overallScore);
    const normalizedScore = Number.isFinite(score) ? Math.round(Math.max(0, Math.min(100, score))) : null;
    const threshold = Number(resolvedLaunch.scenario.passThreshold ?? 70);
    const status: Scorecard["status"] = normalizedScore === null
      ? "needs-review"
      : normalizedScore >= threshold ? "passed" : "not-passed";
    const liveTranscriptJson = transcriptRef.current.map((line) => ({
      type: line.role === "agent" ? "user" : "assistant",
      message: line.text,
      time: line.seconds,
    }));
    const transcriptJson = Array.isArray(call?.transcriptJson) && call.transcriptJson.length
      ? call.transcriptJson
      : liveTranscriptJson;
    const transcriptText = transcriptJson
      .map((line: any) => `${line.type === "user" || line.type === "agent" ? "Agent" : "Prospect"}: ${line.message ?? ""}`)
      .filter((line: string) => !line.endsWith(": "))
      .join("\n");
    let saved = false;
    try {
      const response = await authenticatedFetch("/api/roleplay/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vapiCallId: call.id,
          scenarioId: resolvedLaunch.scenario.id,
          scenarioName: resolvedLaunch.scenario.name,
          scenarioDifficulty: resolvedLaunch.scenario.difficulty,
          score: normalizedScore,
          gradeStatus: status,
          durationSeconds: call.durationSeconds ?? seconds,
          summary: call.analysis?.summary ?? null,
          transcript: transcriptText,
          transcriptJson,
          evaluations: [],
        }),
      });
      const body = await response.json().catch(() => null) as { success?: boolean } | null;
      saved = response.ok && Boolean(body?.success);
    } catch {
      saved = false;
    }
    setScorecard({ score: normalizedScore, status, summary: call.analysis?.summary ?? null, saved });
  }, [seconds]);

  const resolveAnalysis = useCallback(async (callId: string, resolvedLaunch: Launch) => {
    setGrading(true);
    for (let attempt = 0; !analysisCancelledRef.current; attempt += 1) {
      const delay = POLL_DELAYS_MS[attempt] ?? SLOW_ANALYSIS_POLL_DELAY_MS;
      await new Promise((resolve) => setTimeout(resolve, delay));
      if (analysisCancelledRef.current) return;
      try {
        const response = await authenticatedFetch(`/api/roleplay/call-analysis?callId=${encodeURIComponent(callId)}`);
        const body = await response.json().catch(() => null) as { success?: boolean; ready?: boolean; call?: any } | null;
        if (response.ok && body?.success && body.ready && body.call?.analysis?.structuredData) {
          await saveAttempt(body.call, body.call.analysis.structuredData, resolvedLaunch);
          setGrading(false);
          return;
        }
      } catch {
        // Keep the result screen alive. A transient request error should not
        // discard an analysis Vapi has not finished producing yet.
      }
    }
  }, [saveAttempt]);

  useEffect(() => {
    if (!transcript.length) return;
    const frame = requestAnimationFrame(() => transcriptScrollRef.current?.scrollToEnd({ animated: true }));
    return () => cancelAnimationFrame(frame);
  }, [transcript.length]);

  const clearConnectionTimer = () => {
    if (connectionTimerRef.current) {
      clearTimeout(connectionTimerRef.current);
      connectionTimerRef.current = null;
    }
  };

  const finishCall = useCallback((resolvedLaunch: Launch, shouldGrade = true) => {
    clearConnectionTimer();
    setAssistantSpeaking(false);
    mutedRef.current = false;
    setMuted(false);
    setCallState("ended");
    if (shouldGrade && !endedRef.current && callIdRef.current) {
      endedRef.current = true;
      void resolveAnalysis(callIdRef.current, resolvedLaunch);
    }
  }, [resolveAnalysis]);

  useEffect(() => () => {
    analysisCancelledRef.current = true;
    clearConnectionTimer();
    if (assistantSpeakingTimerRef.current) clearTimeout(assistantSpeakingTimerRef.current);
    try { dailyCallRef.current?.destroy?.(); } catch {}
    dailyCallRef.current = null;
  }, []);

  const startCall = async () => {
    if (!launch) return;
    setError(null);
    setCallState("connecting");
    setTranscript([]);
    transcriptRef.current = [];
    setCompletedWaypointIds([]);
    setScorecard(null);
    setStartedAt(null);
    mutedRef.current = false;
    setMuted(false);
    endedRef.current = false;
    analysisCancelledRef.current = false;
    callIdRef.current = null;
    agentReadyRef.current = false;
    clearConnectionTimer();
    try {
      const response = await fetch("https://api.vapi.ai/call/web", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${launch.vapiPublicKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assistantId: launch.assistantId,
          assistantOverrides: launch.assistantOverrides,
        }),
      });
      const call = await response.json().catch(() => null) as { id?: string; webCallUrl?: string; message?: string } | null;
      if (!response.ok || !call?.id || !call.webCallUrl) {
        throw new Error(call?.message ?? "Could not create the AI practice call.");
      }
      callIdRef.current = call.id;

      const daily = Daily.createCallObject({ audioSource: true, videoSource: false });
      dailyCallRef.current = daily;
      const subscribeToAudio = (event: any) => {
        const participant = event?.participant;
        if (!participant?.local && participant?.session_id) {
          try {
            daily.updateParticipant(participant.session_id, {
              setSubscribedTracks: { audio: true, video: false },
            });
          } catch {}
        }
      };
      const onMessage = (event: any) => {
        const raw = event?.data;
        if (raw === "listening") {
          if (!agentReadyRef.current) {
            agentReadyRef.current = true;
            clearConnectionTimer();
            const now = Date.now();
            setStartedAt(now);
            setSeconds(0);
            setCallState("live");
          }
          return;
        }
        let message: any = raw;
        if (typeof raw === "string") {
          try { message = JSON.parse(raw); } catch { return; }
        }
        if (!message || typeof message !== "object") return;
        if (message?.type === "tool-calls" || message?.type === "function-call") {
          const validIds = new Set((launch.scenario.waypoints ?? []).map((waypoint) => waypoint.id));
          const ids = toolWaypointIds(message).filter((id) => validIds.has(id));
          if (ids.length) setCompletedWaypointIds((current) => Array.from(new Set([...current, ...ids])));
          return;
        }
        if (String(message?.type ?? "").startsWith("transcript")) appendTranscript(message);
      };
      daily.on("participant-joined", subscribeToAudio);
      daily.on("participant-updated", subscribeToAudio);
      daily.on("app-message", onMessage);
      daily.on("track-started", (event: any) => {
        const participant = event?.participant;
        if (!participant?.local && participant?.user_name === "Vapi Speaker" && event?.track?.kind === "audio") {
          subscribeToAudio(event);
          try { daily.sendAppMessage("playable"); } catch {}
        }
      });
      daily.on("remote-participants-audio-level", (event: any) => {
        const levels = Object.values(event?.participantsAudioLevel ?? {}) as number[];
        const level = Math.max(0, ...levels.map((value) => Number(value) || 0));
        setVolume(Math.min(1, level / 0.15));
        if (level > 0.012) {
          if (assistantSpeakingTimerRef.current) clearTimeout(assistantSpeakingTimerRef.current);
          setAssistantSpeaking(true);
        } else {
          if (assistantSpeakingTimerRef.current) clearTimeout(assistantSpeakingTimerRef.current);
          assistantSpeakingTimerRef.current = setTimeout(() => setAssistantSpeaking(false), 220);
        }
      });
      daily.on("left-meeting", () => finishCall(launch, agentReadyRef.current));
      daily.on("error", (event: any) => {
        const message = event?.errorMsg ?? event?.message ?? "The call could not connect.";
        setError(String(message));
        if (!agentReadyRef.current) {
          callIdRef.current = null;
          setCallState("ready");
        }
      });
      daily.startRemoteParticipantsAudioLevelObserver?.(100);
      await daily.join({ url: call.webCallUrl, subscribeToTracksAutomatically: false });
      connectionTimerRef.current = setTimeout(() => {
        if (agentReadyRef.current || dailyCallRef.current !== daily) return;
        callIdRef.current = null;
        try { daily.destroy?.(); } catch {}
        dailyCallRef.current = null;
        setCallState("ready");
        setError("The AI prospect did not finish connecting. Please try again.");
      }, 20000);
    } catch (caught) {
      try { dailyCallRef.current?.destroy?.(); } catch {}
      dailyCallRef.current = null;
      setCallState("ready");
      setError(caught instanceof Error ? caught.message : "Could not start the call. Check microphone access and try again.");
    }
  };

  const endCall = () => {
    try { dailyCallRef.current?.leave?.(); } catch {}
  };

  const toggleMute = () => {
    if (callState !== "live" || !dailyCallRef.current) return;
    const nextMuted = !muted;
    try {
      // Daily expects whether the local microphone is enabled, which is the
      // inverse of our `muted` UI state.
      dailyCallRef.current.setLocalAudio(!nextMuted);
      mutedRef.current = nextMuted;
      setMuted(nextMuted);
    } catch {
      Alert.alert("Could not change microphone state", "Please try again in a moment.");
    }
  };

  const waypoints = useMemo(() => launch?.scenario.waypoints ?? [], [launch]);

  if (loading) {
    return <PracticeSessionSkeleton onBack={onBack} />;
  }
  if (error && !launch) {
    return <View style={styles.center}><EmptyState icon="alert-circle-outline" title="Practice unavailable" subtitle={error} /><Pressable onPress={() => void prepare()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></View>;
  }
  if (!launch) return null;

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <BackBtn label="Practice" onPress={onBack} />
          {callState !== "ready" ? <View style={[styles.status, callState === "live" && styles.statusLive]}><View style={[styles.statusDot, callState === "live" && styles.statusDotLive]} /><Text style={[styles.statusText, callState === "live" && styles.statusTextLive]}>{callState === "live" ? timeLabel(seconds) : callState === "connecting" ? "Connecting" : "Complete"}</Text></View> : null}
        </View>
        <Text style={styles.title} numberOfLines={2}>{launch.scenario.name}</Text>
      </View>

      <View style={styles.callStage}>
        <View style={styles.callCard}>
          <View style={[styles.avatarRing, assistantSpeaking && styles.avatarRingSpeaking]}>
            <View style={[styles.avatar, assistantSpeaking && styles.avatarSpeaking]}>
              <Ionicons name={assistantSpeaking ? "volume-high" : "person"} size={28} color="#fff" />
            </View>
          </View>
          <Text style={styles.prospectName}>AI prospect</Text>
          <Text style={styles.callHint}>{callState === "live" ? assistantSpeaking ? "Speaking…" : "Listening…" : callState === "connecting" ? "Connecting to the AI prospect…" : callState === "ended" ? "Practice complete." : launch.scenario.description || "Practice a real conversation before your next tour."}</Text>
          {callState === "live" ? <View style={styles.volumeRow}>{Array.from({ length: 18 }, (_, index) => <View key={index} style={[styles.volumeBar, index / 18 < Math.min(1, Math.sqrt(volume)) ? styles.volumeBarActive : null]} />)}</View> : null}
        </View>

        <View style={styles.transcriptArea}>
          <ScrollView ref={transcriptScrollRef} style={styles.transcriptScroll} contentContainerStyle={styles.transcriptContent} showsVerticalScrollIndicator>
            {error ? <View style={styles.error}><Ionicons name="alert-circle-outline" size={18} color={C.red} /><Text style={styles.errorText}>{error}</Text></View> : null}
            {transcript.length ? transcript.map((line) => (
              <View key={line.id} style={[styles.line, line.role === "agent" ? styles.agentLine : styles.prospectLine]}>
                <View style={[styles.speakerMark, line.role === "agent" ? styles.agentMark : styles.prospectMark]}>
                  <Text style={[styles.speakerMarkText, line.role === "agent" ? styles.agentText : styles.prospectText]}>{line.role === "agent" ? "Y" : "AI"}</Text>
                </View>
                <View style={styles.lineBody}>
                  <View style={styles.lineMeta}>
                    <Text style={[styles.lineRole, line.role === "agent" ? styles.agentText : styles.prospectText]}>{line.role === "agent" ? "You" : "AI prospect"}</Text>
                    <Text style={styles.lineTime}>{timeLabel(line.seconds)}</Text>
                  </View>
                  <Text style={styles.lineText}>{line.text}</Text>
                </View>
              </View>
            )) : <View style={styles.emptyTranscript}><Ionicons name="chatbubble-ellipses-outline" size={23} color={C.textMuted} /><Text style={styles.emptyTranscriptText}>{callState === "live" ? "The conversation will appear here as you speak." : "Tap the microphone when you’re ready."}</Text></View>}
            {callState === "ended" ? <View style={styles.scoreCard}>{grading ? <><LoadingDots color={C.brand} /><Text style={styles.scoreTitle}>Reviewing your practice…</Text><Text style={styles.scoreCopy}>Your result will appear here as soon as it is ready.</Text></> : <>{scorecard?.score !== null && scorecard?.score !== undefined ? <Text style={styles.score}>{scorecard.score}%</Text> : <Ionicons name="time-outline" size={28} color={C.amber} />}<Text style={styles.scoreTitle}>{scorecard?.status === "passed" ? "Practice passed" : scorecard?.score != null ? "Practice complete" : "Analysis is still processing"}</Text>{scorecard?.summary ? <Text style={styles.scoreCopy}>{scorecard.summary}</Text> : null}<Text style={styles.scoreSaved}>{scorecard?.saved ? "Saved to your practice history." : "You can return to practice history for the full result."}</Text><Pressable onPress={onBack} style={styles.doneButton}><Text style={styles.doneButtonText}>Back to practice</Text></Pressable></>}</View> : null}
          </ScrollView>
        </View>
      </View>

      <View style={styles.controlDock}>
        {callState === "ready" ? <View style={styles.readyControls}><Pressable onPress={() => void startCall()} style={styles.startButton} accessibilityRole="button" accessibilityLabel="Start live practice"><Ionicons name="mic" size={25} color="#fff" /></Pressable><View style={styles.readyGoals}><GoalsButton completed={completedWaypointIds.length} total={waypoints.length} onPress={() => setGoalsOpen(true)} /></View></View> : null}
        {callState === "connecting" ? <View style={styles.connecting}><LoadingDots color={C.brand} /><Text style={styles.connectingText}>Connecting securely…</Text></View> : null}
        {callState === "live" ? <View style={styles.liveControlsRow}><Pressable onPress={toggleMute} style={[styles.control, styles.liveMuteControl]}><Ionicons name={muted ? "mic-off" : "mic"} size={22} color={C.text} /><Text style={styles.controlText}>{muted ? "Unmute" : "Mute"}</Text></Pressable><GoalsButton completed={completedWaypointIds.length} total={waypoints.length} onPress={() => setGoalsOpen(true)} /><Pressable onPress={endCall} style={[styles.control, styles.endControl, styles.liveEndControl]}><Ionicons name="call" size={22} color="#fff" /><Text style={[styles.controlText, styles.endControlText]}>End</Text></Pressable></View> : null}
      </View>

      <Modal visible={goalsOpen} transparent animationType="slide" onRequestClose={() => setGoalsOpen(false)}>
        <View style={styles.drawerOverlay}>
          <Pressable style={styles.drawerDismiss} onPress={() => setGoalsOpen(false)} />
          <View style={styles.goalsDrawer}>
            <View style={styles.drawerHandle} />
            <View style={styles.drawerHeader}><View><Text style={styles.drawerEyebrow}>PRACTICE</Text><Text style={styles.drawerTitle}>Goals</Text></View><Pressable onPress={() => setGoalsOpen(false)} style={styles.drawerClose} accessibilityLabel="Close goals"><Ionicons name="close" size={19} color={C.textSec} /></Pressable></View>
            <Text style={styles.drawerProgress}>{completedWaypointIds.length} of {waypoints.length} complete</Text>
            <ScrollView contentContainerStyle={styles.drawerList} showsVerticalScrollIndicator={false}>{waypoints.map((waypoint) => {
              const done = completedWaypointIds.includes(waypoint.id);
              return <View key={waypoint.id} style={[styles.waypoint, done && styles.waypointDone]}><View style={[styles.waypointIcon, done && styles.waypointIconDone]}><Ionicons name={done ? "checkmark" : "flag-outline"} size={15} color={done ? "#fff" : C.brand} /></View><View style={styles.grow}><Text style={styles.waypointTitle}>{waypoint.title}</Text>{waypoint.cue ? <Text style={styles.waypointCue}>{waypoint.cue}</Text> : null}</View></View>;
            })}</ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function GoalsButton({ completed, total, onPress }: { completed: number; total: number; onPress: () => void }) {
  const complete = total > 0 && completed === total;
  return (
    <Pressable onPress={onPress} style={styles.goalsButton} accessibilityRole="button" accessibilityLabel={`Open goals, ${completed} of ${total} complete`}>
      <Ionicons name="checkbox-outline" size={19} color={complete ? C.green : C.brand} />
      <Text style={styles.goalsButtonText}>{completed}/{total}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 28, backgroundColor: C.bg },
  header: { gap: 8, paddingHorizontal: 20, paddingBottom: 14 }, headerTop: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerCopy: { flex: 1, minWidth: 0 }, eyebrow: { color: C.textMuted, fontSize: 9, fontWeight: "900", letterSpacing: 0.8 }, title: { color: C.text, fontSize: 20, fontWeight: "900", lineHeight: 25 },
  goalsButton: { width: 46, height: 46, alignItems: "center", justifyContent: "center", gap: 0, borderRadius: 23, borderWidth: 1, borderColor: C.border, backgroundColor: C.card }, goalsButtonText: { color: C.textMuted, fontSize: 10, fontWeight: "900", fontVariant: ["tabular-nums"] },
  status: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 99, backgroundColor: C.card, borderWidth: 1, borderColor: C.border }, statusLive: { backgroundColor: C.green + "12", borderColor: C.green + "35" }, statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.textMuted }, statusDotLive: { backgroundColor: C.green }, statusText: { color: C.textMuted, fontSize: 10, fontWeight: "900" }, statusTextLive: { color: C.green },
  callStage: { flex: 1, minHeight: 0, paddingHorizontal: 20 },
  callCard: { alignItems: "center", paddingTop: 8, paddingBottom: 16 },
  avatarRing: { width: 74, height: 74, alignItems: "center", justifyContent: "center", borderRadius: 37, backgroundColor: C.brand + "12" },
  avatarRingSpeaking: { backgroundColor: C.brand + "22", transform: [{ scale: 1.04 }] },
  avatar: { width: 60, height: 60, alignItems: "center", justifyContent: "center", borderRadius: 30, backgroundColor: C.brand }, avatarSpeaking: { backgroundColor: C.brand }, prospectName: { marginTop: 10, color: C.text, fontSize: 16, fontWeight: "900" }, callHint: { marginTop: 4, maxWidth: 280, color: C.textSec, fontSize: 12, fontWeight: "600", textAlign: "center", lineHeight: 18 },
  controlDock: { minHeight: 88, paddingHorizontal: 20, paddingTop: 13, paddingBottom: 20, borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.border, backgroundColor: C.card }, readyControls: { position: "relative", width: "100%", height: 64, alignItems: "center", justifyContent: "center" }, readyGoals: { position: "absolute", left: "50%", marginLeft: 70 }, startButton: { width: 64, height: 64, alignItems: "center", justifyContent: "center", borderRadius: 32, borderWidth: 4, borderColor: "#dbeafe", backgroundColor: C.brand, shadowColor: C.brand, shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } }, connecting: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 }, connectingText: { color: C.textSec, fontSize: 12, fontWeight: "800" },
  liveControlsRow: { flexDirection: "row", alignItems: "center", gap: 8 }, controls: { flex: 1, flexDirection: "row", gap: 10 }, control: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.card }, liveMuteControl: { flex: 1 }, controlText: { color: C.text, fontSize: 13, fontWeight: "900" }, endControl: { borderColor: C.red, backgroundColor: C.red }, liveEndControl: { flex: 1 }, endControlText: { color: "#fff" },
  volumeRow: { height: 21, flexDirection: "row", alignItems: "flex-end", gap: 3, marginTop: 17 }, volumeBar: { width: 3, height: 5, borderRadius: 2, backgroundColor: C.border }, volumeBarActive: { height: 18, backgroundColor: C.brand },
  error: { flexDirection: "row", gap: 9, alignItems: "flex-start", padding: 12, borderRadius: 13, backgroundColor: C.redBg }, errorText: { flex: 1, color: C.red, fontSize: 12, fontWeight: "700", lineHeight: 18 },
  section: { gap: 9 }, sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, sectionTitle: { color: C.text, fontSize: 16, fontWeight: "900" }, sectionMeta: { minWidth: 23, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 99, backgroundColor: C.brand + "12", color: C.brand, fontSize: 10, fontWeight: "900", textAlign: "center" },
  waypoint: { flexDirection: "row", gap: 11, paddingVertical: 13, paddingHorizontal: 12, borderRadius: 12, backgroundColor: C.card }, waypointDone: { backgroundColor: C.green + "0A" }, waypointIcon: { width: 26, height: 26, alignItems: "center", justifyContent: "center", borderRadius: 13, borderWidth: 1, borderColor: C.border, backgroundColor: C.bg }, waypointIconDone: { borderColor: C.green, backgroundColor: C.green }, grow: { flex: 1, minWidth: 0 }, waypointTitle: { color: C.text, fontSize: 13, fontWeight: "800", lineHeight: 18 }, waypointCue: { marginTop: 3, color: C.textSec, fontSize: 11, fontWeight: "500", lineHeight: 16 },
  transcriptArea: { flex: 1, minHeight: 0, borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.border }, transcriptScroll: { flex: 1 }, transcriptContent: { flexGrow: 1, gap: 6, paddingVertical: 14, paddingRight: 2 },
  line: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingHorizontal: 10, paddingVertical: 11, borderRadius: 10 },
  agentLine: { backgroundColor: C.brand + "09" }, prospectLine: { backgroundColor: C.card },
  speakerMark: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: 14 }, agentMark: { backgroundColor: C.brand + "12" }, prospectMark: { backgroundColor: C.brand + "0A", borderWidth: 1, borderColor: C.brand + "22" }, speakerMarkText: { fontSize: 9, fontWeight: "900" },
  lineBody: { flex: 1, minWidth: 0 }, lineMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }, lineRole: { fontSize: 10, fontWeight: "900" }, lineTime: { color: C.textMuted, fontSize: 9, fontWeight: "800", fontVariant: ["tabular-nums"] }, agentText: { color: C.brand }, prospectText: { color: C.brand }, lineText: { marginTop: 4, color: C.text, fontSize: 14, lineHeight: 20, fontWeight: "600" }, emptyTranscript: { flex: 1, minHeight: 150, alignItems: "center", justifyContent: "center", gap: 10, padding: 32 }, emptyTranscriptText: { maxWidth: 230, color: C.textMuted, fontSize: 13, fontWeight: "600", lineHeight: 20, textAlign: "center" },
  drawerOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(12, 20, 36, 0.32)" }, drawerDismiss: { flex: 1 }, goalsDrawer: { width: "100%", maxHeight: "72%", paddingTop: 9, paddingHorizontal: 20, paddingBottom: 30, backgroundColor: C.bg, borderTopWidth: 1, borderColor: C.border, borderTopLeftRadius: 24, borderTopRightRadius: 24, shadowColor: "#0B1731", shadowOpacity: 0.16, shadowRadius: 24, shadowOffset: { width: 0, height: -7 } }, drawerHandle: { width: 34, height: 4, alignSelf: "center", borderRadius: 4, backgroundColor: C.border, marginBottom: 17 }, drawerHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }, drawerEyebrow: { color: C.textMuted, fontSize: 10, fontWeight: "900", letterSpacing: 0.7 }, drawerTitle: { marginTop: 3, color: C.text, fontSize: 24, fontWeight: "900" }, drawerClose: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border, borderRadius: 18, backgroundColor: C.card }, drawerProgress: { marginTop: 11, marginBottom: 17, color: C.brand, fontSize: 13, fontWeight: "800" }, drawerList: { gap: 8, paddingBottom: 30 },
  scoreCard: { alignItems: "center", gap: 9, padding: 22, borderRadius: 18, borderWidth: 1, borderColor: C.brand + "30", backgroundColor: C.brand + "08" }, score: { color: C.brand, fontSize: 38, fontWeight: "900" }, scoreTitle: { color: C.text, fontSize: 16, fontWeight: "900", textAlign: "center" }, scoreCopy: { color: C.textSec, fontSize: 12, fontWeight: "600", lineHeight: 18, textAlign: "center" }, scoreSaved: { color: C.textMuted, fontSize: 11, fontWeight: "700", textAlign: "center" }, doneButton: { marginTop: 5, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 11, backgroundColor: C.brand }, doneButtonText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  loadingText: { color: C.textSec, fontSize: 13, fontWeight: "700" }, retry: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: C.brand }, retryText: { color: "#fff", fontSize: 13, fontWeight: "900" },
});
