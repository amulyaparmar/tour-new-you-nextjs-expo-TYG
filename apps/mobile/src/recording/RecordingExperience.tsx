import { Ionicons } from "@expo/vector-icons";
import { setAudioModeAsync } from "expo-audio";
import * as SecureStore from "expo-secure-store";
import { useVideoPlayer, VideoView } from "expo-video";
import { WebView } from "react-native-webview";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCodeStyled from "react-native-qrcode-styled";
import {
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Reanimated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutUp,
  LinearTransition,
  SlideInRight,
  SlideOutRight,
  runOnJS,
  withSpring,
  withTiming,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import type { SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LoadingDots } from "@/components/loading-dots";
import { BottomSheetModal } from "@/components/bottom-sheet-modal";
import {
  appendDictationText,
  formatRecordingUploadTitle,
  isRecordingUploadTitle,
  type SessionAttachment,
  type SessionLead,
} from "@tour/shared";
import type { LiveSessionChatMessage, Material } from "../api";
import {
  addSessionParticipant,
  createCheckInLink,
  createSession,
  fetchLiveSessionSuggestions,
  materialUrl,
  streamLiveSessionChat,
  updateSessionNotes,
  updateSessionParticipantNotes,
} from "../api";
import { getApiBaseUrl } from "../config";
import { isOnline } from "../offline/sync-outbox";
import { aiResponseCompleteHaptic, aiResponseStartHaptic } from "../lib/haptics";
import { ChatTypingIndicator, LiveChatMarkdown } from "./LiveChatMarkdown";
import { isExpoGo, isSimulator, supportsBackgroundRecording } from "../runtime";
import { formatElapsed } from "./formatElapsed";
import { useRecording } from "./RecordingProvider";
import { ElevenLabsDictationButton } from "../components/ElevenLabsDictationButton";
import {
  useSessionParticipantRealtime,
  type SessionParticipantRealtimeStatus,
} from "../session-participants-realtime";

const C = {
  bg: "#F7F8FB",
  bgDeep: "#FFFFFF",
  panel: "#FFFFFF",
  panelSoft: "#EEF4FF",
  line: "rgba(16,24,40,0.1)",
  text: "#101828",
  textSec: "#667085",
  textMuted: "#98A2B3",
  brand: "#006CE5",
  brandSoft: "#EAF4FF",
  blue: "#48A8FF",
  red: "#D92D20",
  green: "#30D158",
} as const;

const CHECK_IN_HEAR_ABOUT_OPTIONS = ["Google", "Apartments.com", "Drive by", "Referral", "Social media", "Other"];
const CHECK_IN_REASON_OPTIONS = ["Tour", "Follow-up", "Application", "Move-in", "Resident question", "Other"];

const TABS = ["Summary", "Transcript", "AI Chat"] as const;
const DEFAULT_PROMPTS = [
  "Ask about move-in date",
  "Confirm must-haves",
  "Mention pet policy",
  "Offer floor plan options",
] as const;
const EMPTY_CHAT_PROMPTS = [
  "How can I improve?",
  "What's going well?",
  "What needs to improve?",
  "Give me 2 things to say",
] as const;
const WAVE_MIN_HEIGHT = 4;
const WAVE_MAX_HEIGHT = 28;
const LIVE_WAVE_BARS_PER_SIDE = 24;

function LiveWaveBar({ height, opacity }: { height: number; opacity: number }) {
  const animatedHeight = useSharedValue(height);

  useEffect(() => {
    animatedHeight.value = withTiming(height, { duration: 90 });
  }, [animatedHeight, height]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: animatedHeight.value,
  }));

  return <Reanimated.View style={[s.waveBar, { opacity }, animatedStyle]} />;
}
const PERMISSION_TIP_KEY = "tour.recording.permissionTip.dismissed";
const SUGGESTION_REFRESH_MS = 18_000;

const IS_SIMULATOR = isSimulator();

type SpeechTranscriberModule = {
  requestPermissions: () => Promise<"authorized" | "denied" | "restricted" | "notDetermined">;
  requestMicrophonePermissions: () => Promise<"granted" | "denied">;
  recordRealTimeAndTranscribe: () => Promise<void>;
  stopListening: () => void;
  isRecording: () => boolean;
  ExpoSpeechTranscriberModule?: {
    addListener: (
      event: "onTranscriptionProgress" | "onTranscriptionError",
      listener: (payload: Record<string, unknown>) => void
    ) => { remove: () => void };
    isRecording: () => boolean;
  };
};
type NoteAccessory = "ai" | "reminders" | "assets" | null;

function loadSpeechTranscriber(): SpeechTranscriberModule | null {
  if (isExpoGo()) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("expo-speech-transcriber") as SpeechTranscriberModule & {
      default?: SpeechTranscriberModule["ExpoSpeechTranscriberModule"];
    };
    // Prefer named native module export; fall back to requireNativeModule.
    if (!mod.ExpoSpeechTranscriberModule) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { requireNativeModule } = require("expo-modules-core");
        mod.ExpoSpeechTranscriberModule = requireNativeModule("ExpoSpeechTranscriber");
      } catch {
        // Expo Go / missing native binary
      }
    }
    return mod;
  } catch {
    return null;
  }
}

const SpeechTranscriber = loadSpeechTranscriber();
let speechStartInFlight: Promise<string | null> | null = null;

function speechErrorMessage(payload: unknown): string | null {
  if (!payload) return null;
  if (typeof payload === "string") return humanizeSpeechError(payload);
  if (typeof payload === "object") {
    const record = payload as { error?: unknown; message?: unknown };
    if (typeof record.error === "string" && record.error.trim()) return humanizeSpeechError(record.error);
    if (typeof record.message === "string" && record.message.trim()) return humanizeSpeechError(record.message);
  }
  return null;
}

/** Apple's "Failed to initialize recognizer" is opaque — map it to something actionable. */
function humanizeSpeechError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("failed to initialize recognizer") || lower.includes("recognizer is unavailable")) {
    if (IS_SIMULATOR) {
      return (
        "Simulator speech isn’t ready. In Simulator: Settings → Accessibility → Spoken Content → Voices → download English. " +
        "Or try on a physical iPhone."
      );
    }
    return "Speech recognition failed to start. Check Speech Recognition is allowed for Tour in Settings, then try again.";
  }
  return raw;
}

function isFatalSpeechInitError(message: string | null | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("failed to initialize recognizer") ||
    lower.includes("recognizer is unavailable") ||
    lower.includes("spoken content") ||
    lower.includes("microphone format not ready")
  );
}

function isRecoverableSpeechSilence(message: string | null | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return lower.includes("no speech detected") || lower.includes("no speech was detected");
}

type Tab = (typeof TABS)[number];

type LiveTranscriptLine = {
  id: string;
  speaker: "Agent" | "Prospect" | "Live";
  text: string;
  time: number;
  isInterim?: boolean;
};

type RecordingAssetPreview = {
  id: string;
  name: string;
  description: string | null;
  url: string | null;
  previewUrl: string | null;
  kind: SessionAttachment["type"];
};

type RecordingExperienceProps = {
  title?: string;
  notes: string;
  onNotesChange: (notes: string) => void;
  uploaderIsAgent?: boolean;
  onUploaderIsAgentChange?: (selected: boolean) => void;
  assets: Material[];
  selectedAssetIds: string[];
  attachments: SessionAttachment[];
  participants: SessionLead[];
  onAddAsset: (asset: Material, attachment?: SessionAttachment) => void;
  onAddParticipant: (lead: SessionLead) => void;
  onUpdateParticipantNotes: (createdAt: string, notes: string | null) => void;
  onCancel: () => void | Promise<void>;
  onFinish: () => void | Promise<void>;
  /** Session-detail close minimizes before recording starts; explicit cancellation remains separate. */
  minimizeOnClose?: boolean;
  cancelIcon?: "chevron-down" | "close";
  cancelDisabled?: boolean;
  caption?: string;
  sessionId?: string | null;
  agentName?: string | null;
  prospectName?: string | null;
  propertyName?: string | null;
  onBeforeRecordingStart?: () => void | Promise<void>;
  onUploadFile?: () => void | Promise<void>;
  onSessionCreated?: (sessionId: string) => void;
  /** Shared presentation progress used by the navigation-style pull-down surface. */
  presentation?: SharedValue<number>;
  onSwipeDown?: () => void;
  /** Begin recording as soon as the experience opens. */
  autoStart?: boolean;
};

function speakerInitial(speaker: LiveTranscriptLine["speaker"]) {
  return speaker === "Prospect" ? "P" : speaker === "Agent" ? "A" : "•";
}

function transcriptText(lines: LiveTranscriptLine[]) {
  return lines.map((line) => `[${formatElapsed(line.time)}] ${line.speaker}: ${line.text}`).join("\n");
}

function personInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

function sessionLeadKey(lead: SessionLead) {
  return lead.createdAt || `${lead.email ?? ""}:${lead.phone ?? ""}:${lead.name}`;
}

function attachmentTypeForMaterial(material: Material): SessionAttachment["type"] {
  const url = materialUrl(material)?.toLowerCase() ?? "";
  if (material.media?.videoUrl || /\.(mp4|mov|m4v|webm)(\?|$)/.test(url)) return "video";
  if (material.media?.iframeUrl) return "link";
  if (material.media?.imageUrl || /\.(png|jpe?g|gif|webp)(\?|$)/.test(url)) return "image";
  if (/^https?:/.test(url)) return material.fileUrl ? "document" : "link";
  return "other";
}

function previewUrlForMaterial(material: Material) {
  const candidate = material.media?.imageUrl
    ?? material.media?.gifUrl
    ?? (material.fileUrl && /\.(?:jpe?g|png|gif|webp)(?:[?#].*)?$/i.test(material.fileUrl) ? material.fileUrl : null);
  if (!candidate) return null;
  return candidate.startsWith("/") ? `${getApiBaseUrl()}${candidate}` : candidate;
}

function previewForMaterial(material: Material): RecordingAssetPreview {
  return {
    id: material.id,
    name: material.name,
    description: material.description || null,
    url: materialUrl(material),
    previewUrl: previewUrlForMaterial(material),
    kind: attachmentTypeForMaterial(material),
  };
}

function previewForAttachment(attachment: SessionAttachment): RecordingAssetPreview {
  return {
    id: attachment.id,
    name: attachment.name,
    description: attachment.description || null,
    url: attachment.url || null,
    previewUrl: attachment.type === "image" ? attachment.url || null : null,
    kind: attachment.type,
  };
}

function RecordingAssetVideoPreview({ source }: { source: string }) {
  const player = useVideoPlayer(source, (videoPlayer) => {
    videoPlayer.loop = false;
  });
  return <VideoView player={player} style={s.assetPreviewMedia} contentFit="contain" nativeControls />;
}

function RecordingAssetWebPreview({ source }: { source: string }) {
  return (
    <WebView
      source={{ uri: source }}
      style={s.assetPreviewMedia}
      originWhitelist={["*"]}
      javaScriptEnabled
      domStorageEnabled
      startInLoadingState
    />
  );
}

/** Own listeners — package hook drops native `{ message }` errors. */
function useLiveSpeechTranscription() {
  const [text, setText] = useState("");
  const [isFinal, setIsFinal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    if (!SpeechTranscriber) return;

    const native = SpeechTranscriber.ExpoSpeechTranscriberModule;
    if (!native?.addListener) {
      // Fall back to package hook if native export isn't available.
      return;
    }

    const progress = native.addListener("onTranscriptionProgress", (payload) => {
      const next = typeof payload.text === "string" ? payload.text : "";
      setText(next);
      setIsFinal(Boolean(payload.isFinal));
      if (next) setError(null);
    });

    const failures = native.addListener("onTranscriptionError", (payload) => {
      const message = speechErrorMessage(payload) || "Live transcription failed.";
      if (isRecoverableSpeechSilence(message)) {
        // Apple reports ordinary silence (including an intentional pause/stop)
        // through its error channel. Treat it as an ended utterance so the
        // restart lifecycle can recover without alarming the user.
        setError(null);
        setIsFinal(true);
        setIsRecording(false);
        return;
      }
      setError(message);
      setIsRecording(false);
    });

    const interval = setInterval(() => {
      try {
        const active = Boolean(native.isRecording?.() ?? SpeechTranscriber.isRecording?.());
        setIsRecording((prev) => (prev !== active ? active : prev));
      } catch {
        // ignore
      }
    }, 400);

    return () => {
      clearInterval(interval);
      progress.remove();
      failures.remove();
    };
  }, []);

  return { text, isFinal, error, isRecording };
}

async function ensureSpeechPermissions(): Promise<string | null> {
  if (!SpeechTranscriber) {
    return "Live transcription requires a development build with expo-speech-transcriber.";
  }

  if (Platform.OS === "ios") {
    const speechPermission = await SpeechTranscriber.requestPermissions();
    if (speechPermission !== "authorized") {
      return "Speech recognition permission was not granted.";
    }
  }

  const micPermission = await SpeechTranscriber.requestMicrophonePermissions();
  if (micPermission !== "granted") {
    return "Microphone permission was not granted for live transcription.";
  }

  return null;
}

async function prepareSpeechAudioSession(): Promise<string | null> {
  try {
    // Keep mixWithOthers so SFSpeechRecognizer can share the mic with expo-audio.
    // Preserve background recording when the file recorder already owns the session.
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
      shouldPlayInBackground: supportsBackgroundRecording(),
      interruptionMode: "mixWithOthers",
    });
    await new Promise((resolve) => setTimeout(resolve, 150));
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Could not configure audio session for speech.";
  }
}

function stopSpeechEngineSafely() {
  try {
    SpeechTranscriber?.stopListening();
  } catch {
    // Native stop can throw if the engine never started.
  }
}

/** Single-flight start — never overlap AVAudioEngine starts (native crash). */
async function startSpeechEngine(): Promise<string | null> {
  if (!SpeechTranscriber) {
    return "Live transcription requires a development build with expo-speech-transcriber.";
  }
  if (speechStartInFlight) return speechStartInFlight;

  speechStartInFlight = (async () => {
    const permissionError = await ensureSpeechPermissions();
    if (permissionError) return permissionError;

    const sessionError = await prepareSpeechAudioSession();
    if (sessionError) return sessionError;

    try {
      // Tear down any previous engine before installing a new tap.
      stopSpeechEngineSafely();
      await new Promise((resolve) => setTimeout(resolve, 350));
      await SpeechTranscriber.recordRealTimeAndTranscribe();
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Live transcription could not start.";
    } finally {
      speechStartInFlight = null;
    }
  })();

  return speechStartInFlight;
}

export function RecordingExperience({
  title,
  notes,
  onNotesChange,
  uploaderIsAgent = false,
  onUploaderIsAgentChange,
  assets,
  attachments,
  participants,
  onAddParticipant,
  onUpdateParticipantNotes,
  onCancel,
  onFinish,
  minimizeOnClose = false,
  cancelIcon = "chevron-down",
  cancelDisabled = false,
  caption,
  sessionId,
  agentName,
  prospectName,
  propertyName,
  onBeforeRecordingStart,
  onUploadFile,
  onSessionCreated,
  presentation,
  onSwipeDown,
  autoStart = false,
}: RecordingExperienceProps) {
  const rec = useRecording();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>("Summary");
  const [hasStarted, setHasStarted] = useState(rec.isRecording);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [selectedAssetPreview, setSelectedAssetPreview] = useState<RecordingAssetPreview | null>(null);
  const [uploadSheetOpen, setUploadSheetOpen] = useState(false);
  const [personSheetOpen, setPersonSheetOpen] = useState(false);
  const [personEntryMode, setPersonEntryMode] = useState<"qr" | "manual">("qr");
  const [checkInBinding, setCheckInBinding] = useState<{ sessionId: string; url: string } | null>(null);
  const [checkInLinkLoading, setCheckInLinkLoading] = useState(false);
  const [checkInLinkError, setCheckInLinkError] = useState<string | null>(null);
  const [participantRealtimeStatus, setParticipantRealtimeStatus] = useState<SessionParticipantRealtimeStatus>("idle");
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const [finishCountdown, setFinishCountdown] = useState(5);
  const [selectedPerson, setSelectedPerson] = useState<SessionLead | null>(null);
  const [personFirstName, setPersonFirstName] = useState("");
  const [personLastName, setPersonLastName] = useState("");
  const [personEmail, setPersonEmail] = useState("");
  const [personPhone, setPersonPhone] = useState("");
  const [personHowHeard, setPersonHowHeard] = useState("");
  const [personReason, setPersonReason] = useState("");
  const [personNotes, setPersonNotes] = useState("");
  const [summarySaving, setSummarySaving] = useState(false);
  const [personSaving, setPersonSaving] = useState(false);
  const [summaryMessage, setSummaryMessage] = useState<string | null>(null);
  const [noteAccessory, setNoteAccessory] = useState<NoteAccessory>(null);
  const [assetSearch, setAssetSearch] = useState("");
  const [assetSheetOpen, setAssetSheetOpen] = useState(false);
  const [reminderDraft, setReminderDraft] = useState("");
  const [reminders, setReminders] = useState<string[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<LiveSessionChatMessage[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatStreaming, setChatStreaming] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [waveformHistory, setWaveformHistory] = useState<number[]>(() => Array.from({ length: LIVE_WAVE_BARS_PER_SIDE }, () => 0.08));
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([...DEFAULT_PROMPTS]);
  const [transcriptionStatus, setTranscriptionStatus] = useState<string | null>(null);
  const [transcriptionRequested, setTranscriptionRequested] = useState(false);
  const [finalTranscriptLines, setFinalTranscriptLines] = useState<LiveTranscriptLine[]>([]);
  const [permissionTipVisible, setPermissionTipVisible] = useState(false);
  const [resolvedSessionId, setResolvedSessionId] = useState<string | null>(sessionId ?? null);
  const listRef = useRef<FlatList<LiveTranscriptLine>>(null);
  const chatListRef = useRef<ScrollView>(null);
  const lastFinalTextRef = useRef("");
  const cancelledRef = useRef(false);
  const autoStartAttemptedRef = useRef(false);
  const speechStartedRef = useRef(false);
  const ensuringSessionRef = useRef<Promise<string | null> | null>(null);
  const dictationPausedSessionRef = useRef(false);
  const liveSpeech = useLiveSpeechTranscription();
  const sessionPaused = rec.isPaused;
  const wasSessionPausedRef = useRef(sessionPaused);
  const sessionElapsed = rec.elapsed;
  const chatFocused = activeTab === "AI Chat";
  const chatComposerMode = chatFocused && hasStarted;
  const keyboardOpen = keyboardHeight > 0;
  const showBottomDock = !chatComposerMode && !keyboardOpen;
  const canSendChat = Boolean(chatInput.trim()) && !chatBusy;
  const meteringRef = useRef(rec.metering);
  const participantKeysRef = useRef(new Set(participants.map(sessionLeadKey)));
  meteringRef.current = rec.metering;

  useEffect(() => {
    for (const participant of participants) {
      participantKeysRef.current.add(sessionLeadKey(participant));
    }
  }, [participants]);

  const reconcileSessionParticipants = useCallback((nextParticipants: SessionLead[]) => {
    const joinedNames: string[] = [];
    for (const participant of nextParticipants) {
      const key = sessionLeadKey(participant);
      if (participantKeysRef.current.has(key)) continue;
      participantKeysRef.current.add(key);
      joinedNames.push(participant.firstName || participant.name.split(" ")[0] || participant.name);
      onAddParticipant(participant);
    }
    if (joinedNames.length === 1) {
      setSummaryMessage(`${joinedNames[0]} joined this session`);
    } else if (joinedNames.length > 1) {
      setSummaryMessage(`${joinedNames.length} people joined this session`);
    }
  }, [onAddParticipant]);

  useSessionParticipantRealtime({
    sessionId: resolvedSessionId,
    onParticipants: reconcileSessionParticipants,
    onStatusChange: setParticipantRealtimeStatus,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const nextLevel = hasStarted && !sessionPaused ? Math.max(0.08, Math.min(1, meteringRef.current)) : 0.08;
      setWaveformHistory((current) => [...current.slice(-(LIVE_WAVE_BARS_PER_SIDE - 1)), nextLevel]);
    }, 90);
    return () => clearInterval(timer);
  }, [hasStarted, sessionPaused]);
  const localPresentation = useSharedValue(1);
  const dragPresentation = presentation ?? localPresentation;
  const dismissGesture = useMemo(() => {
    return Gesture.Pan()
      .activeOffsetY(6)
      .failOffsetX([-32, 32])
      .onUpdate((event) => {
        if (event.translationY > 0) {
          dragPresentation.value = Math.max(0, 1 - event.translationY / 500);
        }
      })
      .onEnd((event) => {
        const shouldMinimize = Boolean(onSwipeDown) && (event.translationY > 92 || event.velocityY > 700);
        if (shouldMinimize) {
          dragPresentation.value = withTiming(0, { duration: 180 }, (finished) => {
            if (finished && onSwipeDown) runOnJS(onSwipeDown)();
          });
        } else {
          dragPresentation.value = withSpring(1, { damping: 19, stiffness: 220, mass: 0.68 });
        }
      });
  }, [dragPresentation, onSwipeDown]);

  const pauseTourForDictation = useCallback(async () => {
    if (!rec.isRecording || rec.isPaused) return;
    stopSpeechEngineSafely();
    await rec.togglePause();
    dictationPausedSessionRef.current = true;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }, [rec]);

  const resumeTourAfterDictation = useCallback(async () => {
    if (!dictationPausedSessionRef.current) return;
    dictationPausedSessionRef.current = false;
    if (rec.isRecording && rec.isPaused) {
      await rec.togglePause();
    }
  }, [rec]);

  useEffect(() => {
    setResolvedSessionId(sessionId ?? null);
  }, [sessionId]);

  useEffect(() => {
    let cancelled = false;
    void SecureStore.getItemAsync(PERMISSION_TIP_KEY).then((value) => {
      if (!cancelled) setPermissionTipVisible(value !== "1");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (event) => setKeyboardHeight(event.endCoordinates.height),
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardHeight(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (!transcriptionRequested) return;

    if (sessionPaused) {
      stopSpeechEngineSafely();
      speechStartedRef.current = false;
      setTranscriptionStatus("Transcription paused. Resume to continue.");
      return;
    }

    let cancelled = false;

    async function startNativeTranscription() {
      if (speechStartedRef.current || liveSpeech.isRecording) return;
      setTranscriptionStatus("Connecting speech recognition…");
      const engineError = await startSpeechEngine();
      if (cancelled) return;
      if (engineError) {
        speechStartedRef.current = false;
        setTranscriptionStatus(engineError);
        return;
      }
      speechStartedRef.current = true;
      setTranscriptionStatus(null);
    }

    void startNativeTranscription();

    return () => {
      cancelled = true;
    };
  }, [transcriptionRequested, sessionPaused, liveSpeech.isRecording]);

  // Apple may not emit a final utterance before its engine is stopped. Promote
  // the visible interim text to durable history exactly once when pausing.
  useEffect(() => {
    const justPaused = sessionPaused && !wasSessionPausedRef.current;
    wasSessionPausedRef.current = sessionPaused;
    if (!justPaused) return;

    const text = liveSpeech.text.trim();
    if (!text || text === lastFinalTextRef.current) return;
    lastFinalTextRef.current = text;
    setFinalTranscriptLines((current) => [
      ...current,
      {
        id: `pause-final-${Date.now()}-${current.length}`,
        speaker: "Live",
        time: sessionElapsed,
        text,
      },
    ]);
  }, [liveSpeech.text, sessionElapsed, sessionPaused]);

  // Native module stops after each final utterance. Restart only after the engine
  // reports stopped — never while isRecording (overlapping installTap = SIGABRT).
  useEffect(() => {
    if (!transcriptionRequested || !SpeechTranscriber || sessionPaused) return;
    if (!liveSpeech.isFinal) return;
    if (liveSpeech.isRecording) return;
    if (isFatalSpeechInitError(liveSpeech.error) || isFatalSpeechInitError(transcriptionStatus)) return;

    speechStartedRef.current = false;
    setTranscriptionStatus("Restarting speech recognition…");

    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled || sessionPaused || !transcriptionRequested) return;
      if (SpeechTranscriber.isRecording()) return;
      void startSpeechEngine().then((engineError) => {
        if (cancelled) return;
        if (engineError) {
          speechStartedRef.current = false;
          setTranscriptionStatus(engineError);
          return;
        }
        speechStartedRef.current = true;
        setTranscriptionStatus(null);
      });
    }, 1200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    transcriptionRequested,
    liveSpeech.isFinal,
    liveSpeech.isRecording,
    liveSpeech.error,
    sessionPaused,
    transcriptionStatus,
  ]);

  useEffect(() => {
    if (!liveSpeech.error) return;
    if (isRecoverableSpeechSilence(liveSpeech.error)) return;
    setTranscriptionStatus(liveSpeech.error);
    if (isFatalSpeechInitError(liveSpeech.error)) {
      // Don't keep hammering Apple's recognizer — it won't recover without device setup.
      speechStartedRef.current = false;
      setTranscriptionRequested(false);
    }
  }, [liveSpeech.error]);

  useEffect(() => {
    if (!transcriptionRequested) return;
    if (liveSpeech.isRecording) {
      speechStartedRef.current = true;
      setTranscriptionStatus(null);
    }
  }, [transcriptionRequested, liveSpeech.isRecording]);

  useEffect(() => {
    const text = liveSpeech.text.trim();
    if (!text || !liveSpeech.isFinal || text === lastFinalTextRef.current) return;

    lastFinalTextRef.current = text;
    setFinalTranscriptLines((current) => [
      ...current,
      {
        id: `final-${Date.now()}-${current.length}`,
        speaker: "Live",
        time: sessionElapsed,
        text,
      },
    ]);
  }, [liveSpeech.isFinal, liveSpeech.text, sessionElapsed]);

  const liveTranscript = useMemo<LiveTranscriptLine[]>(() => {
    const currentText = liveSpeech.text.trim();
    const shouldShowInterim = currentText && (!liveSpeech.isFinal || currentText !== lastFinalTextRef.current);
    if (shouldShowInterim) {
      return [
        ...finalTranscriptLines,
        {
          id: "live-interim",
          speaker: "Live",
          time: sessionElapsed,
          text: currentText,
          isInterim: true,
        },
      ];
    }
    if (finalTranscriptLines.length > 0) return finalTranscriptLines;
    return [
      {
        id: "live-ready",
        speaker: "Live",
        time: Math.max(0, sessionElapsed - 1),
        text:
          transcriptionStatus ||
          (sessionPaused
            ? "Transcription paused. Resume to keep capturing speech."
            : liveSpeech.isRecording
              ? "Listening for the tour. Speech will appear here as it is recognized."
              : "Waiting for speech recognition…"),
        isInterim: true,
      },
    ];
  }, [
    finalTranscriptLines,
    liveSpeech.isFinal,
    liveSpeech.isRecording,
    liveSpeech.text,
    sessionElapsed,
    sessionPaused,
    transcriptionStatus,
  ]);

  useEffect(() => {
    if (liveTranscript.length === 0) return;
    listRef.current?.scrollToEnd({ animated: true });
  }, [liveTranscript.length, liveSpeech.text]);

  useEffect(() => {
    const latest = [...liveTranscript].reverse().find((line) => line.text.trim() && !line.id.startsWith("live-ready"));
    if (!latest) {
      rec.setTranscriptPreview("");
      return;
    }
    rec.setTranscriptPreview(latest.text);
    // Intentionally only when transcript content changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveTranscript]);

  useEffect(() => {
    if (!chatFocused || chatMessages.length === 0) return;
    const timer = setTimeout(() => chatListRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(timer);
  }, [chatFocused, chatMessages, chatBusy, chatStreaming]);

  const visibleAttachments = attachments;
  const filteredAssets = useMemo(() => {
    const query = assetSearch.trim().toLowerCase();
    if (!query) return assets;
    return assets.filter((asset) => `${asset.name} ${asset.description ?? ""} ${asset.type}`.toLowerCase().includes(query));
  }, [assetSearch, assets]);
  const filteredAttachments = useMemo(() => {
    const query = assetSearch.trim().toLowerCase();
    if (!query) return visibleAttachments;
    return visibleAttachments.filter((attachment) =>
      `${attachment.name} ${attachment.description ?? ""} ${attachment.type}`.toLowerCase().includes(query),
    );
  }, [assetSearch, visibleAttachments]);
  const hasAssets = visibleAttachments.length > 0 || assets.length > 0;
  const latestAiNote = useMemo(
    () => [...chatMessages].reverse().find((message) => message.role === "assistant")?.content ?? "",
    [chatMessages],
  );

  const propertyContext = useMemo(() => {
    return [
      propertyName ? `Property/community: ${propertyName}` : null,
      prospectName ? `Prospect: ${prospectName}` : null,
      agentName ? `Agent: ${agentName}` : null,
      notes.trim() ? `Live notes:\n${notes.trim()}` : null,
    ]
      .filter(Boolean)
      .join("\n\n");
  }, [agentName, notes, propertyName, prospectName]);

  const transcriptSnapshot = useMemo(() => transcriptText(liveTranscript), [liveTranscript]);

  useEffect(() => {
    if (!chatFocused || !resolvedSessionId) return;

    let cancelled = false;

    async function refreshSuggestions() {
      try {
        const { suggestions } = await fetchLiveSessionSuggestions(resolvedSessionId!, {
          liveTranscript: transcriptSnapshot,
          propertyContext,
        });
        if (!cancelled && suggestions.length) {
          setSuggestedPrompts(suggestions.slice(0, 4));
        }
      } catch {
        // Keep the last good suggestions if refresh fails.
      }
    }

    void refreshSuggestions();
    const timer = setInterval(() => void refreshSuggestions(), SUGGESTION_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [chatFocused, propertyContext, resolvedSessionId, transcriptSnapshot]);

  const waveformBars = useMemo(() => {
    // Use the recorder's rolling metering history rather than a fixed shape.
    // This lets the waveform taper naturally when the conversation goes quiet.
    const paddedHistory = Array.from({ length: LIVE_WAVE_BARS_PER_SIDE }, (_, index) => waveformHistory[index] ?? 0.08);
    const liveLevels = paddedHistory.map((level, index) => {
      const activity = hasStarted && !sessionPaused
        ? Math.max(0, Math.min(1, (level - 0.08) / 0.92))
        : 0;
      // Keep a restrained resting silhouette so quiet speech does not make the
      // waveform disappear completely, while real metering still drives peaks.
      const quietShape = 0.12 + Math.sin((index / (LIVE_WAVE_BARS_PER_SIDE - 1)) * Math.PI) * 0.1;
      const visibleActivity = Math.max(activity, quietShape);
      return Math.max(WAVE_MIN_HEIGHT, Math.round(WAVE_MIN_HEIGHT + (WAVE_MAX_HEIGHT - WAVE_MIN_HEIGHT) * visibleActivity));
    });

    // Keep the live envelope duplicated on both sides of the timer so the
    // recorder has the balanced waveform treatment used in the reference UI.
    return {
      left: liveLevels,
      right: [...liveLevels].reverse(),
    };
  }, [hasStarted, sessionPaused, waveformHistory]);

  const statusCaption =
    caption ??
    (!hasStarted
      ? "Ready when you are"
      : sessionPaused
        ? "Recording paused"
        : supportsBackgroundRecording()
          ? "Recording securely in the background"
          : "Recording in Expo preview");

  async function ensureLiveSessionId(): Promise<string | null> {
    if (resolvedSessionId) return resolvedSessionId;
    if (ensuringSessionRef.current) return ensuringSessionRef.current;

    ensuringSessionRef.current = (async () => {
      try {
        if (!(await isOnline())) return null;
        const automaticTitle = formatRecordingUploadTitle(new Date());
        const resolvedTitle = title?.trim() || automaticTitle;
        const created = await createSession({
          title: resolvedTitle,
          titleIsAuto: isRecordingUploadTitle(resolvedTitle),
          scheduledAt: new Date().toISOString(),
          prospectName: prospectName ?? null,
          agentName: agentName ?? null,
          location: propertyName ?? null,
          notes: notes.trim() || null,
        });
        const nextId = created.session.id;
        setResolvedSessionId(nextId);
        rec.setLiveSessionId(nextId);
        onSessionCreated?.(nextId);
        return nextId;
      } catch {
        return null;
      } finally {
        ensuringSessionRef.current = null;
      }
    })();

    return ensuringSessionRef.current;
  }

  function openAddPerson() {
    const first = participants[0];
    setPersonFirstName("");
    setPersonLastName("");
    setPersonEmail("");
    setPersonPhone("");
    setPersonHowHeard(first?.questionAnswers?.hear_about ?? "");
    setPersonReason(first?.reason ?? "");
    setSummaryMessage(null);
    setPersonEntryMode("qr");
    setPersonSheetOpen(true);
    void prepareRemoteCheckIn();
  }

  async function prepareRemoteCheckIn() {
    setCheckInLinkError(null);
    setCheckInLinkLoading(true);
    try {
      const liveSessionId = await ensureLiveSessionId();
      if (!liveSessionId) {
        throw new Error("Connect to the internet to create this live check-in QR.");
      }
      if (checkInBinding?.sessionId === liveSessionId) return;

      const binding = await createCheckInLink({ sessionId: liveSessionId });
      setCheckInBinding(binding);
    } catch (caught) {
      setCheckInLinkError(caught instanceof Error ? caught.message : "Could not create the live check-in QR.");
    } finally {
      setCheckInLinkLoading(false);
    }
  }

  async function shareRemoteCheckIn() {
    if (!checkInBinding?.url) return;
    await Share.share({
      title: "Tour check-in",
      message: checkInBinding.url,
      url: checkInBinding.url,
    });
  }

  async function saveSessionNotes() {
    setSummarySaving(true);
    setSummaryMessage(null);
    try {
      const liveSessionId = await ensureLiveSessionId();
      if (!liveSessionId) throw new Error("Could not create this session yet.");
      await updateSessionNotes(liveSessionId, notes);
      setSummaryMessage("Notes saved");
    } catch (caught) {
      setSummaryMessage(caught instanceof Error ? caught.message : "Could not save notes.");
    } finally {
      setSummarySaving(false);
    }
  }

  async function saveNewPerson() {
    if (!personFirstName.trim()) {
      setSummaryMessage("First name is required.");
      return;
    }
    setPersonSaving(true);
    setSummaryMessage(null);
    try {
      const liveSessionId = await ensureLiveSessionId();
      if (!liveSessionId) throw new Error("Could not create this session yet.");
      const lead = await addSessionParticipant(liveSessionId, {
        firstName: personFirstName.trim(),
        lastName: personLastName.trim() || null,
        email: personEmail.trim() || "",
        phone: personPhone.trim() || null,
        wantsSummary: false,
        reason: personReason.trim() || null,
        questionAnswers: personHowHeard.trim() ? { hear_about: personHowHeard.trim() } : undefined,
      });
      participantKeysRef.current.add(sessionLeadKey(lead));
      onAddParticipant(lead);
      setPersonSheetOpen(false);
      setSummaryMessage(`${lead.name} joined this session`);
    } catch (caught) {
      setSummaryMessage(caught instanceof Error ? caught.message : "Could not add this person.");
    } finally {
      setPersonSaving(false);
    }
  }

  function openPerson(person: SessionLead) {
    setSelectedPerson(person);
    setPersonNotes(person.notes ?? "");
    setSummaryMessage(null);
  }

  async function savePersonNotes() {
    if (!selectedPerson) return;
    setPersonSaving(true);
    setSummaryMessage(null);
    try {
      const liveSessionId = await ensureLiveSessionId();
      if (!liveSessionId) throw new Error("Could not create this session yet.");
      await updateSessionParticipantNotes(liveSessionId, selectedPerson.createdAt, personNotes);
      onUpdateParticipantNotes(selectedPerson.createdAt, personNotes.trim() || null);
      setSelectedPerson((current) => current ? { ...current, notes: personNotes.trim() || null } : current);
      setSummaryMessage("Person notes saved");
    } catch (caught) {
      setSummaryMessage(caught instanceof Error ? caught.message : "Could not save person notes.");
    } finally {
      setPersonSaving(false);
    }
  }

  async function submitChat(text: string) {
    const trimmed = text.trim();
    if (!trimmed || chatBusy) return;

    const nextMessages: LiveSessionChatMessage[] = [...chatMessages, { role: "user", content: trimmed }];
    // Paint typing state immediately before any awaits.
    setChatBusy(true);
    setChatStreaming(true);
    setChatError(null);
    setChatInput("");
    setChatMessages([...nextMessages, { role: "assistant", content: "" }]);
    let responseStarted = false;

    try {
      const liveSessionId = await ensureLiveSessionId();
      if (!liveSessionId) {
        throw new Error("Could not attach this chat to a session yet. Try again in a moment.");
      }
      const reply = await streamLiveSessionChat(
        liveSessionId,
        {
          messages: nextMessages,
          liveTranscript: transcriptSnapshot,
          propertyContext,
        },
        (partial) => {
          if (!responseStarted) {
            responseStarted = true;
            aiResponseStartHaptic();
          }
          setChatMessages((current) => {
            const copy = current.slice();
            const last = copy[copy.length - 1];
            if (last?.role === "assistant") {
              copy[copy.length - 1] = { role: "assistant", content: partial };
              return copy;
            }
            return [...nextMessages, { role: "assistant", content: partial }];
          });
        },
      );
      setChatMessages([
        ...nextMessages,
        { role: "assistant", content: reply || "I do not have enough context yet." },
      ]);
      if (responseStarted) aiResponseCompleteHaptic();
    } catch (error) {
      setChatMessages(nextMessages);
      setChatError(error instanceof Error ? error.message : "Tour AI could not answer right now.");
    } finally {
      setChatStreaming(false);
      setChatBusy(false);
    }
  }

  function stopNativeTranscription() {
    stopSpeechEngineSafely();
    speechStartedRef.current = false;
    setTranscriptionRequested(false);
  }

  async function startSessionRecording() {
    if (hasStarted || starting) return;

    cancelledRef.current = false;
    setStarting(true);
    setStartError(null);
    setTranscriptionStatus(null);
    try {
      const activationPromise = Promise.resolve()
        .then(() => onBeforeRecordingStart?.())
        .catch((error) => {
          setStartError(error instanceof Error ? error.message : "Recording started, but the session could not be updated.");
        });

      // Start file recording first. Speech starts afterward via effect (single-flight).
      // Starting both AVAudioEngine + AVAudioRecorder at once can native-crash.
      const started = await rec.start();
      if (!started) {
        setStartError("Could not start recording.");
        return;
      }

      setHasStarted(true);
      void activationPromise;
      void ensureLiveSessionId();
      // Let the recorder settle before sharing the mic with SFSpeechRecognizer.
      await new Promise((resolve) => setTimeout(resolve, 400));
      if (cancelledRef.current) return;
      setTranscriptionRequested(true);
    } catch (error) {
      setStartError(error instanceof Error ? error.message : "Could not start recording.");
    } finally {
      setStarting(false);
    }
  }

  useEffect(() => {
    if (!autoStart || autoStartAttemptedRef.current || hasStarted || starting) return;
    autoStartAttemptedRef.current = true;
    void startSessionRecording();
  }, [autoStart, hasStarted, starting]);

  function selectTab(tab: Tab) {
    setActiveTab(tab);
  }

  const liveStatusLabel = !hasStarted
    ? "Ready to record"
    : sessionPaused
      ? "Paused"
      : "Live recording";

  const finishRequestedRef = useRef(false);

  function completeSessionRecording() {
    if (finishRequestedRef.current) return;
    finishRequestedRef.current = true;
    setFinishConfirmOpen(false);
    stopNativeTranscription();
    void onFinish();
  }

  function finishRecording() {
    finishRequestedRef.current = false;
    setFinishCountdown(5);
    setFinishConfirmOpen(true);
  }

  function continueRecordingFromFinish() {
    setFinishConfirmOpen(false);
    setFinishCountdown(5);
  }

  useEffect(() => {
    if (!finishConfirmOpen) return;
    if (finishCountdown <= 0) {
      completeSessionRecording();
      return;
    }
    const timeout = setTimeout(() => setFinishCountdown((current) => current - 1), 1000);
    return () => clearTimeout(timeout);
  }, [finishConfirmOpen, finishCountdown]);

  function confirmCancelSession() {
    setCancelConfirmOpen(true);
  }

  function dismissPermissionTip() {
    setPermissionTipVisible(false);
    void SecureStore.setItemAsync(PERMISSION_TIP_KEY, "1");
  }

  const renderTranscript = ({ item }: { item: LiveTranscriptLine }) => (
    <View style={[s.transcriptRow, item.isInterim && s.transcriptRowInterim]}>
      <View style={[s.speakerDot, item.speaker === "Prospect" && s.speakerDotProspect]}>
        <Text style={s.speakerInitial}>{speakerInitial(item.speaker)}</Text>
      </View>
      <View style={s.transcriptBody}>
        <View style={s.transcriptMeta}>
          <Text style={s.transcriptSpeaker}>{item.speaker}</Text>
          <Text style={s.transcriptTime}>{formatElapsed(item.time)}</Text>
        </View>
        <Text style={[s.transcriptCopy, item.isInterim && s.interimCopy]}>{item.text}</Text>
      </View>
    </View>
  );

  async function shareSelectedAsset() {
    if (!selectedAssetPreview) return;
    try {
      await Share.share({
        title: selectedAssetPreview.name,
        message: selectedAssetPreview.url
          ? `${selectedAssetPreview.name}\n${selectedAssetPreview.url}`
          : selectedAssetPreview.name,
        url: selectedAssetPreview.url ?? undefined,
      });
    } catch {
      // The native share sheet can be dismissed without an action.
    }
  }

  async function downloadSelectedAsset() {
    if (!selectedAssetPreview?.url) return;
    try {
      await Linking.openURL(selectedAssetPreview.url);
    } catch {
      // Keep the preview open if the device cannot open the asset URL.
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === "ios" ? "height" : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={s.stackShadow} />

      <View style={[s.sheet, showBottomDock && s.sheetWithDock]}>
        <GestureDetector gesture={dismissGesture}>
            <View>
              <View style={s.topBar}>
                <Pressable
                  accessibilityLabel="Minimize recording"
                  disabled={cancelDisabled}
                  onPress={() => {
                    if (hasStarted || minimizeOnClose) {
                      rec.minimizeExperience();
                      return;
                    }
                    cancelledRef.current = true;
                    setStarting(false);
                    stopNativeTranscription();
                    void onCancel();
                  }}
                  style={[s.iconButton, cancelDisabled && s.disabled]}
                >
                  <Ionicons name={hasStarted || minimizeOnClose ? "chevron-down" : cancelIcon} size={24} color={C.text} />
                </Pressable>
              </View>

              <Reanimated.View
                key="recording-header"
                entering={FadeInDown.duration(220)}
                exiting={FadeOutUp.duration(160)}
                layout={LinearTransition.duration(220)}
                style={s.header}
              >
                <View style={s.livePill}>
                  <View style={[s.liveDot, !hasStarted && s.liveDotReady, sessionPaused && s.liveDotPaused]} />
                  <Text style={s.liveText}>{liveStatusLabel}</Text>
                </View>
                <Text style={s.title} numberOfLines={2}>
                  {title || "Live Mystery Shopping Calls"}
                </Text>
                <View style={s.metaRow}>
                  <MetaIcon
                    icon="calendar-outline"
                    text={new Date().toLocaleDateString(undefined, { weekday: "short", month: "numeric", day: "numeric" })}
                  />
                  <MetaIcon icon="time-outline" text={formatElapsed(sessionElapsed)} />
                  <MetaIcon icon="business-outline" text={agentName || "Tour agent"} />
                </View>
                <Text style={s.caption}>{statusCaption}</Text>
              </Reanimated.View>

              <View style={s.tabs}>
                {TABS.map((tab) => (
                  <Pressable
                    key={tab}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: activeTab === tab }}
                    onPress={() => selectTab(tab)}
                    style={s.tab}
                  >
                    <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>{tab}</Text>
                    {activeTab === tab && <View style={s.tabLine} />}
                  </Pressable>
                ))}
              </View>
            </View>
          </GestureDetector>

        <View style={s.content}>
          {activeTab === "Summary" && (
            <ScrollView
              contentContainerStyle={s.summaryContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            >
              <View style={s.summarySection}>
                <View style={s.summarySectionHead}>
                  <View>
                    <Text style={s.sectionTitle}>People</Text>
                    <Text style={s.sectionCaption}>
                      {participants.length ? `${participants.length} checked in` : "Add everyone joining this tour"}
                    </Text>
                  </View>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.peopleStrip}>
                  {participants.map((person) => (
                    <Pressable
                      key={`${person.createdAt}-${person.email ?? person.phone ?? person.name}`}
                      onPress={() => openPerson(person)}
                      style={({ pressed }) => [s.personBubbleWrap, pressed && s.pressed]}
                    >
                      <View style={s.personBubble}>
                        <Text style={s.personBubbleText}>{personInitials(person.name)}</Text>
                      </View>
                      <Text style={s.personBubbleName} numberOfLines={1}>{person.firstName || person.name.split(" ")[0]}</Text>
                    </Pressable>
                  ))}
                  {!participants.length && prospectName ? (
                    <View style={s.personBubbleWrap}>
                      <View style={s.personBubble}><Text style={s.personBubbleText}>{personInitials(prospectName)}</Text></View>
                      <Text style={s.personBubbleName} numberOfLines={1}>{prospectName.split(" ")[0]}</Text>
                    </View>
                  ) : null}
                  <Pressable onPress={openAddPerson} style={({ pressed }) => [s.personBubbleWrap, pressed && s.pressed]}>
                    <View style={s.addPersonBubble}><Ionicons name="add" size={28} color={C.brand} /></View>
                    <Text style={s.addPersonLabel}>Check in</Text>
                  </Pressable>
                </ScrollView>
              </View>

              <View style={[s.summaryCard, s.sessionNotesCard]}>
                <TextInput
                  value={notes}
                  onChangeText={onNotesChange}
                  onBlur={() => void saveSessionNotes()}
                  placeholder="Add a note…"
                  placeholderTextColor={C.textMuted}
                  multiline
                  textAlignVertical="top"
                  style={s.summaryNotesInput}
                />
                <View style={s.notesFooter}>
                  <View style={s.autosaveRow}>
                    <Text style={s.autosaveProperty} numberOfLines={1}>{propertyName || "This property"}</Text>
                    <Text style={s.autosaveSeparator}>—</Text>
                    <Text style={s.autosaveText}>{summarySaving ? "Saving…" : "Autosaved"}</Text>
                  </View>
                  <View style={s.noteActions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Show AI note"
                      onPress={() => setNoteAccessory((current) => current === "ai" ? null : "ai")}
                      style={[s.noteAction, noteAccessory === "ai" && s.noteActionActive]}
                    >
                      <Ionicons name="sparkles-outline" size={14} color={noteAccessory === "ai" ? C.brand : C.textSec} />
                      <Text style={[s.noteActionText, noteAccessory === "ai" && s.noteActionTextActive]}>AI</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Show reminders"
                      onPress={() => setNoteAccessory((current) => current === "reminders" ? null : "reminders")}
                      style={[s.noteAction, noteAccessory === "reminders" && s.noteActionActive]}
                    >
                      <Ionicons name="notifications-outline" size={14} color={noteAccessory === "reminders" ? C.brand : C.textSec} />
                      <Text style={[s.noteActionText, noteAccessory === "reminders" && s.noteActionTextActive]}>
                        {reminders.length ? `Reminders ${reminders.length}` : "Reminder"}
                      </Text>
                    </Pressable>
                    {hasAssets ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Show assets"
                        onPress={() => {
                          Keyboard.dismiss();
                          setAssetSearch("");
                          setSelectedAssetPreview(null);
                          setAssetSheetOpen(true);
                        }}
                        style={[s.noteAction, assetSheetOpen && s.noteActionActive]}
                      >
                        <Ionicons name="folder-open-outline" size={14} color={assetSheetOpen ? C.brand : C.textSec} />
                        <Text style={[s.noteActionText, assetSheetOpen && s.noteActionTextActive]}>Assets</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
                {noteAccessory === "ai" ? (
                  <View style={s.notesInsightPanel}>
                    <View style={s.notesInsightIcon}><Ionicons name="sparkles-outline" size={18} color={C.brand} /></View>
                    <View style={s.flex1}>
                      <Text style={s.notesInsightBody}>
                        {latestAiNote || "AI notes will appear as the session develops."}
                      </Text>
                    </View>
                  </View>
                ) : null}
                {noteAccessory === "reminders" ? (
                  <View style={s.remindersPane}>
                    <View style={s.reminderComposer}>
                      <TextInput
                        value={reminderDraft}
                        onChangeText={setReminderDraft}
                        placeholder="Add a reminder…"
                        placeholderTextColor={C.textMuted}
                        returnKeyType="done"
                        onSubmitEditing={() => {
                          const reminder = reminderDraft.trim();
                          if (!reminder) return;
                          setReminders((current) => [...current, reminder]);
                          setReminderDraft("");
                        }}
                        style={s.reminderInput}
                      />
                      <Pressable
                        accessibilityLabel="Add reminder"
                        disabled={!reminderDraft.trim()}
                        onPress={() => {
                          const reminder = reminderDraft.trim();
                          if (!reminder) return;
                          setReminders((current) => [...current, reminder]);
                          setReminderDraft("");
                        }}
                        style={[s.reminderAddButton, !reminderDraft.trim() && s.disabled]}
                      >
                        <Ionicons name="add" size={18} color="#fff" />
                      </Pressable>
                    </View>
                    {reminders.map((reminder, index) => (
                      <View key={`${reminder}-${index}`} style={s.reminderRow}>
                        <Ionicons name="ellipse-outline" size={16} color={C.brand} />
                        <Text style={s.reminderText}>{reminder}</Text>
                      </View>
                    ))}
                    {!reminders.length ? <Text style={s.remindersEmpty}>Keep next steps here so nothing gets missed.</Text> : null}
                  </View>
                ) : null}
              </View>

              {summaryMessage ? <Text style={s.summaryMessage}>{summaryMessage}</Text> : null}
            </ScrollView>
          )}

          {activeTab === "Transcript" && (
            <FlatList
              ref={listRef}
              data={liveTranscript}
              renderItem={renderTranscript}
              keyExtractor={(item) => item.id}
              contentContainerStyle={s.transcriptList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                <View style={s.notice}>
                  <Ionicons
                    name={
                      liveSpeech.error || isFatalSpeechInitError(transcriptionStatus)
                        ? "mic-off-outline"
                        : liveSpeech.isRecording
                          ? "radio-outline"
                          : "mic-outline"
                    }
                    size={18}
                    color={C.brand}
                  />
                  <Text style={s.noticeText}>
                    {liveSpeech.error ||
                      transcriptionStatus ||
                      (sessionPaused
                        ? "Transcription paused. Resume to continue."
                        : liveSpeech.isRecording
                          ? "Live transcription is listening."
                          : hasStarted
                            ? "Connecting speech recognition…"
                            : "Transcript starts after recording begins.")}
                  </Text>
                </View>
              }
            />
          )}

          {activeTab === "AI Chat" && (
            <View style={s.chatPane}>
              <ScrollView
                ref={chatListRef}
                style={s.chatList}
                contentContainerStyle={s.chatListContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                showsVerticalScrollIndicator={false}
              >
                {chatMessages.length === 0 ? (
                  <View style={s.emptyChat}>
                    <Ionicons name="sparkles-outline" size={26} color={C.brand} />
                    <Text style={s.emptyChatTitle}>Ask Tour AI during the tour</Text>
                    <Text style={s.emptyChatBody}>
                      It uses the session, community, notes, selected assets, and live transcript context.
                    </Text>
                    <View style={s.emptyPromptGrid}>
                      {EMPTY_CHAT_PROMPTS.map((prompt) => (
                        <Pressable
                          key={prompt}
                          disabled={chatBusy}
                          onPress={() => void submitChat(prompt)}
                          style={({ pressed }) => [
                            s.emptyPromptBubble,
                            pressed && s.pressed,
                            chatBusy && { opacity: 0.6 },
                          ]}
                        >
                          <Text style={s.emptyPromptText}>{prompt}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : (
                  chatMessages.map((message, index) => {
                    const isStreamingAssistant =
                      chatStreaming &&
                      message.role === "assistant" &&
                      index === chatMessages.length - 1;
                    return (
                      <View
                        key={`${message.role}-${index}`}
                        style={[s.chatBubble, message.role === "user" ? s.chatUser : s.chatAssistant]}
                      >
                        <Text style={s.chatRole}>{message.role === "user" ? "You" : "Tour AI"}</Text>
                        {message.role === "assistant" ? (
                          message.content.trim() ? (
                            <LiveChatMarkdown content={message.content} streaming={isStreamingAssistant} />
                          ) : (
                            <ChatTypingIndicator />
                          )
                        ) : (
                          <Text style={s.chatCopy}>{message.content}</Text>
                        )}
                      </View>
                    );
                  })
                )}
                {chatError && <Text style={s.chatError}>{chatError}</Text>}
              </ScrollView>

              <View
                style={[
                  s.chatFooter,
                  {
                    paddingBottom: keyboardHeight > 0 ? 10 : Math.max(insets.bottom, 10),
                  },
                ]}
              >
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={s.promptStrip}
                >
                  {suggestedPrompts.map((prompt) => (
                    <Pressable
                      key={prompt}
                      disabled={chatBusy}
                      onPress={() => {
                        setChatInput(prompt);
                      }}
                      style={s.promptChip}
                    >
                      <Text style={s.promptChipText} numberOfLines={1}>
                        {prompt}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <View style={s.composer}>
                  <View style={s.composerIcon}>
                    <Ionicons name="sparkles-outline" size={18} color={C.textSec} />
                  </View>
                  <TextInput
                    value={chatInput}
                    onChangeText={setChatInput}
                    editable={!chatBusy}
                    placeholder="Ask Tour AI..."
                    placeholderTextColor={C.textMuted}
                    multiline
                    textAlignVertical="center"
                    style={s.chatInput}
                  />
                  <ElevenLabsDictationButton
                    disabled={chatBusy}
                    keepAudioSessionActive
                    onBeforeStart={pauseTourForDictation}
                    onAfterStop={resumeTourAfterDictation}
                    onError={setChatError}
                    onTranscript={(text) => {
                      setChatInput((current) => appendDictationText(current, text));
                    }}
                  />
                  <Pressable
                    accessibilityLabel="Send message"
                    disabled={!canSendChat}
                    onPress={() => submitChat(chatInput)}
                    style={[s.sendButton, canSendChat ? s.sendButtonActive : s.sendButtonDisabled]}
                  >
                    {chatBusy ? (
                      <LoadingDots size="small" color="#fff" />
                    ) : (
                      <Ionicons name="arrow-up" size={18} color="#fff" />
                    )}
                  </Pressable>
                </View>
              </View>
            </View>
          )}
        </View>
      </View>

      {showBottomDock ? (
        <Reanimated.View
          key="bottom-recording-dock"
          entering={SlideInRight.springify().damping(18).stiffness(160).mass(0.85)}
          exiting={SlideOutRight.springify().damping(18).stiffness(140).mass(0.9)}
          style={s.bottomDockOverlay}
        >
          {startError ? <Text style={s.startError}>{startError}</Text> : null}
          {permissionTipVisible ? (
            <Reanimated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)} style={s.permissionPopover} pointerEvents="box-none">
              <View style={s.permissionCard}>
                <Text style={s.permissionText}>Always get permission before recording</Text>
                <Pressable
                  accessibilityLabel="Dismiss permission tip"
                  hitSlop={10}
                  onPress={dismissPermissionTip}
                  style={s.permissionClose}
                >
                  <Ionicons name="close" size={16} color="#0B2740" />
                </Pressable>
              </View>
              <View style={s.permissionCaret} />
            </Reanimated.View>
          ) : null}
          <View style={s.waveLine}>
            <View style={[s.waveHalf, s.waveHalfLeft]}>
              {waveformBars.left.map((height, index) => (
                <LiveWaveBar
                  key={`left-${index}`}
                  height={height}
                  opacity={hasStarted ? (sessionPaused ? 0.48 : 0.95) : 0.42}
                />
              ))}
            </View>
            <Text style={s.waveTime}>{formatElapsed(sessionElapsed)}</Text>
            <View style={[s.waveHalf, s.waveHalfRight]}>
              {waveformBars.right.map((height, index) => (
                <LiveWaveBar
                  key={`right-${index}`}
                  height={height}
                  opacity={hasStarted ? (sessionPaused ? 0.48 : 0.95) : 0.42}
                />
              ))}
            </View>
          </View>
          {hasStarted ? (
            <View style={s.recordControls}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel session"
                onPress={confirmCancelSession}
                style={({ pressed }) => [s.roundControl, pressed && s.controlPressed]}
              >
                <Ionicons name="close" size={24} color={C.textSec} />
              </Pressable>
              <Pressable
                accessibilityLabel={sessionPaused ? "Resume recording" : "Pause recording"}
                onPress={() => void rec.togglePause()}
                style={({ pressed }) => [s.roundControl, pressed && s.controlPressed]}
              >
                <Ionicons name={sessionPaused ? "play" : "pause"} size={24} color={C.text} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Stop session"
                onPress={finishRecording}
                style={({ pressed }) => [s.stopControl, pressed && s.stopControlPressed]}
              >
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={s.stopControlText}>Stop Session</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Open AI chat"
                onPress={() => selectTab("AI Chat")}
                style={({ pressed }) => [s.roundControl, pressed && s.controlPressed]}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={21} color={C.text} />
              </Pressable>
              {onUploadFile ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Upload a recording"
                  onPress={() => setUploadSheetOpen(true)}
                  style={({ pressed }) => [s.roundControl, pressed && s.controlPressed]}
                >
                  <Ionicons name="cloud-upload-outline" size={21} color={C.brand} />
                </Pressable>
              ) : null}
            </View>
          ) : (
            <View style={s.readyActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Start session"
                disabled={starting}
                onPress={() => void startSessionRecording()}
                style={[s.startRecordingButton, starting && s.startRecordingButtonDisabled]}
              >
                {starting ? (
                  <LoadingDots size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="mic" size={22} color="#fff" />
                    <Text style={s.startRecordingText}>Start Session</Text>
                  </>
                )}
              </Pressable>
              {onUploadFile && !starting ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Upload a recording" onPress={() => setUploadSheetOpen(true)} style={s.uploadRecordingButton}>
                  <Ionicons name="cloud-upload-outline" size={20} color={C.brand} />
                  <Text style={s.uploadRecordingText}>Upload</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </Reanimated.View>
      ) : null}

      <BottomSheetModal
        visible={cancelConfirmOpen}
        onClose={() => setCancelConfirmOpen(false)}
        sheetHeight={390}
        contentStyle={s.cancelConfirmContent}
      >
        <View style={s.cancelConfirmTopRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss cancel recording"
            hitSlop={10}
            onPress={() => setCancelConfirmOpen(false)}
            style={({ pressed }) => [s.cancelConfirmClose, pressed && s.controlPressed]}
          >
            <Ionicons name="close" size={20} color={C.textSec} />
          </Pressable>
        </View>
        <View style={s.cancelConfirmIcon}>
          <Ionicons name="close" size={22} color={C.textSec} />
        </View>
        <Text style={s.cancelConfirmTitle}>Cancel recording?</Text>
        <Text style={s.cancelConfirmCopy}>This recording will be discarded and cannot be recovered.</Text>
        <View style={s.cancelConfirmActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel recording"
            onPress={() => {
              setCancelConfirmOpen(false);
              stopNativeTranscription();
              void onCancel();
            }}
            style={({ pressed }) => [s.cancelRecordingButton, pressed && s.controlPressed]}
          >
            <Ionicons name="trash-outline" size={18} color={C.textSec} />
            <Text style={s.cancelRecordingButtonText}>Cancel Recording</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue recording"
            onPress={() => setCancelConfirmOpen(false)}
            style={({ pressed }) => [s.continueRecordingButton, pressed && s.stopControlPressed]}
          >
            <Ionicons name="mic" size={18} color="#fff" />
            <Text style={s.continueRecordingButtonText}>Continue Recording</Text>
          </Pressable>
        </View>
      </BottomSheetModal>

      <BottomSheetModal
        visible={finishConfirmOpen}
        onClose={continueRecordingFromFinish}
        sheetHeight={385}
        contentStyle={s.finishConfirmContent}
      >
        <View style={s.finishConfirmTopRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue recording"
            hitSlop={10}
            onPress={continueRecordingFromFinish}
            style={({ pressed }) => [s.cancelConfirmClose, pressed && s.controlPressed]}
          >
            <Ionicons name="close" size={20} color={C.textSec} />
          </Pressable>
        </View>
        <View style={s.finishConfirmIcon}>
          <Ionicons name="checkmark" size={24} color={C.brand} />
        </View>
        <Text style={s.finishConfirmTitle}>Complete this session?</Text>
        <Text style={s.finishConfirmCopy}>The recording will stop and begin processing automatically.</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Complete session automatically in ${finishCountdown} seconds`}
          onPress={completeSessionRecording}
          style={({ pressed }) => [s.completeSessionCard, pressed && s.stopControlPressed]}
        >
          <View style={s.completeSessionCardIcon}>
            <Ionicons name="checkmark" size={18} color="#fff" />
          </View>
          <View style={s.flex1}>
            <Text style={s.completeSessionCardTitle}>Complete Session</Text>
            <Text style={s.completeSessionCardCopy}>Stop recording and start processing</Text>
          </View>
          <View style={s.finishCountdownBadge}>
            <Ionicons name="time-outline" size={14} color="#fff" />
            <Text style={s.finishCountdownText}>{finishCountdown}</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue recording session"
          onPress={continueRecordingFromFinish}
          style={({ pressed }) => [s.continueSessionCard, pressed && s.controlPressed]}
        >
          <View style={s.continueSessionCardIcon}>
            <Ionicons name="mic" size={18} color={C.brand} />
          </View>
          <View style={s.flex1}>
            <Text style={s.continueSessionCardTitle}>Continue Recording</Text>
            <Text style={s.continueSessionCardCopy}>Return to the live session</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={C.brand} />
        </Pressable>
      </BottomSheetModal>

      <Modal visible={uploadSheetOpen} transparent animationType="slide" onRequestClose={() => setUploadSheetOpen(false)}>
        <View style={s.sheetBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setUploadSheetOpen(false)} />
          <View style={s.uploadSheet}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <View style={s.flex1}>
                <Text style={s.assetSheetTitle}>Upload a recording</Text>
                <Text style={s.assetSheetSubtitle}>Confirm your role before choosing the audio or video file.</Text>
              </View>
              <Pressable accessibilityLabel="Close upload" onPress={() => setUploadSheetOpen(false)} style={s.assetClose}>
                <Ionicons name="close" size={20} color={C.text} />
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: uploaderIsAgent }}
              onPress={() => onUploaderIsAgentChange?.(!uploaderIsAgent)}
              style={({ pressed }) => [s.agentIdentityToggle, uploaderIsAgent && s.agentIdentityToggleSelected, pressed && s.pressed]}
            >
              <View style={[s.agentIdentityCheck, uploaderIsAgent && s.agentIdentityCheckSelected]}>
                {uploaderIsAgent ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}
              </View>
              <View style={s.flex1}>
                <Text style={s.agentIdentityTitle}>I am the leasing agent</Text>
                <Text style={s.agentIdentityCopy}>
                  {uploaderIsAgent
                    ? `Use ${agentName?.trim() || "my profile name"} for this session.`
                    : "Leave this off when uploading a recording from another agent."}
                </Text>
              </View>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setUploadSheetOpen(false);
                setTimeout(() => void onUploadFile?.(), 220);
              }}
              style={({ pressed }) => [s.chooseUploadButton, pressed && s.pressed]}
            >
              <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
              <Text style={s.chooseUploadButtonText}>Choose recording</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <BottomSheetModal
        visible={assetSheetOpen}
        onClose={() => {
          if (selectedAssetPreview) {
            setSelectedAssetPreview(null);
          } else {
            setAssetSheetOpen(false);
          }
        }}
        swipeBackEnabled={Boolean(selectedAssetPreview)}
        onSwipeBack={() => setSelectedAssetPreview(null)}
        sheetHeight={Math.min(selectedAssetPreview ? 650 : 620, Math.round(Dimensions.get("window").height * (selectedAssetPreview ? 0.76 : 0.72)))}
        header={selectedAssetPreview ? (
          <View style={s.assetPreviewHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to all assets"
              hitSlop={10}
              onPress={() => setSelectedAssetPreview(null)}
              style={({ pressed }) => [s.assetBackButton, pressed && s.pressed]}
            >
              <Ionicons name="chevron-back" size={20} color={C.text} />
            </Pressable>
            <View style={s.flex1}>
              <Text style={s.assetSheetTitle} numberOfLines={2}>{selectedAssetPreview.name}</Text>
              <Text style={s.assetSheetSubtitle}>Asset preview</Text>
            </View>
            <Pressable accessibilityLabel="Close assets" onPress={() => setAssetSheetOpen(false)} style={s.assetClose}>
              <Ionicons name="close" size={20} color={C.text} />
            </Pressable>
          </View>
        ) : (
          <View style={s.sheetHeader}>
            <View style={s.flex1}>
              <Text style={s.assetSheetTitle}>Assets</Text>
              <Text style={s.assetSheetSubtitle}>{visibleAttachments.length + assets.length} session and community assets</Text>
            </View>
            <Pressable accessibilityLabel="Close assets" onPress={() => setAssetSheetOpen(false)} style={s.assetClose}>
              <Ionicons name="close" size={20} color={C.text} />
            </Pressable>
          </View>
        )}
        contentStyle={selectedAssetPreview ? s.assetPreviewContent : s.assetViewerContent}
      >
        {selectedAssetPreview ? (
          <>
            <View style={s.assetPreviewStage}>
              {selectedAssetPreview.kind === "video" && selectedAssetPreview.url ? (
                <RecordingAssetVideoPreview source={selectedAssetPreview.url} />
              ) : selectedAssetPreview.kind === "link" && selectedAssetPreview.url ? (
                <RecordingAssetWebPreview source={selectedAssetPreview.url} />
              ) : selectedAssetPreview.previewUrl ? (
                <Image source={{ uri: selectedAssetPreview.previewUrl }} resizeMode="contain" style={s.assetPreviewMedia} />
              ) : (
                <View style={s.assetPreviewFallback}>
                  <Ionicons name={selectedAssetPreview.kind === "image" ? "image-outline" : "document-outline"} size={48} color={C.brand} />
                  <Text style={s.assetPreviewFallbackText}>Preview unavailable</Text>
                </View>
              )}
            </View>
            {selectedAssetPreview.description ? <Text style={s.assetPreviewDescription}>{selectedAssetPreview.description}</Text> : null}
            <View style={s.assetPreviewActions}>
              <Pressable onPress={() => void shareSelectedAsset()} style={({ pressed }) => [s.assetPreviewAction, pressed && s.pressed]}>
                <Ionicons name="share-social-outline" size={17} color={C.text} />
                <Text style={s.assetPreviewActionText}>Share</Text>
              </Pressable>
              <Pressable disabled={!selectedAssetPreview.url} onPress={() => void downloadSelectedAsset()} style={({ pressed }) => [s.assetPreviewAction, !selectedAssetPreview.url && s.disabled, pressed && s.pressed]}>
                <Ionicons name="download-outline" size={17} color={C.text} />
                <Text style={s.assetPreviewActionText}>Download</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <ScrollView contentContainerStyle={s.assetViewerList} showsVerticalScrollIndicator={false}>
            <View style={s.assetInlineSearch}>
              <Ionicons name="search-outline" size={16} color={C.textMuted} />
              <TextInput value={assetSearch} onChangeText={setAssetSearch} placeholder="Search assets" placeholderTextColor={C.textMuted} style={s.assetInlineSearchInput} />
            </View>
            {filteredAttachments.map((attachment) => (
              <Pressable key={`drawer-attachment-${attachment.id}`} disabled={!attachment.url} onPress={() => setSelectedAssetPreview(previewForAttachment(attachment))} style={({ pressed }) => [s.assetPickRow, pressed && s.pressed]}>
                <View style={s.assetViewerThumb}><Ionicons name={attachment.type === "video" ? "play" : attachment.type === "image" ? "image-outline" : "document-attach-outline"} size={21} color={C.brand} /></View>
                <View style={s.flex1}><Text style={s.assetPickTitle} numberOfLines={2}>{attachment.name}</Text><Text style={s.assetPickMeta}>{attachment.description || attachment.type}</Text></View>
                {attachment.url ? <Ionicons name="chevron-forward" size={18} color={C.textMuted} /> : null}
              </Pressable>
            ))}
            {filteredAssets.map((asset) => (
              <Pressable key={`drawer-material-${asset.id}`} disabled={!materialUrl(asset)} onPress={() => setSelectedAssetPreview(previewForMaterial(asset))} style={({ pressed }) => [s.assetPickRow, pressed && s.pressed]}>
                <View style={s.assetViewerThumb}>{previewUrlForMaterial(asset) ? <Image source={{ uri: previewUrlForMaterial(asset)! }} resizeMode="cover" style={s.assetPreviewImage} /> : <Ionicons name="folder-open-outline" size={21} color={C.brand} />}</View>
                <View style={s.flex1}><Text style={s.assetPickTitle} numberOfLines={2}>{asset.name}</Text><Text style={s.assetPickMeta}>{asset.description || asset.type}</Text></View>
                {materialUrl(asset) ? <Ionicons name="chevron-forward" size={18} color={C.textMuted} /> : null}
              </Pressable>
            ))}
            {!filteredAttachments.length && !filteredAssets.length ? <Text style={s.sectionCaption}>No assets match your search.</Text> : null}
          </ScrollView>
        )}
      </BottomSheetModal>

      <Modal visible={personSheetOpen} transparent animationType="slide" onRequestClose={() => setPersonSheetOpen(false)}>
        <View style={s.sheetBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPersonSheetOpen(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.personSheet}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <View style={s.flex1}>
                <Text style={s.assetSheetTitle}>Add another person</Text>
                <Text style={s.assetSheetSubtitle}>Let them scan, share the link, or enter their details here.</Text>
              </View>
              <Pressable accessibilityLabel="Close add person" onPress={() => setPersonSheetOpen(false)} style={s.assetClose}>
                <Ionicons name="close" size={20} color={C.text} />
              </Pressable>
            </View>
            <View style={s.personModeTabs}>
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: personEntryMode === "qr" }}
                onPress={() => {
                  setPersonEntryMode("qr");
                  void prepareRemoteCheckIn();
                }}
                style={[s.personModeTab, personEntryMode === "qr" && s.personModeTabActive]}
              >
                <Ionicons name="qr-code-outline" size={16} color={personEntryMode === "qr" ? C.brand : C.textMuted} />
                <Text style={[s.personModeTabText, personEntryMode === "qr" && s.personModeTabTextActive]}>Scan or share</Text>
              </Pressable>
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: personEntryMode === "manual" }}
                onPress={() => setPersonEntryMode("manual")}
                style={[s.personModeTab, personEntryMode === "manual" && s.personModeTabActive]}
              >
                <Ionicons name="create-outline" size={16} color={personEntryMode === "manual" ? C.brand : C.textMuted} />
                <Text style={[s.personModeTabText, personEntryMode === "manual" && s.personModeTabTextActive]}>Enter details</Text>
              </Pressable>
            </View>

            <Reanimated.View key={personEntryMode} entering={FadeIn.duration(170)} style={s.personModeBody}>
              {personEntryMode === "qr" ? (
                <View style={s.personQrPanel}>
                  <View style={s.personRealtimeStatus}>
                    <View style={[
                      s.personRealtimeDot,
                      participantRealtimeStatus === "live" && s.personRealtimeDotLive,
                    ]} />
                    <Text style={s.personRealtimeText}>
                      {participantRealtimeStatus === "live"
                        ? "Live check-in connected"
                        : participantRealtimeStatus === "connecting"
                          ? "Connecting live check-in…"
                          : "Check-ins will refresh automatically"}
                    </Text>
                  </View>

                  {checkInLinkLoading || !checkInBinding?.url ? (
                    <View style={s.personQrLoading}>
                      {checkInLinkLoading ? <LoadingDots size="large" color={C.brand} /> : <Ionicons name="cloud-offline-outline" size={34} color={C.textMuted} />}
                      <Text style={s.personQrLoadingTitle}>
                        {checkInLinkLoading ? "Preparing live check-in…" : "Live QR unavailable"}
                      </Text>
                      <Text style={s.personQrLoadingCopy}>
                        {checkInLinkError ?? "Connect to create a QR for this exact session."}
                      </Text>
                      {!checkInLinkLoading ? (
                        <Pressable onPress={() => void prepareRemoteCheckIn()} style={s.personRetryButton}>
                          <Ionicons name="refresh" size={16} color={C.brand} />
                          <Text style={s.personRetryText}>Try again</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : (
                    <>
                      <View style={s.personQrCard}>
                        <QRCodeStyled
                          data={checkInBinding.url}
                          size={210}
                          padding={10}
                          color={C.text}
                          pieceScale={0.82}
                          pieceCornerType="rounded"
                          pieceBorderRadius={4}
                          outerEyesOptions={{ borderRadius: 12, color: C.text }}
                          innerEyesOptions={{ borderRadius: 10, color: C.brand }}
                          errorCorrectionLevel="Q"
                          style={s.personQrCode}
                        />
                      </View>
                      <Text style={s.personQrTitle}>Scan to join this tour</Text>
                      <Text style={s.personQrCopy}>Their check-in will appear here without interrupting the recording.</Text>
                      <Pressable
                        accessibilityRole="link"
                        accessibilityLabel="Open check-in page"
                        onPress={() => void Linking.openURL(checkInBinding.url)}
                        style={({ pressed }) => [s.personQrLink, pressed && s.pressed]}
                      >
                        <Text style={s.personQrUrl} numberOfLines={2}>{checkInBinding.url}</Text>
                        <Ionicons name="open-outline" size={13} color={C.brand} />
                      </Pressable>
                      <Pressable onPress={() => void shareRemoteCheckIn()} style={[s.personPrimaryButton, s.personShareButton]}>
                        <Ionicons name="share-social-outline" size={18} color="#fff" />
                        <Text style={s.personPrimaryButtonText}>Share check-in link</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              ) : (
                <ScrollView contentContainerStyle={s.personForm} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                  <View style={s.personNameRow}>
                    <SummaryField label="First name" value={personFirstName} onChangeText={setPersonFirstName} autoCapitalize="words" />
                    <SummaryField label="Last name" value={personLastName} onChangeText={setPersonLastName} autoCapitalize="words" />
                  </View>
                  <SummaryField label="Email (optional)" value={personEmail} onChangeText={setPersonEmail} keyboardType="email-address" autoCapitalize="none" />
                  <SummaryField label="Phone (optional)" value={personPhone} onChangeText={setPersonPhone} keyboardType="phone-pad" />
                  <SummarySelectField
                    label="How did you hear about us?"
                    value={personHowHeard}
                    options={CHECK_IN_HEAR_ABOUT_OPTIONS}
                    onChange={setPersonHowHeard}
                  />
                  <SummarySelectField
                    label="Reason for visit"
                    value={personReason}
                    options={CHECK_IN_REASON_OPTIONS}
                    onChange={setPersonReason}
                  />
                  {summaryMessage ? <Text style={s.personError}>{summaryMessage}</Text> : null}
                  <Pressable disabled={personSaving} onPress={() => void saveNewPerson()} style={[s.personPrimaryButton, personSaving && s.disabled]}>
                    {personSaving ? <LoadingDots size="small" color="#fff" /> : <Ionicons name="person-add-outline" size={18} color="#fff" />}
                    <Text style={s.personPrimaryButtonText}>{personSaving ? "Adding…" : "Add to session"}</Text>
                  </Pressable>
                </ScrollView>
              )}
            </Reanimated.View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={Boolean(selectedPerson)} transparent animationType="slide" onRequestClose={() => setSelectedPerson(null)}>
        <View style={s.sheetBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedPerson(null)} />
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.personSheet}>
            <View style={s.sheetHandle} />
            {selectedPerson ? (
              <ScrollView contentContainerStyle={s.personDetailContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={s.personDetailHeader}>
                  <View style={s.personDetailAvatar}><Text style={s.personDetailAvatarText}>{personInitials(selectedPerson.name)}</Text></View>
                  <View style={s.flex1}>
                    <Text style={s.personDetailName}>{selectedPerson.name}</Text>
                    <Text style={s.assetSheetSubtitle}>Checked in {new Date(selectedPerson.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</Text>
                  </View>
                  <Pressable accessibilityLabel="Close person details" onPress={() => setSelectedPerson(null)} style={s.assetClose}>
                    <Ionicons name="close" size={20} color={C.text} />
                  </Pressable>
                </View>
                <View style={s.personDetailCard}>
                  <DetailLine icon="mail-outline" label="Email" value={selectedPerson.email || "Not provided"} />
                  <DetailLine icon="call-outline" label="Phone" value={selectedPerson.phone || "Not provided"} />
                  <DetailLine icon="compass-outline" label="Reason" value={selectedPerson.reason || "Not provided"} />
                  <DetailLine icon="megaphone-outline" label="How they heard" value={selectedPerson.questionAnswers?.hear_about || "Not provided"} />
                  {Object.entries(selectedPerson.questionAnswers ?? {}).filter(([key]) => key !== "hear_about").map(([key, value]) => (
                    <DetailLine key={key} icon="chatbox-outline" label={key.replace(/_/g, " ")} value={value} />
                  ))}
                </View>
                <View style={s.summaryCard}>
                  <Text style={s.summaryCardTitle}>Notes about {selectedPerson.firstName || selectedPerson.name.split(" ")[0]}</Text>
                  <TextInput
                    value={personNotes}
                    onChangeText={setPersonNotes}
                    placeholder="Add context specific to this person…"
                    placeholderTextColor={C.textMuted}
                    multiline
                    textAlignVertical="top"
                    style={s.summaryNotesInput}
                  />
                  <Pressable disabled={personSaving} onPress={() => void savePersonNotes()} style={[s.summarySaveButton, personSaving && s.disabled]}>
                    {personSaving ? <LoadingDots size="small" color="#fff" /> : <Ionicons name="checkmark" size={17} color="#fff" />}
                    <Text style={s.summarySaveButtonText}>Save person notes</Text>
                  </Pressable>
                </View>
                <View style={s.summarySection}>
                  <Text style={s.sectionTitle}>Session assets</Text>
                  <Text style={s.sectionCaption}>These resources are available to everyone in this tour.</Text>
                  {visibleAttachments.length ? visibleAttachments.map((attachment) => (
                    <Pressable key={attachment.id} disabled={!attachment.url} onPress={() => setSelectedAssetPreview(previewForAttachment(attachment))} style={s.attachmentCard}>
                      <View style={s.attachmentIcon}><Ionicons name={attachment.type === "video" ? "play" : "document-attach-outline"} size={18} color={C.brand} /></View>
                      <Text style={[s.attachmentTitle, s.flex1]} numberOfLines={1}>{attachment.name}</Text>
                      {attachment.url ? <Ionicons name="eye-outline" size={16} color={C.textMuted} /> : null}
                    </Pressable>
                  )) : <Text style={s.sectionCaption}>No assets have been attached yet.</Text>}
                </View>
                {summaryMessage ? <Text style={s.summaryMessage}>{summaryMessage}</Text> : null}
              </ScrollView>
            ) : null}
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function SummaryField(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, style, ...inputProps } = props;
  return (
    <View style={s.summaryField}>
      <Text style={s.summaryFieldLabel}>{label}</Text>
      <TextInput {...inputProps} placeholderTextColor={C.textMuted} style={[s.summaryFieldInput, style]} />
    </View>
  );
}

function SummarySelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <View style={s.summarySelectField}>
      <Text style={s.summaryFieldLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.summarySelectOptions}>
        {options.map((option) => {
          const active = value === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              onPress={() => onChange(option)}
              style={[s.summarySelectOption, active && s.summarySelectOptionActive]}
            >
              <Text style={[s.summarySelectOptionText, active && s.summarySelectOptionTextActive]}>{option}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function DetailLine({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={s.detailLine}>
      <View style={s.detailLineIcon}><Ionicons name={icon} size={16} color={C.brand} /></View>
      <View style={s.flex1}>
        <Text style={s.detailLineLabel}>{label}</Text>
        <Text style={s.detailLineValue}>{value}</Text>
      </View>
    </View>
  );
}

function MetaIcon({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={s.metaItem}>
      <Ionicons name={icon} size={16} color={C.textMuted} />
      <Text style={s.metaText} numberOfLines={1}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingTop: Platform.OS === "ios" ? 24 : 10, overflow: "visible" },
  stackShadow: {
    position: "absolute",
    top: Platform.OS === "ios" ? 36 : 18,
    left: 42,
    right: 42,
    height: 38,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: "#E8EEF7",
    opacity: 1,
  },
  sheet: { flex: 1, marginTop: 22, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: C.bg, overflow: "hidden" },
  sheetWithDock: { paddingBottom: Platform.OS === "ios" ? 132 : 120 },
  topBar: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8 },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  assetsButton: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 12, borderRadius: 20, backgroundColor: C.brandSoft },
  assetsButtonText: { color: C.brand, fontSize: 13, fontWeight: "900" },
  header: { paddingHorizontal: 20, gap: 7, paddingBottom: 6 },
  livePill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: C.brandSoft },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.green },
  liveDotReady: { backgroundColor: C.textMuted },
  liveDotPaused: { backgroundColor: "#F79009" },
  liveText: { color: C.brand, fontSize: 11, fontWeight: "900" },
  title: { color: C.text, fontSize: 25, lineHeight: 30, fontWeight: "900" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5, maxWidth: "46%" },
  metaText: { color: C.textSec, fontSize: 13, fontWeight: "700" },
  caption: { color: C.textMuted, fontSize: 12, fontWeight: "700" },
  tabs: { height: 48, flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.line, backgroundColor: C.bg },
  tab: { flex: 1, minHeight: 46, alignItems: "center", justifyContent: "center" },
  tabText: { color: C.textSec, fontSize: 14, fontWeight: "900" },
  tabTextActive: { color: C.brand },
  tabLine: { position: "absolute", left: 8, right: 8, bottom: 0, height: 3, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: C.brand },
  content: { flex: 1, minHeight: 0 },
  summaryContent: { padding: 18, gap: 18, paddingBottom: 28 },
  summarySection: { gap: 10 },
  summarySectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  sectionCaption: { color: C.textSec, fontSize: 12, lineHeight: 17, fontWeight: "600", marginTop: 2 },
  peopleStrip: { gap: 14, paddingVertical: 4, paddingRight: 10 },
  personBubbleWrap: { width: 62, alignItems: "center", gap: 6 },
  personBubble: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", backgroundColor: C.brand, borderWidth: 3, borderColor: "#DCEEFF" },
  personBubbleText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  personBubbleName: { width: 62, color: C.text, fontSize: 11, fontWeight: "800", textAlign: "center" },
  addPersonBubble: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderStyle: "dashed", borderColor: C.brand, backgroundColor: C.brandSoft },
  addPersonLabel: { color: C.brand, fontSize: 11, fontWeight: "900" },
  summaryCard: { gap: 11, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel },
  sessionNotesCard: { gap: 8, padding: 0, borderWidth: 0, backgroundColor: "transparent" },
  summaryCardHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  summaryIcon: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: C.brandSoft },
  summaryCardTitle: { color: C.text, fontSize: 15, fontWeight: "900" },
  summaryCardCaption: { color: C.textSec, fontSize: 11, lineHeight: 16, fontWeight: "600", marginTop: 1 },
  summaryNotesInput: { minHeight: 72, maxHeight: 150, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: "rgba(16,24,40,0.08)", color: C.text, fontSize: 14, lineHeight: 20, fontWeight: "600", backgroundColor: C.panel },
  notesFooter: { minHeight: 30, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, paddingHorizontal: 3 },
  autosaveRow: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 5 },
  autosaveProperty: { maxWidth: "68%", color: C.textSec, fontSize: 10, fontWeight: "700" },
  autosaveSeparator: { color: C.textMuted, fontSize: 10, fontWeight: "700" },
  autosaveText: { color: C.textMuted, fontSize: 10, fontWeight: "700" },
  noteActions: { flexDirection: "row", alignItems: "center", gap: 5 },
  noteAction: { minHeight: 28, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 8, borderRadius: 14, backgroundColor: "rgba(16,24,40,0.045)" },
  noteActionActive: { backgroundColor: C.brandSoft },
  noteActionText: { color: C.textSec, fontSize: 10, fontWeight: "800" },
  noteActionTextActive: { color: C.brand },
  inlineAssetsSection: { gap: 9, paddingTop: 4 },
  inlineAssetsHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  assetInlineSearch: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 11, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel },
  assetInlineSearchInput: { flex: 1, color: C.text, fontSize: 12, fontWeight: "700" },
  inlineAssetsRow: { gap: 10, paddingRight: 20 },
  inlineAssetCard: { width: 126, gap: 5, padding: 8, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel },
  inlineAssetThumb: { height: 62, alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: 10, backgroundColor: C.brandSoft },
  inlineAssetThumbImage: { width: "100%", height: "100%" },
  inlineAssetTitle: { color: C.text, fontSize: 12, fontWeight: "800" },
  inlineAssetMeta: { color: C.textMuted, fontSize: 10, fontWeight: "700", textTransform: "capitalize" },
  notesAssetPanel: { gap: 8, paddingTop: 2 },
  summarySaveButton: { minHeight: 42, alignSelf: "flex-end", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 15, borderRadius: 21, backgroundColor: C.brand },
  summarySaveButtonText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  notesInsightPanel: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 11, borderRadius: 13, backgroundColor: C.brandSoft },
  notesInsightIcon: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: C.panel },
  notesInsightTitle: { color: C.text, fontSize: 12, fontWeight: "900", marginBottom: 4 },
  notesInsightBody: { color: C.textSec, fontSize: 12, lineHeight: 18, fontWeight: "600" },
  remindersPane: { gap: 9 },
  reminderComposer: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 7, paddingLeft: 12, paddingRight: 5, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.bg },
  reminderInput: { flex: 1, color: C.text, fontSize: 13, fontWeight: "600" },
  reminderAddButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 17, backgroundColor: C.brand },
  reminderRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 3 },
  reminderText: { flex: 1, color: C.text, fontSize: 12, lineHeight: 17, fontWeight: "700" },
  remindersEmpty: { color: C.textMuted, fontSize: 11, fontWeight: "600", paddingVertical: 4 },
  smallAddButton: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 11, borderRadius: 18, backgroundColor: C.brandSoft },
  smallAddButtonText: { color: C.brand, fontSize: 12, fontWeight: "900" },
  assetSearchBar: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel },
  assetSearchInput: { flex: 1, color: C.text, fontSize: 13, fontWeight: "700" },
  assetLibrary: { gap: 7 },
  assetLibraryRow: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 10, padding: 9, borderRadius: 13, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel },
  assetPreviewThumb: { width: 42, height: 42, overflow: "hidden", alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: C.brandSoft },
  assetPreviewImage: { width: "100%", height: "100%" },
  compactAssetEmpty: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 12, borderRadius: 12, backgroundColor: C.brandSoft },
  compactAssetEmptyText: { color: C.textSec, fontSize: 11, fontWeight: "800" },
  attachmentGrid: { gap: 8 },
  attachmentCard: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 13, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel },
  attachmentIcon: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: C.brandSoft },
  attachmentTitle: { color: C.text, fontSize: 13, fontWeight: "900" },
  attachmentMeta: { color: C.textSec, fontSize: 11, fontWeight: "600", marginTop: 2 },
  emptyAttachmentCard: { minHeight: 112, alignItems: "center", justifyContent: "center", gap: 5, padding: 18, borderRadius: 16, borderWidth: 1.5, borderStyle: "dashed", borderColor: "rgba(0,108,229,0.32)", backgroundColor: C.brandSoft },
  emptyAttachmentTitle: { color: C.text, fontSize: 14, fontWeight: "900" },
  emptyAttachmentCaption: { color: C.textSec, fontSize: 11, lineHeight: 16, fontWeight: "600", textAlign: "center" },
  summaryMessage: { color: C.brand, fontSize: 12, lineHeight: 17, fontWeight: "800", textAlign: "center" },
  infoBlock: { gap: 6, paddingBottom: 2 },
  sectionTitle: { color: C.text, fontSize: 18, fontWeight: "900" },
  infoBody: { color: C.text, fontSize: 15, lineHeight: 22, fontWeight: "600" },
  promptGrid: { gap: 8 },
  promptCard: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel },
  promptCardText: { flex: 1, color: C.text, fontSize: 13, fontWeight: "800" },
  transcriptList: { padding: 16, gap: 8, paddingBottom: 20 },
  notice: { flexDirection: "row", gap: 9, padding: 11, borderRadius: 12, backgroundColor: C.brandSoft, marginBottom: 4 },
  noticeText: { flex: 1, color: C.textSec, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  transcriptRow: { flexDirection: "row", gap: 10, paddingVertical: 9 },
  transcriptRowInterim: { opacity: 0.84 },
  speakerDot: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(109,134,255,0.22)" },
  speakerDotProspect: { backgroundColor: "rgba(72,168,255,0.22)" },
  speakerInitial: { color: C.text, fontSize: 12, fontWeight: "900" },
  transcriptBody: { flex: 1, minWidth: 0, gap: 4 },
  transcriptMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  transcriptSpeaker: { color: C.text, fontSize: 14, fontWeight: "900" },
  transcriptTime: { color: C.textMuted, fontSize: 12, fontWeight: "800" },
  transcriptCopy: { color: C.text, fontSize: 15, lineHeight: 22, fontWeight: "600" },
  interimCopy: { color: C.textSec, fontStyle: "italic" },
  transcriptionButton: { alignSelf: "center", minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 16, borderRadius: 22, backgroundColor: C.brandSoft, marginTop: 4 },
  transcriptionButtonText: { color: C.bgDeep, fontSize: 13, fontWeight: "900" },
  chatPane: { flex: 1, minHeight: 0 },
  chatList: { flex: 1, minHeight: 0 },
  chatListContent: { gap: 10, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12 },
  emptyChat: { alignItems: "center", gap: 8, padding: 22 },
  emptyChatTitle: { color: C.text, fontSize: 19, fontWeight: "900", textAlign: "center" },
  emptyChatBody: { color: C.textSec, fontSize: 14, lineHeight: 20, fontWeight: "700", textAlign: "center" },
  emptyPromptGrid: { alignSelf: "stretch", gap: 10, marginTop: 14 },
  emptyPromptBubble: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(0,108,229,0.18)",
    borderRadius: 18,
    backgroundColor: C.bgDeep,
  },
  emptyPromptText: { color: C.text, fontSize: 14, lineHeight: 18, fontWeight: "900", textAlign: "center" },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
  chatBubble: { maxWidth: "92%", borderRadius: 14, padding: 12, gap: 4 },
  chatUser: { alignSelf: "flex-end", backgroundColor: "rgba(109,134,255,0.22)" },
  chatAssistant: { alignSelf: "flex-start", width: "92%", backgroundColor: C.panel },
  chatRole: { color: C.textMuted, fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  chatCopy: { color: C.text, fontSize: 15, lineHeight: 22, fontWeight: "600" },
  chatError: { color: C.red, fontSize: 13, fontWeight: "800" },
  chatFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
    backgroundColor: C.bg,
    paddingTop: 10,
    paddingHorizontal: 18,
    gap: 8,
  },
  promptStrip: { gap: 8, paddingBottom: 2 },
  promptChip: {
    minHeight: 36,
    maxWidth: 180,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.line,
  },
  promptChipText: { color: C.textSec, fontSize: 12, fontWeight: "800" },
  composer: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 27,
    backgroundColor: C.bgDeep,
  },
  composerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  chatInput: {
    flex: 1,
    minHeight: 34,
    maxHeight: 96,
    color: C.text,
    fontSize: 16,
    fontWeight: "700",
    paddingTop: Platform.OS === "ios" ? 8 : 6,
    paddingBottom: Platform.OS === "ios" ? 8 : 6,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.brand,
  },
  sendButtonActive: {
    backgroundColor: C.brand,
  },
  sendButtonDisabled: {
    backgroundColor: "#C7D7EA",
  },
  notesPane: { flex: 1, padding: 22, gap: 12 },
  notesInput: { flex: 1, color: C.text, fontSize: 17, lineHeight: 25, fontWeight: "600", padding: 14, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel },
  bottomDockOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    paddingHorizontal: 18,
    paddingBottom: Platform.OS === "ios" ? 20 : 14,
    gap: 10,
    backgroundColor: C.bg,
    overflow: "visible",
  },
  bottomDock: { paddingHorizontal: 18, paddingBottom: Platform.OS === "ios" ? 20 : 14, gap: 10, backgroundColor: C.bg },
  startError: { color: C.red, fontSize: 12, fontWeight: "800", textAlign: "center" },
  permissionPopover: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 118,
    alignItems: "center",
    zIndex: 40,
  },
  permissionCard: {
    minHeight: 40,
    maxWidth: 340,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: C.brandSoft,
    shadowColor: "#101828",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  permissionText: { flex: 1, color: "#0B2740", fontSize: 13, fontWeight: "800" },
  permissionClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(16,24,40,0.06)",
  },
  permissionCaret: {
    width: 12,
    height: 12,
    marginTop: -6,
    backgroundColor: C.brandSoft,
    transform: [{ rotate: "45deg" }],
  },
  waveLine: { width: "100%", height: 34, flexDirection: "row", alignItems: "center", overflow: "hidden" },
  waveHalf: { flex: 1, height: 34, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4, overflow: "hidden" },
  waveHalfLeft: { paddingRight: 6 },
  waveHalfRight: { paddingLeft: 6 },
  waveBar: { width: 3, borderRadius: 2, backgroundColor: C.brand },
  waveTime: { width: 58, color: C.text, fontSize: 15, fontWeight: "900", fontVariant: ["tabular-nums"], textAlign: "center", backgroundColor: C.bg },
  recordControls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  roundControl: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "#E4EAF2" },
  controlPressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  stopControl: { minWidth: 142, height: 54, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 16, borderRadius: 27, backgroundColor: C.brand, shadowColor: C.brand, shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.2, shadowRadius: 11, elevation: 3 },
  stopControlPressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  stopControlText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  readyActions: { minHeight: 62, alignItems: "center", justifyContent: "center" },
  startRecordingButton: { alignSelf: "center", minWidth: 220, minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 22, borderRadius: 29, backgroundColor: C.brand, shadowColor: C.brand, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 3 },
  startRecordingButtonDisabled: { backgroundColor: "#5AA8F7" },
  startRecordingText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  uploadRecordingButton: { position: "absolute", right: 0, bottom: 2, minWidth: 58, minHeight: 52, alignItems: "center", justifyContent: "center", gap: 2, paddingHorizontal: 6, borderRadius: 16, borderWidth: 1, borderColor: "rgba(0,108,229,0.18)", backgroundColor: C.brandSoft },
  uploadRecordingText: { color: C.brand, fontSize: 10, fontWeight: "900" },
  cancelConfirmContent: { alignItems: "center" },
  cancelConfirmTopRow: { alignSelf: "stretch", minHeight: 38, alignItems: "flex-end", justifyContent: "center" },
  cancelConfirmClose: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: "#F2F4F7" },
  cancelConfirmIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center", marginTop: 2, marginBottom: 10, borderRadius: 24, backgroundColor: "#F2F4F7" },
  cancelConfirmTitle: { color: C.text, fontSize: 21, fontWeight: "900", textAlign: "center" },
  cancelConfirmCopy: { maxWidth: 310, marginTop: 6, color: C.textSec, fontSize: 13, lineHeight: 19, fontWeight: "600", textAlign: "center" },
  cancelConfirmActions: { alignSelf: "stretch", gap: 10, marginTop: 20 },
  cancelRecordingButton: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: "#D0D5DD", borderRadius: 26, backgroundColor: "#fff" },
  cancelRecordingButtonText: { color: C.textSec, fontSize: 14, fontWeight: "900" },
  continueRecordingButton: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 28, backgroundColor: C.brand, shadowColor: C.brand, shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.2, shadowRadius: 11, elevation: 3 },
  continueRecordingButtonText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  finishConfirmContent: { alignItems: "center", gap: 9 },
  finishConfirmTopRow: { alignSelf: "stretch", minHeight: 34, alignItems: "flex-end", justifyContent: "center" },
  finishConfirmIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center", marginBottom: 2, borderRadius: 24, backgroundColor: C.brandSoft },
  finishConfirmTitle: { color: C.text, fontSize: 21, fontWeight: "900", textAlign: "center" },
  finishConfirmCopy: { maxWidth: 320, marginBottom: 7, color: C.textSec, fontSize: 13, lineHeight: 18, fontWeight: "600", textAlign: "center" },
  completeSessionCard: { alignSelf: "stretch", minHeight: 70, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, borderRadius: 18, backgroundColor: C.brand, shadowColor: C.brand, shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.18, shadowRadius: 11, elevation: 3 },
  completeSessionCardIcon: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 17, backgroundColor: "rgba(255,255,255,0.18)" },
  completeSessionCardTitle: { color: "#fff", fontSize: 14, fontWeight: "900" },
  completeSessionCardCopy: { marginTop: 2, color: "rgba(255,255,255,0.76)", fontSize: 10, fontWeight: "700" },
  finishCountdownBadge: { minWidth: 43, height: 30, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, paddingHorizontal: 7, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.18)" },
  finishCountdownText: { color: "#fff", fontSize: 13, fontWeight: "900", fontVariant: ["tabular-nums"] },
  continueSessionCard: { alignSelf: "stretch", minHeight: 64, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: "rgba(0,108,229,0.16)", borderRadius: 18, backgroundColor: C.brandSoft },
  continueSessionCardIcon: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 17, backgroundColor: "#fff" },
  continueSessionCardTitle: { color: C.text, fontSize: 14, fontWeight: "900" },
  continueSessionCardCopy: { marginTop: 2, color: C.textSec, fontSize: 10, fontWeight: "700" },
  sheetBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.58)" },
  uploadSheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: C.bg, paddingHorizontal: 18, paddingBottom: Platform.OS === "ios" ? 34 : 20 },
  agentIdentityToggle: { minHeight: 82, flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderWidth: 1, borderColor: C.line, borderRadius: 16, backgroundColor: C.panel },
  agentIdentityToggleSelected: { borderColor: "rgba(0,108,229,0.42)", backgroundColor: C.brandSoft },
  agentIdentityCheck: { width: 24, height: 24, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: C.textMuted, borderRadius: 8, backgroundColor: C.bg },
  agentIdentityCheckSelected: { borderColor: C.brand, backgroundColor: C.brand },
  agentIdentityTitle: { color: C.text, fontSize: 14, fontWeight: "900" },
  agentIdentityCopy: { marginTop: 3, color: C.textSec, fontSize: 11, lineHeight: 16, fontWeight: "600" },
  chooseUploadButton: { minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, marginTop: 14, borderRadius: 27, backgroundColor: C.brand },
  chooseUploadButtonText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  personSheet: { maxHeight: "88%", minHeight: "58%", borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: C.bg, paddingHorizontal: 18, paddingBottom: Platform.OS === "ios" ? 32 : 18 },
  sheetHandle: { width: 40, height: 4, alignSelf: "center", borderRadius: 2, backgroundColor: "#51606F", marginTop: 9, marginBottom: 14 },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  assetSheetTitle: { color: C.text, fontSize: 20, fontWeight: "900" },
  assetSheetSubtitle: { color: C.textSec, fontSize: 12, marginTop: 2, fontWeight: "700" },
  assetClose: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: C.panel },
  assetBackButton: { width: 52, height: 46, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: C.brandSoft },
  assetViewerContent: { paddingBottom: 0 },
  assetViewerList: { gap: 8, paddingBottom: 18 },
  assetViewerThumb: { width: 64, height: 52, overflow: "hidden", alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: C.brandSoft },
  assetSheetList: { flexGrow: 0 },
  assetPickRow: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: 11, padding: 9, borderWidth: 1, borderColor: C.line, borderRadius: 14, backgroundColor: C.panel },
  assetPickTitle: { color: C.text, fontSize: 13, fontWeight: "800" },
  assetPickMeta: { color: C.textSec, fontSize: 11, marginTop: 2, fontWeight: "600" },
  assetPreviewHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  assetPreviewContent: { gap: 12, paddingBottom: 16 },
  assetPreviewStage: { flex: 1, minHeight: 280, maxHeight: 440, overflow: "hidden", borderWidth: 1, borderColor: C.line, borderRadius: 18, backgroundColor: "#E9EEF5" },
  assetPreviewMedia: { width: "100%", height: "100%" },
  assetPreviewFallback: { flex: 1, alignItems: "center", justifyContent: "center", gap: 9 },
  assetPreviewFallbackText: { color: C.textSec, fontSize: 12, fontWeight: "800" },
  assetPreviewDescription: { color: C.textSec, fontSize: 13, lineHeight: 19, fontWeight: "600" },
  assetPreviewActions: { flexDirection: "row", gap: 10, paddingTop: 2 },
  assetPreviewAction: { flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1, borderColor: C.line, borderRadius: 13, backgroundColor: C.panel },
  assetPreviewActionText: { color: C.text, fontSize: 13, fontWeight: "900" },
  personModeTabs: { flexDirection: "row", gap: 5, padding: 4, marginBottom: 14, borderRadius: 15, backgroundColor: "#EEF1F5" },
  personModeTab: { flex: 1, minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12 },
  personModeTabActive: { backgroundColor: "#fff", shadowColor: "#101828", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 5, elevation: 2 },
  personModeTabText: { color: C.textMuted, fontSize: 12, fontWeight: "900" },
  personModeTabTextActive: { color: C.brand },
  personModeBody: { flexShrink: 1 },
  personQrPanel: { alignItems: "center", gap: 9, paddingBottom: 8 },
  personRealtimeStatus: { minHeight: 30, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 11, borderRadius: 15, backgroundColor: C.brandSoft },
  personRealtimeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.textMuted },
  personRealtimeDotLive: { backgroundColor: C.green },
  personRealtimeText: { color: C.textSec, fontSize: 11, fontWeight: "800" },
  personQrCard: { width: 232, height: 232, alignItems: "center", justifyContent: "center", borderRadius: 26, backgroundColor: "#fff", shadowColor: "#101828", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 22, elevation: 5 },
  personQrCode: { backgroundColor: "#fff", borderRadius: 20 },
  personQrTitle: { color: C.text, fontSize: 17, fontWeight: "900" },
  personQrCopy: { maxWidth: 310, color: C.textSec, fontSize: 12, lineHeight: 17, fontWeight: "600", textAlign: "center" },
  personQrLink: { maxWidth: 330, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 6, paddingVertical: 3 },
  personQrUrl: { flexShrink: 1, color: C.brand, fontSize: 10, lineHeight: 14, fontWeight: "700", textAlign: "center", textDecorationLine: "underline" },
  personQrLoading: { minHeight: 310, alignSelf: "stretch", alignItems: "center", justifyContent: "center", gap: 9, paddingHorizontal: 24, borderWidth: 1, borderColor: C.line, borderRadius: 20, backgroundColor: C.panel },
  personQrLoadingTitle: { color: C.text, fontSize: 16, fontWeight: "900", textAlign: "center" },
  personQrLoadingCopy: { color: C.textSec, fontSize: 12, lineHeight: 18, fontWeight: "600", textAlign: "center" },
  personRetryButton: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 14, borderRadius: 20, backgroundColor: C.brandSoft },
  personRetryText: { color: C.brand, fontSize: 12, fontWeight: "900" },
  personForm: { gap: 12, paddingBottom: 10 },
  personNameRow: { flexDirection: "row", gap: 10 },
  summaryField: { flex: 1, gap: 6 },
  summaryFieldLabel: { color: C.textSec, fontSize: 11, fontWeight: "800" },
  summaryFieldInput: { minHeight: 48, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, color: C.text, fontSize: 14, fontWeight: "600" },
  summarySelectField: { gap: 6 },
  summarySelectOptions: { gap: 6, paddingRight: 8 },
  summarySelectOption: { minHeight: 34, justifyContent: "center", paddingHorizontal: 12, borderWidth: 1, borderColor: "#d7dae3", borderRadius: 999, backgroundColor: C.panel },
  summarySelectOptionActive: { borderColor: C.brand, backgroundColor: "#eff6ff" },
  summarySelectOptionText: { color: C.textSec, fontSize: 12, fontWeight: "700" },
  summarySelectOptionTextActive: { color: C.brand },
  personError: { color: C.red, fontSize: 12, lineHeight: 17, fontWeight: "800" },
  personPrimaryButton: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 26, backgroundColor: C.brand, marginTop: 2 },
  personShareButton: { minWidth: 252, paddingHorizontal: 24 },
  personPrimaryButtonText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  personDetailContent: { gap: 14, paddingBottom: 10 },
  personDetailHeader: { flexDirection: "row", alignItems: "center", gap: 11 },
  personDetailAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: C.brand },
  personDetailAvatarText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  personDetailName: { color: C.text, fontSize: 20, fontWeight: "900" },
  personDetailCard: { paddingHorizontal: 13, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel },
  detailLine: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  detailLineIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: C.brandSoft },
  detailLineLabel: { color: C.textMuted, fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  detailLineValue: { color: C.text, fontSize: 13, lineHeight: 18, fontWeight: "700", marginTop: 2, textTransform: "none" },
  emptyState: { padding: 24, alignItems: "center", gap: 6 },
  emptyTitle: { color: C.text, fontSize: 14, fontWeight: "800" },
  emptySubtitle: { color: C.textSec, fontSize: 12, textAlign: "center" },
  flex1: { flex: 1 },
  disabled: { opacity: 0.5 },
});
