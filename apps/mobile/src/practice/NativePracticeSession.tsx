import "react-native-get-random-values";

import { authenticatedFetch } from "@/auth";
import { BottomSheetModal } from "@/components/bottom-sheet-modal";
import { CustomText } from "@/components/custom-text";
import { EmptyStateCard } from "@/components/empty-state-card";
import { GlassNavHeader, glassNavContentInset } from "@/components/glass-nav-header";
import { getLiquidGlassView } from "@/components/liquid-glass";
import { LiquidGlassIconButton } from "@/components/liquid-glass-icon-button";
import { LoadingDots } from "@/components/loading-dots";
import { SessionModeTabs } from "@/components/session/session-mode-tabs";
import { MotionPressable } from "@/components/ui/motion";
import { ACCENT, BACKGROUND, CARD, HINT, LARGE_CORNER, SMALL_CORNER, TEXT } from "@/theme/tokens";
import { tourColors as C } from "@/theme/tour-brand";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PracticeSessionSkeleton } from "./practice-loading";

type PracticeReviewTab = "transcript" | "report";

const PRACTICE_REVIEW_TABS: { id: PracticeReviewTab; label: string }[] = [
  { id: "transcript", label: "Transcript" },
  { id: "report", label: "Report" },
];
const FOOTER_FADE = 56;
const FOOTER_CONTROLS = 58;
const LIVE_DOCK = 76;
const LIVE_DOCK_GAP = 10;
const GOALS_HEADER_BAR = 44;
const GOALS_HEADER_FADE = 56;
const GOALS_HEADER_INSET = GOALS_HEADER_BAR + 8;

type Waypoint = { id: string; title: string; cue?: string; type?: string };
type Scenario = {
  id: string;
  name: string;
  description?: string;
  difficulty?: "easy" | "medium" | "hard";
  waypoints?: Waypoint[];
};
type TranscriptLine = { id: string; role: "agent" | "prospect"; text: string; seconds: number };

type Launch = {
  success: true;
  vapiPublicKey: string;
  assistantId: string;
  assistantOverrides: Record<string, unknown>;
  traineeName: string;
  scenario: Scenario & { waypoints?: Waypoint[]; passThreshold?: number };
};

type StoredAttempt = {
  vapi_call_id?: string | null;
  scenario_id?: string | null;
  scenario_name?: string | null;
  scenario_difficulty?: string | null;
  score?: number | null;
  grade_status?: string | null;
  duration_seconds?: number | null;
  summary?: string | null;
  transcript_json?: unknown;
  evaluations?: unknown;
};

type Scorecard = {
  score: number | null;
  status: "passed" | "not-passed" | "needs-review";
  summary: string | null;
  saved: boolean;
};

const WAYPOINTS_EVAL_KEYWORD = "roleplay_waypoints";

function waypointsFromEvaluations(evaluations: unknown): { waypoints: Waypoint[]; completedIds: string[] } {
  if (!Array.isArray(evaluations)) return { waypoints: [], completedIds: [] };
  const entry = evaluations.find((item) => {
    if (!item || typeof item !== "object") return false;
    return (item as { keyword?: string }).keyword === WAYPOINTS_EVAL_KEYWORD;
  }) as { details?: { waypoints?: unknown; completedIds?: unknown } } | undefined;
  const rawWaypoints = Array.isArray(entry?.details?.waypoints) ? entry.details.waypoints : [];
  const waypoints = rawWaypoints.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const waypoint = item as { id?: unknown; title?: unknown; cue?: unknown };
    const id = typeof waypoint.id === "string" ? waypoint.id.trim() : "";
    const title = typeof waypoint.title === "string" ? waypoint.title.trim() : "";
    if (!id || !title) return [];
    return [{
      id,
      title,
      cue: typeof waypoint.cue === "string" && waypoint.cue.trim() ? waypoint.cue.trim() : undefined,
    }];
  });
  const completedIds = Array.isArray(entry?.details?.completedIds)
    ? entry.details.completedIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : [];
  return { waypoints, completedIds };
}

function linesFromStoredAttempt(raw: unknown): TranscriptLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry, index) => {
    const record = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
    const text = String(record.message ?? record.text ?? "").trim();
    if (!text) return [];
    const type = String(record.type ?? record.role ?? "").toLowerCase();
    const role: TranscriptLine["role"] = ["user", "customer", "human", "agent"].includes(type)
      ? "agent"
      : "prospect";
    return [{
      id: `${role}:${index}`,
      role,
      text,
      seconds: Math.max(0, Math.round(Number(record.time ?? record.seconds) || 0)),
    }];
  });
}

// Vapi finalizes post-call analysis asynchronously. We start with shorter
// retries, then continue at a calm interval while the result screen is open.
const POLL_DELAYS_MS = [2000, 3000, 5000, 8000, 10000, 15000, 20000, 30000, 45000];
const SLOW_ANALYSIS_POLL_DELAY_MS = 30000;

function loadDaily() {
  const loaded = require("@daily-co/react-native-daily-js") as {
    default?: { createCallObject: (options: { audioSource: boolean; videoSource: boolean }) => any };
    createCallObject?: (options: { audioSource: boolean; videoSource: boolean }) => any;
  };
  const Daily = loaded.default ?? loaded;
  if (typeof Daily.createCallObject !== "function") {
    throw new Error("Live practice could not load the call SDK.");
  }
  return Daily;
}

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

function PracticeSessionShell({
  title,
  onBack,
  footer,
  liveDock,
  children,
}: {
  title: string;
  onBack: () => void;
  footer?: React.ReactNode;
  liveDock?: React.ReactNode;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const footerPad = Math.max(insets.bottom, 16);
  return (
    <View style={styles.root}>
      <View
        style={[
          styles.page,
          { paddingTop: glassNavContentInset(insets.top) },
        ]}
      >
        {children}
      </View>
      {footer ? (
        <View pointerEvents="box-none" style={[styles.footer, { paddingBottom: footerPad }]}>
          {liveDock}
          <View
            style={[
              styles.footerControls,
              liveDock ? styles.footerControlsUnderDock : null,
            ]}
          >
            <LinearGradient
              colors={["rgba(242, 242, 247, 0)", "rgba(242, 242, 247, 0.62)", BACKGROUND]}
              locations={[0, 0.5, 1]}
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
            />
            {footer}
          </View>
        </View>
      ) : null}
      <GlassNavHeader title={title} onBack={onBack} />
    </View>
  );
}

function prospectDescription(description?: string) {
  return description || "Practice a real conversation before your next tour.";
}

function PracticeLiveDock({
  speaking,
  seconds,
}: {
  speaking: boolean;
  seconds: number;
}) {
  const GlassView = useMemo(() => getLiquidGlassView(), []);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    pulse.stopAnimation();
    pulse.setValue(1);
    if (!speaking) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.28, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      pulse.stopAnimation();
    };
  }, [pulse, speaking]);

  return (
    <View style={styles.liveDock}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.liveAccent,
          !speaking && styles.liveAccentQuiet,
          { opacity: speaking ? pulse : 1 },
        ]}
      />
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {GlassView ? (
          <GlassView
            glassEffectStyle="regular"
            colorScheme="light"
            tintColor="rgba(180,184,192,0.22)"
            borderRadius={LARGE_CORNER}
            style={StyleSheet.absoluteFill}
          />
        ) : Platform.OS === "ios" ? (
          <BlurView tint="systemThinMaterialLight" intensity={80} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.liveDockSurface]} />
        )}
        <View style={[StyleSheet.absoluteFill, styles.liveDockWash]} />
      </View>
      <View style={styles.liveDockInner}>
        <View style={styles.emptyIcon}>
          <Ionicons name={speaking ? "volume-high" : "ear-outline"} size={22} color={ACCENT} />
        </View>
        <View style={styles.flex}>
          <CustomText textStyle="title" numberOfLines={1}>
            AI prospect
          </CustomText>
          <View style={styles.liveMetaRow}>
            <Animated.View
              style={[
                styles.liveDot,
                !speaking && styles.liveDotQuiet,
                { opacity: speaking ? pulse : 1 },
              ]}
            />
            <CustomText textStyle="caption" style={styles.muted}>
              {speaking ? "Speaking" : "Listening"}
            </CustomText>
            <CustomText textStyle="micro" style={styles.liveTimer}>
              {timeLabel(seconds)}
            </CustomText>
          </View>
        </View>
      </View>
    </View>
  );
}

export function NativePracticeSession({
  scenario,
  attemptId,
  onBack,
  active = true,
  onAttemptPersisted,
}: {
  scenario: Scenario | null;
  attemptId?: string;
  onBack: () => void;
  active?: boolean;
  onAttemptPersisted?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const headerInset = glassNavContentInset(insets.top);
  const [launch, setLaunch] = useState<Launch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [callState, setCallState] = useState<"ready" | "connecting" | "live" | "ended">("ready");
  const [muted, setMuted] = useState(false);
  const [assistantSpeaking, setAssistantSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [completedWaypointIds, setCompletedWaypointIds] = useState<string[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [grading, setGrading] = useState(false);
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [reviewTab, setReviewTab] = useState<PracticeReviewTab>("transcript");
  const endedFromLiveRef = useRef(false);
  const completedWaypointIdsRef = useRef<string[]>([]);
  const secondsRef = useRef(0);
  const resumeStartedRef = useRef<string | null>(null);
  const [resumeCallId, setResumeCallId] = useState<string | null>(null);

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
    if (attemptId) {
      setLoading(true);
      setError(null);
      try {
        const response = await authenticatedFetch(
          `/api/roleplay/attempts?id=${encodeURIComponent(attemptId)}`,
        );
        const body = (await response.json().catch(() => null)) as
          | { success?: boolean; attempt?: StoredAttempt; message?: string }
          | null;
        if (!response.ok || !body?.success || !body.attempt) {
          throw new Error(body?.message ?? "Could not load this practice session.");
        }
        const attempt = body.attempt;
        const status: Scorecard["status"] =
          attempt.grade_status === "passed" || attempt.grade_status === "not-passed"
            ? attempt.grade_status
            : "needs-review";
        const storedGoals = waypointsFromEvaluations(attempt.evaluations);
        const scenarioWaypoints = Array.isArray(scenario?.waypoints) ? scenario.waypoints : [];
        const reportWaypoints = storedGoals.waypoints.length ? storedGoals.waypoints : scenarioWaypoints;
        setLaunch({
          success: true,
          vapiPublicKey: "",
          assistantId: "",
          assistantOverrides: {},
          traineeName: "",
          scenario: {
            id: attempt.scenario_id || scenario?.id || "",
            name: attempt.scenario_name || scenario?.name || "Practice",
            description: scenario?.description,
            difficulty: (attempt.scenario_difficulty as Scenario["difficulty"]) || scenario?.difficulty,
            waypoints: reportWaypoints,
          },
        });
        setTranscript(linesFromStoredAttempt(attempt.transcript_json));
        setCompletedWaypointIds(storedGoals.completedIds);
        completedWaypointIdsRef.current = storedGoals.completedIds;
        setScorecard({
          score: attempt.score == null ? null : Math.round(Number(attempt.score)),
          status,
          summary: attempt.summary ?? null,
          saved: true,
        });
        setSeconds(Math.max(0, Math.round(Number(attempt.duration_seconds) || 0)));
        setCallState("ended");
        const pendingCallId =
          typeof attempt.vapi_call_id === "string" ? attempt.vapi_call_id.trim() : "";
        if (attempt.score == null && pendingCallId) {
          callIdRef.current = pendingCallId;
          analysisCancelledRef.current = false;
          setResumeCallId(pendingCallId);
          setGrading(true);
        } else {
          setResumeCallId(null);
          setGrading(false);
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not load this practice session.");
      } finally {
        setLoading(false);
      }
      return;
    }
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
  }, [attemptId, scenario?.description, scenario?.difficulty, scenario?.id, scenario?.name, scenario?.waypoints]);

  useEffect(() => { void prepare(); }, [prepare]);

  useEffect(() => {
    completedWaypointIdsRef.current = completedWaypointIds;
  }, [completedWaypointIds]);

  useEffect(() => {
    secondsRef.current = seconds;
  }, [seconds]);

  useEffect(() => {
    if (!startedAt || callState !== "live") return;
    const timer = setInterval(() => setSeconds(elapsed(startedAt)), 1000);
    return () => clearInterval(timer);
  }, [callState, startedAt]);

  useEffect(() => {
    if (callState === "live") endedFromLiveRef.current = true;
    if (callState === "ended" && endedFromLiveRef.current) {
      endedFromLiveRef.current = false;
      setReviewTab("report");
    }
  }, [callState]);

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

  const persistAttempt = useCallback(async ({
    vapiCallId,
    resolvedLaunch,
    score,
    gradeStatus,
    durationSeconds,
    summary,
    transcriptJson,
  }: {
    vapiCallId: string;
    resolvedLaunch: Launch;
    score: number | null;
    gradeStatus: Scorecard["status"];
    durationSeconds: number;
    summary: string | null;
    transcriptJson: unknown[];
  }) => {
    const transcriptText = transcriptJson
      .map((line: any) => `${line.type === "user" || line.type === "agent" ? "Agent" : "Prospect"}: ${line.message ?? ""}`)
      .filter((line: string) => !line.endsWith(": "))
      .join("\n");
    try {
      const response = await authenticatedFetch("/api/roleplay/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vapiCallId,
          scenarioId: resolvedLaunch.scenario.id,
          scenarioName: resolvedLaunch.scenario.name,
          scenarioDifficulty: resolvedLaunch.scenario.difficulty,
          score,
          gradeStatus,
          durationSeconds,
          summary,
          transcript: transcriptText,
          transcriptJson,
          evaluations: [{
            keyword: WAYPOINTS_EVAL_KEYWORD,
            score: completedWaypointIdsRef.current.length,
            comments: [],
            details: {
              waypoints: (resolvedLaunch.scenario.waypoints ?? []).map((waypoint) => ({
                id: waypoint.id,
                title: waypoint.title,
                cue: waypoint.cue ?? "",
              })),
              completedIds: completedWaypointIdsRef.current,
            },
          }],
        }),
      });
      const body = await response.json().catch(() => null) as { success?: boolean } | null;
      const saved = response.ok && Boolean(body?.success);
      if (saved) onAttemptPersisted?.();
      return saved;
    } catch {
      return false;
    }
  }, [onAttemptPersisted]);

  const liveTranscriptJson = () =>
    transcriptRef.current.map((line) => ({
      type: line.role === "agent" ? "user" : "assistant",
      message: line.text,
      time: line.seconds,
    }));

  const saveAttempt = useCallback(async (call: any, structuredData: any, resolvedLaunch: Launch) => {
    const score = Number(structuredData?.overallScore);
    const normalizedScore = Number.isFinite(score) ? Math.round(Math.max(0, Math.min(100, score))) : null;
    const threshold = Number(resolvedLaunch.scenario.passThreshold ?? 70);
    const status: Scorecard["status"] = normalizedScore === null
      ? "needs-review"
      : normalizedScore >= threshold ? "passed" : "not-passed";
    const transcriptJson = Array.isArray(call?.transcriptJson) && call.transcriptJson.length
      ? call.transcriptJson
      : liveTranscriptJson();
    const saved = await persistAttempt({
      vapiCallId: call.id,
      resolvedLaunch,
      score: normalizedScore,
      gradeStatus: status,
      durationSeconds: call.durationSeconds ?? secondsRef.current,
      summary: call.analysis?.summary ?? null,
      transcriptJson,
    });
    setScorecard({ score: normalizedScore, status, summary: call.analysis?.summary ?? null, saved });
  }, [persistAttempt]);

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
      const callId = callIdRef.current;
      const durationSeconds = secondsRef.current;
      setGrading(true);
      const transcriptJson = liveTranscriptJson();
      void (async () => {
        await persistAttempt({
          vapiCallId: callId,
          resolvedLaunch,
          score: null,
          gradeStatus: "needs-review",
          durationSeconds,
          summary: null,
          transcriptJson,
        });
        if (analysisCancelledRef.current) return;
        await resolveAnalysis(callId, resolvedLaunch);
      })();
    }
  }, [persistAttempt, resolveAnalysis]);

  useEffect(() => {
    if (!resumeCallId || !launch) return;
    if (resumeStartedRef.current === resumeCallId) return;
    resumeStartedRef.current = resumeCallId;
    analysisCancelledRef.current = false;
    endedRef.current = true;
    void resolveAnalysis(resumeCallId, launch);
  }, [launch, resolveAnalysis, resumeCallId]);

  useEffect(() => () => {
    analysisCancelledRef.current = true;
    clearConnectionTimer();
    if (assistantSpeakingTimerRef.current) clearTimeout(assistantSpeakingTimerRef.current);
    try { dailyCallRef.current?.destroy?.(); } catch {}
    dailyCallRef.current = null;
  }, []);

  useEffect(() => {
    if (active) return;
    clearConnectionTimer();
    if (assistantSpeakingTimerRef.current) clearTimeout(assistantSpeakingTimerRef.current);
    try { dailyCallRef.current?.destroy?.(); } catch {}
    dailyCallRef.current = null;
  }, [active]);

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
    resumeStartedRef.current = null;
    setResumeCallId(null);
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

      const daily = loadDaily().createCallObject({ audioSource: true, videoSource: false });
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
  const headerTitle = launch?.scenario.name ?? scenario?.name ?? "Practice";
  const footerPad = Math.max(insets.bottom, 16);
  const scrollBottomPad =
    callState === "ended"
      ? insets.bottom + 8
      : FOOTER_CONTROLS +
        footerPad +
        (callState === "live" ? LIVE_DOCK_GAP : FOOTER_FADE) +
        8;
  const goalsSheetHeight = Math.round(
    Math.min(windowHeight * 0.72, Math.max(380, 168 + Math.max(waypoints.length, 1) * 88)),
  );

  if (loading) {
    return <PracticeSessionSkeleton title={headerTitle} onBack={onBack} />;
  }
  if (error && !launch) {
    return (
      <PracticeSessionShell title={headerTitle} onBack={onBack}>
        <View style={styles.center}>
          <EmptyStateCard icon="alert-circle-outline" title="Practice unavailable" subtitle={error}>
            <MotionPressable
              accessibilityRole="button"
              haptic="selection"
              onPress={() => void prepare()}
              style={styles.primaryBtn}
            >
              <CustomText textStyle="title" style={styles.primaryBtnText}>
                Try again
              </CustomText>
            </MotionPressable>
          </EmptyStateCard>
        </View>
      </PracticeSessionShell>
    );
  }
  if (!launch) return null;

  const footer =
    callState === "ready" ? (
      <View style={styles.readyControls}>
        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel="Start practice"
          haptic="medium"
          onPress={() => void startCall()}
          style={[styles.primaryBtn, styles.readyStart]}
        >
          <CustomText textStyle="title" style={styles.primaryBtnText}>
            Start Practice
          </CustomText>
        </MotionPressable>
        <GoalsButton
          completed={completedWaypointIds.length}
          total={waypoints.length}
          onPress={() => setGoalsOpen(true)}
        />
      </View>
    ) : callState === "connecting" ? (
      <View style={styles.connecting}>
        <LoadingDots color={ACCENT} />
        <CustomText textStyle="caption" style={styles.muted}>
          Connecting securely…
        </CustomText>
      </View>
    ) : callState === "live" ? (
      <View style={styles.liveControlsRow}>
        <MotionPressable
          accessibilityRole="button"
          haptic="selection"
          onPress={toggleMute}
          style={[styles.control, styles.liveMuteControl]}
        >
          <Ionicons name={muted ? "mic-off" : "mic"} size={22} color={TEXT} />
          <CustomText textStyle="title">{muted ? "Unmute" : "Mute"}</CustomText>
        </MotionPressable>
        <GoalsButton
          completed={completedWaypointIds.length}
          total={waypoints.length}
          onPress={() => setGoalsOpen(true)}
        />
        <MotionPressable
          accessibilityRole="button"
          haptic="medium"
          onPress={endCall}
          style={[styles.control, styles.endControl]}
        >
          <Ionicons name="call" size={22} color={CARD} />
          <CustomText textStyle="title" style={styles.onAccent}>
            End
          </CustomText>
        </MotionPressable>
      </View>
    ) : null;

  return (
    <PracticeSessionShell
      title={headerTitle}
      onBack={onBack}
      footer={footer}
      liveDock={
        callState === "live" ? (
          <PracticeLiveDock speaking={assistantSpeaking} seconds={seconds} />
        ) : null
      }
    >
      <ScrollView
        ref={transcriptScrollRef}
        style={[styles.transcriptScroll, { marginTop: -headerInset }]}
        contentContainerStyle={[
          styles.transcriptContent,
          { paddingTop: headerInset, paddingBottom: scrollBottomPad },
        ]}
        showsVerticalScrollIndicator
      >
        {callState === "ended" ? (
          <View style={styles.tabWrap}>
            <SessionModeTabs
              value={reviewTab}
              onChange={setReviewTab}
              items={PRACTICE_REVIEW_TABS}
            />
          </View>
        ) : null}
        {error ? (
          <View style={styles.error}>
            <Ionicons name="alert-circle-outline" size={18} color={C.red} />
            <CustomText textStyle="caption" style={styles.errorText}>
              {error}
            </CustomText>
          </View>
        ) : null}
        {callState === "ended" && reviewTab === "report" ? (
          <View style={styles.report}>
            {grading ? (
              <View style={styles.reportCard}>
                <LoadingDots color={ACCENT} />
                <CustomText textStyle="title">Reviewing your practice…</CustomText>
                <CustomText textStyle="caption" style={styles.scoreCopy}>
                  Your result will appear here as soon as it is ready.
                </CustomText>
              </View>
            ) : (
              <>
                <View style={styles.reportSection}>
                  <CustomText textStyle="micro" style={styles.reportLabel}>
                    Score
                  </CustomText>
                  <View style={styles.reportCard}>
                    {scorecard?.score != null ? (
                      <CustomText textStyle="hero" style={styles.score}>
                        {scorecard.score}%
                      </CustomText>
                    ) : (
                      <CustomText textStyle="title" style={styles.scoreCopy}>
                        Analysis is still processing
                      </CustomText>
                    )}
                  </View>
                </View>
                {scorecard?.summary ? (
                  <View style={styles.reportSection}>
                    <CustomText textStyle="micro" style={styles.reportLabel}>
                      Summary
                    </CustomText>
                    <View style={styles.reportCard}>
                      <CustomText textStyle="body" style={styles.summaryText}>
                        {scorecard.summary}
                      </CustomText>
                    </View>
                  </View>
                ) : null}
                {waypoints.length ? (
                  <View style={styles.reportSection}>
                    <CustomText textStyle="micro" style={styles.reportLabel}>
                      Goals
                    </CustomText>
                    <View style={styles.reportCard}>
                      {waypoints.map((waypoint) => {
                        const done = completedWaypointIds.includes(waypoint.id);
                        return (
                          <View key={waypoint.id} style={styles.reportGoalRow}>
                            <View style={[styles.iconWrap, done && styles.iconWrapDone]}>
                              <Ionicons
                                name={done ? "checkmark" : "flag-outline"}
                                size={16}
                                color={done ? CARD : ACCENT}
                              />
                            </View>
                            <View style={styles.flex}>
                              <CustomText textStyle="body">{waypoint.title}</CustomText>
                              {waypoint.cue ? (
                                <CustomText textStyle="caption" style={styles.muted}>
                                  {waypoint.cue}
                                </CustomText>
                              ) : null}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ) : null}
              </>
            )}
          </View>
        ) : (
          <>
            <View style={styles.callCard}>
              <View style={styles.emptyIcon}>
                <Ionicons name="person" size={22} color={ACCENT} />
              </View>
              <CustomText textStyle="title" style={styles.prospectName}>
                About your prospect
              </CustomText>
              <CustomText textStyle="caption" style={styles.callHint}>
                {prospectDescription(launch.scenario.description)}
              </CustomText>
            </View>
            {transcript.length ? (
              <View>
                {transcript.map((line) => (
                  <View key={line.id} style={styles.turnRow}>
                    <View style={styles.turnMeta}>
                      <CustomText
                        textStyle="caption"
                        style={line.role === "agent" ? styles.agentMeta : styles.prospectMeta}
                      >
                        {line.role === "agent" ? "You" : "AI prospect"}
                      </CustomText>
                      <CustomText textStyle="caption" style={styles.turnTime}>
                        {timeLabel(line.seconds)}
                      </CustomText>
                    </View>
                    <CustomText textStyle="body" style={styles.turnText}>
                      {line.text}
                    </CustomText>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}
        </ScrollView>

      <BottomSheetModal
        visible={goalsOpen}
        onClose={() => setGoalsOpen(false)}
        sheetHeight={goalsSheetHeight}
        sheetStyle={styles.goalsSheet}
        contentStyle={styles.goalsSheetBody}
      >
        <View style={styles.goalsSheetInner}>
          <View pointerEvents="box-none" style={styles.goalsHeaderWrap}>
            <LinearGradient
              colors={[BACKGROUND, "rgba(242, 242, 247, 0.62)", "rgba(242, 242, 247, 0)"]}
              locations={[0, 0.5, 1]}
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
            />
            <View pointerEvents="box-none" style={styles.goalsTitleRow}>
              <View style={styles.flex}>
                <CustomText textStyle="hero">Goals</CustomText>
              </View>
              <LiquidGlassIconButton
                icon="close"
                accessibilityLabel="Close goals"
                onPress={() => setGoalsOpen(false)}
              />
            </View>
          </View>
          <ScrollView
            style={styles.goalsList}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.goalsListContent}
          >
            <View style={styles.goalsSection}>
              <View style={styles.goalsSectionHeading}>
                <CustomText textStyle="micro" style={styles.goalsSectionLabel}>
                  Session goals
                </CustomText>
                <CustomText textStyle="micro" style={styles.muted}>
                  {completedWaypointIds.length} of {waypoints.length} complete
                </CustomText>
              </View>
              <View style={styles.goalsStack}>
                {waypoints.map((waypoint) => {
                  const done = completedWaypointIds.includes(waypoint.id);
                  return (
                    <View key={waypoint.id} style={styles.goalRow}>
                      <View style={[styles.iconWrap, done && styles.iconWrapDone]}>
                        <Ionicons
                          name={done ? "checkmark" : "flag-outline"}
                          size={16}
                          color={done ? CARD : ACCENT}
                        />
                      </View>
                      <View style={styles.flex}>
                        <CustomText textStyle="body">{waypoint.title}</CustomText>
                        {waypoint.cue ? (
                          <CustomText textStyle="caption" style={styles.muted}>
                            {waypoint.cue}
                          </CustomText>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        </View>
      </BottomSheetModal>
    </PracticeSessionShell>
  );
}

function GoalsButton({
  completed,
  total,
  onPress,
}: {
  completed: number;
  total: number;
  onPress: () => void;
}) {
  const complete = total > 0 && completed === total;
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={`Open goals, ${completed} of ${total} complete`}
      haptic="selection"
      onPress={onPress}
      style={styles.goalsButton}
    >
      <Ionicons name="checkbox-outline" size={18} color={complete ? C.green : ACCENT} />
      <CustomText textStyle="micro" style={styles.goalsButtonText}>
        {completed}/{total}
      </CustomText>
    </MotionPressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BACKGROUND },
  page: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    paddingHorizontal: 16,
  },
  footerControls: {
    zIndex: 1,
    paddingTop: FOOTER_FADE,
  },
  footerControlsUnderDock: {
    marginTop: -(FOOTER_FADE - LIVE_DOCK_GAP),
  },
  callCard: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 22,
    paddingHorizontal: 18,
    borderRadius: LARGE_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  prospectName: { marginTop: 6 },
  liveTimer: { color: TEXT, fontVariant: ["tabular-nums"], marginLeft: 2 },
  callHint: { maxWidth: 280, color: C.textSec, textAlign: "center", lineHeight: 18 },
  liveDock: {
    zIndex: 2,
    minHeight: LIVE_DOCK,
    marginBottom: LIVE_DOCK_GAP,
    borderRadius: LARGE_CORNER,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  liveAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    height: 3,
    backgroundColor: ACCENT,
  },
  liveAccentQuiet: { backgroundColor: C.textMuted },
  liveDockSurface: { backgroundColor: "rgba(231,233,237,0.92)" },
  liveDockWash: { backgroundColor: "rgba(230,232,236,0.24)" },
  liveDockInner: {
    minHeight: LIVE_DOCK,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  liveMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ACCENT },
  liveDotQuiet: { backgroundColor: C.textSec },
  transcriptScroll: { flex: 1 },
  transcriptContent: { gap: 14, paddingHorizontal: 16 },
  tabWrap: { marginHorizontal: -16 },
  turnRow: { paddingVertical: 10 },
  turnMeta: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 3 },
  turnTime: { color: C.textMuted, fontVariant: ["tabular-nums"] },
  turnText: { color: C.textSec, lineHeight: 20 },
  agentMeta: { color: ACCENT },
  prospectMeta: { color: C.prospect },
  emptyIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: HINT,
  },
  error: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: C.redBg,
  },
  errorText: { flex: 1, color: C.red, lineHeight: 17 },
  report: { gap: 18, paddingTop: 4 },
  reportSection: { gap: 8 },
  reportLabel: {
    color: C.textMuted,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  reportCard: {
    gap: 14,
    padding: 16,
    borderRadius: LARGE_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  reportGoalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  summaryText: { lineHeight: 20 },
  score: { color: ACCENT },
  scoreCopy: { color: C.textSec, lineHeight: 18 },
  readyControls: { flexDirection: "row", alignItems: "center", gap: 8 },
  readyStart: { flex: 1 },
  connecting: {
    minHeight: FOOTER_CONTROLS,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  liveControlsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  control: {
    minHeight: FOOTER_CONTROLS,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  liveMuteControl: { flex: 1 },
  endControl: { backgroundColor: C.red },
  onAccent: { color: CARD },
  goalsButton: {
    width: FOOTER_CONTROLS,
    height: FOOTER_CONTROLS,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: FOOTER_CONTROLS / 2,
    backgroundColor: CARD,
  },
  goalsButtonText: { color: C.textMuted, fontVariant: ["tabular-nums"] },
  primaryBtn: {
    minHeight: 50,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 25,
    backgroundColor: ACCENT,
    boxShadow: "0 6px 14px rgba(0, 108, 229, 0.28)",
  },
  primaryBtnText: { color: CARD },
  muted: { color: C.textSec },
  flex: { flex: 1, minWidth: 0 },
  goalsSheet: {
    overflow: "hidden",
    paddingTop: 2,
    paddingHorizontal: 0,
    borderTopLeftRadius: LARGE_CORNER,
    borderTopRightRadius: LARGE_CORNER,
    borderCurve: "continuous",
    backgroundColor: BACKGROUND,
  },
  goalsSheetBody: { overflow: "visible" },
  goalsSheetInner: { flex: 1 },
  goalsHeaderWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: GOALS_HEADER_BAR + GOALS_HEADER_FADE,
    zIndex: 20,
    overflow: "visible",
    backgroundColor: "transparent",
  },
  goalsTitleRow: {
    height: GOALS_HEADER_BAR,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    overflow: "visible",
  },
  goalsList: { flex: 1 },
  goalsListContent: {
    gap: 18,
    paddingTop: GOALS_HEADER_INSET,
    paddingHorizontal: 18,
    paddingBottom: 22,
  },
  goalsSection: { gap: 8 },
  goalsSectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  goalsSectionLabel: {
    color: C.textMuted,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  goalsStack: { gap: 8 },
  goalRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: LARGE_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  iconWrap: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: HINT,
  },
  iconWrapDone: { backgroundColor: C.green },
});
