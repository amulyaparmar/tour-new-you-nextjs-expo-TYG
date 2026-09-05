import { Ionicons } from "@expo/vector-icons";
import { setAudioModeAsync } from "expo-audio";
import { LinearGradient } from "expo-linear-gradient";
import * as SecureStore from "expo-secure-store";
import { useVideoPlayer, VideoView } from "expo-video";
import { WebView } from "react-native-webview";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
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
  TextInput,
  useWindowDimensions,
  View,
  FlatList,
} from "react-native";
import Reanimated, {
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutRight,
  withTiming,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CustomText } from "@/components/custom-text";
import { TourCheckInFormModal } from "@/components/check-in/tour-check-in-form-modal";
import { ShowCheckInQrModal } from "@/components/check-in/show-check-in-qr-modal";
import { LoadingDots } from "@/components/loading-dots";
import { BottomSheetModal } from "@/components/bottom-sheet-modal";
import { glassNavContentInset } from "@/components/glass-nav-header";
import { LiquidGlassIconButton } from "@/components/liquid-glass-icon-button";
import {
  PAGE_SHEET_HEADER_INSET,
  PageSheetModal,
} from "@/components/page-sheet-modal";
import { SecondaryButton } from "@/components/secondary-button";
import { SessionModeTabs } from "@/components/session/session-mode-tabs";
import { TourScreenHeader } from "@/components/session/tour-screen-header";
import { ACCENT, BACKGROUND, CARD, HINT, LARGE_CORNER, SMALL_CORNER, TEXT } from "@/theme/tokens";
import { tourColors as C } from "@/theme/tour-brand";
import {
  appendDictationText,
  formatRecordingUploadTitle,
  isRecordingUploadTitle,
  type SessionAttachment,
  type SessionLead,
} from "@tour/shared";
import type { LiveSessionChatMessage, Material } from "../api";
import {
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
import { mergeTranscriptLines, speakerInitial } from "./liveTranscript";
import { useRecording } from "./RecordingProvider";
import { useMuseLiveTranscription } from "./useMuseLiveTranscription";
import { ElevenLabsDictationButton } from "../components/ElevenLabsDictationButton";
import {
  useSessionParticipantRealtime,
} from "../session-participants-realtime";

type Tab = "summary" | "transcript" | "ai";
const RECORDING_TABS: { id: Tab; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "transcript", label: "Transcript" },
  { id: "ai", label: "AI Chat" },
];
const DEFAULT_PROMPTS = [
  "Ask about move-in date",
  "Confirm must-haves",
  "Mention pet policy",
  "Offer floor plan options",
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
type NoteAccessory = "ai" | "reminders" | null;

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

type LiveTranscriptLine = {
  id: string;
  speaker: string;
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
  /** The host and scroll surfaces share the same pixel-based sheet position. */
  sheetOffset: SharedValue<number>;
  sheetHeight: SharedValue<number>;
  sheetClosing: SharedValue<boolean>;
  isPresented: boolean;
  onSwipeDown: () => void;
  /** Begin recording as soon as the experience opens. */
  autoStart?: boolean;
  /** Rubrics/materials or the native recorder are still starting. */
  preparing?: boolean;
};

function transcriptText(lines: LiveTranscriptLine[]) {
  return lines.map((line) => `[${formatElapsed(line.time)}] ${line.speaker}: ${line.text}`).join("\n");
}

function estimatedUtteranceStart(text: string, elapsed: number) {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const estimatedDuration = Math.min(8, Math.max(0.8, wordCount / 2.5));
  return Math.max(0, elapsed - estimatedDuration);
}

function personInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

function slugifyRep(name: string | null | undefined) {
  const slug = (name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || null;
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

function fmtAssetDate(value: string | null | undefined) {
  if (!value) return "Unscheduled";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isVideoLikeUrl(url: string) {
  if (/^file:\/\//i.test(url)) return true;
  return /\.(mp4|mov|m4v|webm)(?:[?#].*)?$/i.test(url);
}

function isPanoramaMaterial(material: Material) {
  if (/\/api\/recordings\/panorama-[^/]+\.jpe?g(?:[?#].*)?$/i.test(material.fileUrl ?? "")) {
    return true;
  }
  if (!material.parsedText) return false;
  try {
    const metadata = JSON.parse(material.parsedText) as { kind?: unknown; projection?: unknown };
    return metadata.kind === "panorama-360" || metadata.projection === "equirectangular";
  } catch {
    return false;
  }
}

function RecordingAssetGridCard({
  name,
  meta,
  previewUrl,
  panorama,
  canPlay,
  canOpen,
  width,
  onPress,
}: {
  name: string;
  meta: string;
  previewUrl: string | null;
  panorama: boolean;
  canPlay: boolean;
  canOpen: boolean;
  width: number;
  onPress: () => void;
}) {
  return (
    <View style={{ width }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Preview ${name}`}
        onPress={onPress}
        style={({ pressed }) => [s.assetGridCard, pressed && s.pressed]}
      >
        <View style={s.assetGridThumb}>
          {previewUrl ? (
            <Image source={{ uri: previewUrl }} style={s.assetGridThumbImage} resizeMode="cover" />
          ) : (
            <View style={s.assetGridFallback}>
              <Ionicons
                name={canPlay ? "play" : canOpen ? "image-outline" : "document-outline"}
                size={22}
                color={ACCENT}
              />
            </View>
          )}
          <LinearGradient
            pointerEvents="none"
            colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.58)"]}
            style={s.assetGridCaptionFade}
          />
          {panorama ? (
            <View style={s.assetGridPanoramaBadge}>
              <Ionicons name="globe-outline" size={12} color={CARD} />
              <CustomText textStyle="micro" style={s.assetGridPanoramaText}>360°</CustomText>
            </View>
          ) : canPlay ? (
            <View pointerEvents="none" style={s.assetGridPlayWrap}>
              <View style={s.assetGridPlayBadge}>
                <Ionicons name="play" size={13} color={CARD} />
              </View>
            </View>
          ) : null}
          <View pointerEvents="none" style={s.assetGridCaption}>
            <CustomText textStyle="title" numberOfLines={1} style={s.assetGridCaptionTitle}>{name}</CustomText>
            <CustomText textStyle="micro" numberOfLines={1} style={s.assetGridCaptionMeta}>{meta}</CustomText>
          </View>
        </View>
      </Pressable>
    </View>
  );
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
  cancelDisabled = false,
  cancelIcon = "chevron-down",
  sessionId,
  agentName,
  prospectName,
  propertyName,
  onBeforeRecordingStart,
  onUploadFile,
  onSessionCreated,
  sheetClosing,
  onSwipeDown,
  autoStart = false,
  preparing = false,
}: RecordingExperienceProps) {
  const rec = useRecording();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<Tab>("summary");
  const [hasStarted, setHasStarted] = useState(rec.isRecording);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [selectedAssetPreview, setSelectedAssetPreview] = useState<RecordingAssetPreview | null>(null);
  const [uploadSheetOpen, setUploadSheetOpen] = useState(false);
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
  const [checkInFormOpen, setCheckInFormOpen] = useState(false);
  const [checkInQrOpen, setCheckInQrOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<SessionLead | null>(null);
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
  const summaryRef = useAnimatedRef<ScrollView>();
  const listRef = useRef<FlatList<LiveTranscriptLine>>(null);
  const chatListRef = useAnimatedRef<ScrollView>();
  const lastFinalTextRef = useRef("");
  const localUtteranceStartedAtRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);
  const autoStartAttemptedRef = useRef(false);
  const speechStartedRef = useRef(false);
  const ensuringSessionRef = useRef<Promise<string | null> | null>(null);
  const dictationPausedSessionRef = useRef(false);
  const liveSpeech = useLiveSpeechTranscription();
  const sessionPaused = rec.isPaused;
  const wasSessionPausedRef = useRef(sessionPaused);
  const sessionElapsed = rec.elapsed;
  const muse = useMuseLiveTranscription({
    enabled: transcriptionRequested && hasStarted && !sessionPaused,
    sessionId: resolvedSessionId,
    elapsed: sessionElapsed,
  });
  const nativeFallbackRequested = transcriptionRequested
    && hasStarted
    && !sessionPaused
    && muse.shouldUseNativeFallback;
  const chatFocused = activeTab === "ai";
  const chatComposerMode = chatFocused && hasStarted;
  const recorderStarting = preparing || starting || (autoStart && !hasStarted && !startError);
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
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const nextLevel = hasStarted && !sessionPaused ? Math.max(0.08, Math.min(1, meteringRef.current)) : 0.08;
      setWaveformHistory((current) => [...current.slice(-(LIVE_WAVE_BARS_PER_SIDE - 1)), nextLevel]);
    }, 90);
    return () => clearInterval(timer);
  }, [hasStarted, sessionPaused]);
  const minimizeSheet = useCallback(() => {
    if (cancelDisabled) return;
    Keyboard.dismiss();
    onSwipeDown();
  }, [cancelDisabled, onSwipeDown]);

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
    if (!chatFocused) {
      setKeyboardHeight(0);
      return;
    }
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
  }, [chatFocused]);

  useEffect(() => {
    if (!nativeFallbackRequested) {
      stopSpeechEngineSafely();
      speechStartedRef.current = false;
      if (sessionPaused) setTranscriptionStatus("Transcription paused. Resume to continue.");
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
  }, [nativeFallbackRequested, sessionPaused, liveSpeech.isRecording]);

  useEffect(() => {
    if (!nativeFallbackRequested) return;
    const text = liveSpeech.text.trim();
    if (!text || liveSpeech.isFinal || localUtteranceStartedAtRef.current !== null) return;
    localUtteranceStartedAtRef.current = sessionElapsed;
  }, [liveSpeech.isFinal, liveSpeech.text, nativeFallbackRequested, sessionElapsed]);

  // Apple may not emit a final utterance before its engine is stopped. Keep the
  // visible interim as a placeholder until Muse replaces the recovered range.
  const wasNativeFallbackRequestedRef = useRef(nativeFallbackRequested);
  useEffect(() => {
    const justPaused = sessionPaused && !wasSessionPausedRef.current;
    const fallbackWasActive = wasNativeFallbackRequestedRef.current;
    const fallbackJustEnded = fallbackWasActive && !nativeFallbackRequested && !sessionPaused;
    wasSessionPausedRef.current = sessionPaused;
    wasNativeFallbackRequestedRef.current = nativeFallbackRequested;
    if ((!justPaused && !fallbackJustEnded) || !fallbackWasActive) return;

    const text = liveSpeech.text.trim();
    if (!text || text === lastFinalTextRef.current) return;
    lastFinalTextRef.current = text;
    setFinalTranscriptLines((current) => [
      ...current,
      {
        id: `fallback-final-${Date.now()}-${current.length}`,
        speaker: "Speaker",
        time: localUtteranceStartedAtRef.current ?? estimatedUtteranceStart(text, sessionElapsed),
        text,
      },
    ]);
    localUtteranceStartedAtRef.current = null;
  }, [liveSpeech.text, nativeFallbackRequested, sessionElapsed, sessionPaused]);

  // Some native recognizers stop after each final utterance. Restart only while
  // local fallback owns transcription and the engine reports stopped.
  useEffect(() => {
    if (!nativeFallbackRequested || !SpeechTranscriber || sessionPaused) return;
    if (!liveSpeech.isFinal) return;
    if (liveSpeech.isRecording) return;
    if (isFatalSpeechInitError(liveSpeech.error) || isFatalSpeechInitError(transcriptionStatus)) return;

    speechStartedRef.current = false;
    setTranscriptionStatus("Restarting speech recognition…");

    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled || sessionPaused || !nativeFallbackRequested) return;
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
    nativeFallbackRequested,
    liveSpeech.isFinal,
    liveSpeech.isRecording,
    liveSpeech.error,
    sessionPaused,
    transcriptionStatus,
  ]);

  useEffect(() => {
    if (!nativeFallbackRequested) return;
    if (!liveSpeech.error) return;
    if (isRecoverableSpeechSilence(liveSpeech.error)) return;
    setTranscriptionStatus(liveSpeech.error);
    if (isFatalSpeechInitError(liveSpeech.error)) {
      // Don't keep hammering Apple's recognizer — it won't recover without device setup.
      speechStartedRef.current = false;
    }
  }, [liveSpeech.error, nativeFallbackRequested]);

  useEffect(() => {
    if (!nativeFallbackRequested) return;
    if (liveSpeech.isRecording) {
      speechStartedRef.current = true;
      setTranscriptionStatus(null);
    }
  }, [nativeFallbackRequested, liveSpeech.isRecording]);

  useEffect(() => {
    if (!nativeFallbackRequested) return;
    const text = liveSpeech.text.trim();
    if (!text || !liveSpeech.isFinal || text === lastFinalTextRef.current) return;

    lastFinalTextRef.current = text;
    setFinalTranscriptLines((current) => [
      ...current,
      {
        id: `final-${Date.now()}-${current.length}`,
        speaker: "Speaker",
        time: localUtteranceStartedAtRef.current ?? estimatedUtteranceStart(text, sessionElapsed),
        text,
      },
    ]);
    localUtteranceStartedAtRef.current = null;
  }, [liveSpeech.isFinal, liveSpeech.text, nativeFallbackRequested, sessionElapsed]);

  const completedTranscriptLines = useMemo(
    () => mergeTranscriptLines(finalTranscriptLines, muse.turns, muse.recoveredRanges),
    [finalTranscriptLines, muse.recoveredRanges, muse.turns]
  );
  const currentTranscriptLine = useMemo<LiveTranscriptLine | null>(() => {
    if (muse.partial?.text.trim()) return muse.partial;
    const currentText = liveSpeech.text.trim();
    const shouldShowLocalInterim = nativeFallbackRequested
      && currentText
      && (!liveSpeech.isFinal || currentText !== lastFinalTextRef.current);
    if (!shouldShowLocalInterim) return null;
    return {
      id: "local-interim",
      speaker: "Speaker",
      time: localUtteranceStartedAtRef.current ?? sessionElapsed,
      text: currentText,
      isInterim: true,
    };
  }, [liveSpeech.isFinal, liveSpeech.text, muse.partial, nativeFallbackRequested, sessionElapsed]);
  const liveTranscript = useMemo<LiveTranscriptLine[]>(
    () => currentTranscriptLine
      ? [...completedTranscriptLines, currentTranscriptLine]
      : completedTranscriptLines,
    [completedTranscriptLines, currentTranscriptLine]
  );

  useEffect(() => {
    if (activeTab !== "transcript" || liveTranscript.length === 0 || sheetClosing.value) return;
    const frame = requestAnimationFrame(() => {
      try {
        listRef.current?.scrollToEnd({ animated: true });
      } catch {
        // The list may not have a measured size yet during tab switches.
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [activeTab, currentTranscriptLine?.text, liveTranscript.length, sheetClosing]);

  useEffect(() => {
    const latest = [...liveTranscript].reverse().find((line) => line.text.trim());
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
    const timer = setTimeout(() => {
      if (sheetClosing.value) return;
      chatListRef.current?.scrollToEnd({ animated: true });
    }, 80);
    return () => clearTimeout(timer);
  }, [chatFocused, chatMessages, chatBusy, chatStreaming, chatListRef, sheetClosing]);

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
  const filteredGridAssets = useMemo(() => {
    const attachedMaterialIds = new Set(
      filteredAttachments
        .map((attachment) => attachment.materialId)
        .filter((id): id is string => Boolean(id)),
    );
    return filteredAssets.filter((asset) => !attachedMaterialIds.has(asset.id));
  }, [filteredAssets, filteredAttachments]);
  const assetGridCardWidth = (windowWidth - 40) / 2;
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
    setCheckInFormOpen(true);
    void ensureLiveSessionId();
  }

  function openCheckInQr() {
    setCheckInQrOpen(true);
    void ensureLiveSessionId();
  }

  function openAssets() {
    Keyboard.dismiss();
    setAssetSearch("");
    setSelectedAssetPreview(null);
    setAssetSheetOpen(true);
  }

  function closeAssets() {
    setSelectedAssetPreview(null);
    setAssetSearch("");
    setAssetSheetOpen(false);
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

      // Start file recording first. Live capture starts afterward via its own lifecycle.
      const started = await rec.start();
      if (!started) {
        setStartError("Could not start recording.");
        return;
      }

      setHasStarted(true);
      void activationPromise;
      void ensureLiveSessionId();
      // Let the recorder settle before opening the live PCM stream.
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
    if (preparing || !autoStart || autoStartAttemptedRef.current || hasStarted || starting) return;
    autoStartAttemptedRef.current = true;
    void startSessionRecording();
  }, [preparing, autoStart, hasStarted, starting]);

  function selectTab(tab: Tab) {
    setActiveTab(tab);
  }

  function handleHeaderBack() {
    if (cancelDisabled) return;
    if (hasStarted || minimizeOnClose) {
      minimizeSheet();
      return;
    }
    cancelledRef.current = true;
    setStarting(false);
    stopNativeTranscription();
    void onCancel();
  }

  const finishRequestedRef = useRef(false);

  function completeSessionRecording() {
    if (finishRequestedRef.current) return;
    finishRequestedRef.current = true;
    stopNativeTranscription();
    void onFinish();
  }

  function finishRecording() {
    finishRequestedRef.current = false;
    Alert.alert(
      "Finish this tour?",
      "The recording will stop and begin processing.",
      [
        { text: "Keep recording", style: "cancel" },
        {
          text: "Finish",
          style: "default",
          isPreferred: true,
          onPress: completeSessionRecording,
        },
      ],
    );
  }

  function deleteRecording() {
    stopNativeTranscription();
    void onCancel();
  }

  function confirmDeleteRecording() {
    Alert.alert(
      "Delete this recording?",
      "This recording will be deleted and cannot be recovered.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: deleteRecording,
        },
      ],
    );
  }

  function dismissPermissionTip() {
    setPermissionTipVisible(false);
    void SecureStore.setItemAsync(PERMISSION_TIP_KEY, "1");
  }

  const renderTranscript = ({ item }: { item: LiveTranscriptLine }) => (
    <View style={[s.transcriptRow, item.isInterim && s.transcriptRowInterim]}>
      <View style={[s.speakerDot, item.speaker === "Prospect" && s.speakerDotProspect]}>
        <CustomText textStyle="caption" style={s.speakerInitial}>{speakerInitial(item.speaker)}</CustomText>
      </View>
      <View style={s.transcriptBody}>
        <View style={s.transcriptMeta}>
          <CustomText textStyle="label" style={s.transcriptSpeaker}>{item.speaker}</CustomText>
          <CustomText textStyle="caption" style={s.transcriptTime}>{formatElapsed(item.time)}</CustomText>
        </View>
        <CustomText textStyle="body" style={[s.transcriptCopy, item.isInterim && s.interimCopy]}>{item.text}</CustomText>
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
    <View style={s.root}>
    <KeyboardAvoidingView
      style={s.flex1}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      enabled={chatFocused && keyboardOpen}
      keyboardVerticalOffset={0}
    >
      <View style={[s.sheet, showBottomDock && s.sheetWithDock]}>
        <View>
          <View style={{ height: glassNavContentInset(insets.top) }} />
          <View style={s.tabWrap}>
            <SessionModeTabs value={activeTab} onChange={selectTab} items={RECORDING_TABS} />
          </View>
        </View>

        <View style={s.content}>
          {activeTab === "summary" && (
            <Reanimated.ScrollView
              ref={summaryRef}
              scrollEventThrottle={16}
              onAccessibilityEscape={handleHeaderBack}
              contentContainerStyle={s.summaryContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            >
              <View style={s.checkedInSection}>
                <CustomText textStyle="title" style={s.checkedInTitle}>Checked-In</CustomText>
                <ScrollView
                  horizontal
                  keyboardShouldPersistTaps="handled"
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.peopleStrip}
                >
                  {participants.map((person) => (
                    <Pressable
                      key={`${person.createdAt}-${person.email ?? person.phone ?? person.name}`}
                      onPress={() => openPerson(person)}
                      style={({ pressed }) => [s.personBubbleWrap, pressed && s.pressed]}
                    >
                      <View style={s.personBubble}>
                        <CustomText textStyle="label" style={s.personBubbleText}>{personInitials(person.name)}</CustomText>
                      </View>
                      <CustomText textStyle="micro" style={s.personBubbleName} numberOfLines={1}>{person.firstName || person.name.split(" ")[0]}</CustomText>
                    </Pressable>
                  ))}
                  {!participants.length && prospectName ? (
                    <View style={s.personBubbleWrap}>
                      <View style={s.personBubble}><CustomText textStyle="label" style={s.personBubbleText}>{personInitials(prospectName)}</CustomText></View>
                      <CustomText textStyle="micro" style={s.personBubbleName} numberOfLines={1}>{prospectName.split(" ")[0]}</CustomText>
                    </View>
                  ) : null}
                  <Pressable onPress={openAddPerson} style={({ pressed }) => [s.personBubbleWrap, pressed && s.pressed]}>
                    <View style={s.addPersonBubble}><Ionicons name="add" size={28} color={ACCENT} /></View>
                    <CustomText textStyle="micro" style={s.addPersonLabel}>Check in</CustomText>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Show QR and check-in link"
                    onPress={openCheckInQr}
                    style={({ pressed }) => [s.qrLinkBubbleWrap, pressed && s.pressed]}
                  >
                    <View style={s.qrLinkBubble}><Ionicons name="link-outline" size={24} color={C.textSec} /></View>
                    <CustomText textStyle="micro" style={s.qrLinkLabel} numberOfLines={2}>Show QR/link</CustomText>
                  </Pressable>
                </ScrollView>
              </View>

              <View style={s.assetsButtonWrap}>
                <SecondaryButton
                  label="Assets"
                  icon="folder-open-outline"
                  onPress={openAssets}
                />
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
                  <CustomText textStyle="micro" style={s.autosaveText}>{summarySaving ? "Saving…" : "Autosaved"}</CustomText>
                  <View style={s.noteActions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Show AI note"
                      onPress={() => setNoteAccessory((current) => current === "ai" ? null : "ai")}
                      style={[s.noteAction, noteAccessory === "ai" && s.noteActionActive]}
                    >
                      <Ionicons name="sparkles-outline" size={14} color={noteAccessory === "ai" ? ACCENT : C.textSec} />
                      <CustomText textStyle="micro" style={[s.noteActionText, noteAccessory === "ai" && s.noteActionTextActive]}>AI</CustomText>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Show reminders"
                      onPress={() => setNoteAccessory((current) => current === "reminders" ? null : "reminders")}
                      style={[s.noteAction, noteAccessory === "reminders" && s.noteActionActive]}
                    >
                      <Ionicons name="notifications-outline" size={14} color={noteAccessory === "reminders" ? ACCENT : C.textSec} />
                      <CustomText textStyle="micro" style={[s.noteActionText, noteAccessory === "reminders" && s.noteActionTextActive]}>
                        {reminders.length ? `Reminders ${reminders.length}` : "Reminder"}
                      </CustomText>
                    </Pressable>
                  </View>
                </View>
                {noteAccessory === "ai" ? (
                  <View style={s.notesInsightPanel}>
                    <View style={s.notesInsightIcon}><Ionicons name="sparkles-outline" size={18} color={ACCENT} /></View>
                    <View style={s.flex1}>
                      <CustomText textStyle="caption" style={s.notesInsightBody}>
                        {latestAiNote || "AI notes will appear as the session develops."}
                      </CustomText>
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
                        <Ionicons name="add" size={18} color={CARD} />
                      </Pressable>
                    </View>
                    {reminders.map((reminder, index) => (
                      <View key={`${reminder}-${index}`} style={s.reminderRow}>
                        <Ionicons name="ellipse-outline" size={16} color={ACCENT} />
                        <CustomText textStyle="caption" style={s.reminderText}>{reminder}</CustomText>
                      </View>
                    ))}
                    {!reminders.length ? <CustomText textStyle="caption" style={s.remindersEmpty}>Keep next steps here so nothing gets missed.</CustomText> : null}
                  </View>
                ) : null}
              </View>

              {summaryMessage ? <CustomText textStyle="label" style={[s.summaryMessage, s.summaryPad]}>{summaryMessage}</CustomText> : null}
            </Reanimated.ScrollView>
          )}

          {activeTab === "transcript" && (
            <View style={s.transcriptPane}>
              <View style={s.liveTranscriptToolbar}>
                <View style={s.liveTranscriptWave}>
                  {[...waveformBars.left, ...waveformBars.right].map((height, index) => (
                    <LiveWaveBar
                      key={`transcript-wave-${index}`}
                      height={height}
                      opacity={hasStarted ? (sessionPaused ? 0.36 : 0.82) : 0.28}
                    />
                  ))}
                </View>
                <View
                  accessible
                  accessibilityLabel={
                    !muse.internetAvailable
                      ? "Offline. Using device transcription."
                      : muse.status === "streaming"
                        ? "Internet transcription active."
                        : muse.status === "connecting"
                          ? "Connecting internet transcription."
                          : "Using device transcription."
                  }
                  style={s.liveConnectionIndicator}
                >
                  <Ionicons
                    name={
                      !muse.internetAvailable
                        ? "cloud-offline-outline"
                        : muse.status === "streaming"
                          ? "radio-outline"
                          : muse.status === "connecting"
                            ? "sync-outline"
                            : "phone-portrait-outline"
                    }
                    size={16}
                    color={muse.status === "streaming" ? ACCENT : C.textMuted}
                  />
                  <View
                    style={[
                      s.liveConnectionDot,
                      muse.status === "streaming" && s.liveConnectionDotActive,
                      !muse.internetAvailable && s.liveConnectionDotOffline,
                    ]}
                  />
                </View>
              </View>

              <FlatList
                ref={listRef}
                scrollEventThrottle={16}
                onAccessibilityEscape={handleHeaderBack}
                data={liveTranscript}
                renderItem={renderTranscript}
                keyExtractor={(item) => item.id}
                contentContainerStyle={[s.transcriptList, liveTranscript.length === 0 && s.transcriptListEmpty]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <View style={s.emptyState}>
                    <CustomText textStyle="title" style={s.emptyTitle}>
                      {hasStarted ? "Listening…" : "Waiting to start"}
                    </CustomText>
                    <CustomText textStyle="caption" style={s.emptySubtitle}>
                      {transcriptionStatus ?? "The live transcript will appear here as people speak."}
                    </CustomText>
                  </View>
                }
              />
            </View>
          )}

          {activeTab === "ai" && (
            <View style={s.chatPane}>
              <Reanimated.ScrollView
                ref={chatListRef}
                scrollEventThrottle={16}
                onAccessibilityEscape={handleHeaderBack}
                style={s.chatList}
                contentContainerStyle={s.chatListContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                showsVerticalScrollIndicator={false}
              >
                {chatMessages.length === 0 ? (
                  <View style={s.emptyChat}>
                    <Ionicons name="sparkles-outline" size={26} color={ACCENT} />
                    <CustomText textStyle="title" style={s.emptyChatTitle}>Ask Tour AI during the tour</CustomText>
                    <CustomText textStyle="caption" style={s.emptyChatBody}>
                      It uses the session, community, notes, selected assets, and live transcript context.
                    </CustomText>
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
                        <CustomText textStyle="micro" style={s.chatRole}>{message.role === "user" ? "You" : "Tour AI"}</CustomText>
                        {message.role === "assistant" ? (
                          message.content.trim() ? (
                            <LiveChatMarkdown content={message.content} streaming={isStreamingAssistant} />
                          ) : (
                            <ChatTypingIndicator />
                          )
                        ) : (
                          <CustomText textStyle="body" style={s.chatCopy}>{message.content}</CustomText>
                        )}
                      </View>
                    );
                  })
                )}
                {chatError && <CustomText textStyle="label" style={s.chatError}>{chatError}</CustomText>}
              </Reanimated.ScrollView>

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
                      <CustomText textStyle="label" style={s.promptChipText} numberOfLines={1}>
                        {prompt}
                      </CustomText>
                    </Pressable>
                  ))}
                </ScrollView>
                <View style={s.composer}>
                  <TextInput
                    value={chatInput}
                    onChangeText={setChatInput}
                    editable={!chatBusy}
                    placeholder="Ask about this tour…"
                    placeholderTextColor={C.textMuted}
                    multiline
                    textAlignVertical="top"
                    style={s.chatInput}
                  />
                  <View style={s.composerActions}>
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
                      style={[s.sendButton, !canSendChat && s.sendButtonDisabled]}
                    >
                      {chatBusy ? (
                        <LoadingDots size="small" color={CARD} />
                      ) : (
                        <Ionicons name="arrow-up" size={18} color={CARD} />
                      )}
                    </Pressable>
                  </View>
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
          {startError ? <CustomText textStyle="label" style={s.startError}>{startError}</CustomText> : null}
          {permissionTipVisible ? (
            <Reanimated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)} style={s.permissionPopover} pointerEvents="box-none">
              <View style={s.permissionCard}>
                <CustomText textStyle="label" style={s.permissionText}>Always get permission before recording</CustomText>
                <Pressable
                  accessibilityLabel="Dismiss permission tip"
                  hitSlop={10}
                  onPress={dismissPermissionTip}
                  style={s.permissionClose}
                >
                  <Ionicons name="close" size={16} color={TEXT} />
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
            <CustomText textStyle="title" style={s.waveTime}>{formatElapsed(sessionElapsed)}</CustomText>
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
                accessibilityLabel={sessionPaused ? "Resume recording" : "Pause recording"}
                onPress={() => void rec.togglePause()}
                style={({ pressed }) => [s.roundControl, pressed && s.controlPressed]}
              >
                <Ionicons name={sessionPaused ? "play" : "pause"} size={24} color={TEXT} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Finish tour"
                onPress={finishRecording}
                style={({ pressed }) => [s.stopControl, pressed && s.stopControlPressed]}
              >
                <Ionicons name="flag" size={20} color={CARD} />
                <CustomText textStyle="title" style={s.stopControlText}>Finish Tour</CustomText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete recording"
                onPress={confirmDeleteRecording}
                style={({ pressed }) => [s.roundControl, pressed && s.controlPressed]}
              >
                <Ionicons name="trash-outline" size={22} color={C.red} />
              </Pressable>
            </View>
          ) : (
            <View style={s.readyActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Start session"
                disabled={starting || recorderStarting}
                onPress={() => void startSessionRecording()}
                style={[s.startRecordingButton, (starting || recorderStarting) && s.startRecordingButtonDisabled]}
              >
                {starting || recorderStarting ? (
                  <LoadingDots size="small" color={CARD} />
                ) : (
                  <>
                    <Ionicons name="mic" size={22} color={CARD} />
                    <CustomText textStyle="title" style={s.startRecordingText}>Start Session</CustomText>
                  </>
                )}
              </Pressable>
            </View>
          )}
        </Reanimated.View>
      ) : null}

      <Modal visible={uploadSheetOpen} transparent animationType="slide" onRequestClose={() => setUploadSheetOpen(false)}>
        <View style={s.sheetBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setUploadSheetOpen(false)} />
          <View style={s.uploadSheet}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <View style={s.flex1}>
                <CustomText textStyle="title" style={s.assetSheetTitle}>Upload a recording</CustomText>
                <CustomText textStyle="caption" style={s.assetSheetSubtitle}>Confirm your role before choosing the audio or video file.</CustomText>
              </View>
              <Pressable accessibilityLabel="Close upload" onPress={() => setUploadSheetOpen(false)} style={s.assetClose}>
                <Ionicons name="close" size={20} color={TEXT} />
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: uploaderIsAgent }}
              onPress={() => onUploaderIsAgentChange?.(!uploaderIsAgent)}
              style={({ pressed }) => [s.agentIdentityToggle, uploaderIsAgent && s.agentIdentityToggleSelected, pressed && s.pressed]}
            >
              <View style={[s.agentIdentityCheck, uploaderIsAgent && s.agentIdentityCheckSelected]}>
                {uploaderIsAgent ? <Ionicons name="checkmark" size={15} color={CARD} /> : null}
              </View>
              <View style={s.flex1}>
                <CustomText textStyle="label" style={s.agentIdentityTitle}>I am the leasing agent</CustomText>
                <CustomText textStyle="caption" style={s.agentIdentityCopy}>
                  {uploaderIsAgent
                    ? `Use ${agentName?.trim() || "my profile name"} for this session.`
                    : "Leave this off when uploading a recording from another agent."}
                </CustomText>
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
              <Ionicons name="cloud-upload-outline" size={20} color={CARD} />
              <CustomText textStyle="title" style={s.chooseUploadButtonText}>Choose recording</CustomText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <PageSheetModal
        visible={assetSheetOpen}
        title={selectedAssetPreview ? selectedAssetPreview.name : "Assets"}
        onClose={closeAssets}
        leading={
          selectedAssetPreview ? (
            <LiquidGlassIconButton
              icon="chevron-back"
              accessibilityLabel="Back to all assets"
              onPress={() => setSelectedAssetPreview(null)}
            />
          ) : undefined
        }
      >
        {selectedAssetPreview ? (
          <View
            style={[
              s.assetPreviewBody,
              {
                paddingTop: PAGE_SHEET_HEADER_INSET,
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}
          >
            <View style={s.assetPreviewStage}>
              {selectedAssetPreview.kind === "video" && selectedAssetPreview.url ? (
                <RecordingAssetVideoPreview source={selectedAssetPreview.url} />
              ) : selectedAssetPreview.kind === "link" && selectedAssetPreview.url ? (
                <RecordingAssetWebPreview source={selectedAssetPreview.url} />
              ) : selectedAssetPreview.previewUrl ? (
                <Image source={{ uri: selectedAssetPreview.previewUrl }} resizeMode="contain" style={s.assetPreviewMedia} />
              ) : (
                <View style={s.assetPreviewFallback}>
                  <Ionicons name={selectedAssetPreview.kind === "image" ? "image-outline" : "document-outline"} size={48} color={ACCENT} />
                  <CustomText textStyle="caption" style={s.assetPreviewFallbackText}>Preview unavailable</CustomText>
                </View>
              )}
            </View>
            {selectedAssetPreview.description ? <CustomText textStyle="caption" style={s.assetPreviewDescription}>{selectedAssetPreview.description}</CustomText> : null}
            <View style={s.assetPreviewActions}>
              <Pressable onPress={() => void shareSelectedAsset()} style={({ pressed }) => [s.assetPreviewAction, pressed && s.pressed]}>
                <Ionicons name="share-social-outline" size={17} color={TEXT} />
                <CustomText textStyle="label" style={s.assetPreviewActionText}>Share</CustomText>
              </Pressable>
              <Pressable disabled={!selectedAssetPreview.url} onPress={() => void downloadSelectedAsset()} style={({ pressed }) => [s.assetPreviewAction, !selectedAssetPreview.url && s.disabled, pressed && s.pressed]}>
                <Ionicons name="download-outline" size={17} color={TEXT} />
                <CustomText textStyle="label" style={s.assetPreviewActionText}>Download</CustomText>
              </Pressable>
            </View>
          </View>
        ) : (
          <ScrollView
            style={s.assetModalBody}
            contentContainerStyle={[
              s.assetModalList,
              {
                paddingTop: PAGE_SHEET_HEADER_INSET + 8,
                paddingBottom: Math.max(insets.bottom, 16) + 24,
              },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <View style={s.assetModalSearchBar}>
              <Ionicons name="search" size={18} color={C.textMuted} />
              <TextInput
                value={assetSearch}
                onChangeText={setAssetSearch}
                placeholder="Search assets"
                placeholderTextColor={C.textMuted}
                style={s.assetModalSearchInput}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>
            {filteredAttachments.length || filteredGridAssets.length ? (
              <View style={s.assetGrid}>
                {filteredAttachments.map((attachment) => {
                  const url = attachment.url;
                  return (
                    <RecordingAssetGridCard
                      key={`drawer-attachment-${attachment.id}`}
                      name={attachment.name}
                      meta={`${attachment.type} · ${fmtAssetDate(attachment.createdAt)}`}
                      previewUrl={attachment.type === "image" ? url : null}
                      panorama={false}
                      canPlay={attachment.type === "video"}
                      canOpen={Boolean(url)}
                      width={assetGridCardWidth}
                      onPress={() => setSelectedAssetPreview(previewForAttachment(attachment))}
                    />
                  );
                })}
                {filteredGridAssets.map((asset) => {
                  const url = materialUrl(asset);
                  const panorama = isPanoramaMaterial(asset);
                  return (
                    <RecordingAssetGridCard
                      key={`drawer-material-${asset.id}`}
                      name={asset.name}
                      meta={`${asset.type} · ${fmtAssetDate(asset.createdAt)}`}
                      previewUrl={previewUrlForMaterial(asset)}
                      panorama={panorama}
                      canPlay={Boolean(!panorama && url && isVideoLikeUrl(url))}
                      canOpen={Boolean(url)}
                      width={assetGridCardWidth}
                      onPress={() => setSelectedAssetPreview(previewForMaterial(asset))}
                    />
                  );
                })}
              </View>
            ) : (
              <CustomText textStyle="caption" style={s.sectionCaption}>
                {assetSearch.trim() ? "No assets match your search." : "Reusable tour assets will appear here."}
              </CustomText>
            )}
          </ScrollView>
        )}
      </PageSheetModal>

      <TourCheckInFormModal
        visible={checkInFormOpen}
        onClose={() => setCheckInFormOpen(false)}
        property={propertyName?.trim() || "this property"}
        agentName={agentName}
        repSlug={slugifyRep(agentName)}
        sessionId={resolvedSessionId}
        bindingPending={!resolvedSessionId}
        onSubmitted={({ sessionId: nextSessionId, guest }) => {
          if (nextSessionId && nextSessionId !== resolvedSessionId) {
            setResolvedSessionId(nextSessionId);
            rec.setLiveSessionId(nextSessionId);
            onSessionCreated?.(nextSessionId);
          }
          participantKeysRef.current.add(sessionLeadKey(guest));
          onAddParticipant(guest);
        }}
      />

      <ShowCheckInQrModal
        visible={checkInQrOpen}
        onClose={() => setCheckInQrOpen(false)}
        property={propertyName?.trim() || "this property"}
        agentName={agentName}
        sessionId={resolvedSessionId}
        bindingPending={!resolvedSessionId}
      />

      <Modal visible={Boolean(selectedPerson)} transparent animationType="slide" onRequestClose={() => setSelectedPerson(null)}>
        <View style={s.sheetBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedPerson(null)} />
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.personSheet}>
            <View style={s.sheetHandle} />
            {selectedPerson ? (
              <ScrollView contentContainerStyle={s.personDetailContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={s.personDetailHeader}>
                  <View style={s.personDetailAvatar}><CustomText textStyle="label" style={s.personDetailAvatarText}>{personInitials(selectedPerson.name)}</CustomText></View>
                  <View style={s.flex1}>
                    <CustomText textStyle="title" style={s.personDetailName}>{selectedPerson.name}</CustomText>
                    <CustomText textStyle="caption" style={s.assetSheetSubtitle}>Checked in {new Date(selectedPerson.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</CustomText>
                  </View>
                  <Pressable accessibilityLabel="Close person details" onPress={() => setSelectedPerson(null)} style={s.assetClose}>
                    <Ionicons name="close" size={20} color={TEXT} />
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
                  <CustomText textStyle="title" style={s.summaryCardTitle}>Notes about {selectedPerson.firstName || selectedPerson.name.split(" ")[0]}</CustomText>
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
                    {personSaving ? <LoadingDots size="small" color={CARD} /> : <Ionicons name="checkmark" size={17} color={CARD} />}
                    <CustomText textStyle="label" style={s.summarySaveButtonText}>Save person notes</CustomText>
                  </Pressable>
                </View>
                <View style={s.summarySection}>
                  <CustomText textStyle="title" style={s.sectionTitle}>Session assets</CustomText>
                  <CustomText textStyle="caption" style={s.sectionCaption}>These resources are available to everyone in this tour.</CustomText>
                  {visibleAttachments.length ? visibleAttachments.map((attachment) => (
                    <Pressable key={attachment.id} disabled={!attachment.url} onPress={() => {
                      setSelectedPerson(null);
                      setSelectedAssetPreview(previewForAttachment(attachment));
                      setAssetSheetOpen(true);
                    }} style={s.attachmentCard}>
                      <View style={s.attachmentIcon}><Ionicons name={attachment.type === "video" ? "play" : "document-attach-outline"} size={18} color={ACCENT} /></View>
                      <CustomText textStyle="label" style={[s.attachmentTitle, s.flex1]} numberOfLines={1}>{attachment.name}</CustomText>
                      {attachment.url ? <Ionicons name="eye-outline" size={16} color={C.textMuted} /> : null}
                    </Pressable>
                  )) : <CustomText textStyle="caption" style={s.sectionCaption}>No assets have been attached yet.</CustomText>}
                </View>
                {summaryMessage ? <CustomText textStyle="label" style={s.summaryMessage}>{summaryMessage}</CustomText> : null}
              </ScrollView>
            ) : null}
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
      <TourScreenHeader
        onBack={handleHeaderBack}
        backButton={
          <LiquidGlassIconButton
            icon={cancelIcon}
            onPress={handleHeaderBack}
            disabled={cancelDisabled}
            accessibilityLabel={hasStarted || minimizeOnClose ? "Minimize recording" : "Back"}
          />
        }
        title={title?.trim() || "Live Mystery Shopping Calls"}
        onMorePress={recorderStarting ? undefined : () => setOptionsMenuOpen(true)}
        moreAccessibilityLabel="Session options"
      />
      <RecordingOptionsMenu
        visible={optionsMenuOpen}
        onClose={() => setOptionsMenuOpen(false)}
        onUploadRecording={() => setUploadSheetOpen(true)}
        onDeleteRecording={confirmDeleteRecording}
      />
    </View>
  );
}

function RecordingOptionsMenu({
  visible,
  onClose,
  onUploadRecording,
  onDeleteRecording,
}: {
  visible: boolean;
  onClose: () => void;
  onUploadRecording: () => void;
  onDeleteRecording: () => void;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const items = [
    {
      key: "upload",
      icon: "cloud-upload-outline" as const,
      title: "Upload a recording",
      meta: "Choose an audio or video file",
      destructive: false,
      onPress: () => {
        onClose();
        onUploadRecording();
      },
    },
    {
      key: "delete",
      icon: "trash-outline" as const,
      title: "Delete this recording",
      meta: "This cannot be recovered",
      destructive: true,
      onPress: () => {
        onClose();
        setTimeout(onDeleteRecording, 280);
      },
    },
  ];
  const sheetHeight = Math.min(150 + items.length * 64, Math.round(windowHeight * 0.62));

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      host="overlay"
      sheetHeight={sheetHeight}
      sheetStyle={s.optionsSheet}
      dragHeader={
        <View style={s.optionsTitleRow}>
          <View style={s.optionsHeaderCopy}>
            <CustomText textStyle="hero">Session options</CustomText>
          </View>
          <LiquidGlassIconButton
            icon="close"
            accessibilityLabel="Close session options"
            onPress={onClose}
          />
        </View>
      }
    >
      <View style={s.optionsList}>
        {items.map((item) => (
          <Pressable
            key={item.key}
            onPress={item.onPress}
            style={({ pressed }) => [s.optionsItem, pressed && s.optionsItemPressed]}
          >
            <View style={[s.optionsItemIcon, item.destructive && s.optionsItemIconDestructive]}>
              <Ionicons name={item.icon} size={21} color={item.destructive ? C.red : ACCENT} />
            </View>
            <View style={s.flex1}>
              <CustomText textStyle="title" style={item.destructive ? s.optionsItemTitleDestructive : undefined}>
                {item.title}
              </CustomText>
              <CustomText textStyle="micro" style={s.optionsItemMeta}>
                {item.meta}
              </CustomText>
            </View>
            <Ionicons name="chevron-forward" size={17} color={C.textMuted} />
          </Pressable>
        ))}
      </View>
    </BottomSheetModal>
  );
}

function DetailLine({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={s.detailLine}>
      <View style={s.detailLineIcon}><Ionicons name={icon} size={16} color={ACCENT} /></View>
      <View style={s.flex1}>
        <CustomText textStyle="micro" style={s.detailLineLabel}>{label}</CustomText>
        <CustomText textStyle="body" style={s.detailLineValue}>{value}</CustomText>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BACKGROUND, overflow: "visible" },
  sheet: { flex: 1, backgroundColor: BACKGROUND, overflow: "hidden" },
  sheetWithDock: { paddingBottom: Platform.OS === "ios" ? 132 : 120 },
  tabWrap: { paddingTop: 8 },
  content: { flex: 1, minHeight: 0 },
  summaryContent: { paddingTop: 16, paddingBottom: 28, gap: 18 },
  summarySection: { gap: 10, paddingHorizontal: 18 },
  summarySectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  sectionCaption: { color: C.textSec, fontSize: 12, lineHeight: 17, fontWeight: "600", marginTop: 2 },
  checkedInSection: {
    gap: 10,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: CARD,
  },
  checkedInTitle: { paddingHorizontal: 16 },
  peopleStrip: { gap: 14, paddingVertical: 4, paddingHorizontal: 16 },
  personBubbleWrap: { width: 62, alignItems: "center", gap: 6 },
  personBubble: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", backgroundColor: ACCENT },
  personBubbleText: { color: CARD, fontSize: 15, fontWeight: "900" },
  personBubbleName: { width: 62, color: TEXT, fontSize: 11, fontWeight: "800", textAlign: "center" },
  addPersonBubble: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", backgroundColor: HINT },
  addPersonLabel: { color: ACCENT, fontSize: 11, fontWeight: "900" },
  qrLinkBubbleWrap: { width: 78, alignItems: "center", gap: 6 },
  qrLinkBubble: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", backgroundColor: HINT },
  qrLinkLabel: { width: 78, color: C.textSec, fontSize: 11, fontWeight: "900", textAlign: "center" },
  assetsButtonWrap: { paddingHorizontal: 16 },
  summaryCard: { gap: 11, padding: 14, borderRadius: SMALL_CORNER, borderCurve: "continuous", backgroundColor: CARD },
  sessionNotesCard: { gap: 8, padding: 0, paddingHorizontal: 18, borderWidth: 0, backgroundColor: "transparent" },
  summaryCardHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  summaryIcon: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: HINT },
  summaryCardTitle: {},
  summaryCardCaption: { color: C.textSec, fontSize: 11, lineHeight: 16, fontWeight: "600", marginTop: 1 },
  summaryNotesInput: { minHeight: 72, maxHeight: 150, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, color: TEXT, fontSize: 14, lineHeight: 20, fontWeight: "600", backgroundColor: CARD },
  notesFooter: { minHeight: 30, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, paddingHorizontal: 3 },
  autosaveText: { color: C.textMuted, fontSize: 10, fontWeight: "700" },
  summaryPad: { paddingHorizontal: 18 },
  noteActions: { flexDirection: "row", alignItems: "center", gap: 5 },
  noteAction: { minHeight: 28, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 8, borderRadius: 14, backgroundColor: BACKGROUND },
  noteActionActive: { backgroundColor: HINT },
  noteActionText: { color: C.textSec, fontSize: 10, fontWeight: "800" },
  noteActionTextActive: { color: ACCENT },
  assetModalBody: { flex: 1 },
  assetModalSearchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: CARD,
  },
  assetModalSearchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: TEXT,
    paddingVertical: 8,
  },
  assetModalList: { paddingHorizontal: 16, gap: 8 },
  assetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  assetGridCard: {
    overflow: "hidden",
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: BACKGROUND,
  },
  assetGridThumb: {
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: BACKGROUND,
  },
  assetGridThumbImage: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
  },
  assetGridCaptionFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 72,
  },
  assetGridCaption: { position: "absolute", left: 10, right: 10, bottom: 9, gap: 1 },
  assetGridCaptionTitle: { color: CARD },
  assetGridCaptionMeta: { color: "rgba(255,255,255,0.78)", fontSize: 10 },
  assetGridPlayBadge: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
    borderRadius: 15,
    backgroundColor: "rgba(15,23,42,0.86)",
  },
  assetGridPlayWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  assetGridPanoramaBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: "rgba(5,150,105,0.72)",
  },
  assetGridPanoramaText: { color: CARD },
  assetGridFallback: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: SMALL_CORNER,
    backgroundColor: CARD,
  },
  assetPreviewBody: { flex: 1, gap: 12, paddingHorizontal: 16 },
  summarySaveButton: { minHeight: 42, alignSelf: "flex-end", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 15, borderRadius: 21, backgroundColor: ACCENT },
  summarySaveButtonText: { color: CARD, fontSize: 12, fontWeight: "900" },
  notesInsightPanel: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 11, borderRadius: 13, backgroundColor: HINT },
  notesInsightIcon: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: CARD },
  notesInsightTitle: { color: TEXT, fontSize: 12, fontWeight: "900", marginBottom: 4 },
  notesInsightBody: { color: C.textSec, fontSize: 12, lineHeight: 18, fontWeight: "600" },
  remindersPane: { gap: 9 },
  reminderComposer: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 7, paddingLeft: 12, paddingRight: 5, borderRadius: 12, backgroundColor: BACKGROUND },
  reminderInput: { flex: 1, color: TEXT, fontSize: 13, fontWeight: "600" },
  reminderAddButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 17, backgroundColor: ACCENT },
  reminderRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 3 },
  reminderText: { flex: 1, color: TEXT, fontSize: 12, lineHeight: 17, fontWeight: "700" },
  remindersEmpty: { color: C.textMuted, fontSize: 11, fontWeight: "600", paddingVertical: 4 },
  attachmentGrid: { gap: 8 },
  attachmentCard: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 13, backgroundColor: CARD },
  attachmentIcon: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: HINT },
  attachmentTitle: { color: TEXT, fontSize: 13, fontWeight: "900" },
  attachmentMeta: { color: C.textSec, fontSize: 11, fontWeight: "600", marginTop: 2 },
  emptyAttachmentCard: { minHeight: 112, alignItems: "center", justifyContent: "center", gap: 5, padding: 18, borderRadius: 16, backgroundColor: HINT },
  emptyAttachmentTitle: {},
  emptyAttachmentCaption: { color: C.textSec, fontSize: 11, lineHeight: 16, fontWeight: "600", textAlign: "center" },
  summaryMessage: { color: ACCENT, fontSize: 12, lineHeight: 17, fontWeight: "800", textAlign: "center" },
  infoBlock: { gap: 6, paddingBottom: 2 },
  sectionTitle: {},
  infoBody: { color: TEXT, fontSize: 15, lineHeight: 22, fontWeight: "600" },
  promptGrid: { gap: 8 },
  promptCard: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 12, borderRadius: 12, backgroundColor: CARD },
  promptCardText: { flex: 1, color: TEXT, fontSize: 13, fontWeight: "800" },
  transcriptPane: { flex: 1, minHeight: 0 },
  liveTranscriptToolbar: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
    backgroundColor: BACKGROUND,
  },
  liveConnectionIndicator: {
    minWidth: 34,
    height: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  liveConnectionDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.textMuted },
  liveConnectionDotActive: { backgroundColor: ACCENT },
  liveConnectionDotOffline: { backgroundColor: C.amber },
  liveTranscriptWave: {
    flex: 1,
    height: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 3,
    overflow: "hidden",
  },
  transcriptList: { paddingHorizontal: 16, paddingTop: 6, gap: 4, paddingBottom: 20 },
  transcriptListEmpty: { flexGrow: 1, justifyContent: "center" },
  transcriptRow: { flexDirection: "row", gap: 10, paddingVertical: 9 },
  transcriptRowInterim: { opacity: 0.84 },
  speakerDot: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: HINT },
  speakerDotProspect: { backgroundColor: "rgba(0, 108, 229, 0.12)" },
  speakerInitial: { color: TEXT, fontSize: 12, fontWeight: "900" },
  transcriptBody: { flex: 1, minWidth: 0, gap: 4 },
  transcriptMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  transcriptSpeaker: { color: TEXT, fontSize: 14, fontWeight: "900" },
  transcriptTime: { color: C.textMuted, fontSize: 12, fontWeight: "800" },
  transcriptCopy: { color: TEXT, fontSize: 15, lineHeight: 22, fontWeight: "600" },
  interimCopy: { color: C.textSec, fontStyle: "italic" },
  transcriptionButton: { alignSelf: "center", minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 16, borderRadius: 22, backgroundColor: HINT, marginTop: 4 },
  transcriptionButtonText: { color: TEXT },
  chatPane: { flex: 1, minHeight: 0 },
  chatList: { flex: 1, minHeight: 0 },
  chatListContent: { gap: 10, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12 },
  emptyChat: { alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 28, borderRadius: LARGE_CORNER, borderCurve: "continuous", backgroundColor: CARD },
  emptyChatTitle: { textAlign: "center" },
  emptyChatBody: { color: C.textSec, fontSize: 14, lineHeight: 20, fontWeight: "700", textAlign: "center" },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
  chatBubble: { maxWidth: "92%", borderRadius: SMALL_CORNER, borderCurve: "continuous", padding: 12, gap: 4 },
  chatUser: { alignSelf: "flex-end", backgroundColor: HINT },
  chatAssistant: { alignSelf: "flex-start", width: "92%", backgroundColor: CARD },
  chatRole: { color: C.textMuted, fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  chatCopy: { color: TEXT, fontSize: 15, lineHeight: 22, fontWeight: "600" },
  chatError: { color: C.red, fontSize: 13, fontWeight: "800" },
  chatFooter: {
    backgroundColor: BACKGROUND,
    paddingTop: 10,
    paddingHorizontal: 18,
    gap: 10,
  },
  promptStrip: { gap: 8, paddingBottom: 2 },
  promptChip: {
    minHeight: 36,
    maxWidth: 180,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: CARD,
  },
  promptChipText: { color: C.textSec, fontSize: 12, fontWeight: "800" },
  composer: {
    minHeight: 80,
    backgroundColor: CARD,
    borderRadius: LARGE_CORNER,
    borderCurve: "continuous",
    paddingTop: 10,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  chatInput: {
    minHeight: 58,
    paddingRight: 88,
    fontSize: 15,
    fontWeight: "600",
    color: TEXT,
  },
  composerActions: {
    position: "absolute",
    right: 8,
    bottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ACCENT,
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
  notesPane: { flex: 1, padding: 22, gap: 12 },
  notesInput: { flex: 1, color: TEXT, fontSize: 17, lineHeight: 25, fontWeight: "600", padding: 14, borderRadius: 14, backgroundColor: CARD },
  bottomDockOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    paddingHorizontal: 18,
    paddingBottom: Platform.OS === "ios" ? 20 : 14,
    gap: 10,
    backgroundColor: BACKGROUND,
    overflow: "visible",
  },
  bottomDock: { paddingHorizontal: 18, paddingBottom: Platform.OS === "ios" ? 20 : 14, gap: 10, backgroundColor: BACKGROUND },
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
    backgroundColor: HINT,
    shadowColor: TEXT,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  permissionText: { flex: 1, color: TEXT, fontSize: 13, fontWeight: "800" },
  permissionClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BACKGROUND,
  },
  permissionCaret: {
    width: 12,
    height: 12,
    marginTop: -6,
    backgroundColor: HINT,
    transform: [{ rotate: "45deg" }],
  },
  waveLine: { width: "100%", height: 34, flexDirection: "row", alignItems: "center", overflow: "hidden" },
  waveHalf: { flex: 1, height: 34, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4, overflow: "hidden" },
  waveHalfLeft: { paddingRight: 6 },
  waveHalfRight: { paddingLeft: 6 },
  waveBar: { width: 3, borderRadius: 2, backgroundColor: ACCENT },
  waveTime: { width: 58, fontVariant: ["tabular-nums"], textAlign: "center", backgroundColor: BACKGROUND },
  recordControls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  roundControl: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: BACKGROUND },
  controlPressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  stopControl: { minWidth: 158, minHeight: 58, height: 58, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 16, borderRadius: 29, backgroundColor: ACCENT, boxShadow: "0 6px 14px rgba(0, 108, 229, 0.28)" },
  stopControlPressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  stopControlText: { color: CARD },
  readyActions: { minHeight: 62, alignItems: "center", justifyContent: "center" },
  startRecordingButton: { alignSelf: "center", minWidth: 220, minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 22, borderRadius: 29, backgroundColor: ACCENT, boxShadow: "0 6px 14px rgba(0, 108, 229, 0.28)" },
  startRecordingButtonDisabled: { opacity: 0.55 },
  startRecordingText: { color: CARD },
  optionsSheet: {
    overflow: "visible",
    paddingTop: 2,
    paddingHorizontal: 0,
    borderTopLeftRadius: LARGE_CORNER,
    borderTopRightRadius: LARGE_CORNER,
    borderCurve: "continuous",
    backgroundColor: BACKGROUND,
  },
  optionsTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    overflow: "visible",
  },
  optionsHeaderCopy: { flex: 1, minWidth: 0 },
  optionsList: {
    marginTop: 14,
    marginHorizontal: 18,
    overflow: "hidden",
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  optionsItem: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
  },
  optionsItemPressed: { backgroundColor: BACKGROUND },
  optionsItemIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: HINT,
  },
  optionsItemIconDestructive: { backgroundColor: "rgba(255, 59, 48, 0.12)" },
  optionsItemTitleDestructive: { color: C.red },
  optionsItemMeta: { marginTop: 2, color: C.textSec },
  sheetBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.58)" },
  uploadSheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: BACKGROUND, paddingHorizontal: 18, paddingBottom: Platform.OS === "ios" ? 34 : 20 },
  agentIdentityToggle: { minHeight: 82, flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: SMALL_CORNER, borderCurve: "continuous", backgroundColor: CARD },
  agentIdentityToggleSelected: { backgroundColor: HINT },
  agentIdentityCheck: { width: 24, height: 24, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: C.textMuted, borderRadius: 8, backgroundColor: BACKGROUND },
  agentIdentityCheckSelected: { borderColor: ACCENT, backgroundColor: ACCENT },
  agentIdentityTitle: { color: TEXT, fontSize: 14, fontWeight: "900" },
  agentIdentityCopy: { marginTop: 3, color: C.textSec, fontSize: 11, lineHeight: 16, fontWeight: "600" },
  chooseUploadButton: { minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, marginTop: 14, borderRadius: 29, backgroundColor: ACCENT, boxShadow: "0 6px 14px rgba(0, 108, 229, 0.28)" },
  chooseUploadButtonText: { color: CARD },
  personSheet: { maxHeight: "88%", minHeight: "58%", borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: BACKGROUND, paddingHorizontal: 18, paddingBottom: Platform.OS === "ios" ? 32 : 18 },
  sheetHandle: { width: 40, height: 4, alignSelf: "center", borderRadius: 2, backgroundColor: C.textMuted, marginTop: 9, marginBottom: 14 },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  assetSheetTitle: {},
  assetSheetSubtitle: { color: C.textSec, fontSize: 12, marginTop: 2, fontWeight: "700" },
  assetClose: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: CARD },
  assetPreviewStage: { flex: 1, minHeight: 280, maxHeight: 440, overflow: "hidden", borderRadius: 18, backgroundColor: HINT },
  assetPreviewMedia: { width: "100%", height: "100%" },
  assetPreviewFallback: { flex: 1, alignItems: "center", justifyContent: "center", gap: 9 },
  assetPreviewFallbackText: { color: C.textSec, fontSize: 12, fontWeight: "800" },
  assetPreviewDescription: { color: C.textSec, fontSize: 13, lineHeight: 19, fontWeight: "600" },
  assetPreviewActions: { flexDirection: "row", gap: 10, paddingTop: 2 },
  assetPreviewAction: { flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 13, backgroundColor: CARD },
  assetPreviewActionText: { color: TEXT, fontSize: 13, fontWeight: "900" },
  personDetailContent: { gap: 14, paddingBottom: 10 },
  personDetailHeader: { flexDirection: "row", alignItems: "center", gap: 11 },
  personDetailAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: ACCENT },
  personDetailAvatarText: { color: CARD, fontSize: 14, fontWeight: "900" },
  personDetailName: {},
  personDetailCard: { paddingHorizontal: 13, borderRadius: SMALL_CORNER, borderCurve: "continuous", backgroundColor: CARD },
  detailLine: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 10 },
  detailLineIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: HINT },
  detailLineLabel: { color: C.textMuted, fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  detailLineValue: { color: TEXT, fontSize: 13, lineHeight: 18, fontWeight: "700", marginTop: 2, textTransform: "none" },
  emptyState: { padding: 24, alignItems: "center", gap: 6 },
  emptyTitle: { color: TEXT, fontSize: 14, fontWeight: "800" },
  emptySubtitle: { color: C.textSec, fontSize: 12, textAlign: "center" },
  flex1: { flex: 1 },
  disabled: { opacity: 0.5 },
});
