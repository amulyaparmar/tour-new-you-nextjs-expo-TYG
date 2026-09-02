import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Audio } from "expo-av";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import { useVideoPlayer, VideoView } from "expo-video";
import * as VideoThumbnails from "expo-video-thumbnails";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppProviders } from "./src/components/app-providers";
import { LoadingDots } from "./src/components/loading-dots";
import {
  Alert,
  AppState,
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Reanimated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Swipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  type AnalysisResult,
  type ConversationPhaseSegmentation,
  type FollowUpAction,
  type Rubric,
  type SessionAttachment,
  type SessionCustomerInterest,
  type SessionLead,
  type SessionSummary,
  type AudioInsights,
  type AudioInsightsStatus,
  AUDIO_INSIGHTS_STATUS_LABELS,
  buildSessionTourTitle,
  formatPersonName,
  formatSessionCardDescription,
  formatSessionCardMeta,
  defaultMemberPublicAlias,
  defaultPropertyPublicAlias,
  formatRecordingUploadTitle,
  isAgentSpeakerLabel,
  isProspectSpeakerLabel,
  rubricItemCount,
  rubricTotalPoints,
  type ProspectInterestCategory,
} from "@tour/shared";
import {
  findPhaseForTimestamp,
  shortPhaseLabel,
  tourSegmentColor,
} from "./src/conversationPhases";
import {
  type Material,
  type TourLibraryLink,
  type PaginatedSessions,
  applyRubricToSession,
  createCheckInLink,
  createSession,
  type CalendarEvent,
  type SessionComment,
  deleteComment,
  deleteSession,
  fetchActions,
  fetchAnalysis,
  fetchAudioInsights,
  fetchComments,
  fetchCalendarEvents,
  fetchMaterials,
  fetchRubrics,
  fetchSession,
  fetchSessions,
  fetchTranscript,
  postComment,
  processSession,
  syncCalendar,
  materialUrl,
  updateActionStatus,
  uploadRecording,
  uploadMaterial,
  uploadRubric,
} from "./src/api";
import { getApiBaseUrl, getSiteBaseUrl } from "./src/config";
import { computeDashboardMetrics } from "./src/dashboard";
import type { UploadProgressInfo } from "./src/presignedUpload";
import { authorizedCommunitiesForSession, type MobileAuthSession, authenticatedFetch, clearSession, getCurrentSession, restoreSession, switchCommunity, updateWorkspaceAliases } from "./src/auth";
import { useEasUpdateCheck } from "./src/hooks/use-eas-update-check";
import {
  registerForPushNotifications,
  addNotificationResponseListener,
  addNotificationReceivedListener,
} from "./src/push-notifications";
import { trackAnalyticsEvent, setAnalyticsUserId } from "./src/analytics";
import { LoginScreen } from "./src/LoginScreen";
import { TourLogo, TourMark } from "./src/components/TourLogo";
import {
  LiveRecordingCard,
  LiveRecordingDock,
  RecordingExperienceHost,
  RecordingProvider,
  formatElapsed,
  useRecording,
  type LiveSessionSnapshot,
} from "./src/recording";
import {
  deleteLocalSession,
  ensureDurableRecording,
  findLocalSessionByRemoteId,
  getRecordingUri,
  listLocalSessions,
  listRecoverableRecordingSessions,
  markReadyToSync,
  type LocalSessionMeta,
  updateLocalSession,
} from "./src/offline/session-local-store";
import { drainSyncOutbox, isOnline, startSyncOutbox } from "./src/offline/sync-outbox";
import { promoteLocalRecordingToCache, resolveSessionPlaybackUri } from "./src/session-audio-cache";
import { MotionBlock, MotionPressable, AnimatedTabContent } from "./src/components/ui/motion";
import {
  CalendarScreenSkeleton,
  CommentsSkeleton,
  DashboardDataSkeleton,
  MaterialsGridSkeleton,
  RubricsSkeleton,
  SessionsListSkeleton,
} from "./src/components/ui/screen-skeletons";
import {
  CollapsibleSection,
  RubricTab,
  ScoreHero,
  SessionAiChatScreen,
  SessionAudioChatScreen,
  SessionAudioInsightsScreen,
  SessionLiveSkeleton,
  ProspectInsightsCard,
  SessionAiFab,
  SessionModeTabs,
  SessionPlayer,
  SessionReviewSkeleton,
  TourScreenHeader,
  SESSION_PAGE_PADDING,
  type SessionReviewMode,
} from "./src/components/session";
import { tourColors as C, tourColors, scoreColor } from "./src/theme/tour-brand";
import { selectionHaptic, impactHaptic } from "./src/lib/haptics";
import {
  TourBackButton as BackBtn,
  TourEmptyState as EmptyState,
  TourInput as Input,
  TourPrimaryButton as PrimaryBtn,
  TourSegPicker as SegPicker,
  TourStatusBadge,
} from "./src/components/tour";
import { CommunityPickerModal } from "@/components/community-picker-modal";
import { BottomSheetModal } from "@/components/bottom-sheet-modal";
import { CheckInSheet } from "./src/components/check-in/check-in-sheet";
import { useAgentCheckInRealtime } from "./src/session-checkin-realtime";
import { ProfileEditorScreen, resolveCardAccent } from "./src/components/profile/profile-editor-screen";
import { VideoAssetRecorder, type RecordedVideoAsset } from "./src/assets/VideoAssetRecorder";
import {
  type LocalAsset,
  listLocalAssets,
  preserveLocalAsset,
  removeLocalAsset,
  subscribeLocalAssets,
  updateLocalAsset,
} from "./src/assets/local-asset-library";
import {
  queryKeys,
  useCalendarEventsQuery,
  useDeleteCommentMutation,
  useDeleteSessionMutation,
  useInfiniteSessionsQuery,
  useMaterialsQuery,
  usePostCommentMutation,
  useProfileQuery,
  useActionsQuery,
  useAnalysisQuery,
  useAudioInsightsQuery,
  useCommentsQuery,
  useRubricsQuery,
  useSampleSessionQuery,
  useSampleSessionsQuery,
  useSessionQuery,
  useSessionsQuery,
  useTranscriptQuery,
  useUpdateActionStatusMutation,
} from "./src/queries";
import { useAppStore } from "./src/stores/app-store";
import { queryClient as appQueryClient } from "./src/query-client";
import type { SortOption, StatusFilter } from "./src/types/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Text as UiText } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { BulkUploadDock, BulkUploadFlow } from "./src/bulk-upload/BulkUploadFlow";
import { SessionReportScreen } from "./src/reports/SessionReportScreen";
import { PracticeSessionsScreen } from "./src/practice/PracticeSessionsScreen";
import {
  emotionAccessibilityLabel,
  emotionColor,
  emotionIcon,
  matchAudioInsightsToTranscript,
  SessionSentimentTimeline,
} from "./src/components/session/session-sentiment-timeline";

const loginBackground = require("./assets/videos/login-bg.mp4");

type ProspectData = { name: string; email: string; phone: string; moveIn: string; bedrooms: string; budget: string };
type MainTab = "home" | "sessions" | "calendar" | "materials" | "settings";
type Screen =
  | { type: "main"; tab: MainTab }
  | { type: "session-detail"; sessionId: string; sample?: boolean; autoStartRecording?: boolean }
  | { type: "session-comments"; sessionId: string; sessionTitle?: string }
  | { type: "session-ai-chat"; sessionId: string; sessionTitle?: string; prospectName?: string }
  | { type: "session-audio-insights"; sessionId: string; sessionTitle?: string; initialStatus?: AudioInsightsStatus; initialInsights?: AudioInsights | null }
  | { type: "session-audio-chat"; sessionId: string; sessionTitle?: string }
  | { type: "session-report"; sessionId: string }
  | { type: "bulk-upload"; batchId?: string }
  | { type: "create-session" }
  | { type: "audio-test" }
  | { type: "rubrics" }
  | { type: "profile" }
  | { type: "tour" };

type TourStep = "contact" | "preferences" | "ready";
type SlideDirection = "forward" | "back";
const SESSION_REVIEW_MODE_ORDER: SessionReviewMode[] = ["transcript", "rubric", "prospect", "coaching", "comments"];
type UploadPhase = "preparing" | "uploading" | "finalizing";
type UploadStats = {
  phase: UploadPhase;
  percent: number;
  loaded: number;
  total: number | null;
  bytesPerSecond: number | null;
  etaSeconds: number | null;
};
type RecordingUploadFile = {
  uri: string;
  mimeType: string;
  name: string;
  size?: number;
  durationSec?: number;
};
type PendingRecordingUpload = {
  sessionId: string;
  uri: string;
  mimeType: string;
  name: string;
  size?: number;
  durationSec?: number;
  savedAt: number;
};

/** Handed back to Create Session after live recording so the upload journey can remount. */
type PendingCreateSessionUpload = {
  localId: string | null;
  uri: string;
  mimeType: string;
  name: string;
  durationSec?: number;
  sessionId: string | null;
  draft: {
    notes: string;
    prospect: string;
    location: string;
    rubricId: string | null;
    selectedAssetIds: string[];
    uploaderIsAgent?: boolean;
  };
};

function emptyLiveDraft(): LocalSessionMeta["draft"] {
  return {
    notes: "",
    assets: [],
    selectedAssetIds: [],
    participants: [],
    attachments: [],
    prospect: "",
    location: "",
    rubricId: null,
    uploaderIsAgent: false,
  };
}

function sessionStatusLabel(session: SessionSummary): string {
  return STATUS_LABELS[session.status] ?? session.status;
}

const AGENT = {
  name: "Alex Johnson",
  title: "Leasing Consultant",
  property: "Downtown Lofts",
  email: "alex@downtownlofts.com",
  phone: "(512) 555-0189",
  profileUrl: "tour.video/alex-downtown",
};

const tourSteps: Array<{ id: TourStep; label: string }> = [
  { id: "contact", label: "Contact" },
  { id: "preferences", label: "Needs" },
  { id: "ready", label: "Tour" },
];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  scheduled: { bg: "#eaf4ff", text: C.brand },
  in_progress: { bg: C.redBg, text: C.red },
  uploaded: { bg: C.amberBg, text: C.amber },
  transcribing: { bg: C.amberBg, text: C.amber },
  segmenting: { bg: C.amberBg, text: C.amber },
  analyzing: { bg: C.amberBg, text: C.amber },
  analysis_ready: { bg: C.greenBg, text: C.green },
  reviewed: { bg: C.greenBg, text: C.green },
  failed: { bg: C.redBg, text: C.red },
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  in_progress: "In progress",
  uploaded: "Uploaded",
  transcribing: "Processing",
  segmenting: "Processing",
  analyzing: "Analyzing",
  analysis_ready: "Analyzed",
  reviewed: "Reviewed",
  failed: "Failed",
};

const PROCESSING_STATUSES = new Set(["transcribing", "segmenting", "analyzing"]);
const SESSION_PROCESS_STEPS = [
  { id: "uploaded", label: "Uploaded", icon: "cloud-done-outline" },
  { id: "transcribing", label: "Transcript", icon: "mic-outline" },
  { id: "segmenting", label: "Segments", icon: "git-branch-outline" },
  { id: "analyzing", label: "Analysis", icon: "sparkles-outline" },
] as const;

function pendingUploadKey(sessionId: string) {
  return `tour.pendingRecordingUpload.${sessionId}`;
}

async function savePendingRecordingUpload(upload: PendingRecordingUpload & { localId?: string | null }) {
  try {
    if (upload.localId) {
      markReadyToSync(upload.localId, {
        durationSec: upload.durationSec ?? 1,
        sourceUri: upload.uri,
        remoteSessionId: upload.sessionId,
        fileName: upload.name,
        mimeType: upload.mimeType,
      });
      return;
    }
    // Legacy fallback for uploads without a local session folder.
    await SecureStore.setItemAsync(pendingUploadKey(upload.sessionId), JSON.stringify(upload));
  } catch {
    // Best-effort local retry metadata only.
  }
}

async function loadPendingRecordingUpload(sessionId: string): Promise<(PendingRecordingUpload & { localId?: string | null }) | null> {
  try {
    const local = findLocalSessionByRemoteId(sessionId);
    if (local && (local.status === "ready_to_sync" || local.status === "failed" || local.status === "syncing")) {
      const uri = getRecordingUri(local.localId);
      if (uri) {
        return {
          sessionId,
          localId: local.localId,
          uri,
          mimeType: local.mimeType,
          name: local.fileName,
          durationSec: local.durationSec ?? undefined,
          savedAt: Date.parse(local.updatedAt) || Date.now(),
        };
      }
    }
    const raw = await SecureStore.getItemAsync(pendingUploadKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingRecordingUpload;
    return parsed?.uri && parsed?.mimeType && parsed?.name ? parsed : null;
  } catch {
    return null;
  }
}

async function clearPendingRecordingUpload(sessionId: string, localId?: string | null) {
  try {
    // Keep local folders only while live audio is pending upload. After upload,
    // playback uses the audio cache / signed URL — not session meta cards.
    const resolvedLocalId = localId ?? findLocalSessionByRemoteId(sessionId)?.localId ?? null;
    if (resolvedLocalId) deleteLocalSession(resolvedLocalId);
    await SecureStore.deleteItemAsync(pendingUploadKey(sessionId));
  } catch {
    // Best-effort local retry metadata only.
  }
}

function formatBytes(bytes?: number | null) {
  if (!bytes || bytes <= 0) return "Unknown size";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

function formatUploadEta(seconds?: number | null) {
  if (seconds == null || !Number.isFinite(seconds)) return "Calculating ETA";
  if (seconds <= 1) return "Finishing now";
  if (seconds < 60) return `${Math.ceil(seconds)} sec left`;
  return `${Math.ceil(seconds / 60)} min left`;
}

function uploadStatsFromProgress(progress: UploadProgressInfo): UploadStats {
  return {
    phase: progress.percent >= 100 ? "finalizing" : "uploading",
    percent: Math.max(0, Math.min(100, progress.percent)),
    loaded: progress.loaded,
    total: progress.total,
    bytesPerSecond: progress.bytesPerSecond,
    etaSeconds: progress.etaSeconds,
  };
}

function initialUploadStats(total?: number | null): UploadStats {
  return {
    phase: "preparing",
    percent: 0,
    loaded: 0,
    total: total ?? null,
    bytesPerSecond: null,
    etaSeconds: null,
  };
}

function fmtDate(d: string | null) {
  if (!d) return "Unscheduled";
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fmtTime(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function fmtSec(sec: number) {
  const m = Math.floor(sec / 60);
  const ss = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function parseMomentTime(value: string): number | null {
  const parts = value.split(":").map((part) => Number(part.trim()));
  if (parts.some((part) => !Number.isFinite(part))) return null;
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  return null;
}

function PulseDot({ color = C.red }: { color?: string }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(withSequence(
      withTiming(1.45, { duration: 850, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 850, easing: Easing.in(Easing.quad) })
    ), -1, false);
    opacity.value = withRepeat(withSequence(
      withTiming(0.45, { duration: 850 }),
      withTiming(1, { duration: 850 })
    ), -1, false);
  }, [opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return <Reanimated.View style={[st.pulseDot, { backgroundColor: color }, animatedStyle]} />;
}

function AnimatedProgressFill({ percent, color = C.brand }: { percent: number; color?: string }) {
  const progress = useSharedValue(percent);

  useEffect(() => {
    progress.value = withTiming(Math.max(0, Math.min(100, percent)), { duration: 260, easing: Easing.out(Easing.cubic) });
  }, [percent, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${progress.value}%`,
  }));

  return <Reanimated.View style={[st.progressFill, { backgroundColor: color }, animatedStyle]} />;
}

function UploadStatusCard({
  title = "Uploading recording",
  fileName,
  fileSize,
  stats,
  error,
  onRetry,
  onChooseDifferent,
}: {
  title?: string;
  fileName?: string | null;
  fileSize?: number | null;
  stats: UploadStats;
  error?: string | null;
  onRetry?: () => void;
  onChooseDifferent?: () => void;
}) {
  const total = stats.total ?? fileSize ?? null;
  const uploadedText = total ? `${formatBytes(stats.loaded)} of ${formatBytes(total)}` : formatBytes(fileSize);
  const speedText = stats.bytesPerSecond ? `${formatBytes(stats.bytesPerSecond)}/s` : "Waiting for transfer";
  const phaseLabel =
    stats.phase === "preparing" ? "Preparing secure upload"
      : stats.phase === "finalizing" ? "Finalizing recording"
        : "Uploading recording";

  return (
    <View style={[st.card, { padding: 20, gap: 14 }]}>
      <View style={st.uploadHeadingRow}>
        <View style={[st.uploadRing, error && { backgroundColor: C.redBg }]}>
          {error ? <Ionicons name="cloud-offline-outline" size={21} color={C.red} /> : <LoadingDots size="small" color={C.brand} />}
        </View>
        <View style={st.flex1}>
          <Text style={st.formTitle}>{error ? "Upload interrupted" : title}</Text>
          <Text style={[st.pageSub, { marginTop: 2 }]} numberOfLines={error ? 3 : 1}>
            {error || phaseLabel}
          </Text>
        </View>
      </View>

      <View style={st.uploadInfoPanel}>
        <Text style={st.uploadFileName} numberOfLines={1}>{fileName || "Recording file"}</Text>
        <View style={st.progressTrack}><AnimatedProgressFill percent={stats.percent} color={error ? C.red : C.brand} /></View>
        <View style={st.uploadStatsRow}>
          <Text style={st.uploadStatText}>{stats.percent}%</Text>
          <Text style={st.uploadStatText}>{uploadedText}</Text>
        </View>
        <View style={st.uploadStatsRow}>
          <Text style={st.uploadSubStatText}>{speedText}</Text>
          <Text style={st.uploadSubStatText}>{formatUploadEta(stats.etaSeconds)}</Text>
        </View>
      </View>

      {error && (onRetry || onChooseDifferent) ? (
        <View style={{ flexDirection: "row", gap: 10 }}>
          {onRetry ? (
            <Pressable onPress={onRetry} style={({ pressed }) => [st.primaryBtn, { flex: 1 }, pressed && st.pressed]}>
              <Ionicons name="refresh" size={18} color="#fff" />
              <Text style={st.primaryBtnText}>Retry</Text>
            </Pressable>
          ) : null}
          {onChooseDifferent ? (
            <Pressable onPress={onChooseDifferent} style={({ pressed }) => [st.outlineBtn, { flex: 1 }, pressed && st.pressed]}>
              <Text style={st.outlineBtnText}>Choose another</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function screenKey(screen: Screen) {
  if (screen.type === "main") return `main:${screen.tab}`;
  if (screen.type === "session-detail") return `session:${screen.sessionId}`;
  if (screen.type === "session-comments") return `session-comments:${screen.sessionId}`;
  if (screen.type === "session-ai-chat") return `session-ai:${screen.sessionId}`;
  if (screen.type === "session-audio-insights") return `session-audio:${screen.sessionId}`;
  if (screen.type === "session-audio-chat") return `session-audio-chat:${screen.sessionId}`;
  if (screen.type === "session-report") return `session-report:${screen.sessionId}`;
  if (screen.type === "bulk-upload") return `bulk-upload:${screen.batchId ?? "new"}`;
  return screen.type;
}

function screenRank(screen: Screen) {
  if (screen.type === "main") {
    const index = TAB_ITEMS.findIndex((tab) => tab.id === screen.tab);
    return Math.max(0, index);
  }
  if (screen.type === "tour") return 11;
  if (screen.type === "create-session") return 12;
  if (screen.type === "rubrics") return 12;
  if (screen.type === "profile") return 12;
  if (screen.type === "session-detail") return 13;
  if (screen.type === "session-comments") return 14;
  if (screen.type === "session-ai-chat") return 14;
  if (screen.type === "session-audio-insights") return 14;
  if (screen.type === "session-audio-chat") return 15;
  if (screen.type === "session-report") return 14;
  if (screen.type === "bulk-upload") return 13;
  return 0;
}

function displaySessionTitle(session: {
  title?: string | null;
  agentName?: string | null;
  prospectName?: string | null;
  leads?: Array<{ name: string }> | null;
}) {
  return buildSessionTourTitle({
    title: session.title,
    agentName: session.agentName,
    prospectName: session.prospectName ?? session.leads?.[0]?.name,
    preferPeopleTitle: true,
  });
}

function ScreenTransition({
  children,
  transitionKey,
  direction,
}: {
  children: React.ReactNode;
  transitionKey: string;
  direction: SlideDirection;
}) {
  const entering = direction === "forward"
    ? SlideInRight.duration(260).easing(Easing.out(Easing.cubic))
    : SlideInLeft.duration(260).easing(Easing.out(Easing.cubic));
  const exiting = direction === "forward"
    ? SlideOutLeft.duration(180).easing(Easing.in(Easing.cubic))
    : SlideOutRight.duration(180).easing(Easing.in(Easing.cubic));

  return (
    <Reanimated.View
      key={transitionKey}
      entering={entering}
      exiting={exiting}
      style={st.screenTransition}
    >
      {children}
    </Reanimated.View>
  );
}

// ═══════════════════════════════════════
// Toast system
// ═══════════════════════════════════════

let _showToast: ((msg: string, type?: "error" | "success" | "info") => void) | null = null;

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  _showToast = useCallback((msg: string, type?: "error" | "success" | "info") => {
    const t = type ?? "info";
    setToast({ msg, type: t });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const bg = toast?.type === "error" ? C.red : toast?.type === "success" ? C.green : C.brand;
  const iconName: keyof typeof Ionicons.glyphMap = toast?.type === "error" ? "alert-circle" : toast?.type === "success" ? "checkmark-circle" : "information-circle";

  return (
    <View style={{ flex: 1 }}>
      {children}
      {toast && (
        <Pressable onPress={() => setToast(null)} style={[st.toast, { backgroundColor: bg }]}>
          <Ionicons name={iconName} size={18} color="#fff" />
          <Text style={st.toastText}>{toast.msg}</Text>
        </Pressable>
      )}
    </View>
  );
}

function showToast(msg: string, type?: "error" | "success" | "info") {
  _showToast?.(msg, type);
}

function OfflineSyncHost({ onOpenRemoteSession }: { onOpenRemoteSession: (sessionId: string) => void }) {
  const recoveryShownRef = useRef(false);

  useEffect(() => {
    // Local session folders are for live-recording audio recovery/upload only.
    // Drop uploaded or empty meta so stale cards never reappear in the UI.
    for (const session of listLocalSessions()) {
      if (session.status === "uploaded" || !session.draft) {
        if (session.status === "uploaded" || !getRecordingUri(session.localId)) {
          deleteLocalSession(session.localId);
        }
      }
    }
    const stop = startSyncOutbox();
    return stop;
  }, []);

  useEffect(() => {
    if (recoveryShownRef.current) return;
    const recoverable = listRecoverableRecordingSessions().filter(
      (session) => Boolean(getRecordingUri(session.localId) || session.recordingSourceUri),
    );
    if (recoverable.length === 0) return;
    recoveryShownRef.current = true;
    const first = recoverable[0]!;
    Alert.alert(
      "Recover recording?",
      `“${first.title || "Tour conversation"}” was interrupted. Upload the saved audio when you’re back online?`,
      [
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            for (const session of recoverable) deleteLocalSession(session.localId);
          },
        },
        {
          text: "Keep & sync",
          onPress: () => {
            for (const session of recoverable) {
              markReadyToSync(session.localId, {
                durationSec: session.durationSec ?? Math.max(1, session.elapsedSec),
                sourceUri: getRecordingUri(session.localId) ?? session.recordingSourceUri,
                remoteSessionId: session.remoteSessionId,
                draft: session.draft ?? emptyLiveDraft(),
                fileName: session.fileName,
                mimeType: session.mimeType,
              });
            }
            void drainSyncOutbox().then(() => {
              const leftover = listLocalSessions().find((s) => s.localId === first.localId);
              if (!leftover) {
                showToast("Recording uploaded", "success");
                if (first.remoteSessionId) onOpenRemoteSession(first.remoteSessionId);
                return;
              }
              if (leftover.lastError) {
                showToast(leftover.lastError, "error");
                return;
              }
              showToast("Saved on device — will upload when online", "info");
            });
          },
        },
      ],
    );
  }, [onOpenRemoteSession]);

  return null;
}

// ═══════════════════════════════════════
// Root App
// ═══════════════════════════════════════

export default function App() {
  useEasUpdateCheck();
  const player = useVideoPlayer(loginBackground, (vp) => {
    vp.loop = true;
    vp.muted = true;
  });

  const [screen, setScreen] = useState<Screen>({ type: "main", tab: "home" });
  const [authSession, setAuthSession] = useState<MobileAuthSession | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tourStep, setTourStep] = useState<TourStep>("contact");
  const [prospect, setProspect] = useState<ProspectData>({ name: "", email: "", phone: "", moveIn: "", bedrooms: "2 bed", budget: "$2,200 - $2,600" });
  const [transitionDirection, setTransitionDirection] = useState<SlideDirection>("forward");
  const [pendingCreateUpload, setPendingCreateUpload] = useState<PendingCreateSessionUpload | null>(null);

  useEffect(() => {
    restoreSession()
      .then((session) => {
        setAuthSession(session);
        if (session) {
          setAnalyticsUserId(session.workspace.user.id);
          void trackAnalyticsEvent("login");
          void registerForPushNotifications();
        }
      })
      .finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    if (!authSession) return;
    setAnalyticsUserId(authSession.workspace.user.id);
    void registerForPushNotifications();
  }, [authSession?.workspace.user.id]);

  const tourIdx = useMemo(() => tourSteps.findIndex((s) => s.id === tourStep), [tourStep]);
  const routeKey = screen.type === "main" ? "main" : screenKey(screen);
  const nav = useCallback((next: Screen) => {
    setTransitionDirection(screenRank(next) >= screenRank(screen) ? "forward" : "back");
    setScreen(next);
  }, [screen]);

  useEffect(() => {
    const refreshSessions = () => {
      void appQueryClient.invalidateQueries({ queryKey: queryKeys.all() });
    };
    const removeReceived = addNotificationReceivedListener(() => {
      refreshSessions();
    });
    const removeResponse = addNotificationResponseListener((payload) => {
      refreshSessions();
      nav({
        type: "session-detail",
        sessionId: payload.sessionId,
        autoStartRecording: Boolean(payload.autoStartRecording),
      });
    });
    const appStateSub = AppState.addEventListener("change", (next) => {
      if (next === "active") refreshSessions();
    });
    return () => {
      removeReceived();
      removeResponse();
      appStateSub.remove();
    };
  }, [nav]);

  if (authLoading) {
    return (
      <AppProviders>
        <View style={[st.root, st.center]}>
          <StatusBar style="dark" />
          <LoadingDots color={C.brand} size="large" />
        </View>
      </AppProviders>
    );
  }

  if (!authSession) {
    return (
      <AppProviders>
        <StatusBar style="dark" />
        <LoginScreen player={player} onAuthenticated={setAuthSession} />
      </AppProviders>
    );
  }

  const agentName =
    authSession.workspace.user.fullName ??
    authSession.workspace.user.email.split("@")[0] ??
    "Team member";
  const property = authSession.workspace.community.name;

  return (
    <AppProviders>
    <View style={st.root}>
      <StatusBar style="dark" />
      <RecordingProvider onNotify={showToast}>
        <ToastProvider>
          <OfflineSyncHost onOpenRemoteSession={(sessionId) => nav({ type: "session-detail", sessionId })} />
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={st.flex1}>
            <ScreenTransition transitionKey={routeKey} direction={transitionDirection}>
              {screen.type === "main" && (
                <MainTabs
                  key={authSession.workspace.community.id}
                  tab={screen.tab}
                  onTab={(t) => nav({ type: "main", tab: t })}
                  onSession={(id, opts) => nav({
                    type: "session-detail",
                    sessionId: id,
                    autoStartRecording: opts?.autoStartRecording,
                  })}
                  onSampleSession={(id) => nav({ type: "session-detail", sessionId: id, sample: true })}
                  onCreate={() => nav({ type: "create-session" })}
                  onAudioTest={() => nav({ type: "audio-test" })}
                  onGuestRegistration={() => {
                    setTourStep("contact");
                    nav({ type: "tour" });
                  }}
                  onProfile={() => nav({ type: "profile" })}
                  onRubrics={() => nav({ type: "rubrics" })}
                  onSignOut={() => {
                    void clearSession().then(() => {
                      appQueryClient.clear();
                      useAppStore.getState().resetCommunityPicker();
                      setScreen({ type: "main", tab: "home" });
                      setAuthSession(null);
                    });
                  }}
                  authSession={authSession}
                  onAuthSession={setAuthSession}
                  agentName={agentName}
                  property={property}
                />
              )}
              {screen.type === "session-detail" && screen.sample ? (
                <SampleSessionDetailScreen
                  sessionId={screen.sessionId}
                  onBack={() => nav({ type: "main", tab: "sessions" })}
                />
              ) : screen.type === "session-detail" ? (
                <SessionDetailScreen
                  sessionId={screen.sessionId}
                  autoStartRecording={Boolean(screen.autoStartRecording)}
                  onBack={() => nav({ type: "main", tab: "sessions" })}
                  onOpenComments={(meta) => nav({ type: "session-comments", ...meta })}
                  onOpenAiChat={(meta) => nav({ type: "session-ai-chat", ...meta })}
                  onOpenAudioInsights={(meta) => nav({ type: "session-audio-insights", ...meta })}
                  onOpenReport={(sessionId) => nav({ type: "session-report", sessionId })}
                />
              ) : null}
              {screen.type === "session-comments" && (
                <SessionCommentsScreen
                  sessionId={screen.sessionId}
                  sessionTitle={screen.sessionTitle}
                  onBack={() => nav({ type: "session-detail", sessionId: screen.sessionId })}
                />
              )}
              {screen.type === "session-ai-chat" && (
                <SessionAiChatScreen
                  sessionId={screen.sessionId}
                  sessionTitle={screen.sessionTitle}
                  prospectName={screen.prospectName}
                  onBack={() => nav({ type: "session-detail", sessionId: screen.sessionId })}
                />
              )}
              {screen.type === "session-audio-insights" && (
                <SessionAudioInsightsScreen
                  sessionId={screen.sessionId}
                  sessionTitle={screen.sessionTitle}
                  initialStatus={screen.initialStatus}
                  initialInsights={screen.initialInsights ?? null}
                  onBack={() => nav({ type: "session-detail", sessionId: screen.sessionId })}
                  onOpenAudioChat={() => nav({
                    type: "session-audio-chat",
                    sessionId: screen.sessionId,
                    sessionTitle: screen.sessionTitle,
                  })}
                />
              )}
              {screen.type === "session-audio-chat" && (
                <SessionAudioChatScreen
                  sessionId={screen.sessionId}
                  sessionTitle={screen.sessionTitle}
                  onBack={() => nav({
                    type: "session-audio-insights",
                    sessionId: screen.sessionId,
                    sessionTitle: screen.sessionTitle,
                  })}
                />
              )}
              {screen.type === "session-report" && (
                <SessionReportScreen
                  sessionId={screen.sessionId}
                  onBack={() => nav({ type: "session-detail", sessionId: screen.sessionId })}
                  onNotify={showToast}
                />
              )}
              {screen.type === "bulk-upload" && (
                <BulkUploadFlow
                  communityId={authSession.workspace.community.id}
                  propertyName={property}
                  agentName={agentName}
                  initialBatchId={screen.batchId}
                  onBack={() => nav({ type: "main", tab: "sessions" })}
                  onOpenSession={(sessionId) => nav({ type: "session-detail", sessionId })}
                  onNotify={showToast}
                />
              )}
              {screen.type === "create-session" && (
                <CreateSessionScreen
                  onBack={() => nav({ type: "main", tab: "sessions" })}
                  onCreated={(id) => nav({ type: "session-detail", sessionId: id })}
                  onLiveRecordingOpened={() => nav({ type: "main", tab: "home" })}
                  pendingUpload={pendingCreateUpload}
                  onPendingUploadHandled={() => setPendingCreateUpload(null)}
                  onRecordingFinished={(payload) => {
                    setPendingCreateUpload(payload);
                    nav({ type: "create-session" });
                  }}
                  onBulkUpload={() => nav({ type: "bulk-upload" })}
                  agentName={agentName}
                />
              )}
              {screen.type === "audio-test" && <AudioTestScreen onBack={() => nav({ type: "main", tab: "home" })} />}
              {screen.type === "rubrics" && <RubricsScreen session={authSession} onBack={() => nav({ type: "main", tab: "settings" })} onSession={(id) => nav({ type: "session-detail", sessionId: id })} />}
              {screen.type === "profile" && (
                <ProfileEditorScreen
                  session={authSession}
                  onBack={() => nav({ type: "main", tab: "home" })}
                  onSaved={setAuthSession}
                  onStartTour={() => {
                    setTourStep("contact");
                    nav({ type: "tour" });
                  }}
                />
              )}
              {screen.type === "tour" && (
                <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={st.scroll}>
                  <TourStepper session={authSession} idx={tourIdx} prospect={prospect} step={tourStep} onBack={() => nav({ type: "profile" })} onChange={(k, v) => setProspect((c) => ({ ...c, [k]: v }))} onStep={setTourStep} />
                </ScrollView>
              )}
            </ScreenTransition>
            <RecordingExperienceHost />
            <BulkUploadDock
              communityId={authSession.workspace.community.id}
              hidden={screen.type === "bulk-upload"}
              onOpen={(batchId) => nav({ type: "bulk-upload", batchId })}
            />
            <LiveRecordingDock />
          </KeyboardAvoidingView>
        </ToastProvider>
      </RecordingProvider>
    </View>
    </AppProviders>
  );
}

function CommunityTopBar({
  left,
  right,
  property,
  onCommunityPress,
}: {
  left?: React.ReactNode;
  right?: React.ReactNode;
  property: string;
  onCommunityPress: () => void;
}) {
  const propertyLabel = property
    .replace(/\s*(?:[·|—-]\s*)?entrata\s+sync(?:ed|ing)?\b/gi, "")
    .trim() || property;
  return (
    <View style={homeSt.topBar}>
      {left ? <View style={homeSt.topBarSide}>{left}</View> : null}
      <View style={homeSt.topBarCenter}>
        <Pressable
          accessibilityLabel="Switch property"
          onPress={onCommunityPress}
          style={({ pressed }) => [homeSt.propertyPicker, pressed && st.pressed]}
        >
          <View style={homeSt.propertyPickerIcon}>
            <Ionicons name="business" size={13} color={C.brand} />
          </View>
          <Text style={homeSt.propertyPickerText} numberOfLines={1}>{propertyLabel}</Text>
          <Ionicons name="chevron-down" size={15} color={C.textSec} />
        </Pressable>
      </View>
      {right ? <View style={[homeSt.topBarSide, homeSt.topBarSideEnd]}>{right}</View> : null}
    </View>
  );
}

// ═══════════════════════════════════════
// Bottom Tab Navigation
// ═══════════════════════════════════════

const TAB_ITEMS: Array<{ id: MainTab; label: string; icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap }> = [
  { id: "home", label: "Home", icon: "home-outline", iconActive: "home" },
  { id: "sessions", label: "Sessions", icon: "list-outline", iconActive: "list" },
  { id: "calendar", label: "Calendar", icon: "calendar-outline", iconActive: "calendar" },
  { id: "materials", label: "Assets", icon: "folder-outline", iconActive: "folder" },
  { id: "settings", label: "Settings", icon: "settings-outline", iconActive: "settings" },
];

function MainTabs({ tab, onTab, onSession, onSampleSession, onCreate, onAudioTest, onGuestRegistration, onProfile, onRubrics, onSignOut, authSession, onAuthSession, agentName, property }: {
  tab: MainTab;
  onTab: (t: MainTab) => void;
  onSession: (id: string, opts?: { autoStartRecording?: boolean }) => void;
  onSampleSession: (id: string) => void;
  onCreate: () => void;
  onAudioTest: () => void;
  onGuestRegistration: () => void;
  onProfile: () => void;
  onRubrics: () => void;
  onSignOut: () => void;
  authSession: MobileAuthSession;
  onAuthSession: (session: MobileAuthSession) => void;
  agentName: string;
  property: string;
}) {
  const { width: tabBarWidth } = useWindowDimensions();
  const queryClient = useQueryClient();
  const sessionsQuery = useSessionsQuery({ limit: 100 });
  const upcomingSessionsQuery = useSessionsQuery({ limit: 10, upcoming: true, sort: "scheduled_asc" });
  const materialsQuery = useMaterialsQuery();
  const calendarQuery = useCalendarEventsQuery();
  const profileQuery = useProfileQuery();
  const sessions = sessionsQuery.data?.sessions ?? [];
  const upcomingSessions = upcomingSessionsQuery.data?.sessions ?? [];
  const materials = materialsQuery.data?.materials ?? [];
  const tourLibrary = materialsQuery.data?.tourLibrary ?? null;
  const calendarEvents = calendarQuery.data?.events ?? [];
  const profile = profileQuery.data;
  const loading = sessionsQuery.isLoading || upcomingSessionsQuery.isLoading || calendarQuery.isLoading;
  const materialsLoading = materialsQuery.isLoading;
  const [refreshing, setRefreshing] = useState(false);
  const error = sessionsQuery.error ?? upcomingSessionsQuery.error ?? calendarQuery.error ?? materialsQuery.error ?? null;
  const communityPickerOpen = useAppStore((state) => state.communityPickerOpen);
  const communityQuery = useAppStore((state) => state.communityQuery);
  const setCommunityPickerOpen = useAppStore((state) => state.setCommunityPickerOpen);
  const setCommunityQuery = useAppStore((state) => state.setCommunityQuery);
  const resetCommunityPicker = useAppStore((state) => state.resetCommunityPicker);
  const [switchingCommunityId, setSwitchingCommunityId] = useState<string | null>(null);
  const [tabTransitionDirection, setTabTransitionDirection] = useState<SlideDirection>("forward");
  const [checkInOpen, setCheckInOpen] = useState(false);
  const checkInStartingRef = useRef(false);
  const [checkInBinding, setCheckInBinding] = useState<{
    sessionId: string | null;
    url: string | null;
  } | null>(null);
  const [checkInPrompt, setCheckInPrompt] = useState<{
    sessionId: string;
    prospectName: string;
  } | null>(null);
  const handledCheckInIdsRef = useRef(new Set<string>());
  const sessionStatesRef = useRef<Map<string, string> | null>(null);
  const publicMemberAlias = defaultMemberPublicAlias({
    alias: authSession.workspace.teamMember?.alias,
    name: authSession.workspace.teamMember?.name || authSession.workspace.user.fullName,
    email: authSession.workspace.user.email,
    id: authSession.workspace.teamMember?.id || authSession.workspace.user.id,
  });
  const tabIndicatorX = useSharedValue(
    (tabBarWidth / TAB_ITEMS.length) * Math.max(0, TAB_ITEMS.findIndex((item) => item.id === tab)),
  );
  const tabIndicatorStyle = useAnimatedStyle(() => ({
    width: tabBarWidth / TAB_ITEMS.length,
    transform: [{ translateX: tabIndicatorX.value }],
  }));

  useEffect(() => {
    const activeIndex = Math.max(0, TAB_ITEMS.findIndex((item) => item.id === tab));
    tabIndicatorX.value = withSpring((tabBarWidth / TAB_ITEMS.length) * activeIndex, {
      damping: 22,
      stiffness: 210,
      mass: 0.72,
    });
  }, [tab, tabBarWidth, tabIndicatorX]);

  useEffect(() => {
    if (!profile) return;
    const next = getCurrentSession();
    if (next) onAuthSession(next);
  }, [profile, onAuthSession]);

  useEffect(() => {
    setCheckInOpen(false);
    setCheckInBinding(null);
    setCheckInPrompt(null);
    handledCheckInIdsRef.current.clear();
  }, [authSession.workspace.community.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      sessionsQuery.refetch(),
      upcomingSessionsQuery.refetch(),
      calendarQuery.refetch(),
      materialsQuery.refetch(),
      profileQuery.refetch(),
    ]);
    setRefreshing(false);
  }, [calendarQuery, materialsQuery, profileQuery, sessionsQuery, upcomingSessionsQuery]);

  const chooseCommunity = useCallback(async (communityId: string) => {
    if (communityId === authSession.workspace.community.id) {
      setCommunityPickerOpen(false);
      return;
    }
    setSwitchingCommunityId(communityId);
    try {
      const nextSession = await switchCommunity(communityId);
      onAuthSession(nextSession);
      resetCommunityPicker();
      showToast(`Switched to ${nextSession.workspace.community.name}`, "success");
      void queryClient.invalidateQueries({ queryKey: queryKeys.all() });
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : "Could not switch property", "error");
    } finally {
      setSwitchingCommunityId(null);
    }
  }, [authSession.workspace.community.id, onAuthSession, queryClient, resetCommunityPicker]);

  const showScrollView = tab !== "sessions" && tab !== "materials";
  const handleTabPress = useCallback((nextTab: MainTab) => {
    const currentIndex = TAB_ITEMS.findIndex((item) => item.id === tab);
    const nextIndex = TAB_ITEMS.findIndex((item) => item.id === nextTab);
    setTabTransitionDirection(nextIndex >= currentIndex ? "forward" : "back");
    onTab(nextTab);
  }, [onTab, tab]);

  const openSessionCheckIn = useCallback(async () => {
    if (checkInStartingRef.current) return;

    checkInStartingRef.current = true;
    setCheckInBinding({ sessionId: null, url: null });
    setCheckInPrompt(null);
    setCheckInOpen(true);
    try {
      const binding = await createCheckInLink();
      setCheckInBinding(binding);
    } catch (caught) {
      // The check-in sheet can work without a pre-created session. If the
      // binding request fails, the eventual lead submission creates the
      // session and returns its ID.
    } finally {
      checkInStartingRef.current = false;
    }
  }, []);

  const showCheckedInSession = useCallback((sessionId: string) => {
    if (handledCheckInIdsRef.current.has(sessionId)) return;
    handledCheckInIdsRef.current.add(sessionId);

    impactHaptic(Haptics.ImpactFeedbackStyle.Medium);
    void queryClient.invalidateQueries({ queryKey: queryKeys.all() });
    // Show the confirmation immediately. The follow-up request replaces the
    // neutral label with the guest's name without making the agent wait.
    setCheckInPrompt({ sessionId, prospectName: "A guest" });
    void fetchSession(sessionId)
      .then(({ session }) => {
        const prospectName = session.prospectName?.trim()
          || session.leads?.[0]?.name?.trim()
          || "A guest";
        setCheckInPrompt((current) => current?.sessionId === sessionId
          ? { sessionId, prospectName }
          : current,
        );
      })
      .catch(() => {
        // The in-sheet confirmation still gives the agent a reliable route
        // into the live session if this best-effort name lookup fails.
      });
  }, [queryClient]);

  useAgentCheckInRealtime({
    userId: authSession.workspace.user.id,
    onCheckIn: showCheckedInSession,
  });

  // While the agent has the QR open, refresh the scoped session list as a
  // recovery path for a temporarily unavailable Realtime connection.
  useEffect(() => {
    if (!checkInOpen) return;
    const interval = setInterval(() => {
      void sessionsQuery.refetch();
    }, 3_000);
    return () => clearInterval(interval);
  }, [checkInOpen, sessionsQuery.refetch]);

  useEffect(() => {
    if (sessionsQuery.isLoading) return;

    const nextStates = new Map(sessions.map((session) => [session.id, session.status]));
    const previousStates = sessionStatesRef.current;
    sessionStatesRef.current = nextStates;
    if (!previousStates) return;

    const linkedSessionId = checkInBinding?.sessionId ?? null;
    const checkedInSession = sessions.find((session) => {
      if (session.status !== "in_progress") return false;
      if (!previousStates.has(session.id)) return session.source === "qr";
      return previousStates.get(session.id) !== "in_progress" && linkedSessionId === session.id;
    });
    if (checkedInSession) showCheckedInSession(checkedInSession.id);
  }, [checkInBinding?.sessionId, sessions, sessionsQuery.isLoading, showCheckedInSession]);

  return (
    <View style={st.flex1}>
      {showScrollView && (
        <ScreenTransition transitionKey={`tab:${tab}`} direction={tabTransitionDirection}>
          <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={st.mainScroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} />}>
            {error && (
              <ErrorBanner
                message={error instanceof Error ? error.message : "Failed to load data"}
                onRetry={() => void onRefresh()}
              />
            )}
            {tab === "home" && (
              <DashboardScreen
                sessions={sessions}
                upcomingSessions={upcomingSessions}
                materialCount={materials.length}
                tourLibrary={tourLibrary}
                loading={loading}
                onSession={onSession}
                onProfile={onProfile}
                onCheckIn={() => void openSessionCheckIn()}
                onCreate={onCreate}
                onAudioTest={onAudioTest}
                onAssets={() => handleTabPress("materials")}
                onCommunityPress={() => setCommunityPickerOpen(true)}
                agentName={agentName}
                userTitle={profile?.title ?? authSession.workspace.user.title ?? "Leasing Consultant"}
                userPhone={profile?.phone ?? authSession.workspace.user.phone ?? null}
                userEmail={authSession.workspace.user.email}
                cardAccent={profile?.cardAccent ?? authSession.workspace.user.cardAccent ?? "#006CE5"}
                property={property}
              />
            )}
            {tab === "calendar" && <CalendarScreen sessions={sessions} upcomingSessions={upcomingSessions} entrataEvents={calendarEvents} loading={loading} onSession={onSession} onReload={async () => { await calendarQuery.refetch(); }} onCommunityPress={() => setCommunityPickerOpen(true)} property={property} />}
            {tab === "settings" && (
              <SettingsScreen
                session={authSession}
                onSessionChange={onAuthSession}
                onProfile={onProfile}
                onRubrics={onRubrics}
                onSignOut={onSignOut}
              />
            )}
          </ScrollView>
        </ScreenTransition>
      )}

      {tab === "sessions" && (
        <ScreenTransition transitionKey="tab:sessions" direction={tabTransitionDirection}>
          <SessionsListScreen onBack={() => handleTabPress("home")} onCommunityPress={() => setCommunityPickerOpen(true)} onSession={onSession} onSampleSession={onSampleSession} property={property} />
        </ScreenTransition>
      )}

      {tab === "materials" && (
        <ScreenTransition transitionKey="tab:materials" direction={tabTransitionDirection}>
          <MaterialsScreen
            materials={materials}
            tourLibrary={tourLibrary}
            communityId={authSession.workspace.community.id}
            loading={materialsLoading}
            onReload={async () => { await materialsQuery.refetch(); }}
            onBack={() => handleTabPress("home")}
            onCommunityPress={() => setCommunityPickerOpen(true)}
            property={property}
          />
        </ScreenTransition>
      )}

      <View style={st.tabBar}>
        <Reanimated.View pointerEvents="none" style={[st.tabBarIndicator, tabIndicatorStyle]}>
          <View style={st.tabBarIndicatorPill} />
        </Reanimated.View>
        {TAB_ITEMS.map((t) => (
          <Pressable
            key={t.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t.id }}
            onPress={() => {
              selectionHaptic();
              handleTabPress(t.id);
            }}
            style={st.tabBarItem}
          >
            <Ionicons name={tab === t.id ? t.iconActive : t.icon} size={22} color={tab === t.id ? C.brand : C.textMuted} />
            <Text style={[st.tabBarLabel, tab === t.id && st.tabBarLabelActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      <CommunityPickerModal
        visible={communityPickerOpen}
        session={authSession}
        query={communityQuery}
        switchingId={switchingCommunityId}
        onPropertyAdded={(nextSession) => {
          onAuthSession(nextSession);
          resetCommunityPicker();
          showToast(`Added ${nextSession.workspace.community.name}`, "success");
          void queryClient.invalidateQueries();
        }}
        onQueryChange={setCommunityQuery}
        onClose={() => {
          if (!switchingCommunityId) {
            setCommunityPickerOpen(false);
            setCommunityQuery("");
          }
        }}
        onSelect={(communityId) => void chooseCommunity(communityId)}
      />
      {checkInBinding ? (
        <CheckInSheet
          visible={checkInOpen}
          onClose={() => {
            setCheckInOpen(false);
            setCheckInPrompt(null);
          }}
          property={property}
          propertyId={authSession.workspace.community.propertyTygId || authSession.workspace.community.id}
          agentName={agentName}
          agentTitle={profile?.title ?? authSession.workspace.user.title ?? "Leasing Consultant"}
          repSlug={publicMemberAlias}
          sessionId={checkInBinding.sessionId}
          checkInUrl={checkInBinding.url}
          checkedInGuest={checkInPrompt}
          onContinueWithQr={() => setCheckInPrompt(null)}
          onCheckedIn={(sessionId) => {
            setCheckInOpen(false);
            setCheckInBinding(null);
            setCheckInPrompt(null);
            onSession(sessionId, { autoStartRecording: true });
          }}
        />
      ) : null}
      <CheckInStartPrompt
        prompt={checkInOpen ? null : checkInPrompt}
        onClose={() => setCheckInPrompt(null)}
        onStart={() => {
          if (!checkInPrompt) return;
          const { sessionId } = checkInPrompt;
          setCheckInPrompt(null);
          onSession(sessionId, { autoStartRecording: true });
        }}
      />
    </View>
  );
}

function CheckInStartPrompt({
  prompt,
  onClose,
  onStart,
}: {
  prompt: { sessionId: string; prospectName: string } | null;
  onClose: () => void;
  onStart: () => void;
}) {
  return (
    <BottomSheetModal
      visible={Boolean(prompt)}
      onClose={onClose}
      sheetHeight={322}
      contentStyle={checkInPromptSt.content}
    >
      <View style={checkInPromptSt.iconWrap}>
        <Ionicons name="person-add" size={22} color={C.brand} />
      </View>
      <Text style={checkInPromptSt.eyebrow}>CHECK-IN COMPLETE</Text>
      <Text style={checkInPromptSt.title} numberOfLines={2}>
        {prompt?.prospectName ?? "A prospect"} is ready for their tour
      </Text>
      <Text style={checkInPromptSt.copy}>
        Start the live session when you're ready. Recording and tour assistance will open together.
      </Text>
      <View style={checkInPromptSt.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Not now"
          onPress={onClose}
          style={({ pressed }) => [checkInPromptSt.secondaryButton, pressed && st.pressed]}
        >
          <Text style={checkInPromptSt.secondaryText}>Not now</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start tour"
          onPress={onStart}
          style={({ pressed }) => [checkInPromptSt.primaryButton, pressed && st.pressed]}
        >
          <Ionicons name="play" size={17} color="#fff" />
          <Text style={checkInPromptSt.primaryText}>Start Tour</Text>
        </Pressable>
      </View>
    </BottomSheetModal>
  );
}

const checkInPromptSt = StyleSheet.create({
  content: {
    alignItems: "flex-start",
    paddingTop: 4,
  },
  iconWrap: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#EAF3FF",
    marginBottom: 14,
  },
  eyebrow: {
    color: C.brand,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    marginBottom: 5,
  },
  title: {
    color: C.text,
    fontSize: 23,
    fontWeight: "800",
    lineHeight: 29,
  },
  copy: {
    color: C.textSec,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 8,
  },
  actions: {
    alignSelf: "stretch",
    flexDirection: "row",
    gap: 10,
    marginTop: "auto",
    paddingTop: 18,
  },
  secondaryButton: {
    height: 48,
    flex: 0.85,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D0D5DD",
  },
  secondaryText: {
    color: C.textSec,
    fontSize: 15,
    fontWeight: "700",
  },
  primaryButton: {
    height: 48,
    flex: 1.3,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    backgroundColor: C.brand,
  },
  primaryText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
});

// ═══════════════════════════════════════
// Error Banner
// ═══════════════════════════════════════

function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card style={errorBannerSt.card}>
      <CardContent style={errorBannerSt.content}>
        <Ionicons name="cloud-offline-outline" size={18} color={C.red} />
        <UiText style={errorBannerSt.text} numberOfLines={2}>{message}</UiText>
        {onRetry ? (
          <Button variant="ghost" size="icon" onPress={onRetry} style={errorBannerSt.retry}>
            <Ionicons name="refresh" size={16} color={C.brand} />
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

const errorBannerSt = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderColor: "rgba(239,68,68,0.2)",
    backgroundColor: "rgba(239,68,68,0.05)",
    paddingVertical: 12,
  },
  content: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 0 },
  text: { flex: 1, fontSize: 14, fontWeight: "600", color: "#ef4444" },
  retry: { width: 36, height: 36 },
});

// ═══════════════════════════════════════
// Dashboard
// ═══════════════════════════════════════

function DashboardScreen({ sessions, upcomingSessions, materialCount, tourLibrary, loading, onSession, onProfile, onCheckIn, onCreate, onAudioTest, onAssets, onCommunityPress, agentName, userTitle, userPhone, userEmail, cardAccent, property }: {
  sessions: SessionSummary[];
  upcomingSessions: SessionSummary[];
  materialCount: number;
  tourLibrary: TourLibraryLink | null;
  loading: boolean;
  onSession: (id: string, opts?: { autoStartRecording?: boolean }) => void;
  onProfile: () => void;
  onCheckIn: () => void;
  onCreate: () => void;
  onAudioTest: () => void;
  onAssets: () => void;
  onCommunityPress: () => void;
  agentName: string;
  userTitle: string;
  userPhone: string | null;
  userEmail: string;
  cardAccent: string;
  property: string;
}) {
  const todayTours = useMemo(() => {
    const todayKey = new Date().toDateString();
    return upcomingSessions
      .filter((session) =>
        session.status === "in_progress" ||
        (session.scheduledAt && new Date(session.scheduledAt).toDateString() === todayKey)
      )
      .slice(0, 2);
  }, [upcomingSessions]);
  const initials = agentName.split(" ").map((name) => name[0]).join("").slice(0, 2).toUpperCase();
  const accent = resolveCardAccent(cardAccent);

  return (
    <View style={[st.page, { gap: 18 }]}>
      <CommunityTopBar
        property={property}
        onCommunityPress={onCommunityPress}
        left={<TourLogo width={62} />}
      />

      <MotionPressable
        onPress={onProfile}
        haptic="selection"
        entering={FadeInDown.delay(40).duration(420).springify()}
        style={homeSt.profileCard}
      >
        <View style={[homeSt.profileHeader, { backgroundColor: accent }]} />
        <Pressable
          accessibilityLabel="Edit contact profile"
          accessibilityRole="button"
          onPress={(event) => {
            event.stopPropagation();
            onProfile();
          }}
          style={({ pressed }) => [homeSt.profileCardSettings, pressed && st.pressed]}
        >
          <Ionicons name="pencil-outline" size={20} color="#fff" />
        </Pressable>
        <View style={homeSt.profileBody}>
          <View style={[homeSt.profileAvatarLarge, { backgroundColor: accent }]}>
            <Text style={[homeSt.profileAvatarLargeText, { color: "#fff" }]}>{initials}</Text>
          </View>
          <Text style={homeSt.profileNameLarge}>{agentName}</Text>
          <Text style={homeSt.profileRoleLarge}>{userTitle || "Leasing Consultant"}</Text>
          <Text style={homeSt.profileProperty}>{property}</Text>

          <View style={homeSt.contactList}>
            <ProfileContact icon="mail" text={userEmail || "team@tour.video"} />
            <ProfileContact icon="call" text={userPhone?.trim() || "Add phone in profile"} />
          </View>
          <Text style={homeSt.editProfileHint}>Tap to edit card color & details</Text>
        </View>
      </MotionPressable>

      <LiveRecordingCard />

      <View style={homeSt.actionPillRow}>
        <MotionPressable onPress={onCheckIn} haptic="medium" entering={FadeInDown.delay(90)} style={homeSt.checkInPill}>
          <Ionicons name="navigate" size={21} color="#fff" />
          <Text style={homeSt.checkInPillText}>Check-In</Text>
        </MotionPressable>
        <MotionPressable onPress={onCreate} haptic="medium" entering={FadeInDown.delay(120)} style={[homeSt.checkInPill, homeSt.newSessionPill]}>
          <Ionicons name="mic" size={21} color="#fff" />
          <Text style={homeSt.checkInPillText}>New Session</Text>
        </MotionPressable>
      </View>

      {loading ? <DashboardDataSkeleton /> : (
        <>
          {todayTours.length > 0 && (
            <HomeSection title="Needs your attention">
              <View style={homeSt.focusStack}>
                {todayTours.map((session) => (
                  <MotionPressable key={session.id} onPress={() => onSession(session.id)} haptic="selection" style={homeSt.tourCard}>
                    <View style={st.flex1}>
                      <Text style={homeSt.tourTitle} numberOfLines={1}>
                        {displaySessionTitle(session)}
                      </Text>
                      <View style={homeSt.tourMetaRow}>
                        <Text style={homeSt.timePill}>{session.status === "in_progress" ? "Now" : session.scheduledAt ? fmtTime(session.scheduledAt) : "Today"}</Text>
                        <Text style={homeSt.tourMeta} numberOfLines={1}>
                          {formatPersonName(session.prospectName)
                            ?? formatPersonName(session.agentName)
                            ?? "Guest ready for tour"}
                        </Text>
                      </View>
                      {formatSessionCardDescription(session) ? (
                        <Text style={homeSt.tourMeta} numberOfLines={2}>{formatSessionCardDescription(session)}</Text>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
                  </MotionPressable>
                ))}
              </View>
            </HomeSection>
          )}

          <HomeSection title="Assets" action="Open" onAction={onAssets}>
            <MotionPressable
              accessibilityLabel="Open property assets"
              onPress={onAssets}
              haptic="selection"
              style={homeSt.assetLinkCard}
            >
              <View style={[homeSt.assetLinkIcon, tourLibrary && homeSt.assetLinkIconConnected]}>
                <Ionicons name={tourLibrary ? "play" : "folder-outline"} size={22} color={tourLibrary ? "#fff" : C.brand} />
              </View>
              <View style={st.flex1}>
                <Text style={homeSt.assetLinkTitle}>
                  {tourLibrary ? "Tour Library connected" : "Local property assets"}
                </Text>
                <Text style={homeSt.assetLinkMeta}>
                  {tourLibrary
                    ? `${materialCount} local and Tour.video resources`
                    : `${materialCount} resources stored for this property`}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
            </MotionPressable>
          </HomeSection>
        </>
      )}
    </View>
  );
}

function materialPreviewUrl(material: Material) {
  return material.media?.imageUrl ?? material.media?.gifUrl ?? null;
}

async function openMaterial(material: Material) {
  const url = materialUrl(material);
  if (!url) return;
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert("Couldn't open media", "The video link is unavailable right now.");
  }
}

function ProfileContact({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={homeSt.profileContactRow}>
      <View style={homeSt.profileContactIcon}>
        <Ionicons name={icon} size={15} color="#111827" />
      </View>
      <Text style={homeSt.profileContactText} numberOfLines={1}>{text}</Text>
    </View>
  );
}


function HomeSection({ title, action, showLogo = false, onAction, children }: { title: string; action?: string; showLogo?: boolean; onAction?: () => void; children: React.ReactNode }) {
  return (
    <MotionBlock style={{ gap: 12 }}>
      <View style={homeSt.sectionHeader}>
        {showLogo && <TourLogo width={58} />}
        <Text style={homeSt.sectionTitle}>{title}</Text>
        {action && (
          <Pressable onPress={onAction} disabled={!onAction} hitSlop={8} style={({ pressed }) => pressed ? st.pressed : undefined}>
            <Text style={homeSt.sectionAction}>{action}</Text>
          </Pressable>
        )}
      </View>
      {children}
    </MotionBlock>
  );
}

function MetricCard({ icon, label, value, color, delay = 0, live = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; color: string; delay?: number; live?: boolean }) {
  return (
    <Reanimated.View entering={FadeInUp.delay(delay).duration(360).springify()} style={homeSt.metricCard}>
      <Card style={metricSt.card}>
        <CardContent style={metricSt.content}>
          {live ? <PulseDot color={color} /> : <Ionicons name={icon} size={20} color={color} />}
          <UiText style={metricSt.value}>{value}</UiText>
          <UiText style={metricSt.label}>{label}</UiText>
        </CardContent>
      </Card>
    </Reanimated.View>
  );
}

const metricSt = StyleSheet.create({
  card: { gap: 6, borderColor: C.border, paddingVertical: 16 },
  content: { gap: 6, paddingHorizontal: 16, paddingVertical: 0 },
  value: { fontSize: 24, fontWeight: "900", fontVariant: ["tabular-nums"], color: C.text },
  label: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", color: C.textMuted },
});

function CardRow({ icon, title, sub, onPress, destructive = false }: { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string; onPress: () => void; destructive?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => pressed && st.pressed}>
      <Card style={[cardRowSt.card, destructive && cardRowSt.cardDestructive]}>
        <CardContent style={cardRowSt.content}>
          <View style={[cardRowSt.iconWrap, destructive && cardRowSt.iconWrapDestructive]}>
            <Ionicons name={icon} size={22} color={destructive ? C.red : C.brand} />
          </View>
          <View style={st.flex1}>
            <UiText style={[cardRowSt.title, destructive && cardRowSt.titleDestructive]}>{title}</UiText>
            <UiText style={cardRowSt.sub}>{sub}</UiText>
          </View>
          <Ionicons name={destructive ? "log-out-outline" : "chevron-forward"} size={18} color={destructive ? C.red : C.textMuted} />
        </CardContent>
      </Card>
    </Pressable>
  );
}

const cardRowSt = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, borderColor: C.border, paddingVertical: 12 },
  cardDestructive: { borderColor: "#fecdca", backgroundColor: "#fffafa" },
  content: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 0 },
  iconWrap: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#e8f2ff",
  },
  iconWrapDestructive: { backgroundColor: C.redBg },
  title: { fontSize: 14, fontWeight: "900", color: C.text },
  titleDestructive: { color: C.red },
  sub: { marginTop: 2, fontSize: 12, color: C.textSec },
});

function SessionRow({ session, onPress, isLast }: { session: SessionSummary; onPress: () => void; isLast: boolean }) {
  const colors = session.id.startsWith("local:")
    ? { bg: C.amberBg, text: C.amber }
    : (STATUS_COLORS[session.status] ?? { bg: "#eaf4ff", text: C.brand });
  const label = sessionStatusLabel(session);
  return (
    <MotionPressable onPress={onPress} haptic="selection" style={[st.sessionRow, !isLast && st.rowBorder]}>
      <View style={st.flex1}>
        <Text style={st.sessionTitle} numberOfLines={1}>{displaySessionTitle(session)}</Text>
        <Text style={st.sessionMeta} numberOfLines={1}>{formatSessionCardMeta(session)}</Text>
        {formatSessionCardDescription(session) ? (
          <Text style={st.sessionMeta} numberOfLines={2}>{formatSessionCardDescription(session)}</Text>
        ) : null}
      </View>
      <TourStatusBadge label={label} bg={colors.bg} color={colors.text} />
      {session.overallScore !== null && <Text style={[st.scoreNum, { color: scoreColor(session.overallScore) }]}>{session.overallScore}%</Text>}
      <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
    </MotionPressable>
  );
}

// ═══════════════════════════════════════
// Sessions List (paginated + infinite scroll + filters)
// ═══════════════════════════════════════

const FILTER_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "needs_review", label: "Needs review" },
  { value: "feedback", label: "Feedback received" },
];

const SORT_OPTS: { value: SortOption; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "newest", label: "Newest", icon: "arrow-down-outline" },
  { value: "oldest", label: "Oldest", icon: "arrow-up-outline" },
  { value: "score_desc", label: "Score \u2193", icon: "trending-down-outline" },
  { value: "score_asc", label: "Score \u2191", icon: "trending-up-outline" },
];

const SESSIONS_PAGE_SIZE = 20;

const SESSION_SWIPE_DELETE_WIDTH = 88;

function SessionListSwipeRow({
  session,
  isDeleting,
  onOpen,
  onDelete,
  onSwipeOpen,
  onSwipeClose,
  onCloseOpen,
  isAnyOpen,
}: {
  session: SessionSummary;
  isDeleting: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onSwipeOpen: (methods: SwipeableMethods) => void;
  onSwipeClose: (methods: SwipeableMethods) => void;
  onCloseOpen: () => void;
  isAnyOpen: () => boolean;
}) {
  const swipeableRef = useRef<SwipeableMethods | null>(null);
  const needsReview = ["uploaded", "failed", "analysis_ready"].includes(session.status);
  const leads = session.leads ?? [];
  const checkedInSummary = leads.length
    ? `${leads.map((lead) => lead.name).join(", ")} · ${leads.length} checked in`
    : null;
  const badgeLabel = needsReview
    ? "REVIEW"
    : session.status === "in_progress"
      ? "LIVE"
      : "SYNCED";
  const badgeReviewStyle = needsReview;

  return (
    <Swipeable
      ref={swipeableRef}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      containerStyle={slst.swipeContainer}
      onSwipeableOpenStartDrag={() => {
        if (swipeableRef.current) onSwipeOpen(swipeableRef.current);
      }}
      onSwipeableOpen={() => {
        if (swipeableRef.current) onSwipeOpen(swipeableRef.current);
      }}
      onSwipeableClose={() => {
        if (swipeableRef.current) onSwipeClose(swipeableRef.current);
      }}
      renderRightActions={() => (
        <View style={slst.swipeActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete ${session.title}`}
            disabled={isDeleting}
            onPress={() => {
              impactHaptic();
              onDelete();
            }}
            style={({ pressed }) => [slst.deleteAction, (pressed || isDeleting) && slst.deleteActionPressed]}
          >
            {isDeleting ? (
              <LoadingDots color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={20} color="#fff" />
                <Text style={slst.deleteActionText}>Delete</Text>
              </>
            )}
          </Pressable>
        </View>
      )}
    >
      <MotionPressable
        onPress={() => {
          if (isAnyOpen()) {
            onCloseOpen();
            return;
          }
          onOpen();
        }}
        haptic="selection"
        entering={FadeInDown.duration(260).springify()}
        style={[slst.sessionCard, isDeleting && slst.sessionCardDeleting]}
        disabled={isDeleting}
      >
        <View style={st.flex1}>
          <View style={slst.sessionNameRow}>
            {session.status === "in_progress" && <PulseDot color="#f04438" />}
            <Text style={slst.sessionName} numberOfLines={1}>{displaySessionTitle(session)}</Text>
          </View>
          <Text style={slst.sessionMeta} numberOfLines={1}>
            {checkedInSummary || formatSessionCardMeta(session)}
          </Text>
          {formatSessionCardDescription(session) ? (
            <Text style={slst.sessionDescription} numberOfLines={2}>
              {formatSessionCardDescription(session)}
            </Text>
          ) : null}
        </View>
        <View style={slst.sessionRight}>
          <View style={[slst.syncBadge, badgeReviewStyle && slst.reviewBadge]}>
            <Text style={[slst.syncText, badgeReviewStyle && slst.reviewText]}>{badgeLabel}</Text>
          </View>
          {session.overallScore !== null && <Text style={slst.sessionScore}>{session.overallScore}</Text>}
        </View>
      </MotionPressable>
    </Swipeable>
  );
}

function SampleSessionListRow({ session, onOpen }: { session: SessionSummary; onOpen: () => void }) {
  return (
    <MotionPressable
      onPress={onOpen}
      haptic="selection"
      entering={FadeInDown.duration(260).springify()}
      style={[slst.sessionCard, slst.sampleSessionCard]}
    >
      <View style={slst.sampleSessionIcon}>
        <Ionicons name="sparkles" size={18} color={C.ai} />
      </View>
      <View style={st.flex1}>
        <Text style={slst.sessionName} numberOfLines={1}>{displaySessionTitle(session)}</Text>
        <Text style={slst.sessionMeta} numberOfLines={1}>
          {[session.location, session.prospectName].filter(Boolean).join(" · ") || "40Fifty Lofts example"}
        </Text>
      </View>
      <View style={slst.sessionRight}>
        <View style={slst.sampleBadge}><Text style={slst.sampleBadgeText}>SAMPLE</Text></View>
        {session.overallScore !== null && <Text style={slst.sessionScore}>{session.overallScore}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={17} color={C.textMuted} />
    </MotionPressable>
  );
}

function SessionsListScreen({ onBack, onCommunityPress, onSession, onSampleSession, property }: { onBack: () => void; onCommunityPress: () => void; onSession: (id: string) => void; onSampleSession: (id: string) => void; property: string }) {
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showSamples, setShowSamples] = useState(false);

  const search = useAppStore((state) => state.sessionsSearch);
  const statusFilter = useAppStore((state) => state.sessionsStatusFilter);
  const sort = useAppStore((state) => state.sessionsSort);
  const showSort = useAppStore((state) => state.showSessionsSort);
  const showSearch = useAppStore((state) => state.showSessionsSearch);
  const setSearch = useAppStore((state) => state.setSessionsSearch);
  const setStatusFilter = useAppStore((state) => state.setSessionsStatusFilter);
  const setSort = useAppStore((state) => state.setSessionsSort);
  const setShowSort = useAppStore((state) => state.setShowSessionsSort);
  const setShowSearch = useAppStore((state) => state.setShowSessionsSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const deleteSessionMutation = useDeleteSessionMutation();

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const openSwipeableRef = useRef<SwipeableMethods | null>(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), search ? 350 : 0);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const sessionsQuery = useInfiniteSessionsQuery({
    limit: SESSIONS_PAGE_SIZE,
    sort,
    search: debouncedSearch.trim() || undefined,
  });

  // Remote-only list. Local folders hold in-flight live audio, not session cards.
  const sessions = useMemo(
    () => sessionsQuery.data?.pages.flatMap((pageData) => pageData.sessions) ?? [],
    [sessionsQuery.data],
  );
  const total = sessionsQuery.data?.pages[0]?.total ?? sessions.length;
  const sampleSessionsQuery = useSampleSessionsQuery(true);
  const sampleSessions = sampleSessionsQuery.data?.sessions ?? [];
  const samplePropertyName = sampleSessionsQuery.data?.propertyName ?? "1540 Place Apartments";
  const samplesAvailable = sampleSessionsQuery.isSuccess && sampleSessions.length > 0;
  const visibleSessions = showSamples ? sampleSessions : sessions;
  const hasMore = sessionsQuery.hasNextPage;
  const loading = sessionsQuery.isLoading;
  const loadingMore = sessionsQuery.isFetchingNextPage;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await drainSyncOutbox();
    await Promise.all([
      sessionsQuery.refetch(),
      sampleSessionsQuery.refetch(),
    ]);
    setRefreshing(false);
  }, [sampleSessionsQuery, sessionsQuery]);

  const onEndReached = useCallback(() => {
    if (hasMore && !loadingMore && !loading) void sessionsQuery.fetchNextPage();
  }, [hasMore, loadingMore, loading, sessionsQuery]);

  const closeOpenSwipeable = useCallback(() => {
    openSwipeableRef.current?.close();
    openSwipeableRef.current = null;
  }, []);

  const handleSwipeOpen = useCallback((methods: SwipeableMethods) => {
    if (openSwipeableRef.current && openSwipeableRef.current !== methods) {
      openSwipeableRef.current.close();
    }
    openSwipeableRef.current = methods;
  }, []);

  const handleSwipeClose = useCallback((methods: SwipeableMethods) => {
    if (openSwipeableRef.current === methods) {
      openSwipeableRef.current = null;
    }
  }, []);

  const performDeleteSession = useCallback(async (sessionId: string) => {
    if (deletingId) return;
    setDeletingId(sessionId);
    closeOpenSwipeable();
    try {
      await deleteSessionMutation.mutateAsync(sessionId);
      showToast("Session deleted", "success");
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : "Could not delete session", "error");
    } finally {
      setDeletingId(null);
    }
  }, [closeOpenSwipeable, deleteSessionMutation, deletingId]);

  const confirmDeleteSession = useCallback((session: SessionSummary) => {
    Alert.alert(
      "Delete session?",
      `Delete “${session.title}” and its generated analysis? This can’t be undone.`,
      [
        { text: "Cancel", style: "cancel", onPress: closeOpenSwipeable },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => void performDeleteSession(session.id),
        },
      ],
    );
  }, [closeOpenSwipeable, performDeleteSession]);

  const openSession = useCallback((session: SessionSummary) => {
    onSession(session.id);
  }, [onSession]);

  type SessionListItem =
    | { kind: "header"; id: string; label: string; count: number }
    | { kind: "session"; id: string; session: SessionSummary };

  const groupedRows = useMemo<SessionListItem[]>(() => {
    const filteredSessions = visibleSessions.filter((session) => {
      if (showSamples) return true;
      if (statusFilter === "all") return true;
      if (statusFilter === "needs_review") return ["uploaded", "failed", "analysis_ready"].includes(session.status);
      if (statusFilter === "feedback") return ["analysis_ready", "reviewed"].includes(session.status) || session.overallScore !== null;
      return true;
    });

    const label = showSamples
      ? `${samplePropertyName} samples`
      : statusFilter === "needs_review"
          ? "Needs Review"
          : statusFilter === "feedback"
            ? "Feedback Received"
            : "Recent Sessions";

    return filteredSessions.length
      ? [
          { kind: "header" as const, id: `header-${showSamples ? "samples" : statusFilter}`, label, count: filteredSessions.length },
          ...filteredSessions.map((session) => ({ kind: "session" as const, id: session.id, session })),
        ]
      : [];
  }, [samplePropertyName, showSamples, statusFilter, visibleSessions]);

  const renderItem = useCallback(({ item }: { item: SessionListItem }) => {
    if (item.kind === "header") {
      return (
        <Reanimated.View entering={FadeIn.delay(80)} style={slst.groupHeader}>
          <Text style={slst.groupLabel}>{item.label}</Text>
          <View style={slst.groupCount}><Text style={slst.groupCountText}>{item.count}</Text></View>
        </Reanimated.View>
      );
    }
    const session = item.session;
    if (showSamples) {
      return <SampleSessionListRow session={session} onOpen={() => onSampleSession(session.id)} />;
    }
    return (
      <SessionListSwipeRow
        session={session}
        isDeleting={deletingId === session.id}
        onOpen={() => openSession(session)}
        onDelete={() => confirmDeleteSession(session)}
        onSwipeOpen={handleSwipeOpen}
        onSwipeClose={handleSwipeClose}
        onCloseOpen={closeOpenSwipeable}
        isAnyOpen={() => openSwipeableRef.current !== null}
      />
    );
  }, [closeOpenSwipeable, confirmDeleteSession, deletingId, handleSwipeClose, handleSwipeOpen, onSampleSession, onSession, openSession, showSamples]);

  const keyExtractor = useCallback((item: SessionListItem) => item.id, []);
  const sessionMetrics = useMemo(() => computeDashboardMetrics(visibleSessions), [visibleSessions]);
  const averageScore = sessionMetrics.averageScore !== null ? `${sessionMetrics.averageScore}%` : "--";

  const ListHeader = useMemo(() => (
    <View style={slst.header}>
      <CommunityTopBar
        property={property}
        onCommunityPress={onCommunityPress}
        left={
          <Pressable accessibilityLabel="Back to home" onPress={onBack} style={({ pressed }) => [homeSt.headerIcon, pressed && st.pressed]}>
            <Ionicons name="arrow-back" size={22} color={C.text} />
          </Pressable>
        }
        right={
          showSamples ? (
            <Pressable accessibilityLabel="Close sample sessions" onPress={() => setShowSamples(false)} style={homeSt.headerIcon}>
              <Ionicons name="close" size={20} color={C.text} />
            </Pressable>
          ) : (
            <Pressable onPress={() => setShowSearch((value) => !value)} style={homeSt.headerIcon}>
              <Ionicons name={showSearch ? "close" : "search"} size={19} color={C.text} />
            </Pressable>
          )
        }
      />
      <View style={slst.titleRow}>
        <View>
          <Text style={st.pageTitle}>{showSamples ? "Sample sessions" : "Sessions"}</Text>
          {showSamples ? <Text style={slst.sampleHeadingSub}>Curated from {samplePropertyName} · Read only</Text> : null}
        </View>
        <View style={slst.avgPill}>
          <Ionicons name="analytics-outline" size={14} color={sessionMetrics.averageScore !== null ? scoreColor(sessionMetrics.averageScore) : C.brand} />
          <Text style={slst.avgPillValue}>{averageScore}</Text>
          <Text style={slst.avgPillLabel}>Avg</Text>
        </View>
      </View>

      {showSamples ? (
        <Pressable accessibilityRole="button" onPress={() => setShowSamples(false)} style={slst.sampleModeBanner}>
          <View style={slst.sampleModeIcon}><Ionicons name="sparkles" size={16} color={C.ai} /></View>
          <View style={st.flex1}>
            <Text style={slst.sampleModeTitle}>Exploring real examples</Text>
            <Text style={slst.sampleModeSub}>These never affect {property}’s sessions or scores.</Text>
          </View>
          <Text style={slst.sampleModeAction}>Back</Text>
        </Pressable>
      ) : showSearch && (
        <Reanimated.View entering={FadeInDown.duration(220)} style={st.searchBar}>
          <Ionicons name="search-outline" size={18} color={C.textMuted} />
          <TextInput autoFocus placeholder="Search sessions..." placeholderTextColor={C.textMuted} value={search} onChangeText={setSearch} style={st.searchInput} returnKeyType="search" />
        </Reanimated.View>
      )}

      {!showSamples && <ScrollView horizontal nestedScrollEnabled directionalLockEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={slst.chipsRow}>
        <View style={[slst.chip, slst.personChip]}><Ionicons name="person-circle-outline" size={18} color={C.text} /><Text style={slst.chipText}>You</Text><Ionicons name="chevron-down" size={12} color={C.textSec} /></View>
        <Pressable style={[slst.chip, slst.teamChip]}><Text style={slst.teamChipText}>Your team</Text></Pressable>
        <Pressable onPress={() => setShowSort((v) => !v)} style={[slst.chip, slst.sortChip]}>
          <Text style={slst.chipText}>{SORT_OPTS.find((o) => o.value === sort)?.label}</Text>
          <Ionicons name="chevron-down" size={12} color={C.textSec} />
        </Pressable>
      </ScrollView>}

      {!showSamples && <ScrollView horizontal nestedScrollEnabled directionalLockEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={slst.filterRow}>
        {FILTER_CHIPS.map((chip) => {
          const active = statusFilter === chip.value;
          return (
            <Pressable
              key={chip.value}
              onPress={() => { selectionHaptic(); setStatusFilter(chip.value); }}
              style={[slst.filterChip, active && slst.filterChipActive]}
            >
              <Text style={[slst.filterChipText, active && slst.filterChipTextActive]}>{chip.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>}

      {!showSamples && showSort && (
        <View style={slst.sortPanel}>
          {SORT_OPTS.map((o) => (
            <Pressable
              key={o.value}
              onPress={() => { selectionHaptic(); setSort(o.value); setShowSort(false); }}
              style={[slst.sortOpt, sort === o.value && slst.sortOptActive]}
            >
              <Ionicons name={o.icon} size={16} color={sort === o.value ? C.brand : C.textMuted} />
              <Text style={[slst.sortOptText, sort === o.value && { color: C.brand, fontWeight: "700" }]}>{o.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  ), [averageScore, onBack, onCommunityPress, property, samplePropertyName, search, sessionMetrics.averageScore, showSamples, sort, showSort, showSearch, statusFilter]);

  const ListFooter = useMemo(() => {
    if (showSamples) return null;
    if (loadingMore) return <LoadingDots style={{ paddingVertical: 20 }} color={C.brand} />;
    if (!hasMore && sessions.length > 0) return (
      <Text style={slst.endText}>All sessions loaded</Text>
    );
    return null;
  }, [hasMore, loadingMore, sessions.length, showSamples]);

  const ListEmpty = useMemo(() => {
    if (loading || (sessions.length === 0 && sampleSessionsQuery.isLoading)) return (
      <View style={{ paddingTop: 20 }}>
        <SessionsListSkeleton />
      </View>
    );
    if (showSamples && sampleSessionsQuery.error) {
      return (
        <View style={{ gap: 12 }}>
          <ErrorBanner
            message={sampleSessionsQuery.error instanceof Error ? sampleSessionsQuery.error.message : "Could not load sample sessions"}
            onRetry={() => void sampleSessionsQuery.refetch()}
          />
          <PrimaryBtn label="Back to my sessions" icon="arrow-back" onPress={() => setShowSamples(false)} />
        </View>
      );
    }
    if (showSamples) {
      return <EmptyState icon="albums-outline" title="Samples unavailable" subtitle="The curated examples could not be loaded." />;
    }
    if (samplesAvailable && !search && statusFilter === "all") {
      return (
        <Reanimated.View entering={FadeInDown.duration(280).springify()} style={slst.sampleEmptyCard}>
          <View style={slst.sampleEmptyIcon}><Ionicons name="sparkles" size={25} color={C.ai} /></View>
          <Text style={slst.sampleEmptyTitle}>No sessions yet</Text>
          <Text style={slst.sampleEmptySub}>
            Explore real, fully analyzed tours from 40Fifty Lofts while your team records its first session.
          </Text>
          <View style={slst.sampleFeatureRow}>
            {["Audio", "Transcript", "Scoring", "Coaching"].map((label) => (
              <View key={label} style={slst.sampleFeaturePill}><Text style={slst.sampleFeatureText}>{label}</Text></View>
            ))}
          </View>
          <MotionPressable onPress={() => setShowSamples(true)} haptic="selection" style={slst.samplePrimaryButton}>
            <Ionicons name="play-circle-outline" size={20} color="#fff" />
            <Text style={slst.samplePrimaryText}>View sample sessions</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </MotionPressable>
          <Text style={slst.sampleFootnote}>Read only · Samples never change this property’s data</Text>
        </Reanimated.View>
      );
    }
    return (
      <EmptyState
        icon={search || statusFilter !== "all" ? "search-outline" : "albums-outline"}
        title={search || statusFilter !== "all" ? "No matching sessions" : "No sessions yet"}
        subtitle="Recent tours will appear here"
      />
    );
  }, [loading, sampleSessionsQuery, samplesAvailable, search, sessions.length, showSamples, statusFilter]);

  return (
    <FlatList
      scrollEnabled
      nestedScrollEnabled
      data={groupedRows}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ListHeaderComponent={
        <View style={{ gap: 12 }}>
          {ListHeader}
          <LiveRecordingCard />
        </View>
      }
      ListFooterComponent={ListFooter}
      ListEmptyComponent={ListEmpty}
      onEndReached={showSamples ? undefined : onEndReached}
      onEndReachedThreshold={0.4}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} />}
      contentContainerStyle={slst.list}
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    />
  );
}

const slst = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 120 },
  header: { gap: 12, marginBottom: 8 },
  sampleHeadingSub: { marginTop: 3, color: C.textMuted, fontSize: 11, fontWeight: "700" },
  sampleModeBanner: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 11, padding: 12, borderWidth: 1, borderColor: C.aiBorder, borderRadius: 14, backgroundColor: "#f8fbff" },
  sampleModeIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: C.aiBg },
  sampleModeTitle: { color: C.text, fontSize: 13, fontWeight: "900" },
  sampleModeSub: { marginTop: 2, color: C.textSec, fontSize: 11, lineHeight: 15, fontWeight: "600" },
  sampleModeAction: { color: C.brand, fontSize: 12, fontWeight: "900" },
  sampleEmptyCard: { alignItems: "center", gap: 12, marginTop: 12, paddingHorizontal: 20, paddingVertical: 24, borderWidth: 1, borderColor: C.aiBorder, borderRadius: 20, backgroundColor: "#fff" },
  sampleEmptyIcon: { width: 54, height: 54, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: C.aiBg },
  sampleEmptyTitle: { color: C.text, fontSize: 21, fontWeight: "900", letterSpacing: -0.25 },
  sampleEmptySub: { maxWidth: 330, color: C.textSec, fontSize: 13, lineHeight: 19, fontWeight: "600", textAlign: "center" },
  sampleFeatureRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6 },
  sampleFeaturePill: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: "#f4f7fb" },
  sampleFeatureText: { color: C.textSec, fontSize: 10, fontWeight: "800" },
  samplePrimaryButton: { alignSelf: "stretch", minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, marginTop: 2, paddingHorizontal: 16, borderRadius: 14, backgroundColor: C.brand },
  samplePrimaryText: { flex: 1, color: "#fff", fontSize: 14, fontWeight: "900", textAlign: "center" },
  sampleFootnote: { color: C.textMuted, fontSize: 10, fontWeight: "700", textAlign: "center" },
  chipsRow: { gap: 6, paddingVertical: 2 },
  filterRow: { gap: 7, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "transparent",
  },
  chipActive: { backgroundColor: "#eef2ff", borderColor: "#c7d2fe" },
  chipText: { fontSize: 12, fontWeight: "600", color: C.textSec },
  chipTextActive: { color: C.brand },
  chipSep: { width: 1, height: 20, backgroundColor: "#e2e8f0", alignSelf: "center", marginHorizontal: 2 },
  sortChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  sortPanel: {
    flexDirection: "row", flexWrap: "wrap", gap: 6,
    backgroundColor: "#f8fafc", borderRadius: 12, padding: 10,
  },
  sortOpt: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
    backgroundColor: "white", borderWidth: 1, borderColor: "#e2e8f0",
  },
  sortOptActive: { borderColor: "#c7d2fe", backgroundColor: "#eef2ff" },
  sortOptText: { fontSize: 12, fontWeight: "600", color: C.textSec },
  sep: { height: 1, backgroundColor: "#f1f5f9" },
  endText: { textAlign: "center", paddingVertical: 20, fontSize: 12, fontWeight: "600", color: C.textMuted },
  skeleton: {
    paddingVertical: 14, paddingHorizontal: 16, gap: 6,
    borderBottomWidth: 1, borderBottomColor: "#f1f5f9",
  },
  skelBar: { height: 12, borderRadius: 6, backgroundColor: "#f1f5f9" },
  personChip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#fff", borderColor: "#e5e7eb" },
  teamChip: { backgroundColor: "#eef2ff" },
  teamChipText: { color: "#4338ca", fontSize: 12, fontWeight: "800" },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  avgPill: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 11, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 999, backgroundColor: "#fff" },
  avgPillValue: { color: C.text, fontSize: 15, fontWeight: "900", fontVariant: ["tabular-nums"] },
  avgPillLabel: { color: C.textMuted, fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  filterChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#fff" },
  filterChipActive: { borderColor: "#bfdbfe", backgroundColor: "#eff6ff" },
  filterChipText: { color: C.textSec, fontSize: 12, fontWeight: "800" },
  filterChipTextActive: { color: C.brand },
  attentionChip: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: "#f59e0b", borderRadius: 18 },
  attentionText: { color: "#f59e0b", fontSize: 12, fontWeight: "800" },
  groupHeader: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 8, paddingBottom: 7 },
  groupLabel: { color: "#9ca3af", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  groupCount: { minWidth: 18, height: 18, borderRadius: 4, backgroundColor: "#e5e7eb", alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  groupCountText: { color: C.textSec, fontSize: 10, fontWeight: "900" },
  swipeContainer: { marginBottom: 10, borderRadius: 12, overflow: "hidden" },
  swipeActions: { width: SESSION_SWIPE_DELETE_WIDTH },
  deleteAction: {
    flex: 1,
    width: SESSION_SWIPE_DELETE_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "#ef4444",
  },
  deleteActionPressed: { backgroundColor: "#dc2626", opacity: 0.92 },
  deleteActionText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  sessionCard: { minHeight: 74, flexDirection: "row", alignItems: "center", gap: 12, padding: 15, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, backgroundColor: "#fff" },
  sampleSessionCard: { marginBottom: 10, borderColor: C.aiBorder, backgroundColor: "#f8fbff" },
  sampleSessionIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: C.aiBg },
  sampleBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5, backgroundColor: C.aiBg },
  sampleBadgeText: { color: C.ai, fontSize: 8, fontWeight: "900" },
  sessionCardDeleting: { opacity: 0.55 },
  sessionNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  sessionName: { flex: 1, color: "#1a1a1a", fontSize: 15, fontWeight: "900" },
  sessionMeta: { color: "#666", fontSize: 12, marginTop: 5 },
  sessionDescription: { color: "#667085", fontSize: 12, marginTop: 4, lineHeight: 16 },
  sessionRight: { alignItems: "flex-end", gap: 5 },
  syncBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, backgroundColor: "#ebf5ff" },
  syncText: { color: C.brand, fontSize: 9, fontWeight: "900" },
  reviewBadge: { backgroundColor: "#fffbeb" },
  reviewText: { color: "#f59e0b" },
  sessionScore: { color: "#1a1a1a", fontSize: 16, fontWeight: "900" },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#f04438" },
});

// ═══════════════════════════════════════
// Calendar
// ═══════════════════════════════════════

const calSt = StyleSheet.create({
  upcomingBlock: { gap: 12 },
});

function CalendarScreen({
  sessions,
  upcomingSessions,
  entrataEvents,
  loading,
  onSession,
  onReload,
  onCommunityPress,
  property,
}: {
  sessions: SessionSummary[];
  upcomingSessions: SessionSummary[];
  entrataEvents: CalendarEvent[];
  loading: boolean;
  onSession: (id: string) => void;
  onReload: () => Promise<void>;
  onCommunityPress: () => void;
  property: string;
}) {
  const today = new Date();
  const [monthOffset, setMonthOffset] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const viewDate = useMemo(() => new Date(today.getFullYear(), today.getMonth() + monthOffset, 1), [monthOffset]);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthLabel = viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const itemsByDay = useMemo(() => {
    const map: Record<number, Array<{ source: "session"; session: SessionSummary } | { source: "entrata"; event: CalendarEvent }>> = {};
    for (const s of sessions) {
      if (!s.scheduledAt) continue;
      const d = new Date(s.scheduledAt);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        (map[day] ??= []).push({ source: "session", session: s });
      }
    }
    for (const event of entrataEvents) {
      const [eventYear, eventMonth, eventDay] = event.appointment_date.split("-").map(Number);
      if (eventYear === year && eventMonth === month + 1 && eventDay) {
        (map[eventDay] ??= []).push({ source: "entrata", event });
      }
    }
    return map;
  }, [entrataEvents, sessions, year, month]);

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks: Array<Array<number | null>> = [];
  let week: Array<number | null> = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length) { while (week.length < 7) week.push(null); weeks.push(week); }

  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());
  const dayItems = selectedDay ? (itemsByDay[selectedDay] ?? []) : [];

  useEffect(() => {
    setSelectedDay(
      monthOffset === 0 ? today.getDate() : null
    );
  }, [monthOffset]);

  async function runSync() {
    setSyncing(true);
    try {
      const result = await syncCalendar();
      await onReload();
      showToast(`${result?.eventsSynced ?? 0} Entrata tours synced`, "success");
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : "Entrata sync failed", "error");
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <View style={st.page}>
        <CommunityTopBar
          property={property}
          onCommunityPress={onCommunityPress}
          left={<TourLogo width={62} />}
          right={<View style={homeSt.headerIcon}><Skeleton style={{ width: 18, height: 18, borderRadius: 9 }} /></View>}
        />
        <CalendarScreenSkeleton />
      </View>
    );
  }

  return (
    <View style={st.page}>
      <CommunityTopBar
        property={property}
        onCommunityPress={onCommunityPress}
        left={<TourLogo width={62} />}
        right={
          <Pressable onPress={() => void runSync()} disabled={syncing} style={({ pressed }) => [homeSt.headerIcon, pressed && st.pressed]}>
            {syncing ? <LoadingDots size="small" color={C.brand} /> : <Ionicons name="sync" size={18} color={C.text} />}
          </Pressable>
        }
      />
      <View style={st.pageHeadingRow}>
        <View style={st.flex1}>
          <Text style={st.pageTitle}>Calendar</Text>
          <Text style={st.pageHeadingSub}>{entrataEvents.length} Entrata tours · {sessions.length} sessions</Text>
        </View>
      </View>

      <View style={st.integrationStrip}>
        <View style={st.integrationIcon}><Ionicons name="calendar" size={17} color={C.green} /></View>
        <View style={st.flex1}>
          <Text style={st.integrationTitle}>Entrata connected</Text>
          <Text style={st.integrationSub}>Tours and prospect details sync from Entrata.</Text>
        </View>
        <View style={st.connectedBadge}><View style={st.connectedBadgeDot} /><Text style={st.connectedBadgeText}>Live</Text></View>
      </View>

      <View style={calSt.upcomingBlock}>
        <View style={homeSt.sectionHeader}>
          <Text style={homeSt.sectionTitle}>Upcoming Tours</Text>
          <Text style={homeSt.sectionAction}>See All</Text>
        </View>
        {upcomingSessions.length === 0 ? (
          <EmptyState icon="calendar-outline" title="No upcoming tours" subtitle="Scheduled and active tours will appear here" />
        ) : (
          <View style={homeSt.focusStack}>
            {upcomingSessions.slice(0, 4).map((session) => (
              <MotionPressable key={session.id} onPress={() => onSession(session.id)} haptic="selection" style={homeSt.tourCard}>
                <View style={st.flex1}>
                  <Text style={homeSt.tourTitle} numberOfLines={1}>{displaySessionTitle(session)}</Text>
                  <View style={homeSt.tourMetaRow}>
                    <Text style={homeSt.timePill}>
                      {session.status === "in_progress"
                        ? "Now"
                        : session.scheduledAt
                          ? `${new Date(session.scheduledAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${fmtTime(session.scheduledAt)}`
                          : "Scheduled"}
                    </Text>
                    <Text style={homeSt.tourMeta} numberOfLines={1}>{session.prospectName ?? "Prospect details pending"}</Text>
                  </View>
                  {formatSessionCardDescription(session) ? (
                    <Text style={homeSt.tourMeta} numberOfLines={2}>{formatSessionCardDescription(session)}</Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
              </MotionPressable>
            ))}
          </View>
        )}
      </View>

      <View style={st.card}>
        <View style={{ padding: 16 }}>
          <View style={st.calNav}>
            <Pressable onPress={() => setMonthOffset((p) => p - 1)}><Ionicons name="chevron-back" size={22} color={C.text} /></Pressable>
            <Text style={st.calMonth}>{monthLabel}</Text>
            <Pressable onPress={() => setMonthOffset((p) => p + 1)}><Ionicons name="chevron-forward" size={22} color={C.text} /></Pressable>
          </View>
          <View style={st.calDowRow}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <Text key={d} style={st.calDow}>{d}</Text>)}
          </View>
          {weeks.map((w, wi) => (
            <View key={wi} style={st.calWeek}>
              {w.map((d, di) => {
                if (d === null) return <View key={di} style={st.calDayCell} />;
                const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                const dayItems = itemsByDay[d] ?? [];
                const hasSessions = dayItems.some((item) => item.source === "session");
                const hasEntrata = dayItems.some((item) => item.source === "entrata");
                const isSelected = d === selectedDay;
                return (
                  <Pressable key={di} onPress={() => setSelectedDay(d === selectedDay ? null : d)} style={[st.calDayCell, isSelected && st.calDaySelected, isToday && !isSelected && st.calDayToday]}>
                    <Text style={[st.calDayText, isToday && st.calDayTextToday, isSelected && st.calDayTextSelected]}>{d}</Text>
                    <View style={st.calDots}>
                      {hasEntrata && <View style={[st.calDot, { backgroundColor: isSelected ? "#fff" : C.ai }]} />}
                      {hasSessions && <View style={[st.calDot, { backgroundColor: isSelected ? "#fff" : C.brand }]} />}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      {selectedDay !== null && (
        <>
          <Text style={st.sectionTitle}>{monthLabel.split(" ")[0]} {selectedDay}</Text>
          {dayItems.length === 0 ? <EmptyState icon="calendar-outline" title="No calendar items" subtitle={`Nothing scheduled for ${monthLabel.split(" ")[0]} ${selectedDay}`} /> : (
            <View style={st.card}>
              {dayItems.map((item, index) => item.source === "session" ? (
                <SessionRow key={item.session.id} session={item.session} onPress={() => onSession(item.session.id)} isLast={index === dayItems.length - 1} />
              ) : (
                <Pressable
                  key={item.event.id}
                  disabled={!item.event.session_id}
                  onPress={() => item.event.session_id && onSession(item.event.session_id)}
                  style={({ pressed }) => [st.calendarEventRow, index < dayItems.length - 1 && st.rowBorder, pressed && st.pressed]}
                >
                  <View style={st.entrataEventIcon}><Ionicons name={item.event.event_type === "virtual" ? "videocam-outline" : "business-outline"} size={18} color={C.ai} /></View>
                  <View style={st.flex1}>
                    <Text style={st.sessionTitle} numberOfLines={1}>{item.event.prospect_name ?? "Entrata tour"}</Text>
                    <Text style={st.sessionMeta}>
                      {formatEntrataClock(item.event.time_from)} · {item.event.event_type === "virtual" ? "Virtual" : "In person"}
                    </Text>
                    {(item.event.prospect_email || item.event.prospect_phone) && (
                      <Text style={st.calendarContact} numberOfLines={1}>{item.event.prospect_email ?? item.event.prospect_phone}</Text>
                    )}
                  </View>
                  <View style={[st.badge, { backgroundColor: C.aiBg }]}><Text style={[st.badgeText, { color: C.ai }]}>{item.event.status.replaceAll("_", " ")}</Text></View>
                  {item.event.session_id && <Ionicons name="chevron-forward" size={17} color={C.textMuted} />}
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}

function formatEntrataClock(value: string | null) {
  if (!value) return "Time TBD";
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return value;
  const date = new Date(2000, 0, 1, Number(match[1]), Number(match[2]));
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// ═══════════════════════════════════════
// Materials
// ═══════════════════════════════════════

const assetSt = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  scrollContent: { gap: 16, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 28 },
  scrollContentSelecting: { paddingBottom: 116 },
  header: { gap: 16 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  titleText: { flex: 1, minWidth: 0 },
  headingAction: { minHeight: 38, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  headingActionText: { color: C.brand, fontSize: 13, fontWeight: "800" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  searchField: { flex: 1, minHeight: 46, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 13, borderWidth: 1, borderColor: "#dce3ec", borderRadius: 13, backgroundColor: "#fff" },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 0, color: C.text, fontSize: 13, fontWeight: "700" },
  clearSearch: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  filterButton: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#dce3ec", borderRadius: 13, backgroundColor: "#fff" },
  filterButtonActive: { borderColor: "#b7d7ff", backgroundColor: "#eef6ff" },
  filterBadge: { position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, borderWidth: 2, borderColor: C.bg, borderRadius: 9, backgroundColor: C.brand },
  filterBadgeText: { color: "#fff", fontSize: 9, fontWeight: "900", fontVariant: ["tabular-nums"] },
  libraryControls: { flexDirection: "row", alignItems: "center", gap: 10 },
  recordButton: { flex: 1, minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 13, backgroundColor: C.brand },
  recordButtonText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  addFileButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 15, borderWidth: 1, borderColor: "#dce3ec", borderRadius: 13, backgroundColor: "#fff" },
  addFileButtonText: { color: C.text, fontSize: 12, fontWeight: "800" },
  resultSummary: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 24 },
  resultSummaryText: { color: C.textSec, fontSize: 11, fontWeight: "700" },
  clearFiltersText: { color: C.brand, fontSize: 11, fontWeight: "800" },
  selectionTitle: { color: C.text, fontSize: 28, fontWeight: "900", letterSpacing: 0 },
  selectAll: { minHeight: 38, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  selectAllText: { color: C.brand, fontSize: 12, fontWeight: "800" },
  selectionDock: { position: "absolute", left: 12, right: 12, bottom: 10, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 9, borderWidth: 1, borderColor: "#dce3ec", borderRadius: 18, backgroundColor: "rgba(255,255,255,0.98)", shadowColor: "#0f172a", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.14, shadowRadius: 18, elevation: 12 },
  bulkActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  bulkAction: { flex: 1, minHeight: 54, alignItems: "center", justifyContent: "center", gap: 4, borderRadius: 12 },
  bulkActionDisabled: { opacity: 0.35 },
  bulkActionText: { color: C.textSec, fontSize: 10, fontWeight: "800" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cardWrap: { width: (Dimensions.get("window").width - 44) / 2 },
  card: { gap: 8 },
  cardSelected: { opacity: 0.94 },
  thumb: { aspectRatio: 4 / 3, alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: 12, backgroundColor: "#eaf2fc" },
  thumbSelected: { borderWidth: 2.5, borderColor: C.brand },
  thumbImage: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  thumbOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,23,42,0.08)" },
  playBadge: { position: "absolute", left: 9, bottom: 9, width: 28, height: 28, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.9)", borderRadius: 14, backgroundColor: "rgba(15,23,42,0.78)" },
  fallbackIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: "#fff" },
  selectCircle: { position: "absolute", top: 9, right: 9, width: 24, height: 24, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.98)", borderRadius: 12, backgroundColor: "rgba(15,23,42,0.34)" },
  selectCircleActive: { borderColor: C.brand, backgroundColor: C.brand },
  cardTitle: { color: C.text, fontSize: 13, fontWeight: "800" },
  cardMetaRow: { minHeight: 16, flexDirection: "row", alignItems: "center", gap: 5 },
  cardMeta: { flexShrink: 1, color: C.textSec, fontSize: 10, fontWeight: "700", textTransform: "capitalize" },
  syncBadge: { position: "absolute", top: 9, left: 9, width: 25, height: 25, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "rgba(15,23,42,0.7)" },
  syncBadgeFailed: { backgroundColor: "rgba(180,35,24,0.9)" },
  syncBadgeSynced: { backgroundColor: "rgba(5,122,85,0.84)" },
  localAction: { position: "absolute", right: 9, bottom: 9, width: 30, height: 30, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.82)", borderRadius: 15, backgroundColor: "rgba(15,23,42,0.78)" },
  noResults: { alignItems: "center", justifyContent: "center", gap: 10, minHeight: 260, paddingHorizontal: 32 },
  noResultsIcon: { width: 52, height: 52, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: "#eaf3ff" },
  noResultsTitle: { color: C.text, fontSize: 17, fontWeight: "900", textAlign: "center" },
  noResultsBody: { color: C.textSec, fontSize: 12, fontWeight: "600", lineHeight: 18, textAlign: "center" },
  noResultsAction: { minHeight: 40, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  noResultsActionText: { color: C.brand, fontSize: 12, fontWeight: "800" },
  filterSheet: { gap: 12, paddingHorizontal: 6 },
  filterSheetScroll: { flex: 1, minHeight: 0 },
  filterSheetScrollContent: { gap: 18, paddingBottom: 4 },
  filterSheetHeader: { gap: 3 },
  filterSheetTitle: { color: C.text, fontSize: 21, fontWeight: "900" },
  filterSheetMeta: { color: C.textSec, fontSize: 12, fontWeight: "600" },
  filterSection: { gap: 10 },
  filterSectionTitle: { color: C.textSec, fontSize: 10, fontWeight: "900", letterSpacing: 0, textTransform: "uppercase" },
  filterChoices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterChip: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 12, borderWidth: 1, borderColor: "#dce3ec", borderRadius: 11, backgroundColor: "#fff" },
  filterChipActive: { borderColor: "#a9ceff", backgroundColor: "#eaf3ff" },
  filterChipText: { color: C.textSec, fontSize: 11, fontWeight: "800" },
  filterChipTextActive: { color: C.brand },
  sortOptions: { overflow: "hidden", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 14, backgroundColor: "#fff" },
  sortOption: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 13 },
  sortOptionBorder: { borderTopWidth: 1, borderTopColor: "#edf0f4" },
  sortOptionText: { flex: 1, color: C.text, fontSize: 13, fontWeight: "700" },
  filterFooter: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 2 },
  filterReset: { minWidth: 92, minHeight: 50, alignItems: "center", justifyContent: "center", paddingHorizontal: 14, borderWidth: 1, borderColor: "#dce3ec", borderRadius: 13, backgroundColor: "#fff" },
  filterResetText: { color: C.text, fontSize: 13, fontWeight: "800" },
  filterApply: { flex: 1, minHeight: 50, alignItems: "center", justifyContent: "center", paddingHorizontal: 14, borderRadius: 13, backgroundColor: C.brand },
  filterApplyText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  modalScrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.42)" },
  modalSheet: { maxHeight: "88%", gap: 14, padding: 18, paddingBottom: Platform.OS === "ios" ? 34 : 20, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: "#fff" },
  modalHandle: { alignSelf: "center", width: 42, height: 5, borderRadius: 3, backgroundColor: "#d1d5db" },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  modalTitle: { color: C.text, fontSize: 22, fontWeight: "900" },
  modalMeta: { color: C.textSec, fontSize: 12, fontWeight: "700", marginTop: 2, textTransform: "capitalize" },
  modalPreview: { minHeight: 250, overflow: "hidden", borderRadius: 20, backgroundColor: "#eef4ff" },
  modalImage: { width: "100%", height: 250 },
  modalFallback: { height: 250, alignItems: "center", justifyContent: "center" },
  modalActions: { flexDirection: "row", gap: 10 },
  modalPrimary: { flex: 1, minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 16, backgroundColor: C.brand },
  modalPrimaryText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  modalSecondary: { minWidth: 98, minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 14, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 16, backgroundColor: "#fff" },
  modalSecondaryText: { color: C.text, fontSize: 13, fontWeight: "900" },
  tourLibraryLink: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: "#dce3ec", borderRadius: 13, backgroundColor: "#fff" },
  tourLibraryLinkIcon: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "#eaf3ff" },
  tourLibraryLinkTitle: { color: C.text, fontSize: 13, fontWeight: "900" },
  tourLibraryLinkMeta: { color: C.textSec, fontSize: 11, fontWeight: "700", marginTop: 2 },
});

type AssetSort = "newest" | "oldest" | "name";
type AssetKindFilter = "all" | "video" | "image" | "file";
type AssetStatusFilter = "all" | "synced" | "not_synced" | "attention";
type DisplayAsset = { material: Material; local: LocalAsset | null };

const ASSET_SORT_LABELS: Record<AssetSort, string> = {
  newest: "Newest",
  oldest: "Oldest",
  name: "Name",
};
const ASSET_KIND_OPTIONS: Array<{ value: AssetKindFilter; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { value: "all", label: "All types", icon: "apps-outline" },
  { value: "video", label: "Videos", icon: "videocam-outline" },
  { value: "image", label: "Images", icon: "image-outline" },
  { value: "file", label: "Files", icon: "document-outline" },
];
const ASSET_STATUS_OPTIONS: Array<{ value: AssetStatusFilter; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { value: "all", label: "Any status", icon: "layers-outline" },
  { value: "synced", label: "Synced", icon: "cloud-done-outline" },
  { value: "not_synced", label: "Not synced", icon: "cloud-offline-outline" },
  { value: "attention", label: "Needs attention", icon: "alert-circle-outline" },
];
const assetThumbnailCache = new Map<string, string>();

function displayAssetKind({ material, local }: DisplayAsset): Exclude<AssetKindFilter, "all"> {
  const url = materialUrl(material);
  if (local?.kind === "video" || material.type === "recording" || material.media?.videoUrl || material.media?.iframeUrl || (url && isVideoLikeUrl(url))) return "video";
  if (local?.kind === "image" || material.media?.imageUrl || material.media?.gifUrl || (url && /\.(?:jpe?g|png|gif|webp|heic)(?:[?#].*)?$/i.test(url))) return "image";
  return "file";
}

function AssetThumbnail({ material, local }: DisplayAsset) {
  const providedPreview = materialPreviewUrl(material);
  const videoSource = local?.kind === "video"
    ? local.localUri
    : material.media?.videoUrl ?? (!providedPreview ? materialUrl(material) : null);
  const [generatedPreview, setGeneratedPreview] = useState(() => videoSource ? assetThumbnailCache.get(videoSource) ?? null : null);

  useEffect(() => {
    if (providedPreview || !videoSource || generatedPreview || Platform.OS === "web") return;
    let cancelled = false;
    void VideoThumbnails.getThumbnailAsync(videoSource, { time: 300, quality: 0.72 })
      .then(({ uri }) => {
        if (cancelled) return;
        assetThumbnailCache.set(videoSource, uri);
        setGeneratedPreview(uri);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [generatedPreview, providedPreview, videoSource]);

  const preview = providedPreview ?? generatedPreview;
  const playable = Boolean(videoSource || material.media?.iframeUrl);
  return (
    <>
      {preview ? (
        <>
          <Image source={{ uri: preview }} style={assetSt.thumbImage} resizeMode="cover" />
          <View style={assetSt.thumbOverlay} />
        </>
      ) : (
        <View style={assetSt.fallbackIcon}>
          <Ionicons name={playable ? "videocam-outline" : "document-outline"} size={22} color={C.brand} />
        </View>
      )}
      {playable ? (
        <View style={assetSt.playBadge}>
          <Ionicons name="play" size={12} color="#fff" />
        </View>
      ) : null}
    </>
  );
}

function AssetSyncBadge({ local }: { local: LocalAsset | null }) {
  if (!local) return null;
  const state = local.status === "synced"
    ? { icon: "cloud-done-outline" as const, label: "Synced", tone: assetSt.syncBadgeSynced }
    : local.status === "uploading"
      ? { icon: "sync-outline" as const, label: "Syncing", tone: undefined }
      : local.status === "failed"
        ? { icon: "alert-circle-outline" as const, label: "Needs attention", tone: assetSt.syncBadgeFailed }
        : { icon: "cloud-offline-outline" as const, label: "Not synced", tone: undefined };
  return (
    <View accessibilityLabel={state.label} style={[assetSt.syncBadge, state.tone]}>
      <Ionicons name={state.icon} size={14} color="#fff" />
    </View>
  );
}

function AssetBulkAction({
  icon,
  label,
  disabled,
  destructive,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  disabled?: boolean;
  destructive?: boolean;
  onPress: () => void;
}) {
  const color = destructive ? C.red : C.brand;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [assetSt.bulkAction, disabled && assetSt.bulkActionDisabled, pressed && st.pressed]}
    >
      <Ionicons name={icon} size={17} color={color} />
      <Text style={[assetSt.bulkActionText, { color }]}>{label}</Text>
    </Pressable>
  );
}

function MaterialsScreen({ materials, tourLibrary, communityId, loading, onReload, onBack, onCommunityPress, property }: { materials: Material[]; tourLibrary: TourLibraryLink | null; communityId: string; loading: boolean; onReload: () => Promise<void>; onBack: () => void; onCommunityPress: () => void; property: string }) {
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<{ material: Material; local: LocalAsset | null } | null>(null);
  const [videoRecorderOpen, setVideoRecorderOpen] = useState(false);
  const [localAssets, setLocalAssets] = useState<LocalAsset[]>([]);
  const [localAssetsLoading, setLocalAssetsLoading] = useState(true);
  const [syncingLocalAssetId, setSyncingLocalAssetId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [assetQuery, setAssetQuery] = useState("");
  const [assetKindFilter, setAssetKindFilter] = useState<AssetKindFilter>("all");
  const [assetStatusFilter, setAssetStatusFilter] = useState<AssetStatusFilter>("all");
  const [assetSort, setAssetSort] = useState<AssetSort>("newest");
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftKindFilter, setDraftKindFilter] = useState<AssetKindFilter>("all");
  const [draftStatusFilter, setDraftStatusFilter] = useState<AssetStatusFilter>("all");
  const [draftSort, setDraftSort] = useState<AssetSort>("newest");
  const [bulkBusy, setBulkBusy] = useState(false);

  const loadLocalAssets = useCallback(async () => {
    setLocalAssets(await listLocalAssets(communityId));
    setLocalAssetsLoading(false);
  }, [communityId]);

  useEffect(() => {
    void loadLocalAssets();
    return subscribeLocalAssets(() => void loadLocalAssets());
  }, [loadLocalAssets]);

  async function syncLocalAsset(asset: LocalAsset, quiet = false) {
    if (syncingLocalAssetId) return;
    setSyncingLocalAssetId(asset.id);
    await updateLocalAsset(asset.id, { status: "uploading", error: null });
    try {
      const material = await uploadMaterial(asset.localUri, asset.mimeType, asset.fileName, {
        name: asset.name,
        description: asset.description,
        type: asset.kind === "video" ? "recording" : "other",
      });
      await updateLocalAsset(asset.id, { status: "synced", remoteMaterialId: material.id, error: null });
      await onReload().catch(() => undefined);
      if (!quiet) showToast("Asset synced to this community", "success");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not upload this asset.";
      await updateLocalAsset(asset.id, { status: "failed", error: message });
      throw caught;
    } finally {
      setSyncingLocalAssetId(null);
    }
  }

  async function addAsset() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["video/*", "audio/*", "image/*", "application/pdf"],
        copyToCacheDirectory: true,
      });
      const file = result.assets?.[0];
      if (result.canceled || !file) return;
      setUploading(true);
      const mimeType = file.mimeType ?? "application/octet-stream";
      if (mimeType.startsWith("image/") || mimeType.startsWith("video/")) {
        const localAsset = await preserveLocalAsset({
          communityId,
          sourceUri: file.uri,
          mimeType,
          fileName: file.name,
        });
        await syncLocalAsset(localAsset);
      } else {
        await uploadMaterial(file.uri, mimeType, file.name);
        await onReload();
        showToast("Asset added to this community", "success");
      }
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : "Could not upload asset", "error");
    } finally {
      setUploading(false);
    }
  }

  async function uploadRecordedVideo(asset: RecordedVideoAsset) {
    const localAsset = asset.localAssetId
      ? (await listLocalAssets(communityId)).find((candidate) => candidate.id === asset.localAssetId)
      : await preserveLocalAsset({
        communityId,
        sourceUri: asset.uri,
        mimeType: asset.mimeType,
        fileName: asset.fileName,
        name: asset.name,
        description: asset.description,
      });
    if (!localAsset) throw new Error("This saved video is no longer available on this device.");
    await syncLocalAsset(localAsset);
  }

  async function saveRecordedVideo(asset: RecordedVideoAsset) {
    const localAsset = await preserveLocalAsset({
      communityId,
      sourceUri: asset.uri,
      mimeType: asset.mimeType,
      fileName: asset.fileName,
      name: asset.name,
      description: asset.description,
    });
    showToast("Saved in your Tour asset library", "success");
    return { id: localAsset.id, uri: localAsset.localUri };
  }

  const displayAssets = useMemo<DisplayAsset[]>(() => {
    const remoteIdsSavedLocally = new Set(localAssets.map((asset) => asset.remoteMaterialId).filter(Boolean));
    return [
      ...localAssets.map((asset) => ({
        local: asset,
        material: {
          id: asset.id,
          name: asset.name,
          type: asset.kind === "video" ? "recording" as const : "other" as const,
          description: asset.description,
          fileUrl: asset.localUri,
          createdAt: asset.createdAt,
          media: {
            sourceKey: asset.id,
            videoUrl: asset.kind === "video" ? asset.localUri : null,
            imageUrl: asset.kind === "image" ? asset.localUri : null,
            gifUrl: null,
            iframeUrl: null,
          },
        } satisfies Material,
      })),
      ...materials
        .filter((material) => !remoteIdsSavedLocally.has(material.id))
        .map((material) => ({ local: null, material })),
    ];
  }, [localAssets, materials]);

  const visibleAssets = useMemo(() => {
    const normalizedQuery = assetQuery.trim().toLocaleLowerCase();
    return displayAssets
      .filter((asset) => {
        if (normalizedQuery) {
          const searchable = `${asset.material.name} ${asset.material.description ?? ""}`.toLocaleLowerCase();
          if (!searchable.includes(normalizedQuery)) return false;
        }
        if (assetKindFilter !== "all" && displayAssetKind(asset) !== assetKindFilter) return false;
        if (assetStatusFilter === "synced" && asset.local?.status !== "synced" && asset.local !== null) return false;
        if (assetStatusFilter === "not_synced" && (!asset.local || asset.local.status === "synced")) return false;
        if (assetStatusFilter === "attention" && asset.local?.status !== "failed") return false;
        return true;
      })
      .sort((left, right) => {
        if (assetSort === "name") return left.material.name.localeCompare(right.material.name);
        const direction = assetSort === "newest" ? -1 : 1;
        return left.material.createdAt.localeCompare(right.material.createdAt) * direction;
      });
  }, [assetKindFilter, assetQuery, assetSort, assetStatusFilter, displayAssets]);

  const selectedAssets = useMemo(
    () => displayAssets.filter(({ material }) => selectedAssetIds.includes(material.id)),
    [displayAssets, selectedAssetIds],
  );
  const syncableSelected = selectedAssets.filter(({ local }) => local && local.status !== "synced");
  const removableSelected = selectedAssets.filter(({ local }) => Boolean(local));
  const activeFilterCount = Number(assetKindFilter !== "all") + Number(assetStatusFilter !== "all");
  const hasAssetRefinement = Boolean(assetQuery.trim()) || activeFilterCount > 0;
  const draftVisibleCount = useMemo(() => displayAssets.filter((asset) => {
    if (draftKindFilter !== "all" && displayAssetKind(asset) !== draftKindFilter) return false;
    if (draftStatusFilter === "synced" && asset.local?.status !== "synced" && asset.local !== null) return false;
    if (draftStatusFilter === "not_synced" && (!asset.local || asset.local.status === "synced")) return false;
    if (draftStatusFilter === "attention" && asset.local?.status !== "failed") return false;
    return true;
  }).length, [displayAssets, draftKindFilter, draftStatusFilter]);

  useEffect(() => {
    setSelectedAssetIds((current) => current.filter((id) => displayAssets.some(({ material }) => material.id === id)));
  }, [displayAssets]);

  function toggleAssetSelection(id: string) {
    selectionHaptic();
    setSelectedAssetIds((current) => current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id]);
  }

  function closeSelectionMode() {
    setSelectionMode(false);
    setSelectedAssetIds([]);
  }

  function openAssetFilters() {
    setDraftKindFilter(assetKindFilter);
    setDraftStatusFilter(assetStatusFilter);
    setDraftSort(assetSort);
    setFilterOpen(true);
  }

  function resetAssetRefinements() {
    setAssetQuery("");
    setAssetKindFilter("all");
    setAssetStatusFilter("all");
    setAssetSort("newest");
  }

  async function shareSelectedAssets() {
    if (!selectedAssets.length) return;
    const lines = selectedAssets.map(({ material }) => {
      const url = materialUrl(material);
      return url ? `${material.name}\n${url}` : material.name;
    });
    await Share.share({ title: "Tour assets", message: lines.join("\n\n") });
  }

  async function syncSelectedAssets() {
    if (!syncableSelected.length || bulkBusy) return;
    setBulkBusy(true);
    let failed = 0;
    for (const { local } of syncableSelected) {
      if (!local) continue;
      try {
        await syncLocalAsset(local, true);
      } catch {
        failed += 1;
      }
    }
    setBulkBusy(false);
    if (failed) showToast(`${failed} ${failed === 1 ? "asset" : "assets"} could not sync`, "error");
    else showToast(`${syncableSelected.length} ${syncableSelected.length === 1 ? "asset" : "assets"} synced`, "success");
  }

  function removeSelectedAssets() {
    if (!removableSelected.length || bulkBusy) return;
    Alert.alert(
      `Remove ${removableSelected.length} ${removableSelected.length === 1 ? "asset" : "assets"}?`,
      "Unsynced files will be deleted. Synced files remain available from the property library.",
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => void (async () => {
            setBulkBusy(true);
            for (const { local } of removableSelected) {
              if (local) await removeLocalAsset(local.id);
            }
            setBulkBusy(false);
            closeSelectionMode();
            showToast("Selected assets removed", "success");
          })(),
        },
      ],
    );
  }

  const allVisibleSelected = visibleAssets.length > 0 && visibleAssets.every(({ material }) => selectedAssetIds.includes(material.id));

  return (
    <View style={assetSt.screen}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[assetSt.scrollContent, selectionMode && assetSt.scrollContentSelecting]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void onReload()} tintColor={C.brand} />}
      >
        <View style={assetSt.header}>
          <CommunityTopBar
            property={property}
            onCommunityPress={onCommunityPress}
            left={
              <Pressable accessibilityLabel="Back to home" onPress={selectionMode ? closeSelectionMode : onBack} style={({ pressed }) => [homeSt.headerIcon, pressed && st.pressed]}>
                <Ionicons name={selectionMode ? "close" : "arrow-back"} size={22} color={C.text} />
              </Pressable>
            }
            right={undefined}
          />

          <View style={assetSt.titleRow}>
            <View style={assetSt.titleText}>
              <Text style={selectionMode ? assetSt.selectionTitle : st.pageTitle}>
                {selectionMode ? `${selectedAssetIds.length} selected` : "Assets"}
              </Text>
              {!selectionMode ? (
                <Text style={st.pageHeadingSub}>{displayAssets.length} saved {displayAssets.length === 1 ? "asset" : "assets"}</Text>
              ) : null}
            </View>
            {selectionMode ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={allVisibleSelected ? "Clear visible selection" : "Select all visible assets"}
                disabled={!visibleAssets.length}
                onPress={() => setSelectedAssetIds((current) => {
                  const visibleIds = visibleAssets.map(({ material }) => material.id);
                  if (allVisibleSelected) return current.filter((id) => !visibleIds.includes(id));
                  return Array.from(new Set([...current, ...visibleIds]));
                })}
                style={assetSt.selectAll}
              >
                <Text style={assetSt.selectAllText}>{allVisibleSelected ? "Clear all" : "Select all"}</Text>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Select assets"
                disabled={!displayAssets.length}
                onPress={() => setSelectionMode(true)}
                style={({ pressed }) => [assetSt.headingAction, !displayAssets.length && assetSt.bulkActionDisabled, pressed && st.pressed]}
              >
                <Text style={assetSt.headingActionText}>Select</Text>
              </Pressable>
            )}
          </View>

          {!selectionMode ? (
            <>
              <View style={assetSt.searchRow}>
                <View style={assetSt.searchField}>
                  <Ionicons name="search-outline" size={18} color={C.textMuted} />
                  <TextInput
                    value={assetQuery}
                    onChangeText={setAssetQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="Search assets"
                    placeholderTextColor={C.textMuted}
                    returnKeyType="search"
                    style={assetSt.searchInput}
                  />
                  {assetQuery ? (
                    <Pressable accessibilityLabel="Clear asset search" onPress={() => setAssetQuery("")} style={assetSt.clearSearch}>
                      <Ionicons name="close-circle" size={17} color={C.textMuted} />
                    </Pressable>
                  ) : null}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Filter and sort assets. ${activeFilterCount} active filters. Sorted by ${ASSET_SORT_LABELS[assetSort]}`}
                  onPress={openAssetFilters}
                  style={({ pressed }) => [assetSt.filterButton, activeFilterCount > 0 && assetSt.filterButtonActive, pressed && st.pressed]}
                >
                  <Ionicons name="options-outline" size={20} color={activeFilterCount > 0 ? C.brand : C.text} />
                  {activeFilterCount > 0 ? (
                    <View style={assetSt.filterBadge}>
                      <Text style={assetSt.filterBadgeText}>{activeFilterCount}</Text>
                    </View>
                  ) : null}
                </Pressable>
              </View>

              <View style={assetSt.libraryControls}>
                <Pressable accessibilityRole="button" accessibilityLabel="Record a video asset" onPress={() => setVideoRecorderOpen(true)} style={({ pressed }) => [assetSt.recordButton, pressed && st.pressed]}>
                  <Ionicons name="videocam-outline" size={17} color="#fff" />
                  <Text style={assetSt.recordButtonText}>Record video</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Add an existing file" onPress={() => void addAsset()} disabled={uploading} style={({ pressed }) => [assetSt.addFileButton, uploading && assetSt.bulkActionDisabled, pressed && st.pressed]}>
                  {uploading ? <LoadingDots size="small" color={C.brand} /> : <Ionicons name="add" size={18} color={C.text} />}
                  <Text style={assetSt.addFileButtonText}>Add file</Text>
                </Pressable>
              </View>

              {tourLibrary ? (
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel="Open the connected Tour Library"
                  onPress={() => void Linking.openURL(tourLibrary.url)}
                  style={({ pressed }) => [assetSt.tourLibraryLink, pressed && st.pressed]}
                >
                  <View style={assetSt.tourLibraryLinkIcon}>
                    <Ionicons name="play" size={16} color={C.brand} />
                  </View>
                  <View style={st.flex1}>
                    <Text style={assetSt.tourLibraryLinkTitle}>Tour Library</Text>
                    <Text style={assetSt.tourLibraryLinkMeta}>Open the connected property library</Text>
                  </View>
                  <Ionicons name="open-outline" size={17} color={C.textMuted} />
                </Pressable>
              ) : null}

              {displayAssets.length > 0 ? (
                <View style={assetSt.resultSummary}>
                  <Text style={assetSt.resultSummaryText}>
                    {visibleAssets.length === displayAssets.length && !assetQuery.trim()
                      ? `${ASSET_SORT_LABELS[assetSort]} first`
                      : `${visibleAssets.length} of ${displayAssets.length} shown`}
                  </Text>
                  {hasAssetRefinement ? (
                    <Pressable accessibilityRole="button" onPress={resetAssetRefinements}>
                      <Text style={assetSt.clearFiltersText}>Clear filters</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </>
          ) : null}
        </View>

        {(loading || localAssetsLoading) ? (
          <MaterialsGridSkeleton />
        ) : displayAssets.length === 0 ? (
          <EmptyState icon="folder-open-outline" title="No assets yet" subtitle="Record a property video or add media from this device" />
        ) : visibleAssets.length === 0 ? (
          <View style={assetSt.noResults}>
            <View style={assetSt.noResultsIcon}>
              <Ionicons name="search-outline" size={24} color={C.brand} />
            </View>
            <Text style={assetSt.noResultsTitle}>No matching assets</Text>
            <Text style={assetSt.noResultsBody}>Try a different search or clear the current filters.</Text>
            <Pressable accessibilityRole="button" onPress={resetAssetRefinements} style={assetSt.noResultsAction}>
              <Text style={assetSt.noResultsActionText}>Show all assets</Text>
            </Pressable>
          </View>
        ) : (
          <View style={assetSt.grid}>
            {visibleAssets.map(({ material, local }) => {
              const assetSelected = selectedAssetIds.includes(material.id);
              return (
                <View key={material.id} style={assetSt.cardWrap}>
                  <Pressable
                    accessibilityRole={selectionMode ? "checkbox" : "button"}
                    accessibilityState={selectionMode ? { checked: assetSelected } : undefined}
                    accessibilityLabel={selectionMode ? `${assetSelected ? "Deselect" : "Select"} ${material.name}` : `Open ${material.name}`}
                    onPress={() => selectionMode ? toggleAssetSelection(material.id) : setSelected({ material, local })}
                    onLongPress={() => {
                      if (selectionMode) return;
                      selectionHaptic();
                      setSelectionMode(true);
                      setSelectedAssetIds([material.id]);
                    }}
                    style={({ pressed }) => [assetSt.card, assetSelected && assetSt.cardSelected, pressed && st.pressed]}
                  >
                    <View style={[assetSt.thumb, assetSelected && assetSt.thumbSelected]}>
                      <AssetThumbnail material={material} local={local} />
                      {selectionMode ? (
                        <View style={[assetSt.selectCircle, assetSelected && assetSt.selectCircleActive]}>
                          {assetSelected ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                        </View>
                      ) : (
                        <AssetSyncBadge local={local} />
                      )}
                      {local && local.status !== "synced" && !selectionMode ? (
                        <Pressable
                          accessibilityLabel={`Upload ${local.name}`}
                          disabled={syncingLocalAssetId === local.id}
                          onPress={(event) => {
                            event.stopPropagation();
                            void syncLocalAsset(local).catch((caught) => showToast(caught instanceof Error ? caught.message : "Could not sync asset", "error"));
                          }}
                          style={assetSt.localAction}
                        >
                          {syncingLocalAssetId === local.id ? <LoadingDots size="small" color="#fff" /> : <Ionicons name="cloud-upload-outline" size={15} color="#fff" />}
                        </Pressable>
                      ) : null}
                    </View>
                    <Text style={assetSt.cardTitle} numberOfLines={1}>{material.name}</Text>
                    <View style={assetSt.cardMetaRow}>
                      <Text style={assetSt.cardMeta} numberOfLines={1}>{displayAssetKind({ material, local })} · {fmtDate(material.createdAt)}</Text>
                    </View>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {selectionMode ? (
        <View style={assetSt.selectionDock}>
          <View style={assetSt.bulkActions}>
            <AssetBulkAction icon="share-outline" label="Share" disabled={!selectedAssets.length || bulkBusy} onPress={() => void shareSelectedAssets()} />
            <AssetBulkAction icon="cloud-upload-outline" label="Upload" disabled={!syncableSelected.length || bulkBusy} onPress={() => void syncSelectedAssets()} />
            <AssetBulkAction icon="trash-outline" label="Delete" destructive disabled={!removableSelected.length || bulkBusy} onPress={removeSelectedAssets} />
          </View>
        </View>
      ) : null}

      <MaterialPreviewModal
        material={selected?.material ?? null}
        onClose={() => setSelected(null)}
        onDelete={selected?.local ? () => {
          const localAsset = selected.local!;
          Alert.alert("Remove this asset?", "The on-device copy will be deleted from Tour.", [
            { text: "Keep", style: "cancel" },
            {
              text: "Remove",
              style: "destructive",
              onPress: () => void removeLocalAsset(localAsset.id).then(() => {
                setSelected(null);
                showToast("Asset removed", "success");
              }),
            },
          ]);
        } : undefined}
      />
      <VideoAssetRecorder
        visible={videoRecorderOpen}
        onClose={() => setVideoRecorderOpen(false)}
        onSaveLocal={saveRecordedVideo}
        onUpload={uploadRecordedVideo}
      />
      <BottomSheetModal
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        sheetHeight={Math.min(620, Dimensions.get("window").height * 0.78)}
        contentStyle={assetSt.filterSheet}
      >
        <ScrollView style={assetSt.filterSheetScroll} showsVerticalScrollIndicator={false} contentContainerStyle={assetSt.filterSheetScrollContent}>
          <View style={assetSt.filterSheetHeader}>
            <Text style={assetSt.filterSheetTitle}>Filter and sort</Text>
            <Text style={assetSt.filterSheetMeta}>{draftVisibleCount} of {displayAssets.length} assets match</Text>
          </View>

          <View style={assetSt.filterSection}>
            <Text style={assetSt.filterSectionTitle}>Type</Text>
            <View style={assetSt.filterChoices}>
              {ASSET_KIND_OPTIONS.map((option) => {
                const active = option.value === draftKindFilter;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      selectionHaptic();
                      setDraftKindFilter(option.value);
                    }}
                    style={({ pressed }) => [assetSt.filterChip, active && assetSt.filterChipActive, pressed && st.pressed]}
                  >
                    <Ionicons name={option.icon} size={15} color={active ? C.brand : C.textMuted} />
                    <Text style={[assetSt.filterChipText, active && assetSt.filterChipTextActive]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={assetSt.filterSection}>
            <Text style={assetSt.filterSectionTitle}>Status</Text>
            <View style={assetSt.filterChoices}>
              {ASSET_STATUS_OPTIONS.map((option) => {
                const active = option.value === draftStatusFilter;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      selectionHaptic();
                      setDraftStatusFilter(option.value);
                    }}
                    style={({ pressed }) => [assetSt.filterChip, active && assetSt.filterChipActive, pressed && st.pressed]}
                  >
                    <Ionicons name={option.icon} size={15} color={active ? C.brand : C.textMuted} />
                    <Text style={[assetSt.filterChipText, active && assetSt.filterChipTextActive]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={assetSt.filterSection}>
            <Text style={assetSt.filterSectionTitle}>Sort by</Text>
            <View style={assetSt.sortOptions}>
              {(["newest", "oldest", "name"] as AssetSort[]).map((option, index) => {
                const active = option === draftSort;
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      selectionHaptic();
                      setDraftSort(option);
                    }}
                    style={({ pressed }) => [assetSt.sortOption, index > 0 && assetSt.sortOptionBorder, pressed && st.pressed]}
                  >
                    <Ionicons name={option === "name" ? "text-outline" : option === "newest" ? "arrow-down-outline" : "arrow-up-outline"} size={17} color={active ? C.brand : C.textMuted} />
                    <Text style={assetSt.sortOptionText}>{option === "name" ? "Name" : option === "newest" ? "Newest first" : "Oldest first"}</Text>
                    {active ? <Ionicons name="checkmark-circle" size={19} color={C.brand} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>

        <View style={assetSt.filterFooter}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setDraftKindFilter("all");
              setDraftStatusFilter("all");
              setDraftSort("newest");
            }}
            style={({ pressed }) => [assetSt.filterReset, pressed && st.pressed]}
          >
            <Text style={assetSt.filterResetText}>Reset</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setAssetKindFilter(draftKindFilter);
              setAssetStatusFilter(draftStatusFilter);
              setAssetSort(draftSort);
              setFilterOpen(false);
            }}
            style={({ pressed }) => [assetSt.filterApply, pressed && st.pressed]}
          >
            <Text style={assetSt.filterApplyText}>Show {draftVisibleCount} {draftVisibleCount === 1 ? "asset" : "assets"}</Text>
          </Pressable>
        </View>
      </BottomSheetModal>
    </View>
  );
}

function MaterialPreviewModal({ material, onClose, onDelete }: { material: Material | null; onClose: () => void; onDelete?: () => void }) {
  const url = material ? materialUrl(material) : null;
  const previewUrl = material ? materialPreviewUrl(material) : null;
  const videoUrl = material?.media?.videoUrl ?? (!previewUrl && url && isVideoLikeUrl(url) ? url : null);

  async function shareSelected() {
    if (!material) return;
    try {
      await Share.share({
        title: material.name,
        message: url ? `${material.name}\n${url}` : material.name,
        url: url ?? undefined,
      });
    } catch {
      showToast("Could not open share sheet", "error");
    }
  }

  async function downloadSelected() {
    if (!material) return;
    await downloadMaterial(material);
  }

  return (
    <Modal visible={Boolean(material)} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={assetSt.modalScrim} onPress={onClose}>
        <Pressable onPress={(event) => event.stopPropagation()} style={assetSt.modalSheet}>
          <View style={assetSt.modalHandle} />
          <View style={assetSt.modalHeader}>
            <View style={st.flex1}>
              <Text style={assetSt.modalTitle} numberOfLines={2}>{material?.name}</Text>
              <Text style={assetSt.modalMeta}>{material ? `${material.type} · ${fmtDate(material.createdAt)}` : ""}</Text>
            </View>
            {onDelete ? (
              <Pressable accessibilityLabel="Remove local asset" onPress={onDelete} style={homeSt.headerIcon}>
                <Ionicons name="trash-outline" size={18} color={C.red} />
              </Pressable>
            ) : null}
            <Pressable accessibilityLabel="Close media preview" onPress={onClose} style={homeSt.headerIcon}>
              <Ionicons name="close" size={19} color={C.text} />
            </Pressable>
          </View>

          <View style={assetSt.modalPreview}>
            {videoUrl ? (
              <MaterialVideoPreview source={videoUrl} />
            ) : previewUrl ? (
              <Image source={{ uri: previewUrl }} style={assetSt.modalImage} resizeMode="cover" />
            ) : (
              <View style={assetSt.modalFallback}>
                <Ionicons name={url ? "play-circle-outline" : "document-outline"} size={52} color={C.brand} />
              </View>
            )}
          </View>

          <Text style={st.materialDesc}>{material?.description}</Text>

          <View style={assetSt.modalActions}>
            <Pressable onPress={() => void shareSelected()} style={({ pressed }) => [assetSt.modalSecondary, pressed && st.pressed]}>
              <Ionicons name="share-social-outline" size={16} color={C.text} />
              <Text style={assetSt.modalSecondaryText}>Share</Text>
            </Pressable>
            <Pressable disabled={!url} onPress={() => void downloadSelected()} style={({ pressed }) => [assetSt.modalSecondary, !url && { opacity: 0.55 }, pressed && st.pressed]}>
              <Ionicons name="download-outline" size={16} color={C.text} />
              <Text style={assetSt.modalSecondaryText}>Download</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function isVideoLikeUrl(url: string) {
  if (/^file:\/\//i.test(url)) return true;
  return /\.(mp4|mov|m4v|webm)(?:[?#].*)?$/i.test(url);
}

function materialDownloadName(material: Material, url: string) {
  const cleanName = material.name.trim().replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "tour-asset";
  const path = (() => {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  })();
  const extension = path.match(/\.([a-z0-9]{2,6})(?:$|[?#])/i)?.[0] ?? (material.media?.videoUrl ? ".mp4" : "");
  return cleanName.toLowerCase().endsWith(extension.toLowerCase()) ? cleanName : `${cleanName}${extension}`;
}

async function downloadMaterial(material: Material) {
  const url = materialUrl(material);
  if (!url) {
    showToast("No downloadable file found", "error");
    return;
  }

  try {
    if (Platform.OS === "web") {
      await Linking.openURL(url);
      return;
    }

    const localUri = url.startsWith("file://")
      ? url
      : (await FileSystem.File.downloadFileAsync(
          url,
          new FileSystem.File(FileSystem.Paths.document, `${Date.now()}-${materialDownloadName(material, url)}`),
          { idempotent: true }
        )).uri;

    await Share.share({
      title: material.name,
      message: material.name,
      url: localUri,
    });
  } catch {
    showToast("Could not download this asset", "error");
  }
}

function MaterialVideoPreview({ source }: { source: string }) {
  const player = useVideoPlayer(source, (vp) => {
    vp.loop = false;
  });
  return <VideoView player={player} style={assetSt.modalImage} contentFit="cover" nativeControls />;
}

// ═══════════════════════════════════════
// Audio Diagnostics
// ═══════════════════════════════════════

function AudioTestScreen({ onBack }: { onBack: () => void }) {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState("Ready to test your microphone.");
  const [busy, setBusy] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!recording) return undefined;
    const startedAt = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 250);
    return () => clearInterval(timer);
  }, [recording]);

  useEffect(() => () => {
    void recording?.stopAndUnloadAsync().catch(() => {});
    void sound?.unloadAsync().catch(() => {});
  }, [recording, sound]);

  async function startTestRecording() {
    if (busy || recording) return;
    setBusy(true);
    try {
      await sound?.unloadAsync().catch(() => {});
      setSound(null);
      setIsPlaying(false);
      setUri(null);
      setFileSize(null);
      setElapsed(0);

      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setStatus("Microphone permission was denied. Enable it for Tour in iOS Settings and try again.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const created = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(created.recording);
      setStatus("Recording. Speak for a few seconds, then stop and play it back.");
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Could not start audio test.");
    } finally {
      setBusy(false);
    }
  }

  async function stopTestRecording() {
    if (!recording || busy) return;
    setBusy(true);
    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const nextUri = recording.getURI();
      setRecording(null);
      setUri(nextUri);
      setStatus(nextUri ? "Recording saved. Play it back below." : "Recording stopped, but no file URI was returned.");

      if (nextUri) {
        const file = new FileSystem.File(nextUri);
        setFileSize(file.exists ? file.size : null);
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Could not stop the recording.");
    } finally {
      setBusy(false);
    }
  }

  async function playOrPause() {
    if (!uri || busy) return;
    setBusy(true);
    try {
      if (sound && isPlaying) {
        await sound.pauseAsync();
        setIsPlaying(false);
        setStatus("Playback paused.");
        return;
      }

      const currentSound = sound ?? (await Audio.Sound.createAsync({ uri }, { shouldPlay: false })).sound;
      if (!sound) {
        currentSound.setOnPlaybackStatusUpdate((playbackStatus) => {
          if (playbackStatus.isLoaded && playbackStatus.didJustFinish) {
            setIsPlaying(false);
            setStatus("Playback finished.");
          }
        });
        setSound(currentSound);
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      await currentSound.playAsync();
      setIsPlaying(true);
      setStatus("Playing recorded audio.");
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Could not play this recording.");
    } finally {
      setBusy(false);
    }
  }

  async function resetTest() {
    if (busy) return;
    await sound?.unloadAsync().catch(() => {});
    if (recording) await recording.stopAndUnloadAsync().catch(() => {});
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true }).catch(() => {});
    setSound(null);
    setRecording(null);
    setUri(null);
    setFileSize(null);
    setElapsed(0);
    setIsPlaying(false);
    setStatus("Ready to test your microphone.");
  }

  const canPlay = Boolean(uri) && !recording;
  const sizeLabel = fileSize === null ? "Not measured" : fileSize < 1024 ? `${fileSize} B` : `${(fileSize / 1024).toFixed(1)} KB`;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={st.scroll}>
      <View style={st.page}>
        <BackBtn label="Home" onPress={onBack} />
        <Text style={st.pageTitle}>Audio Test</Text>
        <Text style={st.pageSub}>Check microphone capture and playback before using live transcription.</Text>

        <View style={audioTestSt.hero}>
          <View style={[audioTestSt.micRing, recording && audioTestSt.micRingRecording]}>
            <Ionicons name={recording ? "radio" : "mic-outline"} size={42} color={recording ? C.red : C.brand} />
          </View>
          <Text style={audioTestSt.timer}>{formatElapsed(elapsed)}</Text>
          <Text style={audioTestSt.status}>{status}</Text>
        </View>

        <View style={audioTestSt.controls}>
          {recording ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Stop test recording" disabled={busy} onPress={stopTestRecording} style={({ pressed }) => [audioTestSt.stopButton, pressed && st.pressed, busy && { opacity: 0.5 }]}>
              <Ionicons name="stop" size={22} color="#fff" />
              <Text style={audioTestSt.primaryText}>Stop</Text>
            </Pressable>
          ) : (
            <Pressable accessibilityRole="button" accessibilityLabel="Start test recording" disabled={busy} onPress={startTestRecording} style={({ pressed }) => [audioTestSt.recordButton, pressed && st.pressed, busy && { opacity: 0.5 }]}>
              <Ionicons name="mic" size={22} color="#fff" />
              <Text style={audioTestSt.primaryText}>Record Test Clip</Text>
            </Pressable>
          )}

          <Pressable accessibilityRole="button" accessibilityLabel={isPlaying ? "Pause test playback" : "Play test recording"} disabled={!canPlay || busy} onPress={playOrPause} style={({ pressed }) => [audioTestSt.secondaryButton, (!canPlay || busy) && { opacity: 0.5 }, pressed && st.pressed]}>
            <Ionicons name={isPlaying ? "pause" : "play"} size={20} color={C.brand} />
            <Text style={audioTestSt.secondaryText}>{isPlaying ? "Pause" : "Play Back"}</Text>
          </Pressable>
        </View>

        <View style={audioTestSt.infoCard}>
          <AudioTestRow label="Captured file" value={uri ? "Created" : "None yet"} />
          <AudioTestRow label="File size" value={sizeLabel} />
          <AudioTestRow label="URI" value={uri ?? "Record a clip first"} />
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel="Reset audio test" onPress={resetTest} style={({ pressed }) => [audioTestSt.resetButton, pressed && st.pressed]}>
          <Ionicons name="refresh" size={18} color={C.textSec} />
          <Text style={audioTestSt.resetText}>Reset test</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function AudioTestRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={audioTestSt.infoRow}>
      <Text style={audioTestSt.infoLabel}>{label}</Text>
      <Text style={audioTestSt.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

// ═══════════════════════════════════════
// Create Session
// ═══════════════════════════════════════

function CreateSessionScreen({
  onBack,
  onCreated,
  onLiveRecordingOpened,
  onRecordingFinished,
  onBulkUpload,
  pendingUpload,
  onPendingUploadHandled,
  agentName,
}: {
  onBack: () => void;
  onCreated: (id: string) => void;
  onLiveRecordingOpened: () => void;
  onRecordingFinished: (payload: PendingCreateSessionUpload) => void;
  onBulkUpload: () => void;
  pendingUpload: PendingCreateSessionUpload | null;
  onPendingUploadHandled: () => void;
  agentName?: string | null;
}) {
  const rec = useRecording();
  const insets = useSafeAreaInsets();

  const [phase, setPhase] = useState<"choose" | "practice" | "uploading" | "details">(pendingUpload ? "uploading" : "choose");
  const [uploadStats, setUploadStats] = useState<UploadStats>(initialUploadStats());
  const [sessionId, setSessionId] = useState<string | null>(pendingUpload?.sessionId ?? null);
  const [fileName, setFileName] = useState(pendingUpload?.name ?? "");
  const [fileSizeMB, setFileSizeMB] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createOptionsReady, setCreateOptionsReady] = useState(false);
  const recorderOpenedRef = useRef(false);
  const startRecordingRef = useRef<() => void>(() => {});
  const pendingUploadStartedRef = useRef<string | null>(null);

  const [title, setTitle] = useState("");
  const [prospect, setProspect] = useState(pendingUpload?.draft.prospect ?? "");
  const [customerInterests, setCustomerInterests] = useState<SessionCustomerInterest[]>([]);
  const [location, setLocation] = useState(pendingUpload?.draft.location ?? "");
  const [notes, setNotes] = useState(pendingUpload?.draft.notes ?? "");
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [rubricId, setRubricId] = useState<string | null>(pendingUpload?.draft.rubricId ?? null);
  const [rubricOpen, setRubricOpen] = useState(false);
  const [assets, setAssets] = useState<Material[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>(pendingUpload?.draft.selectedAssetIds ?? []);
  const [uploaderIsAgent, setUploaderIsAgent] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchRubrics(),
      fetchMaterials().catch(() => ({ materials: [] as Material[] })),
    ])
      .then(([{ rubrics: list }, materialData]) => {
        setRubrics(list);
        setAssets(materialData.materials.filter((material) => materialUrl(material)));
        if (list.length > 0) {
          const defaultRubric = list.find((r) => r.isDefault) ?? list[0];
          if (defaultRubric) setRubricId(defaultRubric.id);
        }
      })
      .catch(() => { /* rubric picker optional */ })
      .finally(() => setCreateOptionsReady(true));
  }, []);

  async function uploadFile(
    uri: string,
    mimeType: string,
    name: string,
    size?: number | null,
    durationSec?: number,
    existingSessionId?: string | null,
    draftOverrides?: {
      notes?: string;
      prospect?: string;
      location?: string;
      rubricId?: string | null;
      uploaderIsAgent?: boolean;
    },
    localId?: string | null,
  ) {
    setFileName(name);
    setFileSizeMB(size ? (size / 1024 / 1024).toFixed(1) : null);
    setPhase("uploading");
    setUploadStats(initialUploadStats(size));

    const nextProspect = draftOverrides?.prospect ?? prospect;
    const nextLocation = draftOverrides?.location ?? location;
    const nextNotes = draftOverrides?.notes ?? notes;
    const nextRubricId = draftOverrides?.rubricId !== undefined ? draftOverrides.rubricId : rubricId;
    const nextUploaderIsAgent = draftOverrides?.uploaderIsAgent ?? uploaderIsAgent;
    let sid = existingSessionId ?? sessionId;
    const durableUri = localId
      ? ((await ensureDurableRecording(localId, uri)) ?? getRecordingUri(localId) ?? uri)
      : uri;

    if (localId) {
      markReadyToSync(localId, {
        durationSec: durationSec ?? 1,
        sourceUri: durableUri,
        remoteSessionId: sid,
        draft: {
          notes: nextNotes,
          assets,
          selectedAssetIds,
          participants: [],
          attachments: [],
          prospect: nextProspect,
          location: nextLocation,
          rubricId: nextRubricId,
          uploaderIsAgent: nextUploaderIsAgent,
        },
        fileName: name,
        mimeType,
      });
    }

    try {
      const automaticTitle = formatRecordingUploadTitle(new Date());
      const hasCustomTitle = Boolean(title.trim());
      if (!sid) {
        if (!(await isOnline())) {
          showToast("Saved on device — will upload when online", "info");
          recorderOpenedRef.current = false;
          setPhase("choose");
          void drainSyncOutbox();
          return;
        }
        const sessionData = await createSession({
          title: title.trim() || automaticTitle,
          titleIsAuto: !hasCustomTitle,
          sourceFileName: name,
          scheduledAt: new Date().toISOString(),
          prospectName: nextProspect.trim() || null,
          uploaderIsAgent: nextUploaderIsAgent,
          location: nextLocation.trim() || null,
          notes: nextNotes.trim() || null,
          rubricId: nextRubricId,
        });
        sid = sessionData.session.id;
        setSessionId(sid);
        if (localId) updateLocalSession(localId, { remoteSessionId: sid });
      }
      if (!hasCustomTitle) setTitle(automaticTitle);
      if (draftOverrides?.notes !== undefined) setNotes(draftOverrides.notes);
      if (draftOverrides?.prospect !== undefined) setProspect(draftOverrides.prospect);
      if (draftOverrides?.location !== undefined) setLocation(draftOverrides.location);
      if (draftOverrides?.rubricId !== undefined && draftOverrides.rubricId) setRubricId(draftOverrides.rubricId);
      if (draftOverrides?.uploaderIsAgent !== undefined) setUploaderIsAgent(draftOverrides.uploaderIsAgent);

      await uploadRecording(sid, durableUri, mimeType, name, durationSec, (next) => setUploadStats(uploadStatsFromProgress(next)));
      await clearPendingRecordingUpload(sid, localId);
      promoteLocalRecordingToCache(sid, durableUri);
      void trackAnalyticsEvent("session_upload_complete", { sessionId: sid });
      setUploadStats((current) => ({ ...current, phase: "finalizing", percent: 100, etaSeconds: 0 }));
      showToast("Recording uploaded", "success");
      setPhase("details");
    } catch (err) {
      if (localId) {
        markReadyToSync(localId, {
          durationSec: durationSec ?? 1,
          sourceUri: durableUri,
          remoteSessionId: sid,
          draft: {
            notes: nextNotes,
            assets,
            selectedAssetIds,
            participants: [],
            attachments: [],
            prospect: nextProspect,
            location: nextLocation,
            rubricId: nextRubricId,
            uploaderIsAgent: nextUploaderIsAgent,
          },
          fileName: name,
          mimeType,
        });
      } else if (sid) {
        await savePendingRecordingUpload({
          sessionId: sid,
          uri: durableUri,
          mimeType,
          name,
          size: size ?? undefined,
          durationSec,
          savedAt: Date.now(),
        });
      }
      const online = await isOnline();
      showToast(
        online ? (err instanceof Error ? err.message : "Upload failed") : "Saved on device — will upload when online",
        online ? "error" : "info",
      );
      recorderOpenedRef.current = false;
      setPhase("choose");
      void drainSyncOutbox();
    }
  }

  useEffect(() => {
    if (!pendingUpload) return;
    if (pendingUploadStartedRef.current === pendingUpload.uri) return;
    pendingUploadStartedRef.current = pendingUpload.uri;

    setProspect(pendingUpload.draft.prospect);
    setLocation(pendingUpload.draft.location);
    setNotes(pendingUpload.draft.notes);
    setSelectedAssetIds(pendingUpload.draft.selectedAssetIds);
    if (pendingUpload.draft.rubricId) setRubricId(pendingUpload.draft.rubricId);
    if (pendingUpload.sessionId) setSessionId(pendingUpload.sessionId);
    onPendingUploadHandled();

    void uploadFile(
      pendingUpload.uri,
      pendingUpload.mimeType,
      pendingUpload.name,
      null,
      pendingUpload.durationSec,
      pendingUpload.sessionId,
      pendingUpload.draft,
      pendingUpload.localId,
    );
    // Intentionally run once per pending upload payload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingUpload]);

  function startRecording() {
    rec.openExperience({
      meta: {
        sessionId: null,
        title: title.trim() || formatRecordingUploadTitle(new Date()),
        prospectName: prospect.trim() || null,
        propertyName: location.trim() || null,
        agentName: uploaderIsAgent ? agentName?.trim() || null : null,
        source: "create-session",
      },
      draft: {
        notes,
        assets,
        selectedAssetIds,
        participants: [],
        attachments: [],
        prospect,
        location,
        rubricId,
        uploaderIsAgent,
      },
      onBeforeRecordingStart: () => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      },
      onUploadFile: pickFile,
      onMinimize: onLiveRecordingOpened,
      onCancel: async (snapshot) => {
        await snapshot.stop();
        snapshot.clearLiveSession();
        showToast("Recording cancelled", "info");
        onBack();
      },
      onFinish: async (snapshot) => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const result = await snapshot.stop();
        const meta = snapshot.meta;
        const draft = snapshot.draft;
        const localId = snapshot.localId;
        if (!result?.uri) {
          snapshot.clearLiveSession();
          showToast("Failed to save recording", "error");
          return;
        }
        let durableUri = result.uri;
        if (localId) {
          durableUri = (await ensureDurableRecording(localId, result.uri)) ?? result.uri;
          markReadyToSync(localId, {
            durationSec: result.durationSec,
            sourceUri: durableUri,
            remoteSessionId: meta.sessionId,
            draft,
            fileName: `tour-${Date.now()}.m4a`,
            mimeType: "audio/m4a",
          });
          durableUri = getRecordingUri(localId) ?? durableUri;
        }
        snapshot.clearLiveSession();
        onRecordingFinished({
          localId,
          uri: durableUri,
          mimeType: "audio/m4a",
          name: `tour-${Date.now()}.m4a`,
          durationSec: result.durationSec,
          sessionId: meta.sessionId,
          draft: {
            notes: draft.notes,
            prospect: draft.prospect,
            location: draft.location,
            rubricId: draft.rubricId,
            selectedAssetIds: draft.selectedAssetIds,
            uploaderIsAgent: draft.uploaderIsAgent,
          },
        });
      },
    });
  }
  startRecordingRef.current = startRecording;

  async function pickFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["video/*", "audio/*"], copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const file = result.assets[0];
      rec.clearLiveSession();
      await uploadFile(file.uri, file.mimeType ?? "video/mp4", file.name ?? "recording.mp4", file.size);
    } catch {
      showToast("Could not select file", "error");
    }
  }

  async function submitAndProcess() {
    if (!sessionId) return;
    setSubmitting(true);

    const patchBody: Record<string, unknown> = {};
    if (title.trim()) patchBody.title = title.trim();
    if (prospect.trim()) patchBody.prospectName = prospect.trim();
    if (location.trim()) patchBody.location = location.trim();
    if (notes.trim()) patchBody.notes = notes.trim();
    if (rubricId) patchBody.rubricId = rubricId;
    if (customerInterests.length > 0) patchBody.customerInterests = customerInterests;

    if (Object.keys(patchBody).length > 0) {
      try {
        await authenticatedFetch(`/api/sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchBody),
        });
      } catch { /* best effort */ }
    }

    onCreated(sessionId);
  }

  if (phase === "practice") {
    return (
      <PracticeSessionsScreen
        onBack={() => setPhase("choose")}
        onOpenNewSession={() => setPhase("choose")}
      />
    );
  }

  // ── Choose: Record or Upload ──
  if (phase === "choose") {
    return (
      <View style={createSessionChoiceSt.root}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[st.scroll, createSessionChoiceSt.scroll]}
        >
          <View style={st.page}>
            <View style={createSessionChoiceSt.header}>
              <MotionPressable accessibilityRole="button" accessibilityLabel="Back to sessions" onPress={onBack} style={createSessionChoiceSt.backButton}>
                <Ionicons name="arrow-back" size={20} color={C.text} />
              </MotionPressable>
              <Text style={createSessionChoiceSt.pageTitle}>New session</Text>
            </View>
            <CreateSessionModeTabs
              active="session"
              onSession={() => undefined}
              onPractice={() => setPhase("practice")}
            />

            <View style={createSessionChoiceSt.liveCard}>
              <View style={createSessionChoiceSt.liveCardHeader}>
                <View style={createSessionChoiceSt.liveIcon}>
                  <Ionicons name="radio-outline" size={20} color={C.brand} />
                </View>
                <View style={st.flex1}>
                  <Text style={createSessionChoiceSt.liveTitle}>Record this tour live</Text>
                  <Text style={createSessionChoiceSt.liveCopy}>Capture the conversation and follow the transcript as it happens.</Text>
                </View>
              </View>
              <View style={createSessionChoiceSt.liveFeatures}>
                <View style={createSessionChoiceSt.liveFeature}>
                  <Ionicons name="timer-outline" size={15} color={C.textSec} />
                  <Text style={createSessionChoiceSt.liveFeatureText}>3-second countdown</Text>
                </View>
                <View style={createSessionChoiceSt.liveFeature}>
                  <Ionicons name="text-outline" size={15} color={C.textSec} />
                  <Text style={createSessionChoiceSt.liveFeatureText}>Live transcription</Text>
                </View>
              </View>
            </View>

            <AgentIdentityToggle
              selected={uploaderIsAgent}
              agentName={agentName}
              onToggle={() => {
                setUploaderIsAgent((value) => !value);
                void Haptics.selectionAsync();
              }}
            />

            <View style={createSessionChoiceSt.uploadHeading}>
              <Text style={createSessionChoiceSt.uploadTitle}>Already recorded the tour?</Text>
              <Text style={createSessionChoiceSt.uploadCopy}>Upload audio or video to create a review.</Text>
            </View>
            <View style={createSessionChoiceSt.importList}>
              <Pressable onPress={pickFile} disabled={!createOptionsReady} style={({ pressed }) => [createSessionChoiceSt.importRow, pressed && st.pressed]}>
                <View style={createSessionChoiceSt.importIcon}>
                  <Ionicons name="cloud-upload-outline" size={19} color={C.textSec} />
                </View>
                <View style={st.flex1}>
                  <Text style={createSessionChoiceSt.importTitle}>Upload one recording</Text>
                  <Text style={createSessionChoiceSt.importCopy}>Choose one audio or video file</Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={C.textMuted} />
              </Pressable>
              <View style={createSessionChoiceSt.importDivider} />
              <Pressable onPress={onBulkUpload} disabled={!createOptionsReady} style={({ pressed }) => [createSessionChoiceSt.importRow, pressed && st.pressed]}>
                <View style={createSessionChoiceSt.importIcon}>
                  <Ionicons name="copy-outline" size={19} color={C.textSec} />
                </View>
                <View style={st.flex1}>
                  <Text style={createSessionChoiceSt.importTitle}>Upload multiple recordings</Text>
                  <Text style={createSessionChoiceSt.importCopy}>Create a separate session for each file</Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={C.textMuted} />
              </Pressable>
            </View>
          </View>
        </ScrollView>

        <View style={[createSessionChoiceSt.bottomDock, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel="Start recording"
            disabled={!createOptionsReady}
            haptic="medium"
            onPress={startRecording}
            style={createSessionChoiceSt.startRecordingButton}
          >
            <Ionicons name="mic" size={28} color="#fff" />
          </MotionPressable>
        </View>
      </View>
    );
  }

  // ── Uploading ──
  if (phase === "uploading") {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={st.scroll}>
        <View style={st.page}>
          <BackBtn label="Sessions" onPress={onBack} />
          <Text style={st.pageTitle}>New Session</Text>
          <UploadStatusCard
            fileName={fileName}
            fileSize={fileSizeMB ? Number(fileSizeMB) * 1024 * 1024 : null}
            stats={uploadStats}
          />
        </View>
      </ScrollView>
    );
  }

  // ── Details form after upload ──
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={st.scroll}>
      <View style={st.page}>
        <BackBtn label="Sessions" onPress={onBack} />
        <Text style={st.pageTitle}>New Session</Text>

        <View style={[st.card, { overflow: "hidden" }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 14, backgroundColor: C.greenBg, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" }}>
            <Ionicons name="checkmark-circle" size={20} color={C.green} />
            <View style={st.flex1}>
              <Text style={{ fontSize: 13, fontWeight: "800", color: C.green }}>Recording uploaded</Text>
              <Text style={{ fontSize: 12, fontWeight: "600", color: C.textSec }} numberOfLines={1}>{fileName}{fileSizeMB ? ` (${fileSizeMB} MB)` : ""}</Text>
            </View>
          </View>

          <View style={{ padding: 18, gap: 14 }}>
            <Text style={st.formTitle}>Session Details</Text>
            <Text style={{ fontSize: 13, fontWeight: "600", color: C.textSec, marginTop: -8 }}>Add context to improve your analysis</Text>
            <AgentIdentityToggle
              selected={uploaderIsAgent}
              agentName={agentName}
              onToggle={() => {
                setUploaderIsAgent((value) => !value);
                void Haptics.selectionAsync();
              }}
            />
            <Input placeholder="Session title" value={title} onChangeText={setTitle} icon="text-outline" />
            <Input placeholder="Prospect name" value={prospect} onChangeText={setProspect} icon="person-outline" />
            <ProspectInterestPicker interests={customerInterests} onChange={setCustomerInterests} />
            <Input placeholder="Location / unit" value={location} onChangeText={setLocation} icon="location-outline" />
            {rubrics.length > 0 && (
              <View>
                <Text style={{ fontSize: 12, fontWeight: "800", color: C.textSec, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Evaluation rubric</Text>
                <Pressable onPress={() => setRubricOpen((o) => !o)} style={({ pressed }) => [st.inputWrap, pressed && st.pressed]}>
                  <Ionicons name="clipboard-outline" size={18} color={C.textMuted} />
                  <Text style={[st.inputField, { flex: 1, paddingVertical: 0 }]} numberOfLines={1}>
                    {rubrics.find((r) => r.id === rubricId)?.name ?? "Select a rubric"}
                  </Text>
                  <Ionicons name={rubricOpen ? "chevron-up" : "chevron-down"} size={16} color={C.textMuted} />
                </Pressable>
                {rubricOpen && (
                  <View style={{ marginTop: 8, gap: 6 }}>
                    {rubrics.map((rubric) => (
                      <Pressable
                        key={rubric.id}
                        onPress={() => {
                          setRubricId(rubric.id);
                          setRubricOpen(false);
                        }}
                        style={({ pressed }) => [{ padding: 12, borderRadius: 12, backgroundColor: rubric.id === rubricId ? C.brand + "12" : C.bg }, pressed && st.pressed]}
                      >
                        <Text style={{ fontSize: 14, fontWeight: "700", color: C.text }}>{rubric.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            )}
            <Input placeholder="Notes or focus areas" value={notes} onChangeText={setNotes} icon="document-text-outline" multiline />
            <PrimaryBtn label={submitting ? "Opening..." : "Continue"} onPress={() => void submitAndProcess()} icon="arrow-forward" disabled={submitting} />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function CreateSessionModeTabs({
  active,
  onSession,
  onPractice,
}: {
  active: "session" | "practice";
  onSession: () => void;
  onPractice: () => void;
}) {
  return (
    <View style={createSessionTabsSt.wrap} accessibilityRole="tablist">
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: active === "session" }}
        onPress={onSession}
        style={[createSessionTabsSt.tab, active === "session" && createSessionTabsSt.tabActive]}
      >
        <Ionicons name="mic-outline" size={15} color={active === "session" ? C.brand : C.textMuted} />
        <Text style={[createSessionTabsSt.label, active === "session" && createSessionTabsSt.labelActive]}>New session</Text>
      </Pressable>
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: active === "practice" }}
        onPress={onPractice}
        style={[createSessionTabsSt.tab, active === "practice" && createSessionTabsSt.tabActive]}
      >
        <Ionicons name="sparkles-outline" size={15} color={active === "practice" ? C.brand : C.textMuted} />
        <Text style={[createSessionTabsSt.label, active === "practice" && createSessionTabsSt.labelActive]}>Practice</Text>
      </Pressable>
    </View>
  );
}

const createSessionTabsSt = StyleSheet.create({
  wrap: { flexDirection: "row", gap: 4, padding: 4, borderWidth: 1, borderColor: C.border, borderRadius: 13, backgroundColor: C.card },
  tab: { flex: 1, minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 9 },
  tabActive: { backgroundColor: C.brand + "10" },
  label: { color: C.textMuted, fontSize: 12, fontWeight: "800" },
  labelActive: { color: C.brand },
});

const createSessionChoiceSt = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingTop: 18, paddingBottom: 18 },
  header: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border, borderRadius: 12, backgroundColor: C.card },
  pageTitle: { color: C.text, fontSize: 26, lineHeight: 32, fontWeight: "900" },
  liveCard: { gap: 15, padding: 16, borderWidth: 1, borderColor: C.border, borderRadius: 14, backgroundColor: C.card },
  liveCardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  liveIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: C.brand + "10" },
  liveTitle: { color: C.text, fontSize: 16, lineHeight: 21, fontWeight: "900" },
  liveCopy: { marginTop: 3, color: C.textSec, fontSize: 12, lineHeight: 17, fontWeight: "600" },
  liveFeatures: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  liveFeature: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9, backgroundColor: "#f4f6f9" },
  liveFeatureText: { color: C.textSec, fontSize: 10, fontWeight: "800" },
  uploadHeading: { gap: 2, marginTop: 4 },
  uploadTitle: { color: C.text, fontSize: 15, lineHeight: 20, fontWeight: "900" },
  uploadCopy: { color: C.textSec, fontSize: 11, lineHeight: 16, fontWeight: "600" },
  importList: { overflow: "hidden", borderWidth: 1, borderColor: C.border, borderRadius: 12, backgroundColor: C.card },
  importRow: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 13, paddingVertical: 9 },
  importIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "#f1f5f9" },
  importTitle: { color: C.text, fontSize: 13, fontWeight: "900" },
  importCopy: { marginTop: 2, color: C.textSec, fontSize: 11, lineHeight: 15, fontWeight: "600" },
  importDivider: { height: StyleSheet.hairlineWidth, marginLeft: 60, backgroundColor: C.border },
  bottomDock: { alignItems: "center", paddingHorizontal: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border, backgroundColor: C.card },
  startRecordingButton: { width: 72, height: 72, alignItems: "center", justifyContent: "center", borderRadius: 36, borderWidth: 5, borderColor: "#dbeafe", backgroundColor: C.brand, shadowColor: C.brand, shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.24, shadowRadius: 14, elevation: 5 },
});

function AgentIdentityToggle({
  selected,
  agentName,
  disabled,
  onToggle,
}: {
  selected: boolean;
  agentName?: string | null;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel="I am the leasing agent"
      onPress={onToggle}
      disabled={disabled}
      style={({ pressed }) => [
        st.agentToggle,
        selected && st.agentToggleSelected,
        pressed && st.pressed,
        disabled && { opacity: 0.6 },
      ]}
    >
      <View style={st.flex1}>
        <Text style={st.agentToggleTitle}>{selected ? "You’re the leasing agent" : "Identify the agent from audio"}</Text>
        <Text style={st.agentToggleCopy}>
          {selected
            ? `Use ${agentName?.trim() || "your profile name"} for this session.`
            : "Tour will assign the speakers after upload."}
        </Text>
      </View>
      <Switch
        pointerEvents="none"
        value={selected}
        disabled={disabled}
        trackColor={{ false: "#d0d5dd", true: C.brand }}
        thumbColor="#fff"
        ios_backgroundColor="#d0d5dd"
      />
    </Pressable>
  );
}

const MOBILE_INTEREST_CHOICES: Array<{ category: ProspectInterestCategory; detail: string }> = [
  { category: "floor_plan", detail: "1 bedroom" },
  { category: "floor_plan", detail: "2 bedroom" },
  { category: "budget_specials", detail: "Budget" },
  { category: "move_in_timing", detail: "Move-in timing" },
  { category: "amenities", detail: "Amenities" },
  { category: "pets", detail: "Pet friendly" },
  { category: "parking_transportation", detail: "Parking" },
  { category: "lease_terms", detail: "Lease terms" },
];

function ProspectInterestPicker({
  interests,
  onChange,
}: {
  interests: SessionCustomerInterest[];
  onChange: (next: SessionCustomerInterest[]) => void;
}) {
  const [customInterest, setCustomInterest] = useState("");
  const selected = new Set(interests.map((interest) => interest.detail.toLowerCase()));

  function addInterest(category: ProspectInterestCategory, detail: string) {
    const clean = detail.trim().slice(0, 120);
    if (!clean || selected.has(clean.toLowerCase()) || interests.length >= 8) return;
    onChange([...interests, { id: `mobile-${Date.now()}-${interests.length}`, category, detail: clean }]);
    setCustomInterest("");
  }

  return (
    <View style={prospectFormSt.wrap}>
      <View style={prospectFormSt.heading}>
        <View style={prospectFormSt.icon}><Ionicons name="heart-outline" size={16} color={C.brand} /></View>
        <View style={st.flex1}>
          <Text style={prospectFormSt.title}>Prospect interests</Text>
          <Text style={prospectFormSt.subtitle}>Optional context for a more tailored analysis</Text>
        </View>
      </View>

      {interests.length > 0 ? (
        <View style={prospectFormSt.selectedList}>
          {interests.map((interest) => (
            <Pressable
              key={interest.id}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${interest.detail}`}
              onPress={() => onChange(interests.filter((item) => item.id !== interest.id))}
              style={prospectFormSt.selectedChip}
            >
              <Text style={prospectFormSt.selectedChipText}>{interest.detail}</Text>
              <Ionicons name="close" size={14} color={C.brand} />
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={prospectFormSt.optionList}>
        {MOBILE_INTEREST_CHOICES.filter((choice) => !selected.has(choice.detail.toLowerCase())).map((choice) => (
          <Pressable
            key={choice.detail}
            accessibilityRole="button"
            accessibilityLabel={`Add ${choice.detail}`}
            onPress={() => addInterest(choice.category, choice.detail)}
            style={({ pressed }) => [prospectFormSt.option, pressed && st.pressed]}
          >
            <Text style={prospectFormSt.optionText}>{choice.detail}</Text>
            <Ionicons name="add" size={14} color={C.textMuted} />
          </Pressable>
        ))}
      </View>

      {interests.length < 8 ? (
        <View style={prospectFormSt.customRow}>
          <TextInput
            value={customInterest}
            onChangeText={setCustomInterest}
            onSubmitEditing={() => addInterest("other", customInterest)}
            placeholder="Add a specific interest"
            placeholderTextColor={C.textMuted}
            returnKeyType="done"
            style={prospectFormSt.customInput}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add custom prospect interest"
            disabled={!customInterest.trim()}
            onPress={() => addInterest("other", customInterest)}
            style={({ pressed }) => [prospectFormSt.addButton, !customInterest.trim() && prospectFormSt.addButtonDisabled, pressed && st.pressed]}
          >
            <Ionicons name="add" size={18} color="#fff" />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const prospectFormSt = StyleSheet.create({
  wrap: { gap: 10, padding: 13, borderWidth: 1, borderColor: "#dbeafe", borderRadius: 14, backgroundColor: "#f8fbff" },
  heading: { flexDirection: "row", alignItems: "center", gap: 9 },
  icon: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "#eaf2ff" },
  title: { color: C.text, fontSize: 13, fontWeight: "900" },
  subtitle: { marginTop: 1, color: C.textSec, fontSize: 11, lineHeight: 15, fontWeight: "600" },
  selectedList: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  selectedChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, backgroundColor: "#eaf2ff" },
  selectedChipText: { color: C.brand, fontSize: 12, fontWeight: "800" },
  optionList: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  option: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 8, paddingVertical: 6, borderWidth: 1, borderColor: "#d7dee8", borderRadius: 999, backgroundColor: "#fff" },
  optionText: { color: C.textSec, fontSize: 11, fontWeight: "700" },
  customRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 40, paddingLeft: 10, borderWidth: 1, borderColor: "#d7dee8", borderRadius: 11, backgroundColor: "#fff" },
  customInput: { flex: 1, minWidth: 0, color: C.text, fontSize: 13, fontWeight: "700", paddingVertical: 9 },
  addButton: { width: 36, alignSelf: "stretch", alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: C.brand },
  addButtonDisabled: { opacity: 0.4 },
});

// ═══════════════════════════════════════
// Session Detail
// ═══════════════════════════════════════

type DTab = "overview" | "rubric" | "transcript" | "actions" | "comments";

type TranscriptAnnotation = {
  id: string;
  kind: "ai_note" | "comment" | "key_moment";
  title: string;
  body: string;
  timestampSec: number | null;
};

function transcriptAnnotationChipLabel(kind: TranscriptAnnotation["kind"]) {
  if (kind === "ai_note") return "AI notes";
  if (kind === "key_moment") return "Key moments";
  return "Comments";
}

function transcriptAnnotationChipIcon(kind: TranscriptAnnotation["kind"]): keyof typeof Ionicons.glyphMap {
  if (kind === "ai_note") return "sparkles";
  if (kind === "key_moment") return "film-outline";
  return "chatbubble-outline";
}

function transcriptAnnotationChipColor(kind: TranscriptAnnotation["kind"]) {
  void kind;
  return C.brand;
}

function SampleSessionDetailScreen({ sessionId, onBack }: { sessionId: string; onBack: () => void }) {
  const sampleQuery = useSampleSessionQuery(sessionId);
  const sample = sampleQuery.data;

  if (sampleQuery.isLoading && !sample) return <SessionReviewSkeleton onBack={onBack} />;
  if (!sample) {
    return (
      <View style={[st.flex1, st.center, { gap: 12, padding: 24 }]}>
        <Ionicons name="alert-circle-outline" size={48} color={C.red} />
        <Text style={[st.emptyTitle, { textAlign: "center" }]}>
          {sampleQuery.error instanceof Error ? sampleQuery.error.message : "Sample session not found"}
        </Text>
        <BackBtn label="Sample sessions" onPress={onBack} />
      </View>
    );
  }

  return (
    <SessionReviewExperience
      session={sample.session}
      analysis={sample.analysis}
      transcript={sample.transcript}
      phases={sample.phases}
      comments={[]}
      actions={sample.actions}
      audioInsights={null}
      audioInsightsStatus="unavailable"
      sessionId={sessionId}
      onBack={onBack}
      onReload={() => void sampleQuery.refetch()}
      onOpenComments={() => undefined}
      onOpenAiChat={() => undefined}
      onOpenAudioInsights={() => undefined}
      onOpenReport={() => undefined}
      readOnly
    />
  );
}

function CheckedInVisitorsCard({ leads }: { leads: SessionSummary["leads"] }) {
  const visibleLeads = leads.slice(0, 3);
  const names = leads.map((lead) => lead.name.trim()).filter(Boolean);
  const namesLabel = names.length <= 2
    ? names.join(" & ")
    : `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
  const visitorLabel = `${leads.length} ${leads.length === 1 ? "visitor" : "visitors"} checked in`;

  return (
    <Reanimated.View entering={FadeInDown.duration(220)} style={st.checkedInCard}>
      <View style={st.checkedInAvatars}>
        {visibleLeads.map((lead, index) => (
          <View
            key={`${lead.createdAt}-${lead.email ?? ""}-${lead.phone ?? ""}`}
            style={[st.checkedInAvatar, index > 0 && st.checkedInAvatarOverlap, { zIndex: visibleLeads.length - index }]}
          >
            <Text style={st.checkedInAvatarText}>{lead.name.slice(0, 1).toUpperCase()}</Text>
          </View>
        ))}
      </View>
      <View style={st.flex1}>
        <Text style={st.checkedInName} numberOfLines={1}>{namesLabel || "Visitor ready"}</Text>
        <Text style={st.checkedInContact}>{visitorLabel} · Ready to begin</Text>
      </View>
      <View style={st.checkedInState}>
        <Ionicons name="checkmark" size={15} color={C.green} />
      </View>
    </Reanimated.View>
  );
}

function SessionDetailScreen({
  sessionId,
  autoStartRecording = false,
  onBack,
  onOpenComments,
  onOpenAiChat,
  onOpenAudioInsights,
  onOpenReport,
}: {
  sessionId: string;
  autoStartRecording?: boolean;
  onBack: () => void;
  onOpenComments: (meta: { sessionId: string; sessionTitle?: string }) => void;
  onOpenAiChat: (meta: { sessionId: string; sessionTitle?: string; prospectName?: string }) => void;
  onOpenReport: (sessionId: string) => void;
  onOpenAudioInsights: (meta: {
    sessionId: string;
    sessionTitle?: string;
    initialStatus?: AudioInsightsStatus;
    initialInsights?: AudioInsights | null;
  }) => void;
}) {
  const [tab, setTab] = useState<DTab>("overview");
  const [refreshing, setRefreshing] = useState(false);
  const sessionQuery = useSessionQuery(sessionId);
  const analysisQuery = useAnalysisQuery(sessionId);
  const actionsQuery = useActionsQuery(sessionId);
  const transcriptQuery = useTranscriptQuery(sessionId);
  const commentsQuery = useCommentsQuery(sessionId);
  const session = sessionQuery.data?.session ?? null;
  const analysis = analysisQuery.data?.analysis ?? null;
  const actions = actionsQuery.data?.actions ?? [];
  const transcript = transcriptQuery.data?.transcript ?? [];
  const phases = sessionQuery.data?.phases ?? null;
  const comments = commentsQuery.data?.comments ?? [];
  const shouldFetchAudioInsights = session?.audioInsightsStatus === "ready" || session?.audioInsightsStatus === "processing";
  const audioInsightsQuery = useAudioInsightsQuery(sessionId, shouldFetchAudioInsights);
  const audioInsightsStatus = audioInsightsQuery.data?.status ?? session?.audioInsightsStatus ?? "pending";
  const audioInsights = audioInsightsQuery.data?.insights ?? null;
  const loading = sessionQuery.isLoading;
  const error =
    sessionQuery.error ??
    analysisQuery.error ??
    actionsQuery.error ??
    transcriptQuery.error ??
    commentsQuery.error ??
    null;

  useEffect(() => {
    void trackAnalyticsEvent("session_view_detail", { sessionId });
  }, [sessionId]);

  const load = useCallback(async () => {
    await Promise.all([
      sessionQuery.refetch(),
      analysisQuery.refetch(),
      actionsQuery.refetch(),
      transcriptQuery.refetch(),
      commentsQuery.refetch(),
      shouldFetchAudioInsights ? audioInsightsQuery.refetch() : Promise.resolve(),
    ]);
  }, [actionsQuery, analysisQuery, audioInsightsQuery, commentsQuery, sessionQuery, shouldFetchAudioInsights, transcriptQuery]);

  useEffect(() => {
    if (!session || analysis || !PROCESSING_STATUSES.has(session.status)) return;
    const poll = setInterval(() => {
      if (AppState.currentState === "active") {
        void sessionQuery.refetch();
        void analysisQuery.refetch();
      }
    }, 4000);
    return () => clearInterval(poll);
  }, [analysis, analysisQuery, session, sessionQuery]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  if (loading && !session) return <SessionLiveSkeleton onBack={onBack} />;

  if (!session) return (
    <View style={[st.flex1, st.center, { gap: 12 }]}>
      <Ionicons name="alert-circle-outline" size={48} color={C.red} />
      <Text style={st.emptyTitle}>{error instanceof Error ? error.message : "Session not found"}</Text>
      <BackBtn label="Sessions" onPress={onBack} />
    </View>
  );

  const hasAnalysis = !!analysis;
  const reviewIsLoading = !analysis
    && analysisQuery.isLoading
    && (session.status === "analysis_ready" || session.status === "reviewed");
  const sc = STATUS_COLORS[session.status] ?? { bg: "#eaf4ff", text: C.brand };
  const sl = STATUS_LABELS[session.status] ?? session.status;
  const isProcessable = ["uploaded", "failed"].includes(session.status);
  const sessionPeopleTitle = displaySessionTitle(session);

  if (hasAnalysis) {
    return (
      <SessionReviewExperience
        session={session}
        analysis={analysis}
        transcript={transcript}
        phases={phases}
        comments={comments}
        actions={actions}
        audioInsights={audioInsights}
        audioInsightsStatus={audioInsightsStatus}
        sessionId={sessionId}
        onBack={onBack}
        onReload={load}
          onOpenComments={() =>
            onOpenComments({
              sessionId,
              sessionTitle: sessionPeopleTitle,
            })
          }
          onOpenAiChat={() =>
            onOpenAiChat({
              sessionId,
              sessionTitle: sessionPeopleTitle,
              prospectName: session.prospectName ?? undefined,
            })
          }
          onOpenAudioInsights={() =>
            onOpenAudioInsights({
              sessionId,
              sessionTitle: sessionPeopleTitle,
              initialStatus: audioInsightsStatus,
              initialInsights: audioInsights,
          })
        }
        onOpenReport={() => onOpenReport(sessionId)}
      />
    );
  }

  if (reviewIsLoading) return <SessionReviewSkeleton onBack={onBack} />;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={[st.scroll, liveSessionSt.pageScroll]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} />}>
      <View style={st.page}>
        {error && <ErrorBanner message={error instanceof Error ? error.message : "Failed to load session"} onRetry={load} />}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel="Back to sessions"
            onPress={onBack}
            style={liveSessionSt.backAction}
          >
            <Ionicons name="arrow-back" size={20} color={C.text} />
          </MotionPressable>
          <View style={st.flex1} />
          <View style={[st.badge, { backgroundColor: sc.bg }]}><Text style={[st.badgeText, { color: sc.text }]}>{sl}</Text></View>
        </View>

        <Text style={st.detailTitle}>{sessionPeopleTitle}</Text>
        <View style={{ gap: 3 }}>
          {session.scheduledAt && <DetailMeta icon="calendar-outline" text={`${fmtDate(session.scheduledAt)} ${fmtTime(session.scheduledAt)}`} />}
          {session.prospectName && !(session.leads?.length ?? 0) && <DetailMeta icon="person-outline" text={session.prospectName} />}
          {session.location && <DetailMeta icon="location-outline" text={session.location} />}
        </View>

        {(session.leads?.length ?? 0) > 0 ? (
          <CheckedInVisitorsCard leads={session.leads ?? []} />
        ) : null}

        {/* Upload / Process section for non-analyzed sessions */}
        {!hasAnalysis && (
          <UploadProcessCard
            sessionId={sessionId}
            status={session.status}
            rubricId={session.rubricId}
            sessionTitle={session.title}
            prospectName={session.prospectName}
            agentName={session.agentName}
            propertyName={session.location || session.title}
            hasRecording={Boolean(session.audioUrl || session.videoUrl)}
            processingError={session.analysisWorkflowError}
            autoStartRecording={autoStartRecording}
            initialNotes={session.notes}
            initialLeads={session.leads ?? []}
            initialAttachments={session.attachments ?? []}
            onDone={load}
          />
        )}

        {hasAnalysis && <ScoreHero analysis={analysis} />}

        {hasAnalysis && (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.tabsRow} contentContainerStyle={{ gap: 2 }}>
              {([["overview", "Overview", "grid-outline"], ["rubric", "Rubric", "clipboard-outline"], ["transcript", "Transcript", "chatbubble-outline"], ["actions", "Actions", "rocket-outline"], ["comments", "Comments", "chatbubbles-outline"]] as const).map(([id, label, icon]) => (
                <Pressable key={id} onPress={() => setTab(id as DTab)} style={[st.tabPill, tab === id && st.tabPillActive]}>
                  <Ionicons name={icon as any} size={14} color={tab === id ? C.brand : C.textMuted} />
                  <Text style={[st.tabPillText, tab === id && st.tabPillTextActive]}>{label}</Text>
                  {id === "actions" && actions.filter((a) => a.status === "open").length > 0 && (
                    <View style={st.tabBadge}><Text style={st.tabBadgeText}>{actions.filter((a) => a.status === "open").length}</Text></View>
                  )}
                  {id === "comments" && comments.length > 0 && (
                    <View style={[st.tabBadge, { backgroundColor: C.brand }]}><Text style={st.tabBadgeText}>{comments.length}</Text></View>
                  )}
                </Pressable>
              ))}
            </ScrollView>

            {tab === "overview" && <OverviewTab analysis={analysis} transcript={transcript} sessionId={sessionId} hasRecording={session.status !== "scheduled"} />}
            {tab === "rubric" && <RubricTab analysis={analysis} />}
            {tab === "transcript" && <TranscriptTab transcript={transcript} />}
            {tab === "actions" && <ActionsTab actions={actions} sessionId={sessionId} onUpdate={load} />}
            {tab === "comments" && <CommentsTab comments={comments} sessionId={sessionId} onUpdate={load} />}
          </>
        )}
      </View>
    </ScrollView>
  );
}

type TranscriptSpeakerRole = "agent" | "prospect" | "other";

function transcriptSpeakerRole(
  speaker: string | null | undefined,
  agentName: string | null | undefined,
  prospectName: string | null | undefined,
  corroboratingSpeaker?: string | null,
): TranscriptSpeakerRole {
  if (isAgentSpeakerLabel(speaker)) return "agent";
  if (isProspectSpeakerLabel(speaker)) return "prospect";
  if (isAgentSpeakerLabel(corroboratingSpeaker)) return "agent";
  if (isProspectSpeakerLabel(corroboratingSpeaker)) return "prospect";

  const normalized = (value: string | null | undefined) =>
    value?.trim().replace(/^~\s*/, "").replace(/\s+/g, " ").toLowerCase() ?? "";
  const candidate = normalized(speaker);
  const corroboratingCandidate = normalized(corroboratingSpeaker);
  const normalizedAgent = normalized(agentName);
  const normalizedProspect = normalized(prospectName);
  if ([candidate, corroboratingCandidate].includes(normalizedAgent) && normalizedAgent) return "agent";
  if ([candidate, corroboratingCandidate].includes(normalizedProspect) && normalizedProspect) return "prospect";

  // Lettered diarization is the common fallback for the primary two voices.
  // Audio Insights remains the stronger signal above when it identified roles.
  if (/^speaker\s*a$/i.test(candidate)) return "agent";
  if (/^speaker\s*b$/i.test(candidate)) return "prospect";
  return "other";
}

function transcriptSpeakerName(
  role: TranscriptSpeakerRole,
  rawSpeaker: string | null | undefined,
  agentName: string | null,
  prospectName: string | null,
) {
  if (role === "agent") return agentName ?? "Agent";
  if (role === "prospect") return prospectName ?? "Prospect";
  return rawSpeaker?.trim() || "Speaker";
}

function SessionReviewExperience({
  session,
  analysis,
  transcript,
  phases,
  comments,
  actions,
  audioInsights,
  audioInsightsStatus,
  sessionId,
  onBack,
  onReload,
  onOpenComments,
  onOpenAiChat,
  onOpenAudioInsights,
  onOpenReport,
  readOnly = false,
}: {
  session: any;
  analysis: AnalysisResult;
  transcript: any[];
  phases: ConversationPhaseSegmentation | null;
  comments: SessionComment[];
  actions: FollowUpAction[];
  audioInsights: AudioInsights | null;
  audioInsightsStatus: AudioInsightsStatus;
  sessionId: string;
  onBack: () => void;
  onReload: () => void;
  onOpenComments: () => void;
  onOpenAiChat: () => void;
  onOpenAudioInsights: () => void;
  onOpenReport: () => void;
  readOnly?: boolean;
}) {
  const [localActions, setLocalActions] = useState(actions);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(transcript[0]?.id ?? null);
  const [reviewMode, setReviewMode] = useState<SessionReviewMode>("transcript");
  const [reviewTabDirection, setReviewTabDirection] = useState<SlideDirection>("forward");
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<string[]>([]);
  const [commentComposerOpen, setCommentComposerOpen] = useState(false);
  const [selectionComment, setSelectionComment] = useState("");
  const [selectionBusy, setSelectionBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [transcriptSearchOpen, setTranscriptSearchOpen] = useState(false);
  const [followPlayback, setFollowPlayback] = useState(true);
  const [annotationSheet, setAnnotationSheet] = useState<{
    items: TranscriptAnnotation[];
    index: number;
  } | null>(null);
  const postCommentMutation = usePostCommentMutation(sessionId);
  const scrollRef = useRef<ScrollView | null>(null);
  const segmentY = useRef<Record<string, number>>({});
  const phaseY = useRef<Record<string, number>>({});
  const tabBodyY = useRef(0);
  const userDragging = useRef(false);
  const lastAutoSegment = useRef<string | null>(null);
  const reviewModeRef = useRef<SessionReviewMode>("transcript");
  const followPlaybackRef = useRef(true);
  const longPressedSegmentRef = useRef<string | null>(null);
  const lastTranscriptTapRef = useRef<{ id: string; at: number } | null>(null);
  const transcriptSearchRef = useRef<TextInput | null>(null);
  const agentDisplayName = formatPersonName(session.agentName)
    ?? formatPersonName(audioInsights?.participants?.agentName)
    ?? formatPersonName(analysis.participantNames?.agentName);
  const prospectDisplayName = formatPersonName(session.prospectName)
    ?? formatPersonName(audioInsights?.participants?.prospectName)
    ?? formatPersonName(analysis.participantNames?.prospectName);

  useEffect(() => { setLocalActions(actions); }, [actions]);
  useEffect(() => { reviewModeRef.current = reviewMode; }, [reviewMode]);

  const changeReviewMode = useCallback((nextMode: SessionReviewMode) => {
    const currentMode = reviewModeRef.current;
    if (nextMode === currentMode) return;
    const currentIndex = SESSION_REVIEW_MODE_ORDER.indexOf(currentMode);
    const nextIndex = SESSION_REVIEW_MODE_ORDER.indexOf(nextMode);
    setReviewTabDirection(nextIndex >= currentIndex ? "forward" : "back");
    reviewModeRef.current = nextMode;
    setReviewMode(nextMode);
  }, []);
  useEffect(() => { followPlaybackRef.current = followPlayback; }, [followPlayback]);

  const scrollToSegment = useCallback((segment: any, animated = true) => {
    if (!segment) return;
    setActiveSegmentId(segment.id);
    const y = segmentY.current[segment.id];
    if (typeof y === "number") scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated });
  }, []);

  useEffect(() => {
    let mounted = true;
    let loadedSound: Audio.Sound | undefined;
    void (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const resolved = await resolveSessionPlaybackUri(sessionId);
        const result = await Audio.Sound.createAsync({ uri: resolved.uri }, { shouldPlay: false, progressUpdateIntervalMillis: 250 });
        if (!mounted) {
          await result.sound.unloadAsync();
          return;
        }
        loadedSound = result.sound;
        setSound(result.sound);
        result.sound.setOnPlaybackStatusUpdate((status) => {
          if (!mounted || !status.isLoaded) return;
          const nextPosition = status.positionMillis / 1000;
          setPosition(nextPosition);
          if (status.durationMillis) setDuration(status.durationMillis / 1000);
          setPlaying(status.isPlaying);
          const segment = transcript.find((item) => nextPosition >= item.startTime && nextPosition < item.endTime);
          if (segment) {
            setActiveSegmentId(segment.id);
            if (
              status.isPlaying &&
              reviewModeRef.current === "transcript" &&
              followPlaybackRef.current &&
              !userDragging.current &&
              lastAutoSegment.current !== segment.id
            ) {
              lastAutoSegment.current = segment.id;
              scrollToSegment(segment);
            }
          }
          if (status.didJustFinish) setPlaying(false);
        });
      } catch {
        showToast("Audio is unavailable for this session", "error");
      }
    })();
    return () => {
      mounted = false;
      void loadedSound?.unloadAsync();
    };
  }, [sessionId, scrollToSegment, transcript]);

  const seekToSeconds = useCallback(async (seconds: number, shouldPlay = false) => {
    if (!sound) return;
    const next = Math.max(0, Math.min(duration || seconds, seconds));
    await sound.setPositionAsync(next * 1000);
    setPosition(next);
    if (shouldPlay) await sound.playAsync();
    const segment = transcript.find((item) => next >= item.startTime && next < item.endTime) ?? transcript[0];
    if (reviewModeRef.current === "transcript" && followPlaybackRef.current) scrollToSegment(segment);
  }, [duration, scrollToSegment, sound, transcript]);

  function setPlaybackFollowing(next: boolean) {
    followPlaybackRef.current = next;
    setFollowPlayback(next);
  }

  function returnToPlayingTranscript() {
    setPlaybackFollowing(true);
    const segment = transcript.find((item) => position >= item.startTime && position < item.endTime) ?? transcript[0];
    if (segment) scrollToSegment(segment);
  }

  async function togglePlayback() {
    if (!sound) return;
    if (playing) await sound.pauseAsync();
    else {
      void trackAnalyticsEvent("session_playback_start", { sessionId });
      await sound.playAsync();
    }
  }

  async function changeSpeed() {
    if (!sound) return;
    const next = speed === 1 ? 1.25 : speed === 1.25 ? 1.5 : speed === 1.5 ? 2 : 1;
    await sound.setRateAsync(next, true);
    setSpeed(next);
  }

  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;
  const coachingMoments = useMemo(() => {
    return analysis.exactMoments
      .map((moment, index) => ({
        ...moment,
        id: `${moment.timestamp}-${index}`,
        seconds: parseMomentTime(moment.timestamp),
      }))
      .filter((moment) => moment.seconds !== null)
      .sort((left, right) => (left.seconds ?? 0) - (right.seconds ?? 0));
  }, [analysis.exactMoments]);
  const commentsBySegment = useMemo(() => {
    const mapped = new Map<string, SessionComment[]>();
    for (const comment of comments) {
      if (comment.timestampSec == null || comment.parentId || transcript.length === 0) continue;
      const nearest = transcript.reduce((best, segment) =>
        Math.abs(segment.startTime - comment.timestampSec!) < Math.abs(best.startTime - comment.timestampSec!)
          ? segment
          : best
      , transcript[0]);
      mapped.set(nearest.id, [...(mapped.get(nearest.id) ?? []), comment]);
    }
    return mapped;
  }, [comments, transcript]);
  const selectedSegments = useMemo(
    () => transcript.filter((segment) => selectedSegmentIds.includes(segment.id)),
    [selectedSegmentIds, transcript]
  );
  const selectionRange = useMemo(() => {
    if (selectedSegments.length === 0) return null;
    const start = Math.min(...selectedSegments.map((segment) => segment.startTime));
    const end = Math.max(...selectedSegments.map((segment) => segment.endTime));
    return { start, end };
  }, [selectedSegments]);
  const emotionByTranscriptId = useMemo(
    () => matchAudioInsightsToTranscript(transcript, audioInsights?.segments),
    [audioInsights?.segments, transcript],
  );
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return transcript.filter((segment) => {
      const signal = emotionByTranscriptId.get(segment.id);
      const role = transcriptSpeakerRole(
        segment.speaker,
        agentDisplayName,
        prospectDisplayName,
        signal?.speaker,
      );
      const displayName = transcriptSpeakerName(
        role,
        segment.speaker,
        agentDisplayName,
        prospectDisplayName,
      );
      return segment.text?.toLowerCase().includes(query)
        || segment.speaker?.toLowerCase().includes(query)
        || displayName.toLowerCase().includes(query)
        || role.includes(query);
    });
  }, [agentDisplayName, emotionByTranscriptId, prospectDisplayName, searchQuery, transcript]);
  function beginSegmentSelection(segmentId: string) {
    impactHaptic();
    longPressedSegmentRef.current = segmentId;
    setSelectedSegmentIds([segmentId]);
  }

  function beginCommentOnSegment(segmentId: string) {
    impactHaptic();
    longPressedSegmentRef.current = segmentId;
    setSelectedSegmentIds([segmentId]);
    setCommentComposerOpen(true);
  }

  function handleTranscriptPress(segment: { id: string; startTime: number }) {
    const now = Date.now();
    const last = lastTranscriptTapRef.current;
    if (last && last.id === segment.id && now - last.at < 320) {
      lastTranscriptTapRef.current = null;
      beginCommentOnSegment(segment.id);
      return;
    }
    lastTranscriptTapRef.current = { id: segment.id, at: now };

    if (longPressedSegmentRef.current === segment.id) {
      longPressedSegmentRef.current = null;
      return;
    }
    if (selectedSegmentIds.length > 0) toggleSegmentSelection(segment.id);
    else {
      setPlaybackFollowing(true);
      void seekToSeconds(segment.startTime, true);
    }
  }

  function toggleSegmentSelection(segmentId: string) {
    selectionHaptic();
    setSelectedSegmentIds((current) =>
      current.includes(segmentId)
        ? current.filter((id) => id !== segmentId)
        : [...current, segmentId]
    );
  }

  function openTranscriptSearch() {
    setPlaybackFollowing(false);
    setTranscriptSearchOpen(true);
    requestAnimationFrame(() => transcriptSearchRef.current?.focus());
  }

  function closeTranscriptSearch() {
    Keyboard.dismiss();
    setSearchQuery("");
    setTranscriptSearchOpen(false);
  }

  async function saveSelectionComment() {
    if (!selectionRange || !selectionComment.trim()) return;
    setSelectionBusy(true);
    try {
      await postCommentMutation.mutateAsync({
        body: selectionComment.trim(),
        kind: "comment",
        timestampSec: selectionRange.start,
        authorName: getCurrentSession()?.workspace.user.fullName ?? undefined,
      });
      setCommentComposerOpen(false);
      setSelectionComment("");
      setSelectedSegmentIds([]);
      showToast("Comment added to transcript", "success");
      onReload();
    } catch {
      showToast("Could not add comment", "error");
    } finally {
      setSelectionBusy(false);
    }
  }

  async function createSelectionClip() {
    if (!selectionRange || selectedSegments.length === 0) return;
    setSelectionBusy(true);
    const excerpt = selectedSegments.map((segment) => `${segment.speaker}: ${segment.text}`).join("\n");
    const rangeLabel = `${fmtSec(selectionRange.start)}–${fmtSec(selectionRange.end)}`;
    const clipUrl = `${getApiBaseUrl()}/api/sessions/${sessionId}/recording#t=${Math.floor(selectionRange.start)},${Math.ceil(selectionRange.end)}`;
    try {
      await postCommentMutation.mutateAsync({
        body: `Clip ${rangeLabel}\n${excerpt}`,
        kind: "key_moment",
        timestampSec: selectionRange.start,
      });
      await Share.share({
        title: `${session.title} clip · ${rangeLabel}`,
        message: `${session.title} · ${rangeLabel}\n\n${excerpt}\n\n${clipUrl}`,
        url: clipUrl,
      });
      setSelectedSegmentIds([]);
      showToast("Clip created and saved", "success");
      onReload();
    } catch {
      showToast("Could not create clip", "error");
    } finally {
      setSelectionBusy(false);
    }
  }

  function openSessionMoreMenu() {
    Alert.alert("Session options", undefined, [
      { text: "Ask Tour AI", onPress: onOpenAiChat },
      { text: "View report", onPress: onOpenReport },
      { text: comments.length > 0 ? `Comments (${comments.length})` : "Comments", onPress: onOpenComments },
      { text: "Audio insights", onPress: onOpenAudioInsights },
      { text: "Coaching", onPress: () => changeReviewMode("coaching") },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  const transcriptGroups = useMemo<Array<{ id: string; label: string; startTime: number; color: string; segments: any[] }>>(() => {
    if (!transcript.length) return [];
    if (!phases?.spans.length) {
      return [{ id: "all", label: "Transcript", startTime: transcript[0]?.startTime ?? 0, color: C.brand, segments: transcript }];
    }
    return phases.spans
      .map((span, index) => {
        const segments = transcript.filter((segment) => segment.startTime >= span.startTime && segment.startTime < span.endTime);
        return {
          id: span.id,
          label: shortPhaseLabel(span.label),
          startTime: span.startTime,
          color: tourSegmentColor(index),
          segments,
        };
      })
      .filter((group) => group.segments.length > 0);
  }, [phases, transcript]);
  const visibleTranscriptGroups = useMemo(() => {
    if (!searchQuery.trim()) return transcriptGroups;
    const matchingIds = new Set(searchResults.map((segment) => segment.id));
    return transcriptGroups
      .map((group) => ({
        ...group,
        segments: group.segments.filter((segment) => matchingIds.has(segment.id)),
      }))
      .filter((group) => group.segments.length > 0);
  }, [searchQuery, searchResults, transcriptGroups]);

  const [activePhaseId, setActivePhaseId] = useState<string | null>(null);
  const activeTranscriptGroup = useMemo(
    () => transcriptGroups.find((group) => group.id === activePhaseId) ?? transcriptGroups[0] ?? null,
    [activePhaseId, transcriptGroups],
  );
  const activePhaseMomentCount = useMemo(() => {
    if (!activeTranscriptGroup) return 0;
    return coachingMoments.filter((moment) =>
      moment.seconds != null &&
      moment.seconds >= activeTranscriptGroup.startTime &&
      moment.seconds < (transcriptGroups[transcriptGroups.indexOf(activeTranscriptGroup) + 1]?.startTime ?? Number.POSITIVE_INFINITY),
    ).length;
  }, [activeTranscriptGroup, coachingMoments, transcriptGroups]);
  const activePhaseAnnotations = useMemo<TranscriptAnnotation[]>(() => {
    if (!activeTranscriptGroup) return [];
    const activeIndex = transcriptGroups.indexOf(activeTranscriptGroup);
    const endTime = transcriptGroups[activeIndex + 1]?.startTime ?? Number.POSITIVE_INFINITY;
    return coachingMoments
      .filter((moment) => moment.seconds != null && moment.seconds >= activeTranscriptGroup.startTime && moment.seconds < endTime)
      .map((moment) => ({
        id: moment.id,
        kind: "ai_note" as const,
        title: "AI coaching note",
        body: [
          moment.explanation,
          moment.suggestedImprovement ? `Try: ${moment.suggestedImprovement}` : null,
        ].filter(Boolean).join("\n\n"),
        timestampSec: moment.seconds,
      }));
  }, [activeTranscriptGroup, coachingMoments, transcriptGroups]);

  useEffect(() => {
    setActivePhaseId((current) =>
      current && transcriptGroups.some((group) => group.id === current)
        ? current
        : transcriptGroups[0]?.id ?? null,
    );
  }, [transcriptGroups]);

  useEffect(() => {
    if (!playing || transcriptGroups.length === 0) return;
    const next = transcriptGroups.reduce(
      (current, group) => (group.startTime <= position ? group : current),
      transcriptGroups[0]!,
    );
    setActivePhaseId((current) => (current === next.id ? current : next.id));
  }, [playing, position, transcriptGroups]);

  function updateActivePhaseForScroll(scrollY: number) {
    if (reviewModeRef.current !== "transcript" || transcriptGroups.length === 0) return;
    const anchor = scrollY + 148;
    let next = transcriptGroups[0]!;
    for (const group of transcriptGroups) {
      const phaseTop = tabBodyY.current + (phaseY.current[group.id] ?? Number.POSITIVE_INFINITY);
      if (phaseTop <= anchor) next = group;
    }
    setActivePhaseId((current) => (current === next.id ? current : next.id));
  }

  const reviewGuestName = session.prospectName?.trim().split(/\s+/)[0] ?? null;
  const reviewTitle = reviewGuestName ? `${reviewGuestName}'s tour` : session.title;
  const reviewSubtitle = [
    session.agentName ? `with ${session.agentName}` : null,
    duration ? fmtSec(duration) : null,
    session.location || null,
  ].filter(Boolean).join(" · ");

  return (
    <View style={reviewSt.root}>
      <ScrollView
        ref={scrollRef}
        scrollEnabled
        nestedScrollEnabled
        directionalLockEnabled
        style={reviewSt.scrollBody}
        contentContainerStyle={reviewSt.scrollContent}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
        scrollEventThrottle={16}
        onScroll={(event) => updateActivePhaseForScroll(event.nativeEvent.contentOffset.y)}
        onScrollBeginDrag={() => {
          if (reviewMode === "transcript") {
            userDragging.current = true;
            setPlaybackFollowing(false);
          }
        }}
        onMomentumScrollEnd={() => { userDragging.current = false; }}
        onScrollEndDrag={() => { userDragging.current = false; }}
      >
        <View>
          <TourScreenHeader
            onBack={onBack}
            title={reviewTitle}
            subtitle={reviewSubtitle || "Recorded tour"}
            onMorePress={readOnly ? undefined : openSessionMoreMenu}
            moreAccessibilityLabel="Session options"
          />
          <SessionReviewSnapshot
            score={analysis.overallScore}
            onOpenRubric={() => changeReviewMode("rubric")}
          />
          {audioInsights?.segments.length ? (
            <SessionSentimentTimeline
              segments={audioInsights.segments}
              overallSentiment={audioInsights.overallSentiment}
              conversationStats={audioInsights.conversationStats}
              duration={duration}
              currentTime={position}
              onPress={onOpenAudioInsights}
            />
          ) : null}
        </View>

        <View style={reviewSt.tabSticky}>
          <SessionModeTabs
            value={reviewMode}
            modes={["transcript", "rubric", "prospect"]}
            commentCount={comments.filter((comment) => !comment.parentId).length}
            onChange={(mode) => {
              if (mode === "ai") {
                onOpenAiChat();
                return;
              }
              if (mode !== "transcript") closeTranscriptSearch();
              changeReviewMode(mode);
            }}
          />
          {reviewMode === "transcript" && activeTranscriptGroup ? (
            <TranscriptLandmark
              label={activeTranscriptGroup.label}
              timestamp={activeTranscriptGroup.startTime}
              color={activeTranscriptGroup.color}
              momentCount={activePhaseMomentCount}
              searchOpen={transcriptSearchOpen}
              onSearchPress={transcriptSearchOpen ? closeTranscriptSearch : openTranscriptSearch}
              onOpenMoments={activePhaseAnnotations.length > 0
                ? () => setAnnotationSheet({ items: activePhaseAnnotations, index: 0 })
                : undefined}
            />
          ) : null}
          {reviewMode === "transcript" && transcriptSearchOpen ? (
            <TranscriptSearchInline
              inputRef={transcriptSearchRef}
              query={searchQuery}
              resultCount={searchResults.length}
              onChangeQuery={setSearchQuery}
              onClose={closeTranscriptSearch}
            />
          ) : null}
        </View>

        <View
          style={reviewSt.tabBody}
          onLayout={(event) => { tabBodyY.current = event.nativeEvent.layout.y; }}
        >
        {readOnly ? (
          <View style={reviewSt.sampleReadOnlyBanner}>
            <View style={reviewSt.sampleReadOnlyIcon}><Ionicons name="eye-outline" size={16} color={C.brand} /></View>
            <View style={st.flex1}>
              <Text style={reviewSt.sampleReadOnlyTitle}>40Fifty Lofts sample</Text>
              <Text style={reviewSt.sampleReadOnlySub}>Read only · Explore the scoring, coaching, audio, and transcript.</Text>
            </View>
          </View>
        ) : null}
        {!readOnly && session.leads?.length > 0 ? (
          <CheckedInVisitorsCard leads={session.leads} />
        ) : null}
        {reviewMode === "rubric" && (
          <AnimatedTabContent tabKey="rubric" direction={reviewTabDirection}>
            <RubricTab analysis={analysis} />
          </AnimatedTabContent>
        )}
        {reviewMode === "prospect" && (
          <AnimatedTabContent tabKey="prospect" direction={reviewTabDirection}>
            <ProspectInsightsCard
              analysis={analysis}
              providedInterests={session.customerInterests ?? []}
            />
          </AnimatedTabContent>
        )}
        {reviewMode === "coaching" && (
          <AnimatedTabContent tabKey="coaching" direction={reviewTabDirection}>
            <ActionsTab
              actions={localActions}
              sessionId={sessionId}
              onUpdate={onReload}
              onActionsChange={setLocalActions}
              readOnly={readOnly}
            />
          </AnimatedTabContent>
        )}
        {reviewMode === "comments" && (
          <AnimatedTabContent tabKey="comments" direction={reviewTabDirection}>
            <CommentsTab comments={comments} sessionId={sessionId} onUpdate={onReload} />
          </AnimatedTabContent>
        )}
        {reviewMode === "transcript" ? (
          <AnimatedTabContent tabKey="transcript" direction={reviewTabDirection}>
            {transcript.length === 0 ? (
              <EmptyState icon="chatbubble-outline" title="No transcript yet" subtitle="The transcript will appear after processing." />
            ) : null}
            {searchQuery.trim() && searchResults.length === 0 ? (
              <View style={reviewSt.transcriptSearchEmpty}>
                <Ionicons name="search-outline" size={17} color={C.textMuted} />
                <Text style={reviewSt.transcriptSearchEmptyText}>No matching moments</Text>
              </View>
            ) : null}
            {visibleTranscriptGroups.map((group, groupIndex) => (
              <View
                key={group.id}
                style={reviewSt.phaseSection}
                onLayout={(event) => { phaseY.current[group.id] = event.nativeEvent.layout.y; }}
              >
            {groupIndex > 0 ? (
              <View style={reviewSt.phaseDivider}>
                <View style={reviewSt.phaseDividerRule} />
                <View style={reviewSt.phaseDividerLabel}>
                  <View style={[reviewSt.phaseDividerDot, { backgroundColor: group.color }]} />
                  <Text style={[reviewSt.phaseDividerTitle, { color: group.color }]}>{group.label}</Text>
                </View>
                <Text style={reviewSt.phaseDividerTime}>{fmtSec(group.startTime)}</Text>
              </View>
            ) : null}
            {group.segments.map((segment, index) => {
              const active = segment.id === activeSegmentId;
              const selected = selectedSegmentIds.includes(segment.id);
              const emotionSignal = emotionByTranscriptId.get(segment.id);
              const speakerRole = transcriptSpeakerRole(
                segment.speaker,
                agentDisplayName,
                prospectDisplayName,
                emotionSignal?.speaker,
              );
              const isAgent = speakerRole === "agent";
              const isProspect = speakerRole === "prospect";
              const speakerName = transcriptSpeakerName(
                speakerRole,
                segment.speaker,
                agentDisplayName,
                prospectDisplayName,
              );
              const speakerRoleLabel = isAgent ? "Agent" : isProspect ? "Prospect" : null;
              const showRoleLabel = Boolean(
                speakerRoleLabel && speakerName.toLowerCase() !== speakerRoleLabel.toLowerCase(),
              );
              const speakerInitial = speakerName.replace(/^~\s*/, "").match(/[A-Za-z0-9]/)?.[0]?.toUpperCase() ?? "·";
              const prev = group.segments[index - 1];
              const showInitial = !prev || prev.speaker !== segment.speaker;
              const moments = coachingMoments.filter((moment) =>
                moment.seconds !== null &&
                moment.seconds >= segment.startTime &&
                moment.seconds < segment.endTime
              );
              const segmentComments = commentsBySegment.get(segment.id) ?? [];
              return (
                <Reanimated.View
                  key={segment.id || index}
                  onLayout={(event) => {
                    segmentY.current[segment.id] =
                      tabBodyY.current +
                      (phaseY.current[group.id] ?? 0) +
                      event.nativeEvent.layout.y;
                  }}
                  style={reviewSt.turnRow}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityHint={readOnly ? "Tap to play from this timestamp." : "Tap to play this timestamp, double tap to add a comment, or press and hold to select transcript segments."}
                    onLongPress={readOnly ? undefined : () => beginSegmentSelection(segment.id)}
                    delayLongPress={360}
                    onPress={() => handleTranscriptPress(segment)}
                    style={[
                      reviewSt.turnMain,
                      isAgent
                        ? reviewSt.turnMainAgent
                        : isProspect
                          ? reviewSt.turnMainProspect
                          : reviewSt.turnMainOther,
                      active && reviewSt.turnMainActive,
                      selected && reviewSt.turnMainSelected,
                    ]}
                  >
                    <View style={reviewSt.turnInitialSlot}>
                      {showInitial && (
                        <View style={[
                          reviewSt.turnInitial,
                          isAgent
                            ? reviewSt.turnInitialAgent
                            : isProspect
                              ? reviewSt.turnInitialProspect
                              : reviewSt.turnInitialOther,
                        ]}>
                          <Text style={[reviewSt.turnInitialText, { color: isAgent ? tourColors.agent : isProspect ? tourColors.prospect : C.textMuted }]}>
                            {speakerInitial}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={st.flex1}>
                      <View style={reviewSt.turnMeta}>
                        <Text
                          style={[reviewSt.turnSpeaker, { color: isAgent ? tourColors.agent : isProspect ? tourColors.prospect : C.textMuted }]}
                        >
                          {speakerName}
                        </Text>
                        {showRoleLabel ? <Text style={reviewSt.turnRole}>· {speakerRoleLabel}</Text> : null}
                        {emotionSignal ? (
                          <Ionicons
                            accessibilityLabel={`Emotional signal: ${emotionAccessibilityLabel(emotionSignal.emotion, emotionSignal.energy)}`}
                            name={emotionIcon(emotionSignal.emotion)}
                            size={14}
                            color={emotionColor(emotionSignal.emotion)}
                          />
                        ) : null}
                        <Text style={[reviewSt.segmentTime, active && reviewSt.segmentTimeActive]}>{fmtSec(segment.startTime)}</Text>
                      </View>
                      <Text style={[reviewSt.turnText, active && reviewSt.turnTextActive]}>{segment.text}</Text>
                    </View>
                  </Pressable>
                  {(() => {
                    const allGroups: Array<{ kind: TranscriptAnnotation["kind"]; items: TranscriptAnnotation[] }> = [
                      {
                        kind: "ai_note",
                        items: moments.map((moment) => ({
                          id: moment.id,
                          kind: "ai_note" as const,
                          title: "AI coaching note",
                          body: [
                            moment.explanation,
                            moment.suggestedImprovement ? `Try: ${moment.suggestedImprovement}` : null,
                          ].filter(Boolean).join("\n\n"),
                          timestampSec: moment.seconds,
                        })),
                      },
                      {
                        kind: "comment",
                        items: segmentComments
                          .filter((comment) => comment.kind !== "key_moment")
                          .map((comment) => ({
                            id: comment.id,
                            kind: "comment" as const,
                            title: comment.authorName || "Comment",
                            body: comment.body,
                            timestampSec: comment.timestampSec,
                          })),
                      },
                      {
                        kind: "key_moment",
                        items: segmentComments
                          .filter((comment) => comment.kind === "key_moment")
                          .map((comment) => ({
                            id: comment.id,
                            kind: "key_moment" as const,
                            title: "Key moment",
                            body: comment.body,
                            timestampSec: comment.timestampSec,
                        })),
                      },
                    ];
                    const groups = allGroups.filter((group) => group.items.length > 0);
                    if (groups.length === 0) return null;
                    return (
                      <View style={[reviewSt.annotationRow, { marginLeft: 36 }]}>
                        {groups.map((group) => {
                          const color = transcriptAnnotationChipColor(group.kind);
                          const label = transcriptAnnotationChipLabel(group.kind);
                          const count = group.items.length;
                          return (
                            <Pressable
                              key={group.kind}
                              accessibilityRole="button"
                              accessibilityLabel={`${count} ${label}`}
                              onPress={() => setAnnotationSheet({ items: group.items, index: 0 })}
                              style={reviewSt.annotationChip}
                            >
                              <Ionicons
                                name={transcriptAnnotationChipIcon(group.kind)}
                                size={12}
                                color={color}
                              />
                              <View style={[reviewSt.annotationCountBadge, { backgroundColor: color }]}>
                                <Text style={reviewSt.annotationCountText}>{count > 99 ? "99+" : String(count)}</Text>
                              </View>
                            </Pressable>
                          );
                        })}
                      </View>
                    );
                  })()}
                </Reanimated.View>
              );
            })}
              </View>
            ))}
          </AnimatedTabContent>
        ) : null}
        </View>
      </ScrollView>

      {!readOnly && selectedSegmentIds.length > 0 && selectionRange ? (
        <View style={reviewSt.selectionBar}>
          <Pressable onPress={() => setSelectedSegmentIds([])} style={reviewSt.selectionClose}>
            <Ionicons name="close" size={18} color={C.textSec} />
          </Pressable>
          <View style={st.flex1}>
            <Text style={reviewSt.selectionTitle}>
              {selectedSegmentIds.length} selected
            </Text>
            <Text style={reviewSt.selectionTime}>
              {fmtSec(selectionRange.start)}–{fmtSec(selectionRange.end)}
            </Text>
          </View>
          <Pressable
            disabled={selectionBusy}
            onPress={() => setCommentComposerOpen(true)}
            style={reviewSt.selectionAction}
          >
            <Ionicons name="chatbubble-outline" size={17} color={C.brand} />
            <Text style={reviewSt.selectionActionText}>Comment</Text>
          </Pressable>
          <Pressable
            disabled={selectionBusy}
            onPress={() => void createSelectionClip()}
            style={reviewSt.selectionAction}
          >
            {selectionBusy ? <LoadingDots size="small" color={C.brand} /> : <Ionicons name="film-outline" size={17} color={C.brand} />}
            <Text style={reviewSt.selectionActionText}>Create clip</Text>
          </Pressable>
        </View>
      ) : null}
      {!readOnly && selectedSegmentIds.length === 0 ? (
        <SessionAiFab
          onPress={onOpenAiChat}
          bottomOffset={reviewMode === "transcript" && !followPlayback ? 166 : 126}
        />
      ) : null}
      <SessionPlayer
        position={position}
        duration={duration}
        playing={playing}
        speed={speed}
        ready={!!sound}
        progressPercent={pct}
        onToggle={() => void togglePlayback()}
        onSpeed={() => void changeSpeed()}
        onSeek={(ratio) => void seekToSeconds(ratio * duration)}
        showReturnToPlaying={reviewMode === "transcript" && !followPlayback}
        onReturnToPlaying={returnToPlayingTranscript}
      />

      <Modal
        visible={Boolean(annotationSheet)}
        transparent
        animationType="fade"
        onRequestClose={() => setAnnotationSheet(null)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={reviewSt.commentModalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAnnotationSheet(null)} />
          <View style={reviewSt.commentModalCard}>
            {annotationSheet ? (() => {
              const { items, index } = annotationSheet;
              const current = items[index]!;
              const canBrowse = items.length > 1;
              return (
                <>
                  <View style={reviewSt.commentModalHeader}>
                    <View style={[
                      reviewSt.commentModalIcon,
                      current.kind === "ai_note" && { backgroundColor: C.aiBg },
                    ]}>
                      <Ionicons
                        name={
                          current.kind === "ai_note"
                            ? "sparkles"
                            : current.kind === "key_moment"
                              ? "film-outline"
                              : "chatbubble-outline"
                        }
                        size={18}
                        color={current.kind === "ai_note" ? C.ai : C.brand}
                      />
                    </View>
                    <View style={st.flex1}>
                      <Text style={reviewSt.commentModalTitle}>{current.title}</Text>
                      <Text style={reviewSt.commentModalTime}>
                        {current.timestampSec != null ? fmtSec(current.timestampSec) : "No timestamp"}
                        {canBrowse ? ` · ${index + 1}/${items.length}` : ""}
                      </Text>
                    </View>
                    <Pressable onPress={() => setAnnotationSheet(null)} hitSlop={10}>
                      <Ionicons name="close" size={21} color={C.textMuted} />
                    </Pressable>
                  </View>
                  <Text style={reviewSt.annotationSheetBody}>{current.body}</Text>
                  <View style={reviewSt.annotationSheetActions}>
                    {canBrowse ? (
                      <View style={reviewSt.annotationSheetNav}>
                        <Pressable
                          accessibilityLabel="Previous note"
                          onPress={() => setAnnotationSheet({
                            items,
                            index: (index - 1 + items.length) % items.length,
                          })}
                          style={reviewSt.annotationSheetNavBtn}
                        >
                          <Ionicons name="chevron-back" size={18} color={C.brand} />
                        </Pressable>
                        <Text style={reviewSt.annotationSheetNavCount}>{index + 1}/{items.length}</Text>
                        <Pressable
                          accessibilityLabel="Next note"
                          onPress={() => setAnnotationSheet({
                            items,
                            index: (index + 1) % items.length,
                          })}
                          style={reviewSt.annotationSheetNavBtn}
                        >
                          <Ionicons name="chevron-forward" size={18} color={C.brand} />
                        </Pressable>
                      </View>
                    ) : <View style={st.flex1} />}
                    {current.timestampSec != null ? (
                      <Pressable
                        onPress={() => {
                          void seekToSeconds(current.timestampSec!, true);
                          setAnnotationSheet(null);
                        }}
                        style={reviewSt.annotationSheetPlay}
                      >
                        <Ionicons name="play" size={14} color="#fff" />
                        <Text style={reviewSt.annotationSheetPlayText}>Play</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </>
              );
            })() : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={commentComposerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCommentComposerOpen(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={reviewSt.commentModalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCommentComposerOpen(false)} />
          <View style={reviewSt.commentModalCard}>
            <View style={reviewSt.commentModalHeader}>
              <View style={reviewSt.commentModalIcon}>
                <Ionicons name="chatbubble-outline" size={18} color={C.brand} />
              </View>
              <View style={st.flex1}>
                <Text style={reviewSt.commentModalTitle}>Comment on selection</Text>
                <Text style={reviewSt.commentModalTime}>
                  {selectionRange ? `${fmtSec(selectionRange.start)}–${fmtSec(selectionRange.end)}` : ""}
                </Text>
              </View>
              <Pressable onPress={() => setCommentComposerOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={21} color={C.textMuted} />
              </Pressable>
            </View>
            <TextInput
              autoFocus
              multiline
              value={selectionComment}
              onChangeText={setSelectionComment}
              placeholder="Add a comment..."
              placeholderTextColor={C.textMuted}
              style={reviewSt.commentModalInput}
            />
            <Pressable
              disabled={!selectionComment.trim() || selectionBusy}
              onPress={() => void saveSelectionComment()}
              style={[
                reviewSt.commentModalSubmit,
                (!selectionComment.trim() || selectionBusy) && { opacity: 0.5 },
              ]}
            >
              {selectionBusy ? <LoadingDots size="small" color="#fff" /> : <Ionicons name="send" size={16} color="#fff" />}
              <Text style={reviewSt.commentModalSubmitText}>Add comment</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function DetailMeta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Ionicons name={icon} size={14} color={C.textSec} />
      <Text style={{ fontSize: 13, fontWeight: "700", color: C.textSec }}>{text}</Text>
    </View>
  );
}

function SessionReviewSnapshot({
  score,
  onOpenRubric,
}: {
  score: number;
  onOpenRubric: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open rubric review. ${score} out of 100.`}
      onPress={onOpenRubric}
      style={({ pressed }) => [reviewSt.reviewSnapshot, pressed && st.pressed]}
    >
      <Text selectable style={reviewSt.reviewScoreValue}>{score}</Text>
      <Text style={reviewSt.reviewScoreUnit}>/100</Text>
      <Text style={reviewSt.reviewScoreLabel}>Tour score</Text>
      <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
    </Pressable>
  );
}

function TranscriptLandmark({
  label,
  timestamp,
  color,
  momentCount,
  searchOpen,
  onSearchPress,
  onOpenMoments,
}: {
  label: string;
  timestamp: number;
  color: string;
  momentCount: number;
  searchOpen: boolean;
  onSearchPress: () => void;
  onOpenMoments?: () => void;
}) {
  return (
    <View style={reviewSt.transcriptLandmark} accessibilityLabel={`Current tour stage: ${label}`}>
      <View style={[reviewSt.transcriptLandmarkDot, { backgroundColor: color }]} />
      <Text numberOfLines={1} style={[reviewSt.transcriptLandmarkLabel, { color }]}>{label}</Text>
      <Text style={reviewSt.transcriptLandmarkTime}>{fmtSec(timestamp)}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={searchOpen ? "Close transcript search" : "Search transcript"}
        onPress={onSearchPress}
        style={[reviewSt.transcriptLandmarkSearch, searchOpen && reviewSt.transcriptLandmarkSearchActive]}
      >
        <Ionicons name={searchOpen ? "close" : "search-outline"} size={15} color={searchOpen ? C.brand : C.textMuted} />
      </Pressable>
      {momentCount > 0 && onOpenMoments ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${momentCount} coaching moments in this stage`}
          onPress={onOpenMoments}
          style={reviewSt.transcriptLandmarkMoment}
        >
          <Ionicons name="sparkles" size={12} color={C.ai} />
          <Text style={reviewSt.transcriptLandmarkMomentText}>{momentCount}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function TranscriptSearchInline({
  inputRef,
  query,
  resultCount,
  onChangeQuery,
  onClose,
}: {
  inputRef: React.RefObject<TextInput | null>;
  query: string;
  resultCount: number;
  onChangeQuery: (query: string) => void;
  onClose: () => void;
}) {
  const hasQuery = Boolean(query.trim());
  return (
    <Reanimated.View entering={FadeInDown.duration(180)} exiting={FadeIn.duration(120)} style={reviewSt.transcriptSearchWrap}>
      <View style={reviewSt.transcriptSearchInput}>
        <Ionicons name="search" size={16} color={C.textMuted} />
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={onChangeQuery}
          placeholder="Search transcript"
          placeholderTextColor={C.textMuted}
          returnKeyType="search"
          style={reviewSt.transcriptSearchText}
        />
        {hasQuery ? (
          <Text style={reviewSt.transcriptSearchCount}>{resultCount}</Text>
        ) : null}
        <Pressable accessibilityLabel="Close transcript search" onPress={onClose} hitSlop={10}>
          <Ionicons name="close" size={17} color={C.textMuted} />
        </Pressable>
      </View>
    </Reanimated.View>
  );
}

function CoachingMomentCard({
  moment,
  onSeek,
  compact = false,
}: {
  moment: {
    timestamp: string;
    transcriptQuote: string;
    explanation: string;
    suggestedImprovement: string;
    seconds: number | null;
  };
  onSeek: () => void;
  compact?: boolean;
}) {
  return (
    <MotionPressable onPress={onSeek} haptic="selection" entering={FadeInDown.duration(260).springify()} style={[reviewSt.coachingMoment, compact && reviewSt.coachingMomentCompact]}>
      <View style={reviewSt.coachingMomentHeader}>
        <View style={reviewSt.coachingMomentIcon}><Ionicons name="sparkles" size={13} color={C.ai} /></View>
        <Text style={reviewSt.coachingMomentKicker}>Coachable Moment</Text>
        <Text style={reviewSt.coachingMomentTime}>{moment.timestamp}</Text>
      </View>
      <Text style={reviewSt.coachingMomentBody}>{moment.explanation}</Text>
      {moment.suggestedImprovement ? (
        <View style={reviewSt.coachingSuggestion}>
          <Text style={reviewSt.coachingSuggestionLabel}>Try</Text>
          <Text style={reviewSt.coachingSuggestionText}>{moment.suggestedImprovement}</Text>
        </View>
      ) : null}
      {!compact && moment.transcriptQuote ? (
        <Text style={reviewSt.coachingQuote} numberOfLines={2}>"{moment.transcriptQuote}"</Text>
      ) : null}
    </MotionPressable>
  );
}

function RubricPicker({
  rubrics,
  value,
  open,
  onToggle,
  onSelect,
}: {
  rubrics: Rubric[];
  value: string | null;
  open: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
}) {
  const selected = rubrics.find((rubric) => rubric.id === value);
  return (
    <View style={liveSessionSt.settingBlock}>
      <Pressable onPress={onToggle} style={({ pressed }) => [liveSessionSt.settingAction, pressed && st.pressed]}>
        <View style={liveSessionSt.settingIcon}>
          <Ionicons name="clipboard-outline" size={18} color={C.textSec} />
        </View>
        <View style={st.flex1}>
          <Text style={st.pickerValue} numberOfLines={1}>{selected?.name ?? "Select rubric"}</Text>
          <Text style={st.pickerMeta}>
            {selected
              ? `Evaluation rubric · ${rubricTotalPoints(selected.definition)} pts · ${rubricItemCount(selected.definition)} items`
              : "Choose how this tour will be evaluated"}
          </Text>
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={C.textMuted} />
      </Pressable>
      {open && (
        <View style={[st.pickerMenu, liveSessionSt.rubricMenu]}>
          {rubrics.map((rubric, index) => (
            <Pressable
              key={rubric.id}
              onPress={() => onSelect(rubric.id)}
              style={({ pressed }) => [
                st.pickerOption,
                index > 0 && st.rowBorder,
                value === rubric.id && st.pickerOptionSelected,
                pressed && st.pressed,
              ]}
            >
              <View style={st.flex1}>
                <Text style={st.pickerOptionTitle}>{rubric.name}</Text>
                <Text style={st.pickerMeta}>
                  {rubric.definition.sections.length} sections · {rubricItemCount(rubric.definition)} items
                </Text>
              </View>
              {rubric.isDefault && <View style={st.defaultBadge}><Text style={st.defaultBadgeText}>Default</Text></View>}
              {value === rubric.id && <Ionicons name="checkmark-circle" size={19} color={C.brand} />}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function ProcessingTimeline({ status }: { status: string }) {
  const activeIndex = Math.max(0, SESSION_PROCESS_STEPS.findIndex((step) => step.id === status));
  const isComplete = status === "analysis_ready" || status === "reviewed";
  const visibleIndex = isComplete ? SESSION_PROCESS_STEPS.length - 1 : activeIndex;
  const activeStep = SESSION_PROCESS_STEPS[visibleIndex] ?? SESSION_PROCESS_STEPS[0];
  const percent = isComplete ? 100 : ((visibleIndex + 1) / SESSION_PROCESS_STEPS.length) * 100;

  return (
    <View style={reviewSt.processingTimeline}>
      <View style={reviewSt.processingProgressHeader}>
        <View style={reviewSt.processingCurrentStep}>
          {isComplete ? <Ionicons name="checkmark-circle" size={16} color={C.green} /> : <PulseDot color={C.brand} />}
          <Text style={reviewSt.processingCurrentLabel}>{isComplete ? "Review ready" : activeStep.label}</Text>
        </View>
        <Text style={reviewSt.processingStepCount}>{isComplete ? "Complete" : `${visibleIndex + 1} of ${SESSION_PROCESS_STEPS.length}`}</Text>
      </View>
      <View style={reviewSt.processingTrack}>
        <AnimatedProgressFill percent={percent} color={isComplete ? C.green : C.brand} />
      </View>
      <View style={reviewSt.processingLabels}>
        <Text style={reviewSt.processingLabel}>Recording saved</Text>
        <Text style={reviewSt.processingLabel}>Review ready</Text>
      </View>
    </View>
  );
}

const liveSessionSt = StyleSheet.create({
  pageScroll: {
    paddingTop: 18,
  },
  backAction: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    backgroundColor: C.card,
  },
  root: {
    gap: 16,
    paddingTop: 2,
  },
  sectionLabel: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  recordingLaunch: {
    alignItems: "center",
    gap: 11,
    paddingVertical: 12,
  },
  recordButtonHalo: {
    width: 88,
    height: 88,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 44,
    backgroundColor: C.brand + "12",
  },
  recordButton: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 32,
    backgroundColor: C.brand,
    shadowColor: C.brand,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 5,
  },
  readyCopyWrap: {
    alignItems: "center",
  },
  readyTitle: {
    color: C.text,
    fontSize: 18,
    fontWeight: "900",
  },
  readyCopy: {
    marginTop: 3,
    color: C.textSec,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    textAlign: "center",
  },
  settingsList: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    backgroundColor: C.card,
  },
  settingBlock: {
    backgroundColor: C.card,
  },
  settingAction: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  settingIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
  },
  settingDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 58,
    backgroundColor: C.border,
  },
  rubricMenu: {
    marginHorizontal: 10,
    marginBottom: 10,
  },
  uploadAction: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  uploadText: {
    color: C.text,
    fontSize: 13,
    fontWeight: "900",
  },
  uploadMeta: {
    marginTop: 2,
    color: C.textSec,
    fontSize: 11,
    fontWeight: "600",
  },
  cancelAction: {
    minHeight: 36,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
  },
  cancelText: {
    color: C.red,
    fontSize: 13,
    fontWeight: "800",
  },
});

const analysisPendingSt = StyleSheet.create({
  root: { gap: 16, paddingVertical: 8 },
  headingRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: C.aiBg },
  title: { color: C.text, fontSize: 17, fontWeight: "900" },
  copy: { marginTop: 3, color: C.textSec, fontSize: 13, lineHeight: 18, fontWeight: "600" },
  fileRow: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: C.border, borderRadius: 10, backgroundColor: C.card },
  fileName: { flex: 1, color: C.textSec, fontSize: 12, fontWeight: "700" },
  backgroundNote: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  backgroundCopy: { color: C.textMuted, fontSize: 11, lineHeight: 16, fontWeight: "600", textAlign: "center" },
  errorRoot: { gap: 16, padding: 18, borderWidth: 1, borderColor: "#fecdca", borderRadius: 16, backgroundColor: "#fff" },
  errorIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: C.redBg },
  errorTitle: { color: C.text, fontSize: 16, fontWeight: "900" },
  errorCopy: { marginTop: 3, color: C.textSec, fontSize: 12, lineHeight: 17, fontWeight: "600" },
});

// ═══════════════════════════════════════
// Upload & Process Card
// ═══════════════════════════════════════

function UploadProcessCard({
  sessionId,
  status,
  rubricId: initialRubricId,
  sessionTitle,
  prospectName,
  agentName,
  propertyName,
  hasRecording,
  processingError,
  autoStartRecording = false,
  initialNotes,
  initialLeads,
  initialAttachments,
  onDone,
}: {
  sessionId: string;
  status: string;
  rubricId: string | null;
  sessionTitle?: string;
  prospectName?: string | null;
  agentName?: string | null;
  propertyName?: string | null;
  hasRecording: boolean;
  processingError?: string | null;
  autoStartRecording?: boolean;
  initialNotes?: string | null;
  initialLeads: SessionLead[];
  initialAttachments: SessionAttachment[];
  onDone: () => void;
}) {
  const rec = useRecording();
  const [phase, setPhase] = useState<"idle" | "uploading" | "processing" | "done" | "error">(
    PROCESSING_STATUSES.has(status) ? "processing" : "idle"
  );
  const [uploadStats, setUploadStats] = useState<UploadStats>(initialUploadStats());
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<"upload" | "processing" | "missing_recording" | null>(null);
  const [recordingAvailable, setRecordingAvailable] = useState(hasRecording);
  const [pickedFile, setPickedFile] = useState<RecordingUploadFile | null>(null);
  const [pendingLocalId, setPendingLocalId] = useState<string | null>(null);
  const [pendingUploadChecked, setPendingUploadChecked] = useState(false);

  const [dNotes, setDNotes] = useState(initialNotes ?? "");
  const [assets, setAssets] = useState<Material[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>(
    initialAttachments.map((attachment) => attachment.materialId).filter((id): id is string => Boolean(id)),
  );
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [rubricsLoaded, setRubricsLoaded] = useState(false);
  const [rubricId, setRubricId] = useState<string | null>(initialRubricId);
  const [rubricOpen, setRubricOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const autoStartedRef = useRef(false);

  useEffect(() => {
    Promise.all([
      fetchRubrics(),
      fetchMaterials().catch(() => ({ materials: [] as Material[] })),
    ])
      .then(([{ rubrics: list }, materialData]) => {
        setRubrics(list);
        setAssets(materialData.materials.filter((material) => materialUrl(material)));
        if (!initialRubricId) {
          const fallbackRubricId = list.find((rubric) => rubric.isDefault)?.id ?? list[0]?.id ?? null;
          setRubricId(fallbackRubricId);
          if (fallbackRubricId) {
            void applyRubricToSession(sessionId, fallbackRubricId).catch(() => {});
          }
        }
      })
      .catch(() => {})
      .finally(() => setRubricsLoaded(true));
  }, [initialRubricId, sessionId]);

  useEffect(() => {
    if (PROCESSING_STATUSES.has(status)) setPhase("processing");
    if (status === "analysis_ready" || status === "reviewed") setPhase("done");
    if (status === "failed") {
      setErrMsg(recordingAvailable
        ? processingError?.trim() || "Tour could not prepare this review. Retry the analysis or upload a different recording."
        : "Add an audio or video recording before starting analysis.");
      setErrorKind(recordingAvailable ? "processing" : "missing_recording");
      setPhase("error");
    }
  }, [processingError, recordingAvailable, status]);

  useEffect(() => {
    let mounted = true;
    void loadPendingRecordingUpload(sessionId).then((pending) => {
      if (!mounted) return;
      if (!pending) {
        setPendingUploadChecked(true);
        return;
      }
      setPickedFile({
        uri: pending.uri,
        mimeType: pending.mimeType,
        name: pending.name,
        size: pending.size,
        durationSec: pending.durationSec,
      });
      setPendingLocalId(pending.localId ?? null);
      setUploadStats(initialUploadStats(pending.size));
      setErrMsg("Upload did not finish. Retry when you have a stable connection.");
      setErrorKind("upload");
      setPhase("error");
      setPendingUploadChecked(true);
    });
    return () => {
      mounted = false;
    };
  }, [sessionId]);

  function addRecordingAsset(asset: Material) {
    if (selectedAssetIds.includes(asset.id)) return;
    setSelectedAssetIds((current) => [...current, asset.id]);
    void Haptics.selectionAsync();
  }

  async function selectRubric(nextRubricId: string) {
    const previous = rubricId;
    setRubricId(nextRubricId);
    setRubricOpen(false);
    try {
      await applyRubricToSession(sessionId, nextRubricId);
      showToast("Rubric applied to this session", "success");
    } catch (caught) {
      setRubricId(previous);
      showToast(caught instanceof Error ? caught.message : "Could not apply rubric", "error");
    }
  }

  async function uploadPickedFile(file: RecordingUploadFile, localId?: string | null) {
    setPickedFile(file);
    setPhase("uploading");
    setErrMsg(null);
    setErrorKind(null);
    setUploadStats(initialUploadStats(file.size));
    const durableUri = localId
      ? ((await ensureDurableRecording(localId, file.uri)) ?? getRecordingUri(localId) ?? file.uri)
      : file.uri;
    if (localId) {
      markReadyToSync(localId, {
        durationSec: file.durationSec ?? 1,
        sourceUri: durableUri,
        remoteSessionId: sessionId,
        fileName: file.name,
        mimeType: file.mimeType,
      });
    }
    try {
      if (!(await isOnline())) {
        setPhase("error");
        setErrorKind("upload");
        setErrMsg("Saved on device — will upload when online.");
        showToast("Saved on device — will upload when online", "info");
        void drainSyncOutbox();
        return;
      }
      await uploadRecording(
        sessionId,
        durableUri,
        file.mimeType,
        file.name,
        file.durationSec,
        (next) => setUploadStats(uploadStatsFromProgress(next)),
      );
      await clearPendingRecordingUpload(sessionId, localId);
      promoteLocalRecordingToCache(sessionId, durableUri);
      setRecordingAvailable(true);
      void trackAnalyticsEvent("session_upload_complete", { sessionId });
      setUploadStats((current) => ({ ...current, phase: "finalizing", percent: 100, etaSeconds: 0 }));
      showToast("Recording uploaded", "success");
      await startProcess(true);
    } catch (caught) {
      await savePendingRecordingUpload({
        sessionId,
        localId,
        uri: durableUri,
        mimeType: file.mimeType,
        name: file.name,
        size: file.size,
        durationSec: file.durationSec,
        savedAt: Date.now(),
      });
      setPhase("error");
      setErrorKind("upload");
      setErrMsg(caught instanceof Error ? caught.message : "Upload failed");
      showToast(caught instanceof Error ? caught.message : "Upload failed", "error");
      void drainSyncOutbox();
    }
  }

  function startSessionRecording() {
    rec.openExperience({
      meta: {
        sessionId,
        title: sessionTitle?.trim() || "Tour conversation",
        prospectName: prospectName?.trim() || null,
        propertyName: propertyName?.trim() || null,
        agentName: agentName?.trim() || null,
        source: "session-detail",
      },
      draft: {
        notes: dNotes,
        assets,
        selectedAssetIds,
        participants: initialLeads,
        attachments: initialAttachments,
        prospect: prospectName?.trim() || "",
        location: propertyName?.trim() || "",
        rubricId,
      },
      onBeforeRecordingStart: async () => {
        if (await isOnline()) {
          const response = await authenticatedFetch(`/api/sessions/${sessionId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "in_progress" }),
          });
          if (!response.ok) throw new Error("Could not activate the tour session");
        }
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      },
      onCancel: async (snapshot) => {
        setCancelling(true);
        try {
          await snapshot.stop();
          snapshot.clearLiveSession();
          setSelectedAssetIds([]);
          if (await isOnline()) {
            const response = await authenticatedFetch(`/api/sessions/${sessionId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "scheduled" }),
            });
            if (!response.ok) throw new Error("Could not reset the session");
          }
          showToast("Recording cancelled. Session returned to scheduled.", "success");
          await onDone();
        } catch (caught) {
          showToast(caught instanceof Error ? caught.message : "Could not cancel the session", "error");
        } finally {
          setCancelling(false);
        }
      },
      onFinish: async (snapshot) => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const result = await snapshot.stop();
        const notes = snapshot.draft.notes;
        const localId = snapshot.localId;
        if (!result?.uri) {
          snapshot.clearLiveSession();
          showToast("Failed to save recording", "error");
          return;
        }
        let durableUri = result.uri;
        if (localId) {
          durableUri = (await ensureDurableRecording(localId, result.uri)) ?? result.uri;
          markReadyToSync(localId, {
            durationSec: result.durationSec,
            sourceUri: durableUri,
            remoteSessionId: sessionId,
            draft: snapshot.draft,
            fileName: `tour-${Date.now()}.m4a`,
            mimeType: "audio/m4a",
          });
          durableUri = getRecordingUri(localId) ?? durableUri;
        }
        snapshot.clearLiveSession();
        setDNotes(notes);
        await uploadPickedFile({
          uri: durableUri,
          mimeType: "audio/m4a",
          name: `tour-${Date.now()}.m4a`,
          durationSec: result.durationSec,
        }, localId);
      },
    });
  }

  useEffect(() => {
    if (!autoStartRecording || autoStartedRef.current) return;
    if (!(status === "scheduled" || status === "in_progress")) return;
    if (phase !== "idle") return;
    autoStartedRef.current = true;
    const timer = setTimeout(() => startSessionRecording(), 350);
    return () => clearTimeout(timer);
    // Intentionally run once when arriving from check-in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStartRecording, phase, status]);

  async function cancelSessionRecording() {
    setCancelling(true);
    try {
      await rec.stop();
      rec.clearLiveSession();
      setSelectedAssetIds([]);
      const response = await authenticatedFetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "scheduled" }),
      });
      if (!response.ok) throw new Error("Could not reset the session");
      showToast("Recording cancelled. Session returned to scheduled.", "success");
      await onDone();
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : "Could not cancel the session", "error");
    } finally {
      setCancelling(false);
    }
  }

  function confirmCancelSession() {
    Alert.alert(
      "Cancel this recording?",
      "The current recording will be discarded and the session will return to Scheduled.",
      [
        { text: "Keep recording", style: "cancel" },
        { text: "Cancel recording", style: "destructive", onPress: () => void cancelSessionRecording() },
      ]
    );
  }

  async function pickAndUpload() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["video/*", "audio/*"], copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const file = result.assets[0];
      await uploadPickedFile({
        uri: file.uri,
        mimeType: file.mimeType ?? "video/mp4",
        name: file.name ?? "recording.mp4",
        size: file.size ?? undefined,
      });
    } catch (err) {
      if (!pickedFile) {
        setPhase("error");
        setErrorKind("upload");
        setErrMsg(err instanceof Error ? err.message : "Upload failed");
        showToast(err instanceof Error ? err.message : "Upload failed", "error");
      }
    }
  }

  async function startProcess(fromFreshUpload = false) {
    if (!recordingAvailable && !fromFreshUpload) {
      setErrMsg("Add an audio or video recording before starting analysis.");
      setErrorKind("missing_recording");
      setPhase("error");
      return;
    }
    setPhase("processing");
    setErrMsg(null);
    setErrorKind(null);
    try {
      await processSession(sessionId);
      setPhase("done");
      showToast("Analysis complete!", "success");
      setTimeout(onDone, 600);
    } catch (err) {
      setPhase("error");
      setErrorKind("processing");
      setErrMsg(err instanceof Error ? err.message : "Processing failed");
      showToast(err instanceof Error ? err.message : "Processing failed", "error");
    }
  }

  // Resume an uploaded session only after its evaluation rubric is resolved.
  useEffect(() => {
    if (status !== "uploaded" || phase !== "idle" || !rubricsLoaded || !pendingUploadChecked) return;
    void (async () => {
      if (rubricId) await applyRubricToSession(sessionId, rubricId);
      await startProcess();
    })().catch((caught) => {
      setPhase("error");
      setErrorKind("processing");
      setErrMsg(caught instanceof Error ? caught.message : "Processing failed");
    });
  }, [pendingUploadChecked, phase, rubricId, rubricsLoaded, sessionId, status]);

  // ── Idle: pick a file ──
  if (phase === "idle" && (status === "scheduled" || status === "in_progress")) {
    return (
      <Reanimated.View entering={FadeInDown.duration(220)} style={liveSessionSt.root}>
        <Text style={liveSessionSt.sectionLabel}>Recording</Text>
        <View style={liveSessionSt.recordingLaunch}>
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel="Start live recording"
            haptic="medium"
            onPress={startSessionRecording}
            style={liveSessionSt.recordButtonHalo}
          >
            <View style={liveSessionSt.recordButton}>
              <Ionicons name="mic" size={27} color="#fff" />
            </View>
          </MotionPressable>
          <View style={liveSessionSt.readyCopyWrap}>
            <Text style={liveSessionSt.readyTitle}>Start the tour</Text>
            <Text style={liveSessionSt.readyCopy}>3-second countdown · Live transcription</Text>
          </View>
        </View>
        <View style={liveSessionSt.settingsList}>
          {rubrics.length > 0 && (
            <RubricPicker
              rubrics={rubrics}
              value={rubricId}
              open={rubricOpen}
              onToggle={() => setRubricOpen((current) => !current)}
              onSelect={(id) => void selectRubric(id)}
            />
          )}
          {rubrics.length > 0 ? <View style={liveSessionSt.settingDivider} /> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Upload an existing recording"
            onPress={pickAndUpload}
            style={({ pressed }) => [liveSessionSt.uploadAction, pressed && st.pressed]}
          >
            <View style={liveSessionSt.settingIcon}>
              <Ionicons name="cloud-upload-outline" size={18} color={C.textSec} />
            </View>
            <View style={st.flex1}>
              <Text style={liveSessionSt.uploadText}>Use an existing recording</Text>
              <Text style={liveSessionSt.uploadMeta}>Import audio or video from this device</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={C.textMuted} />
          </Pressable>
        </View>
        {status === "in_progress" && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel active session"
            disabled={cancelling}
            onPress={confirmCancelSession}
            style={({ pressed }) => [liveSessionSt.cancelAction, pressed && st.pressed]}
          >
            {cancelling ? <LoadingDots size="small" color={C.red} /> : <Ionicons name="close-circle-outline" size={18} color={C.red} />}
            <Text style={liveSessionSt.cancelText}>{cancelling ? "Cancelling..." : "Cancel session"}</Text>
          </Pressable>
        )}
      </Reanimated.View>
    );
  }

  // ── Uploading ──
  if (phase === "uploading") {
    return (
      <UploadStatusCard
        fileName={pickedFile?.name}
        fileSize={pickedFile?.size}
        stats={uploadStats}
      />
    );
  }

  // ── Processing ──
  if (phase === "processing") {
    return (
      <View style={analysisPendingSt.root}>
        <View style={analysisPendingSt.headingRow}>
          <View style={analysisPendingSt.icon}><Ionicons name="sparkles-outline" size={21} color={C.brand} /></View>
          <View style={st.flex1}>
            <Text style={analysisPendingSt.title}>Preparing your review</Text>
            <Text style={analysisPendingSt.copy}>Tour is turning your recording into a transcript, segments, and score.</Text>
          </View>
        </View>
        {pickedFile?.name ? (
          <View style={analysisPendingSt.fileRow}>
            <Ionicons name="checkmark-circle" size={16} color={C.green} />
            <Text style={analysisPendingSt.fileName} numberOfLines={1}>{pickedFile.name}</Text>
          </View>
        ) : null}
        <ProcessingTimeline status={status} />
        <View style={analysisPendingSt.backgroundNote}>
          <Ionicons name="phone-portrait-outline" size={15} color={C.textMuted} />
          <Text style={analysisPendingSt.backgroundCopy}>You can leave this screen. We’ll keep working.</Text>
        </View>
      </View>
    );
  }

  // ── Done ──
  if (phase === "done") {
    return (
      <View style={[st.card, { padding: 20, gap: 10, alignItems: "center" }]}>
        <Ionicons name="checkmark-circle" size={44} color={C.green} />
        <Text style={st.formTitle}>Analysis Complete</Text>
        <Text style={st.pageSub}>Loading results...</Text>
      </View>
    );
  }

  // ── Error ──
  if (phase === "error") {
    const uploadError = errorKind === "upload";
    const missingRecording = errorKind === "missing_recording";
    return (
      uploadError ? (
        <UploadStatusCard
          fileName={pickedFile?.name}
          fileSize={pickedFile?.size}
          stats={uploadStats}
          error={errMsg ?? "Upload failed"}
          onRetry={pickedFile ? () => void uploadPickedFile(pickedFile, pendingLocalId) : undefined}
          onChooseDifferent={() => void pickAndUpload()}
        />
      ) : (
        <View style={analysisPendingSt.errorRoot}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={analysisPendingSt.errorIcon}>
              <Ionicons name={missingRecording ? "mic-off-outline" : "alert-circle-outline"} size={22} color={C.red} />
            </View>
            <View style={st.flex1}>
              <Text style={analysisPendingSt.errorTitle}>{missingRecording ? "Recording required" : "Review couldn't be prepared"}</Text>
              <Text style={analysisPendingSt.errorCopy}>{errMsg}</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable onPress={missingRecording ? startSessionRecording : () => void startProcess()} style={({ pressed }) => [st.primaryBtn, { flex: 1 }, pressed && st.pressed]}>
              <Ionicons name={missingRecording ? "mic-outline" : "refresh"} size={17} color="#fff" />
              <Text style={st.primaryBtnText}>{missingRecording ? "Record" : "Retry"}</Text>
            </Pressable>
            <Pressable onPress={pickAndUpload} style={({ pressed }) => [st.outlineBtn, { flex: 1 }, pressed && st.pressed]}>
              <Ionicons name="cloud-upload-outline" size={17} color={C.text} />
              <Text style={st.outlineBtnText}>{missingRecording ? "Upload file" : "Replace file"}</Text>
            </Pressable>
          </View>
        </View>
      )
    );
  }

  // Fallback: uploaded but not yet processing
  return (
    <View style={[st.card, { padding: 20, gap: 12 }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Ionicons name="checkmark-circle" size={20} color={C.green} />
        <Text style={{ fontSize: 14, fontWeight: "700", color: C.green }}>Recording uploaded</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <PrimaryBtn label="Process Now" onPress={() => void startProcess()} icon="analytics-outline" />
        <Pressable onPress={pickAndUpload} style={({ pressed }) => [st.outlineBtn, pressed && st.pressed]}><Text style={st.outlineBtnText}>Re-upload</Text></Pressable>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════
// Overview Tab + Audio Player
// ═══════════════════════════════════════

function OverviewTab({ analysis, transcript, sessionId, hasRecording }: { analysis: AnalysisResult; transcript: any[]; sessionId: string; hasRecording: boolean }) {
  return (
    <View style={{ gap: 12 }}>
      {hasRecording && <AudioPlayer sessionId={sessionId} transcript={transcript} />}

      <InfoCard title="Executive Summary" icon="document-text-outline">{analysis.summary}</InfoCard>

      <View style={[st.card, { borderLeftWidth: 3, borderLeftColor: C.green }]}>
        <View style={{ padding: 16, gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="thumbs-up-outline" size={16} color={C.green} />
            <Text style={[st.cardTitle, { color: C.green }]}>Strengths</Text>
          </View>
          {analysis.strengths.map((s, i) => <BulletItem key={i} text={s} color={C.green} />)}
        </View>
      </View>

      <View style={[st.card, { borderLeftWidth: 3, borderLeftColor: C.amber }]}>
        <View style={{ padding: 16, gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="trending-up-outline" size={16} color={C.amber} />
            <Text style={[st.cardTitle, { color: C.amber }]}>Opportunities</Text>
          </View>
          {analysis.opportunities.map((o, i) => <BulletItem key={i} text={o} color={C.amber} />)}
        </View>
      </View>

      {analysis.suggestedRewrite && (
        <View style={[st.card, { borderLeftWidth: 3, borderLeftColor: C.brand }]}>
          <View style={{ padding: 16, gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={C.brand} />
              <Text style={[st.cardTitle, { color: C.brand }]}>Coaching Script</Text>
            </View>
            <Text style={{ fontSize: 14, fontWeight: "600", color: C.textSec, lineHeight: 21, fontStyle: "italic" }}>"{analysis.suggestedRewrite}"</Text>
          </View>
        </View>
      )}

      {analysis.fairHousingFlags && analysis.fairHousingFlags.length > 0 && (
        <View style={[st.card, { backgroundColor: C.redBg, borderColor: C.red + "30" }]}>
          <View style={{ padding: 16, gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="shield-outline" size={16} color={C.red} />
              <Text style={[st.cardTitle, { color: C.red }]}>Fair Housing Flags</Text>
            </View>
            {analysis.fairHousingFlags.map((f, i) => <Text key={i} style={{ fontSize: 13, fontWeight: "600", color: C.red }}>• {f}</Text>)}
          </View>
        </View>
      )}
    </View>
  );
}

function AudioPlayer({ sessionId, transcript }: { sessionId: string; transcript: any[] }) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let mounted = true;
    let s: Audio.Sound | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const resolved = await resolveSessionPlaybackUri(sessionId);
        const loadPromise = Audio.Sound.createAsync({ uri: resolved.uri }, { shouldPlay: false });
        timer = setTimeout(() => { if (mounted) setLoadError(true); }, 15_000);

        const { sound: loaded } = await loadPromise;
        clearTimeout(timer);
        if (!mounted) { loaded.unloadAsync(); return; }
        s = loaded;
        setSound(loaded);
        setLoadError(false);
        const status = await loaded.getStatusAsync();
        if (status.isLoaded && status.durationMillis) setDur(status.durationMillis / 1000);
        loaded.setOnPlaybackStatusUpdate((st) => {
          if (!mounted) return;
          if (st.isLoaded) {
            setPos(st.positionMillis / 1000);
            if (st.durationMillis) setDur(st.durationMillis / 1000);
            if (st.didJustFinish) { setPlaying(false); setPos(0); }
          }
        });
      } catch {
        clearTimeout(timer);
        if (mounted) setLoadError(true);
      }
    })();
    return () => { mounted = false; clearTimeout(timer); s?.unloadAsync(); };
  }, [sessionId, retryToken]);

  async function togglePlay() {
    if (!sound) return;
    if (playing) {
      await sound.pauseAsync();
      setPlaying(false);
    } else {
      await sound.playAsync();
      setPlaying(true);
    }
  }

  async function seekTo(frac: number) {
    if (!sound || dur === 0) return;
    const ms = frac * dur * 1000;
    await sound.setPositionAsync(ms);
    setPos(frac * dur);
  }

  const pct = dur > 0 ? (pos / dur) * 100 : 0;
  const activeSeg = transcript.find((s) => pos >= s.startTime && pos < s.endTime);

  if (loadError) {
    return (
      <View style={[st.card, { padding: 16, flexDirection: "row", alignItems: "center", gap: 10 }]}>
        <Ionicons name="alert-circle-outline" size={20} color={C.textMuted} />
        <Text style={{ fontSize: 13, fontWeight: "600", color: C.textSec, flex: 1 }}>Audio unavailable</Text>
        <Pressable onPress={() => { setLoadError(false); setSound(null); setRetryToken((n) => n + 1); }} style={({ pressed }) => pressed && st.pressed}>
          <Text style={{ fontSize: 13, fontWeight: "800", color: C.brand }}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!sound) {
    return (
      <View style={[st.card, { padding: 16, flexDirection: "row", alignItems: "center", gap: 10 }]}>
        <LoadingDots size="small" color={C.brand} />
        <Text style={{ fontSize: 13, fontWeight: "600", color: C.textSec }}>Loading audio...</Text>
      </View>
    );
  }

  return (
    <View style={[st.card, { overflow: "hidden" }]}>
      <View style={{ padding: 16, gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable onPress={togglePlay} style={({ pressed }) => [st.playBtn, pressed && st.pressed]}>
            <Ionicons name={playing ? "pause" : "play"} size={22} color="#fff" />
          </Pressable>
          <View style={st.flex1}>
            <Pressable onPress={(e) => { const w = Dimensions.get("window").width - 120; seekTo(Math.max(0, Math.min(1, (e.nativeEvent as any).locationX / w))); }}>
              <View style={st.timelineTrack}>
                <View style={[st.timelineFill, { width: `${pct}%` as any }]} />
                <View style={[st.timelineThumb, { left: `${pct}%` as any }]} />
              </View>
            </Pressable>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
              <Text style={st.timeText}>{fmtSec(pos)}</Text>
              <Text style={st.timeText}>{fmtSec(dur)}</Text>
            </View>
          </View>
        </View>
        {activeSeg && (
          <View style={{ backgroundColor: C.brand + "08", borderRadius: 10, padding: 10 }}>
            <Text style={{ fontSize: 11, fontWeight: "800", color: C.brand, marginBottom: 2 }}>{activeSeg.speaker}</Text>
            <Text style={{ fontSize: 13, fontWeight: "600", color: C.text, lineHeight: 19 }}>{activeSeg.text}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function InfoCard({ title, icon, children }: { title: string; icon: keyof typeof Ionicons.glyphMap; children: string }) {
  return (
    <View style={st.card}>
      <View style={{ padding: 16, gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name={icon} size={16} color={C.text} />
          <Text style={st.cardTitle}>{title}</Text>
        </View>
        <Text style={{ fontSize: 14, fontWeight: "600", color: C.textSec, lineHeight: 21 }}>{children}</Text>
      </View>
    </View>
  );
}

function BulletItem({ text, color }: { text: string; color: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
      <Ionicons name="ellipse" size={6} color={color} style={{ marginTop: 7 }} />
      <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: C.textSec, lineHeight: 21 }}>{text}</Text>
    </View>
  );
}

// ═══════════════════════════════════════
// Transcript Tab
// ═══════════════════════════════════════

function TranscriptTab({ transcript }: { transcript: any[] }) {
  if (!transcript.length) return <EmptyState icon="chatbubble-outline" title="No transcript" subtitle="Process a recording to generate the transcript" />;
  return (
    <View style={st.card}>
      <View style={{ padding: 16 }}>
        {transcript.map((seg, i) => {
          const isAgent = seg.speaker?.toLowerCase().includes("agent");
          return (
            <View key={seg.id || i} style={[{ paddingVertical: 10 }, i > 0 && { borderTopWidth: 1, borderTopColor: "#f1f5f9" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <View style={[st.speakerBadge, { backgroundColor: isAgent ? C.brand + "15" : C.aiBg }]}>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: isAgent ? C.brand : C.ai }}>{seg.speaker}</Text>
                </View>
                <Text style={st.timeText}>{fmtSec(seg.startTime)}</Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: "600", color: C.text, lineHeight: 21 }}>{seg.text}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ═══════════════════════════════════════
// Actions Tab
// ═══════════════════════════════════════

function ActionsTab({
  actions,
  sessionId,
  onUpdate,
  onActionsChange,
  readOnly = false,
}: {
  actions: FollowUpAction[];
  sessionId: string;
  onUpdate: () => void;
  onActionsChange?: (next: FollowUpAction[] | ((prev: FollowUpAction[]) => FollowUpAction[])) => void;
  readOnly?: boolean;
}) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const updateActionMutation = useUpdateActionStatusMutation(sessionId);
  const priorityRank = { high: 0, medium: 1, low: 2 } as const;
  const open = actions
    .filter((a) => a.status === "open")
    .sort((left, right) => (priorityRank[left.priority] ?? 1) - (priorityRank[right.priority] ?? 1));
  const done = actions.filter((a) => a.status !== "open");
  const selectedAction = actions.find((action) => action.id === selectedActionId) ?? null;

  async function handleStatus(id: string, status: "completed" | "dismissed") {
    const previous = actions;
    onActionsChange?.((prev) => prev.map((action) => (action.id === id ? { ...action, status } : action)));
    setUpdatingId(id);
    try {
      await updateActionMutation.mutateAsync({ actionId: id, status });
      showToast(status === "completed" ? "Marked as done" : "Dismissed", "success");
      onUpdate();
    } catch {
      onActionsChange?.(previous);
      showToast("Failed to update", "error");
    } finally {
      setUpdatingId(null);
    }
  }

  if (!actions.length) return <EmptyState icon="rocket-outline" title="No actions" subtitle="Follow-up actions will appear after analysis" />;

  return (
    <View style={reviewSt.coachingQueue}>
      <View style={reviewSt.coachingQueueHeader}>
        <View style={reviewSt.coachingQueueIcon}>
          <Ionicons name="checkmark-done-outline" size={17} color={C.brand} />
        </View>
        <View style={st.flex1}>
          <Text style={reviewSt.coachingQueueTitle}>Coaching</Text>
          <Text style={reviewSt.coachingQueueSubtitle}>
            {open.length === 1 ? "1 move to consider" : `${open.length} moves to consider`}
          </Text>
        </View>
      </View>
      {open.length > 0 && open.map((a, index) => {
        return (
          <Pressable
            key={a.id}
            accessibilityRole="button"
            accessibilityLabel={`Open follow-up: ${a.title}`}
            onPress={() => {
              selectionHaptic();
              setSelectedActionId(a.id);
            }}
            style={({ pressed }) => [reviewSt.coachingQueueItem, pressed && st.pressed]}
          >
            <View style={reviewSt.coachingQueueIndex}>
              <Text style={reviewSt.coachingQueueIndexText}>{index + 1}</Text>
            </View>
            <View style={st.flex1}>
              <Text style={reviewSt.coachingQueueItemTitle} numberOfLines={2}>{a.title}</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={C.textMuted} />
          </Pressable>
        );
      })}
      {done.length > 0 ? (
        <CollapsibleSection title={`Completed (${done.length})`}>
          {done.map((a) => (
            <View key={a.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, opacity: 0.7 }}>
              <Ionicons name={a.status === "completed" ? "checkmark-circle" : "close-circle"} size={18} color={a.status === "completed" ? C.green : C.textMuted} />
              <Text style={{ flex: 1, fontSize: 14, fontWeight: "700", color: C.text }} numberOfLines={1}>{a.title}</Text>
            </View>
          ))}
        </CollapsibleSection>
      ) : null}

      <Modal
        visible={Boolean(selectedAction)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedActionId(null)}
      >
        <View style={reviewSt.actionSheetBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedActionId(null)} />
          {selectedAction ? (() => {
            const actionIndex = open.findIndex((action) => action.id === selectedAction.id);
            return (
              <View style={reviewSt.actionSheet}>
                <View style={reviewSt.actionSheetHandle} />
                <View style={reviewSt.actionSheetHeader}>
                  <View style={reviewSt.coachingQueueIndex}>
                    <Text style={reviewSt.coachingQueueIndexText}>{actionIndex + 1}</Text>
                  </View>
                  <View style={st.flex1}>
                    <Text style={reviewSt.actionSheetKicker}>Coaching action</Text>
                    <Text style={reviewSt.actionSheetTitle}>{selectedAction.title}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close follow-up action"
                    onPress={() => setSelectedActionId(null)}
                    hitSlop={8}
                  >
                    <Ionicons name="close" size={21} color={C.textMuted} />
                  </Pressable>
                </View>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={reviewSt.actionSheetContent}>
                  <View style={reviewSt.actionSheetSection}>
                    <Text style={reviewSt.actionSheetSectionLabel}>Why it matters</Text>
                    <Text style={reviewSt.actionSheetBody}>{selectedAction.description}</Text>
                  </View>
                  {selectedAction.suggestedMessage ? (
                    <View style={reviewSt.actionMessage}>
                      <View style={reviewSt.actionMessageHeader}>
                        <Ionicons name="chatbubble-ellipses-outline" size={15} color={C.brand} />
                        <Text style={reviewSt.actionMessageLabel}>Suggested follow-up</Text>
                      </View>
                      <Text style={reviewSt.actionMessageText}>{selectedAction.suggestedMessage}</Text>
                    </View>
                  ) : null}
                </ScrollView>
                {!readOnly ? (
                  <View style={reviewSt.actionSheetActions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Dismiss follow-up action"
                      disabled={updatingId === selectedAction.id}
                      onPress={() => void handleStatus(selectedAction.id, "dismissed").then(() => setSelectedActionId(null))}
                      style={({ pressed }) => [reviewSt.actionSheetDismiss, pressed && st.pressed]}
                    >
                      <Text style={reviewSt.actionSheetDismissText}>Dismiss</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Mark follow-up action complete"
                      disabled={updatingId === selectedAction.id}
                      onPress={() => void handleStatus(selectedAction.id, "completed").then(() => setSelectedActionId(null))}
                      style={({ pressed }) => [reviewSt.actionSheetComplete, pressed && st.pressed]}
                    >
                      {updatingId === selectedAction.id ? (
                        <LoadingDots size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="checkmark" size={17} color="#fff" />
                          <Text style={reviewSt.actionSheetCompleteText}>Mark done</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })() : null}
        </View>
      </Modal>
    </View>
  );
}

// ═══════════════════════════════════════
// Comments Tab
// ═══════════════════════════════════════

function SessionCommentsScreen({
  sessionId,
  sessionTitle,
  onBack,
}: {
  sessionId: string;
  sessionTitle?: string;
  onBack: () => void;
}) {
  const [title, setTitle] = useState(sessionTitle);
  const [refreshing, setRefreshing] = useState(false);
  const commentsQuery = useCommentsQuery(sessionId);
  const sessionQuery = useSessionQuery(sessionId);
  const comments = commentsQuery.data?.comments ?? [];
  const loading = commentsQuery.isLoading;
  const error = commentsQuery.error ?? sessionQuery.error ?? null;

  useEffect(() => {
    if (!title && sessionQuery.data?.session?.title) setTitle(sessionQuery.data.session.title);
  }, [sessionQuery.data, title]);

  const load = useCallback(async () => {
    await Promise.all([
      commentsQuery.refetch(),
      title ? Promise.resolve() : sessionQuery.refetch(),
    ]);
  }, [commentsQuery, sessionQuery, title]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <View style={reviewSt.root}>
      <TourScreenHeader
        onBack={onBack}
        title="Comments"
        subtitle={title ?? "Session feedback"}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={C.brand} />}
        contentContainerStyle={reviewSt.commentsPageContent}
      >
        {error ? <ErrorBanner message={error instanceof Error ? error.message : "Could not load comments"} onRetry={load} /> : null}
        {loading ? (
          <CommentsSkeleton />
        ) : (
          <CommentsTab comments={comments} sessionId={sessionId} onUpdate={load} />
        )}
      </ScrollView>
    </View>
  );
}

function CommentsTab({
  comments,
  sessionId,
  onUpdate,
}: {
  comments: SessionComment[];
  sessionId: string;
  onUpdate: () => void;
}) {
  const [body, setBody] = useState("");
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const postCommentMutation = usePostCommentMutation(sessionId);
  const deleteCommentMutation = useDeleteCommentMutation(sessionId);
  const submitting = postCommentMutation.isPending;

  async function handlePost() {
    if (!body.trim()) return;
    try {
      await postCommentMutation.mutateAsync({ body: body.trim(), parentId: replyToId });
      setBody("");
      setReplyToId(null);
      showToast("Comment posted", "success");
      onUpdate();
    } catch {
      showToast("Failed to post comment", "error");
    }
  }

  async function handleDelete(commentId: string) {
    try {
      await deleteCommentMutation.mutateAsync(commentId);
      showToast("Comment deleted", "success");
      onUpdate();
    } catch {
      showToast("Failed to delete", "error");
    }
  }

  const topLevel = comments.filter((c) => !c.parentId);
  const getReplies = (parentId: string) => comments.filter((c) => c.parentId === parentId);

  function relativeTime(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <View style={{ gap: 12 }}>
      {/* Compose */}
      <View style={st.card}>
        <View style={{ padding: 14, gap: 10 }}>
          {replyToId && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.brand + "10", borderRadius: 8, padding: 8 }}>
              <Ionicons name="return-down-forward-outline" size={14} color={C.brand} />
              <Text style={{ flex: 1, fontSize: 12, fontWeight: "700", color: C.brand }}>Replying to comment</Text>
              <Pressable onPress={() => setReplyToId(null)}><Ionicons name="close-circle" size={18} color={C.textMuted} /></Pressable>
            </View>
          )}
          <TextInput
            placeholder="Add a comment..."
            placeholderTextColor={C.textMuted}
            value={body}
            onChangeText={setBody}
            multiline
            style={{ fontSize: 14, fontWeight: "600", color: C.text, minHeight: 60, textAlignVertical: "top" }}
          />
          <Pressable
            onPress={handlePost}
            disabled={!body.trim() || submitting}
            style={({ pressed }) => [st.primaryBtn, { minHeight: 42 }, pressed && st.pressed, (!body.trim() || submitting) && { opacity: 0.5 }]}
          >
            <Ionicons name="send-outline" size={16} color="#fff" />
            <Text style={[st.primaryBtnText, { fontSize: 14 }]}>{submitting ? "Posting..." : "Post Comment"}</Text>
          </Pressable>
        </View>
      </View>

      {/* Comments list */}
      {topLevel.length === 0 ? (
        <EmptyState icon="chatbubbles-outline" title="No comments yet" subtitle="Be the first to add feedback on this session" />
      ) : (
        topLevel.map((c) => (
          <View key={c.id} style={st.card}>
            <View style={{ padding: 14, gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.brand + "15", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 12, fontWeight: "900", color: C.brand }}>{c.authorName[0]?.toUpperCase()}</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: "800", color: C.text }}>{c.authorName}</Text>
                <View style={reviewSt.commentKindBadge}>
                  <Ionicons
                    name={c.kind === "key_moment" ? "star" : "chatbubble-outline"}
                    size={10}
                    color={c.kind === "key_moment" ? C.ai : C.brand}
                  />
                  <Text style={[reviewSt.commentKindText, c.kind === "key_moment" && { color: C.ai }]}>
                    {c.kind === "key_moment" ? "Key moment" : "Manual"}
                  </Text>
                </View>
                <Text style={{ fontSize: 11, fontWeight: "600", color: C.textMuted }}>{relativeTime(c.createdAt)}</Text>
                {c.timestampSec !== null && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: C.brand + "10", borderRadius: 99, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Ionicons name="time-outline" size={10} color={C.brand} />
                    <Text style={{ fontSize: 10, fontWeight: "800", color: C.brand }}>{fmtSec(c.timestampSec)}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }} />
                <Pressable onPress={() => setReplyToId(c.id)} style={{ padding: 4 }}>
                  <Ionicons name="return-down-forward-outline" size={16} color={C.textMuted} />
                </Pressable>
                <Pressable onPress={() => handleDelete(c.id)} style={{ padding: 4 }}>
                  <Ionicons name="trash-outline" size={16} color={C.textMuted} />
                </Pressable>
              </View>
              <Text style={{ fontSize: 14, fontWeight: "600", color: C.textSec, lineHeight: 21 }}>{c.body}</Text>

              {/* Replies */}
              {getReplies(c.id).map((r) => (
                <View key={r.id} style={{ marginLeft: 28, marginTop: 8, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: C.brand + "20", gap: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.brand + "10", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 9, fontWeight: "900", color: C.brand }}>{r.authorName[0]?.toUpperCase()}</Text>
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: "800", color: C.text }}>{r.authorName}</Text>
                    <Text style={{ fontSize: 10, fontWeight: "600", color: C.textMuted }}>{relativeTime(r.createdAt)}</Text>
                    <View style={{ flex: 1 }} />
                    <Pressable onPress={() => handleDelete(r.id)} style={{ padding: 4 }}>
                      <Ionicons name="trash-outline" size={14} color={C.textMuted} />
                    </Pressable>
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: C.textSec, lineHeight: 20 }}>{r.body}</Text>
                </View>
              ))}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

// ═══════════════════════════════════════
// Rubrics
// ═══════════════════════════════════════

function RubricsScreen({
  session,
  onBack,
  onSession,
}: {
  session: MobileAuthSession;
  onBack: () => void;
  onSession: (id: string) => void;
}) {
  const [selected, setSelected] = useState<Rubric | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const rubricsQuery = useRubricsQuery();
  const sessionsQuery = useSessionsQuery({ limit: 100 });
  const rubrics = rubricsQuery.data?.rubrics ?? [];
  const sessions = sessionsQuery.data?.sessions ?? [];
  const loading = rubricsQuery.isLoading || sessionsQuery.isLoading;
  const error = rubricsQuery.error ?? sessionsQuery.error ?? null;

  useEffect(() => {
    if (!selected) return;
    setSelected(rubrics.find((rubric) => rubric.id === selected.id) ?? null);
  }, [rubrics, selected]);

  const load = useCallback(async () => {
    await Promise.all([rubricsQuery.refetch(), sessionsQuery.refetch()]);
  }, [rubricsQuery, sessionsQuery]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function openRubricSettings() {
    const url = `${getSiteBaseUrl()}/rubrics`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Could not open Tour.you", `Open ${url} in your browser to manage rubric settings.`);
    }
  }

  function applicationsFor(rubricId: string) {
    return sessions.filter((item) => item.rubricId === rubricId);
  }

  const defaultRubric = rubrics.find((rubric) => rubric.isDefault) ?? rubrics[0] ?? null;
  const otherRubrics = defaultRubric ? rubrics.filter((rubric) => rubric.id !== defaultRubric.id) : rubrics;

  return (
    <View style={st.flex1}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={st.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={C.brand} />}
      >
          <View style={st.page}>
            <View style={st.pageHeadingRow}>
              <BackBtn label="Settings" onPress={onBack} />
              <View style={st.flex1} />
            </View>
            <View>
              <Text style={st.pageTitle}>Rubrics</Text>
              <Text style={st.pageHeadingSub}>{session.workspace.community.name}</Text>
            </View>
            {error && <ErrorBanner message={error instanceof Error ? error.message : "Could not load rubrics"} onRetry={load} />}
            <MotionPressable
              onPress={() => void openRubricSettings()}
              haptic="selection"
              style={st.defaultRubricCard}
            >
              <View style={[st.defaultRubricIcon, { backgroundColor: C.brand + "10" }]}>
                <Ionicons name="open-outline" size={22} color={C.brand} />
              </View>
              <View style={st.flex1}>
                <Text style={st.defaultRubricTitle}>Manage rubric settings on Tour.you</Text>
                <Text style={st.materialMeta}>Clone frozen templates, edit criteria, and manage this property’s rubrics on the web.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
            </MotionPressable>
          {loading ? <RubricsSkeleton /> : rubrics.length === 0 ? (
            <EmptyState icon="clipboard-outline" title="No rubrics" subtitle="Evaluation templates will appear here" />
          ) : (
            <>
              {defaultRubric && (
                <MotionPressable onPress={() => setSelected(defaultRubric)} haptic="selection" style={st.defaultRubricCard}>
                  <View style={st.defaultRubricIcon}>
                    <Ionicons name="clipboard-outline" size={23} color={C.ai} />
                  </View>
                  <View style={st.flex1}>
                    <View style={st.rubricTitleRow}>
                      <Text style={st.defaultRubricTitle} numberOfLines={2}>{defaultRubric.name}</Text>
                      <View style={st.defaultBadge}><Text style={st.defaultBadgeText}>Default</Text></View>
                    </View>
                    <Text style={st.materialMeta}>
                      {defaultRubric.definition.sections.length} sections · {rubricItemCount(defaultRubric.definition)} items · {rubricTotalPoints(defaultRubric.definition)} pts
                    </Text>
                    <Text style={st.rubricAppliedText}>{applicationsFor(defaultRubric.id).length} session{applicationsFor(defaultRubric.id).length === 1 ? "" : "s"}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
                </MotionPressable>
              )}

              <Text style={st.sectionTitle}>All rubrics</Text>
              <View style={st.rubricGrid}>
              {otherRubrics.map((rubric) => {
                const applications = applicationsFor(rubric.id);
                return (
                  <MotionPressable
                    key={rubric.id}
                    onPress={() => setSelected(rubric)}
                    haptic="selection"
                    style={st.rubricCard}
                  >
                    <View style={st.rubricListIcon}><Ionicons name="clipboard-outline" size={19} color={C.ai} /></View>
                    <View style={st.rubricCardBody}>
                      <Text style={st.rubricCardTitle} numberOfLines={2}>{rubric.name}</Text>
                      <Text style={st.materialMeta} numberOfLines={1}>
                        {rubric.definition.sections.length} sections · {rubricItemCount(rubric.definition)} items
                      </Text>
                      <Text style={st.rubricAppliedText}>{applications.length} session{applications.length === 1 ? "" : "s"}</Text>
                    </View>
                  </MotionPressable>
                );
              })}
              </View>
            </>
          )}
        </View>
      </ScrollView>

      <Modal visible={Boolean(selected)} animationType="slide" onRequestClose={() => setSelected(null)}>
        {selected && (
          <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={st.scroll}>
            <View style={st.page}>
              <View style={st.pageHeadingRow}>
                <BackBtn label="Rubrics" onPress={() => setSelected(null)} />
                <View style={st.flex1} />
                {selected.isDefault && <View style={st.defaultBadge}><Text style={st.defaultBadgeText}>Default</Text></View>}
              </View>
              <Text style={st.detailTitle}>{selected.name}</Text>
              <Text style={st.pageHeadingSub}>
                {rubricItemCount(selected.definition)} criteria · {rubricTotalPoints(selected.definition)} points
              </Text>
              {selected.definition.sections.map((section) => (
                <View key={section.name} style={st.card}>
                  <View style={st.rubricSectionHeader}>
                    <View style={st.flex1}>
                      <Text style={st.cardTitle}>{section.name}</Text>
                      <Text style={st.materialMeta}>{section.items.length} items</Text>
                    </View>
                    <Text style={st.rubricPoints}>{section.items.reduce((sum, item) => sum + item.points, 0)} pts</Text>
                  </View>
                  {section.items.map((item, index) => (
                    <View key={item.id} style={[st.rubricItem, index > 0 && st.rowBorder]}>
                      <View style={st.rubricItemNumber}><Text style={st.rubricItemNumberText}>{index + 1}</Text></View>
                      <View style={st.flex1}>
                        <Text style={st.rubricItemText}>{item.text}</Text>
                        {item.note && <Text style={st.rubricItemNote}>{item.note}</Text>}
                      </View>
                      <Text style={st.rubricPoints}>{item.points}</Text>
                    </View>
                  ))}
                </View>
              ))}
              {selected.definition.compliance && selected.definition.compliance.length > 0 && (
                <View style={st.card}>
                  <View style={st.rubricSectionHeader}><Text style={st.cardTitle}>Compliance</Text></View>
                  {selected.definition.compliance.map((item, index) => (
                    <View key={item.id} style={[st.rubricItem, index > 0 && st.rowBorder]}>
                      <Ionicons name="shield-checkmark-outline" size={18} color={C.green} />
                      <View style={st.flex1}>
                        <Text style={st.rubricItemText}>{item.text}</Text>
                        {item.note && <Text style={st.rubricItemNote}>{item.note}</Text>}
                      </View>
                    </View>
                  ))}
                </View>
              )}
              <Text style={st.sectionTitle}>Applied sessions</Text>
              {applicationsFor(selected.id).length === 0 ? (
                <EmptyState icon="albums-outline" title="No applications yet" subtitle="Choose this rubric when starting or opening a scheduled session" />
              ) : (
                <View style={st.card}>
                  {applicationsFor(selected.id).map((item, index, list) => (
                    <SessionRow
                      key={item.id}
                      session={item}
                      isLast={index === list.length - 1}
                      onPress={() => {
                        setSelected(null);
                        onSession(item.id);
                      }}
                    />
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
        )}
      </Modal>
    </View>
  );
}

// ═══════════════════════════════════════
// Settings
// ═══════════════════════════════════════

type SettingsView = "main" | "check-in" | "legal" | "about";

function SettingsGroup({ children }: { children: React.ReactNode }) {
  return <View style={settingsPageSt.group}>{children}</View>;
}

function SettingsRow({
  icon,
  title,
  subtitle,
  value,
  onPress,
  destructive = false,
  external = false,
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  external?: boolean;
  last?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [settingsPageSt.row, !last && settingsPageSt.rowBorder, pressed && st.pressed]}
    >
      <View style={[settingsPageSt.rowIcon, destructive && settingsPageSt.rowIconDestructive]}>
        <Ionicons name={icon} size={18} color={destructive ? C.red : C.textSec} />
      </View>
      <View style={st.flex1}>
        <Text style={[settingsPageSt.rowTitle, destructive && { color: C.red }]}>{title}</Text>
        {subtitle ? <Text style={settingsPageSt.rowSubtitle} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={settingsPageSt.rowValue} numberOfLines={1}>{value}</Text> : null}
      {onPress ? <Ionicons name={external ? "open-outline" : "chevron-forward"} size={17} color={destructive ? C.red : C.textMuted} /> : null}
    </Pressable>
  );
}

function SettingsSubpageHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={settingsPageSt.subpageHeader}>
      <MotionPressable accessibilityRole="button" accessibilityLabel="Back to settings" onPress={onBack} style={settingsPageSt.backButton}>
        <Ionicons name="arrow-back" size={20} color={C.text} />
      </MotionPressable>
      <Text style={settingsPageSt.subpageTitle}>{title}</Text>
    </View>
  );
}

function SettingsScreen({ session, onSessionChange, onProfile, onRubrics, onSignOut }: {
  session: MobileAuthSession;
  onSessionChange: (session: MobileAuthSession) => void;
  onProfile: () => void;
  onRubrics: () => void;
  onSignOut: () => void;
}) {
  const [view, setView] = useState<SettingsView>("main");
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [communityPickerOpen, setCommunityPickerOpen] = useState(false);
  const [communityQuery, setCommunityQuery] = useState("");
  const [logoutOpen, setLogoutOpen] = useState(false);
  const defaultUserAlias = defaultMemberPublicAlias({
    alias: session.workspace.teamMember?.alias,
    name: session.workspace.teamMember?.name || session.workspace.user.fullName,
    email: session.workspace.user.email,
    id: session.workspace.teamMember?.id || session.workspace.user.id,
  });
  const defaultPropertyAlias = defaultPropertyPublicAlias({
    alias: session.workspace.community.alias,
    name: session.workspace.community.name,
    propertyTygId: session.workspace.community.propertyTygId,
  });
  const [userAlias, setUserAlias] = useState(defaultUserAlias);
  const [propertyAlias, setPropertyAlias] = useState(defaultPropertyAlias);
  const [savingAliases, setSavingAliases] = useState(false);
  const teamRole = session.workspace.teamMember?.role || "Property Team";
  const authorizedPropertyCount = authorizedCommunitiesForSession(session).length;
  const publicPropertyKey = propertyAlias.trim() || defaultPropertyAlias;
  const publicMemberKey = userAlias.trim() || defaultUserAlias;
  const publicCheckInUrl = `${getSiteBaseUrl().replace(/\/$/, "")}/p/${encodeURIComponent(publicPropertyKey)}/${encodeURIComponent(publicMemberKey)}`;
  const accent = resolveCardAccent(session.workspace.user.cardAccent);

  useEffect(() => {
    setUserAlias(defaultMemberPublicAlias({
      alias: session.workspace.teamMember?.alias,
      name: session.workspace.teamMember?.name || session.workspace.user.fullName,
      email: session.workspace.user.email,
      id: session.workspace.teamMember?.id || session.workspace.user.id,
    }));
    setPropertyAlias(defaultPropertyPublicAlias({
      alias: session.workspace.community.alias,
      name: session.workspace.community.name,
      propertyTygId: session.workspace.community.propertyTygId,
    }));
  }, [
    session.workspace.community.id,
    session.workspace.community.alias,
    session.workspace.community.name,
    session.workspace.community.propertyTygId,
    session.workspace.teamMember?.alias,
    session.workspace.teamMember?.name,
    session.workspace.teamMember?.id,
    session.workspace.user.fullName,
    session.workspace.user.email,
    session.workspace.user.id,
  ]);

  async function saveAliases() {
    setSavingAliases(true);
    try {
      const nextSession = await updateWorkspaceAliases({
        userAlias: userAlias.trim() || null,
        propertyAlias: propertyAlias.trim() || null,
      });
      onSessionChange(nextSession);
      showToast("Public check-in link saved", "success");
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : "Could not save aliases", "error");
    } finally {
      setSavingAliases(false);
    }
  }

  async function chooseCommunity(communityId: string) {
    if (communityId === session.workspace.community.id) {
      setCommunityPickerOpen(false);
      return;
    }
    setSwitchingId(communityId);
    try {
      onSessionChange(await switchCommunity(communityId));
      setCommunityPickerOpen(false);
      setCommunityQuery("");
      showToast("Property switched", "success");
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : "Could not switch property", "error");
    } finally {
      setSwitchingId(null);
    }
  }

  async function openSettingsUrl(path: string) {
    const url = `${getSiteBaseUrl().replace(/\/$/, "")}${path}`;
    try {
      await Linking.openURL(url);
    } catch {
      showToast("Could not open this page", "error");
    }
  }

  const content = view === "check-in" ? (
    <View style={st.page}>
      <SettingsSubpageHeader title="Public check-in" onBack={() => setView("main")} />
      <Text style={settingsPageSt.intro}>Choose the public link guests use to check in for a tour.</Text>
      <View style={st.aliasSettingsCard}>
        <View style={st.aliasFieldGroup}>
          <Text style={st.aliasFieldLabel}>Property alias</Text>
          <View style={st.aliasInputRow}>
            <Text style={st.aliasPrefix}>tour.you/p/</Text>
            <TextInput
              accessibilityLabel="Property alias"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={defaultPropertyAlias || "property-name"}
              placeholderTextColor={C.textMuted}
              value={propertyAlias}
              onChangeText={setPropertyAlias}
              style={st.aliasInput}
            />
          </View>
        </View>
        <View style={st.aliasFieldGroup}>
          <Text style={st.aliasFieldLabel}>Your alias</Text>
          <View style={st.aliasInputRow}>
            <Text style={st.aliasPrefix}>/</Text>
            <TextInput
              accessibilityLabel="Your check-in alias"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={defaultUserAlias || "your-name"}
              placeholderTextColor={C.textMuted}
              value={userAlias}
              onChangeText={setUserAlias}
              style={st.aliasInput}
            />
          </View>
        </View>
        <View style={settingsPageSt.linkPreview}>
          <View style={settingsPageSt.linkPreviewIcon}>
            <Ionicons name="link-outline" size={18} color={C.brand} />
          </View>
          <Text style={settingsPageSt.linkPreviewText} numberOfLines={2}>{publicCheckInUrl}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={savingAliases}
          onPress={() => void saveAliases()}
          style={({ pressed }) => [st.aliasSaveButton, pressed && st.pressed, savingAliases && st.aliasSaveButtonDisabled]}
        >
          {savingAliases ? <LoadingDots size="small" color="#fff" /> : <Ionicons name="checkmark" size={17} color="#fff" />}
          <Text style={st.aliasSaveText}>{savingAliases ? "Saving…" : "Save check-in link"}</Text>
        </Pressable>
      </View>
      <SettingsGroup>
        <SettingsRow icon="open-outline" title="Preview check-in page" value="Web" onPress={() => void Linking.openURL(publicCheckInUrl)} external last />
      </SettingsGroup>
    </View>
  ) : view === "legal" ? (
    <View style={st.page}>
      <SettingsSubpageHeader title="Privacy & legal" onBack={() => setView("main")} />
      <SettingsGroup>
        <SettingsRow icon="shield-checkmark-outline" title="Privacy policy" subtitle="How Tour collects, uses, and protects data" onPress={() => void openSettingsUrl("/privacy-policy")} external />
        <SettingsRow icon="document-text-outline" title="Terms of use" subtitle="The terms that govern use of Tour" onPress={() => void openSettingsUrl("/terms")} external last />
      </SettingsGroup>
      <View style={settingsPageSt.notice}>
        <View style={settingsPageSt.noticeIcon}>
          <Ionicons name="mic-outline" size={19} color={C.brand} />
        </View>
        <View style={st.flex1}>
          <Text style={settingsPageSt.noticeTitle}>Recording consent</Text>
          <Text style={settingsPageSt.noticeCopy}>Always get permission before recording. Recording and consent laws vary by location and your organization is responsible for following them.</Text>
        </View>
      </View>
    </View>
  ) : view === "about" ? (
    <View style={st.page}>
      <SettingsSubpageHeader title="About Tour" onBack={() => setView("main")} />
      <View style={settingsPageSt.aboutHero}>
        <TourMark size={58} />
        <Text style={settingsPageSt.aboutTitle}>Tour</Text>
        <Text style={settingsPageSt.aboutCopy}>Record and review leasing tours, understand each prospect, and improve every conversation.</Text>
      </View>
      <Text style={settingsPageSt.sectionLabel}>APP</Text>
      <SettingsGroup>
        <SettingsRow icon="globe-outline" title="Tour website" value="tour.you" onPress={() => void openSettingsUrl("")} external />
        <SettingsRow icon="information-circle-outline" title="Version" value="0.1.0" last />
      </SettingsGroup>
    </View>
  ) : (
    <View style={st.page}>
      <Text style={st.pageTitle}>Settings</Text>
      <Pressable onPress={onProfile} style={({ pressed }) => [settingsPageSt.profileRow, pressed && st.pressed]}>
        <View style={[settingsPageSt.profileAvatar, { backgroundColor: accent }]}>
          <Text style={settingsPageSt.profileAvatarText}>
            {(session.workspace.user.fullName ?? session.workspace.user.email)[0]?.toUpperCase()}
          </Text>
        </View>
        <View style={st.flex1}>
          <Text style={settingsPageSt.profileName}>{session.workspace.user.fullName ?? "Team member"}</Text>
          <Text style={settingsPageSt.profileMeta}>{session.workspace.user.title ?? teamRole}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
      </Pressable>

      <Text style={settingsPageSt.sectionLabel}>PROPERTY</Text>
      <SettingsGroup>
        <SettingsRow
          icon="business-outline"
          title={session.workspace.community.name}
          subtitle={`${authorizedPropertyCount} available ${authorizedPropertyCount === 1 ? "property" : "properties"}`}
          value="Switch"
          onPress={() => setCommunityPickerOpen(true)}
          last
        />
      </SettingsGroup>

      <Text style={settingsPageSt.sectionLabel}>TOUR SETUP</Text>
      <SettingsGroup>
        <SettingsRow icon="qr-code-outline" title="Public check-in" subtitle="Manage your guest check-in link" onPress={() => setView("check-in")} />
        <SettingsRow icon="clipboard-outline" title="Rubrics" subtitle="Evaluation templates and criteria" onPress={onRubrics} last />
      </SettingsGroup>

      <Text style={settingsPageSt.sectionLabel}>ABOUT</Text>
      <SettingsGroup>
        <SettingsRow icon="shield-outline" title="Privacy & legal" onPress={() => setView("legal")} />
        <SettingsRow icon="information-circle-outline" title="About Tour" value="0.1.0" onPress={() => setView("about")} last />
      </SettingsGroup>

      <Text style={settingsPageSt.sectionLabel}>ACCOUNT</Text>
      <SettingsGroup>
        <SettingsRow icon="log-out-outline" title="Log out" onPress={() => setLogoutOpen(true)} destructive last />
      </SettingsGroup>
      <Text style={settingsPageSt.footer}>{session.workspace.organization.name}</Text>
    </View>
  );

  return (
    <>
      {content}

      <CommunityPickerModal
        visible={communityPickerOpen}
        session={session}
        query={communityQuery}
        switchingId={switchingId}
        onPropertyAdded={(nextSession) => {
          onSessionChange(nextSession);
          setCommunityPickerOpen(false);
          setCommunityQuery("");
          showToast(`Added ${nextSession.workspace.community.name}`, "success");
        }}
        onQueryChange={setCommunityQuery}
        onClose={() => {
          if (!switchingId) {
            setCommunityPickerOpen(false);
            setCommunityQuery("");
          }
        }}
        onSelect={(communityId) => void chooseCommunity(communityId)}
      />
      <BottomSheetModal
        visible={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        sheetHeight={310}
        dragHeader={
          <View style={logoutSheetSt.header}>
            <View style={logoutSheetSt.icon}>
              <Ionicons name="log-out-outline" size={22} color={C.red} />
            </View>
            <View style={st.flex1}>
              <Text style={logoutSheetSt.title}>Log out of Tour?</Text>
              <Text style={logoutSheetSt.subtitle}>Your account will be removed from this device.</Text>
            </View>
          </View>
        }
      >
        <View style={logoutSheetSt.body}>
          <Text style={logoutSheetSt.note}>
            You’ll need a new email verification code the next time you sign in.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onSignOut}
            style={({ pressed }) => [logoutSheetSt.logoutButton, pressed && st.pressed]}
          >
            <Text style={logoutSheetSt.logoutText}>Log out</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setLogoutOpen(false)}
            style={({ pressed }) => [logoutSheetSt.cancelButton, pressed && st.pressed]}
          >
            <Text style={logoutSheetSt.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </BottomSheetModal>
    </>
  );
}

const settingsPageSt = StyleSheet.create({
  profileRow: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: C.border, borderRadius: 12, backgroundColor: C.card },
  profileAvatar: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  profileAvatarText: { color: "#fff", fontSize: 18, fontWeight: "900" },
  profileName: { color: C.text, fontSize: 15, fontWeight: "900" },
  profileMeta: { marginTop: 2, color: C.textSec, fontSize: 12, fontWeight: "600" },
  sectionLabel: { marginTop: 5, color: C.textMuted, fontSize: 10, fontWeight: "900", letterSpacing: 0.4 },
  group: { overflow: "hidden", borderWidth: 1, borderColor: C.border, borderRadius: 12, backgroundColor: C.card },
  row: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 13, paddingVertical: 9 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  rowIcon: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "#f1f5f9" },
  rowIconDestructive: { backgroundColor: C.redBg },
  rowTitle: { color: C.text, fontSize: 13, fontWeight: "800" },
  rowSubtitle: { marginTop: 2, color: C.textSec, fontSize: 11, lineHeight: 15, fontWeight: "600" },
  rowValue: { maxWidth: 86, color: C.textMuted, fontSize: 11, fontWeight: "700" },
  footer: { color: C.textMuted, fontSize: 10, textAlign: "center", paddingVertical: 4 },
  subpageHeader: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border, borderRadius: 12, backgroundColor: C.card },
  subpageTitle: { flex: 1, color: C.text, fontSize: 24, lineHeight: 30, fontWeight: "900" },
  intro: { marginTop: -4, color: C.textSec, fontSize: 13, lineHeight: 19, fontWeight: "600" },
  linkPreview: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 11, borderRadius: 10, backgroundColor: C.aiBg },
  linkPreviewIcon: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: C.card },
  linkPreviewText: { flex: 1, color: C.brand, fontSize: 11, lineHeight: 16, fontWeight: "800" },
  notice: { flexDirection: "row", alignItems: "flex-start", gap: 11, padding: 14, borderWidth: 1, borderColor: C.border, borderRadius: 12, backgroundColor: C.card },
  noticeIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: C.aiBg },
  noticeTitle: { color: C.text, fontSize: 13, fontWeight: "900" },
  noticeCopy: { marginTop: 3, color: C.textSec, fontSize: 11, lineHeight: 17, fontWeight: "600" },
  aboutHero: { alignItems: "center", gap: 7, paddingHorizontal: 26, paddingVertical: 22 },
  aboutTitle: { color: C.text, fontSize: 22, fontWeight: "900" },
  aboutCopy: { maxWidth: 320, color: C.textSec, fontSize: 13, lineHeight: 19, fontWeight: "600", textAlign: "center" },
});

const logoutSheetSt = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: C.redBg },
  title: { color: C.text, fontSize: 20, lineHeight: 25, fontWeight: "900" },
  subtitle: { marginTop: 2, color: C.textSec, fontSize: 12, lineHeight: 17 },
  body: { flex: 1, gap: 10, paddingTop: 16 },
  note: { color: C.textSec, fontSize: 13, lineHeight: 19 },
  logoutButton: { minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: C.red },
  logoutText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  cancelButton: { minHeight: 46, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border, borderRadius: 12, backgroundColor: C.card },
  cancelText: { color: C.textSec, fontSize: 14, fontWeight: "800" },
});

// ═══════════════════════════════════════
// Profile & Tour (preserved)
// ═══════════════════════════════════════

function TourStepper({ session, idx, prospect, step, onBack, onChange, onStep }: {
  session: MobileAuthSession; idx: number; prospect: ProspectData; step: TourStep; onBack: () => void; onChange: (k: keyof ProspectData, v: string) => void; onStep: (s: TourStep) => void;
}) {
  const name = session.workspace.user.fullName ?? "Team member";
  return (
    <View style={st.page}>
      <BackBtn label="Profile" onPress={onBack} />
      <View style={[st.card, { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }]}>
        <View style={st.avatar36}><Text style={{ color: C.brand, fontSize: 13, fontWeight: "900" }}>{name[0]?.toUpperCase()}</Text></View>
        <View style={st.flex1}>
          <Text style={{ fontSize: 17, fontWeight: "900", color: C.text }}>{name}</Text>
          <Text style={{ fontSize: 12, fontWeight: "700", color: C.textSec }}>{session.workspace.user.email}</Text>
        </View>
      </View>
      <View style={[st.card, { flexDirection: "row", padding: 14, gap: 10 }]}>
        {tourSteps.map((s, i) => (
          <View key={s.id} style={{ flex: 1, alignItems: "center", gap: 8 }}>
            <View style={[st.stepDot, i === idx && st.stepDotActive, i < idx && st.stepDotDone]}><Text style={[st.stepDotText, (i === idx || i < idx) && { color: "#fff" }]}>{i + 1}</Text></View>
            <Text style={[st.stepLabel, i === idx && { color: C.text }]}>{s.label}</Text>
          </View>
        ))}
      </View>
      <View style={[st.card, { padding: 18 }]}>
        {step === "contact" && (
          <View style={{ gap: 14 }}>
            <Text style={st.formTitle}>Your contact information</Text>
            <Input placeholder="Full name" value={prospect.name} onChangeText={(v) => onChange("name", v)} icon="person-outline" />
            <Input placeholder="Email" value={prospect.email} onChangeText={(v) => onChange("email", v)} icon="mail-outline" keyboardType="email-address" autoCapitalize="none" />
            <Input placeholder="Phone" value={prospect.phone} onChangeText={(v) => onChange("phone", v)} icon="call-outline" keyboardType="phone-pad" />
            <PrimaryBtn label="Continue to preferences" onPress={() => onStep("preferences")} icon="arrow-forward" />
          </View>
        )}
        {step === "preferences" && (
          <View style={{ gap: 14 }}>
            <Text style={st.formTitle}>What should the tour focus on?</Text>
            <Input placeholder="Target move-in date" value={prospect.moveIn} onChangeText={(v) => onChange("moveIn", v)} icon="calendar-outline" />
            <SegPicker label="Bedrooms" options={["Studio", "1 bed", "2 bed", "3 bed"]} value={prospect.bedrooms} onChange={(v) => onChange("bedrooms", v)} />
            <SegPicker label="Budget" options={["<$2,000", "$2,200 - $2,600", "$2,600+"]} value={prospect.budget} onChange={(v) => onChange("budget", v)} />
            <PrimaryBtn label="Review and start tour" onPress={() => onStep("ready")} icon="arrow-forward" />
          </View>
        )}
        {step === "ready" && (
          <View style={{ gap: 14 }}>
            <Text style={st.formTitle}>Ready to start</Text>
            <View style={{ backgroundColor: "#f8fafc", borderRadius: 22, padding: 16, gap: 12 }}>
              <SRow label="Prospect" value={prospect.name || "Guest"} />
              <SRow label="Contact" value={prospect.email || prospect.phone || "—"} />
              <SRow label="Focus" value={`${prospect.bedrooms} \u00B7 ${prospect.budget}`} />
              <SRow label="Move-in" value={prospect.moveIn || "Flexible"} />
            </View>
            <Pressable style={({ pressed }) => [st.darkBtn, pressed && st.pressed]}><Ionicons name="flag-outline" size={18} color="#fff" /><Text style={st.darkBtnText}>Start tour</Text></Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

function SRow({ label, value }: { label: string; value: string }) {
  return <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ fontSize: 13, fontWeight: "800", color: C.textSec }}>{label}</Text><Text style={{ fontSize: 13, fontWeight: "900", color: C.text }}>{value}</Text></View>;
}

// ═══════════════════════════════════════
// Shared components (see src/components/tour)
// ═══════════════════════════════════════

const W = Dimensions.get("window").width;

const audioTestSt = StyleSheet.create({
  hero: { alignItems: "center", gap: 12, padding: 22, borderWidth: 1, borderColor: C.border, borderRadius: 20, backgroundColor: "#fff" },
  micRing: { width: 104, height: 104, borderRadius: 52, alignItems: "center", justifyContent: "center", backgroundColor: C.brand + "10" },
  micRingRecording: { backgroundColor: C.red + "12" },
  timer: { color: C.text, fontSize: 42, lineHeight: 48, fontWeight: "900", fontVariant: ["tabular-nums"] },
  status: { color: C.textSec, fontSize: 14, lineHeight: 20, fontWeight: "700", textAlign: "center" },
  controls: { gap: 10 },
  recordButton: { minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingHorizontal: 18, borderRadius: 29, backgroundColor: C.red },
  stopButton: { minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingHorizontal: 18, borderRadius: 29, backgroundColor: C.red },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  secondaryButton: { minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingHorizontal: 16, borderWidth: 1, borderColor: "#dbeafe", borderRadius: 27, backgroundColor: "#f5f9ff" },
  secondaryText: { color: C.brand, fontSize: 15, fontWeight: "900" },
  infoCard: { borderWidth: 1, borderColor: C.border, borderRadius: 16, backgroundColor: "#fff", overflow: "hidden" },
  infoRow: { minHeight: 58, gap: 5, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  infoLabel: { color: C.textMuted, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  infoValue: { color: C.text, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  resetButton: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 23 },
  resetText: { color: C.textSec, fontSize: 13, fontWeight: "800" },
});

const homeSt = StyleSheet.create({
  topBar: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 },
  topBarSide: { minWidth: 44, flexShrink: 0, alignItems: "flex-start", justifyContent: "center" },
  topBarSideEnd: { alignItems: "flex-end" },
  topBarCenter: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center" },
  propertyPicker: { maxWidth: "100%", minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 10, borderRadius: 11, backgroundColor: "#eef3f8" },
  propertyPickerIcon: { width: 25, height: 25, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: C.card },
  propertyPickerText: { flexShrink: 1, color: C.text, fontSize: 14, lineHeight: 18, fontWeight: "800", textAlign: "center" },
  headerIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#e2e2e2", borderRadius: 8, backgroundColor: "#fff" },
  profileCard: { overflow: "hidden", borderRadius: 28, backgroundColor: "#fff", shadowColor: "#101828", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 4 },
  profileHeader: { height: 112, backgroundColor: "#111" },
  profileCardSettings: { position: "absolute", top: 16, right: 16, zIndex: 2, width: 42, height: 42, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.45)", borderRadius: 21, backgroundColor: "rgba(15,23,42,0.28)" },
  profileBody: { alignItems: "center", gap: 5, paddingHorizontal: 24, paddingTop: 0, paddingBottom: 24 },
  profileAvatarLarge: { width: 88, height: 88, marginTop: -44, borderWidth: 4, borderColor: "#fff", borderRadius: 44, alignItems: "center", justifyContent: "center", backgroundColor: "#d1d5db" },
  profileAvatarLargeText: { color: "#6b7280", fontSize: 30, fontWeight: "900" },
  profileNameLarge: { color: "#111", fontSize: 22, fontWeight: "900", marginTop: 12, textAlign: "center" },
  profileRoleLarge: { color: "#5f6673", fontSize: 15, fontWeight: "600" },
  profileProperty: { color: "#7b8496", fontSize: 14, fontWeight: "700" },
  editProfileHint: { marginTop: 10, color: "#98A2B3", fontSize: 12, fontWeight: "700" },
  contactList: { alignSelf: "stretch", gap: 14, marginTop: 22 },
  profileContactRow: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 14 },
  profileContactIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "#f1f1f1" },
  profileContactText: { flex: 1, color: "#252a32", fontSize: 14, fontWeight: "600" },
  actionPillRow: { flexDirection: "row", gap: 10 },
  checkInPill: { flex: 1, minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingHorizontal: 14, borderRadius: 29, backgroundColor: "#2f343c", shadowColor: "#111827", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.16, shadowRadius: 18, elevation: 5 },
  newSessionPill: { backgroundColor: C.brand },
  checkInPillText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  practiceCard: { minHeight: 78, flexDirection: "row", alignItems: "center", gap: 13, padding: 14, borderWidth: 1, borderColor: "#c7d7fe", borderRadius: 18, backgroundColor: "#f8fbff" },
  practiceIcon: { width: 45, height: 45, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: C.brand },
  practiceTitle: { color: C.text, fontSize: 14, fontWeight: "900" },
  practiceMeta: { marginTop: 3, color: C.textSec, fontSize: 11, lineHeight: 16, fontWeight: "700" },
  audioTestCard: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 12, padding: 13, borderWidth: 1, borderColor: "#dbeafe", borderRadius: 18, backgroundColor: "#f5f9ff" },
  audioTestIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#eaf2ff" },
  audioTestTitle: { color: C.text, fontSize: 14, fontWeight: "900" },
  audioTestSub: { color: C.textSec, fontSize: 12, fontWeight: "700", marginTop: 2 },
  businessCard: { padding: 16, gap: 14, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 20, backgroundColor: "#fff", shadowColor: "#101828", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 2 },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  profileAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: C.brand },
  profileAvatarText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  profileName: { color: "#000", fontSize: 14, fontWeight: "800" },
  profileRole: { color: C.textSec, fontSize: 11, marginTop: 3 },
  contactRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  contactText: { flex: 1, color: C.textSec, fontSize: 11 },
  smsButton: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: C.brand },
  smsButtonText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  metricCard: { width: (W - 47) / 2 },
  commandGrid: { flexDirection: "row", gap: 9 },
  commandButton: { flex: 1, minHeight: 92, justifyContent: "space-between", padding: 12, borderWidth: 1, borderColor: C.border, borderRadius: 16, backgroundColor: "#fff" },
  commandIcon: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  commandTitle: { color: C.text, fontSize: 13, fontWeight: "900" },
  commandSub: { color: C.textSec, fontSize: 10, fontWeight: "700", marginTop: 2 },
  focusStack: { gap: 9 },
  focusCard: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 10, padding: 11, borderWidth: 1, borderColor: C.border, borderRadius: 14, backgroundColor: "#fff" },
  focusIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  focusTitle: { color: C.text, fontSize: 13, fontWeight: "900" },
  focusMeta: { color: C.textSec, fontSize: 11, fontWeight: "700", marginTop: 3 },
  focusScore: { fontSize: 18, fontWeight: "900", fontVariant: ["tabular-nums"] },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 7 },
  sectionTitle: { flex: 1, color: C.text, fontSize: 17, fontWeight: "900" },
  sectionAction: { color: C.brand, fontSize: 13, fontWeight: "800" },
  tourCard: { minHeight: 70, flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 12, borderWidth: 1, borderColor: C.border, borderRadius: 16, backgroundColor: "#fff" },
  tourTitle: { color: C.text, fontSize: 15, fontWeight: "800" },
  tourMetaRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 8 },
  timePill: { color: C.brand, fontSize: 11, fontWeight: "800", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4, backgroundColor: "rgba(0,108,229,0.07)" },
  tourMeta: { flex: 1, color: C.textSec, fontSize: 12 },
  assetLinkCard: { minHeight: 78, flexDirection: "row", alignItems: "center", gap: 13, padding: 14, borderWidth: 1, borderColor: C.border, borderRadius: 18, backgroundColor: "#fff" },
  assetLinkIcon: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#eef4ff" },
  assetLinkIconConnected: { backgroundColor: C.brand },
  assetLinkTitle: { color: C.text, fontSize: 14, fontWeight: "900" },
  assetLinkMeta: { color: C.textSec, fontSize: 11, lineHeight: 16, fontWeight: "700", marginTop: 3 },
  statusPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 9, fontWeight: "900" },
  actionCard: { minHeight: 78, flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderWidth: 1, borderColor: "#e5e5e5", borderRadius: 12, backgroundColor: "#fff" },
  actionIcon: { width: 48, height: 48, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  qrBrandCenter: { position: "absolute", width: 18, height: 18, borderRadius: 5, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  actionTitle: { color: "#000", fontSize: 14, fontWeight: "900" },
  actionSub: { color: C.textSec, fontSize: 12, marginTop: 3 },
  createButton: { minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: C.brand },
  createButtonText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  insightCard: { minHeight: 105, flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderWidth: 1, borderLeftWidth: 4, borderColor: C.brand, borderRadius: 16, backgroundColor: "#fff" },
  insightText: { color: C.text, fontSize: 14, lineHeight: 20, fontWeight: "600" },
  insightLink: { color: C.brand, fontSize: 12, fontWeight: "800", marginTop: 10 },
  sheetScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.42)" },
  sheetKeyboard: { flex: 1, justifyContent: "flex-end" },
  checkInSheet: { position: "relative", maxHeight: "88%", gap: 8, paddingHorizontal: 18, paddingTop: 4, paddingBottom: Platform.OS === "ios" ? 16 : 12, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: "#fff" },
  sheet: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: Platform.OS === "ios" ? 34 : 20, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: "#fff" },
  sheetHandleHitbox: { alignSelf: "stretch", alignItems: "center", justifyContent: "center", minHeight: 28, marginBottom: 6 },
  sheetHandle: { width: 44, height: 5, borderRadius: 3, backgroundColor: "#d1d5db" },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  sheetTitle: { color: "#111827", fontSize: 24, fontWeight: "900" },
  sheetSub: { color: "#7b8496", fontSize: 13, fontWeight: "700", marginTop: 2 },
  sheetClose: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 20, backgroundColor: "#fff" },
  sheetTabs: { flexDirection: "row", gap: 6, padding: 4, borderRadius: 17, backgroundColor: "#f3f4f6", marginBottom: 10 },
  sheetTab: { flex: 1, minHeight: 39, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 13 },
  sheetTabActive: { backgroundColor: "#fff", shadowColor: "#101828", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 1 },
  sheetTabText: { color: C.textMuted, fontSize: 13, fontWeight: "900" },
  sheetTabTextActive: { color: C.brand },
  checkInSheetBody: { flex: 1, minHeight: 0, gap: 8, overflow: "hidden" },
  checkInStepPane: { flex: 1, minHeight: 0 },
  checkInScroll: { flex: 1, minHeight: 0 },
  checkInForm: { gap: 10, paddingBottom: 14 },
  checkInFormKeyboard: { paddingBottom: 110 },
  skipButton: { alignSelf: "flex-end", paddingHorizontal: 8, paddingVertical: 2 },
  skipText: { color: "#0b0b0c", fontSize: 21, fontWeight: "900" },
  checkInHead: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 2 },
  formHeadAvatar: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: "#111827" },
  formHeadText: { flex: 1, color: "#111318", fontSize: 17, lineHeight: 22, fontWeight: "900" },
  formRow2: { flexDirection: "row", gap: 9 },
  floatingField: { flex: 1, minHeight: 56, justifyContent: "center", paddingHorizontal: 14, borderWidth: 1, borderColor: "#d7dae3", borderRadius: 14, backgroundColor: "#fff" },
  floatingFieldHighlighted: { borderColor: C.brand, borderWidth: 2, shadowColor: C.brand, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 2 },
  floatingLabel: { position: "absolute", left: 12, top: -8, paddingHorizontal: 5, color: "#4b5563", fontSize: 11, fontWeight: "900", backgroundColor: "#fff" },
  floatingInput: { color: "#111318", fontSize: 16, fontWeight: "600", paddingVertical: 0 },
  phoneRow: { flexDirection: "row", gap: 9 },
  phoneCc: { width: 84, minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 10, borderWidth: 1, borderColor: "#d7dae3", borderRadius: 14, backgroundColor: "#fff" },
  phoneFlag: { fontSize: 15 },
  phoneCcInput: { flex: 1, minWidth: 34, color: "#111318", fontSize: 15, fontWeight: "800", paddingVertical: 0 },
  phoneCcText: { color: "#111318", fontSize: 19, fontWeight: "800" },
  addJobButton: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: "#d7d7d7", borderRadius: 999, backgroundColor: "#fff" },
  addJobText: { color: "#111318", fontSize: 13, fontWeight: "900" },
  nextButton: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, borderRadius: 999, backgroundColor: "#111" },
  nextButtonText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  checkInDestination: { color: C.textMuted, fontSize: 9, fontWeight: "700", textAlign: "center" },
  stepHeader: { gap: 2, marginBottom: 2 },
  stepKicker: { color: C.brand, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  questionTitle: { color: C.text, fontSize: 18, lineHeight: 23, fontWeight: "900" },
  questionField: { gap: 8 },
  questionLabel: { color: C.text, fontSize: 13, fontWeight: "900" },
  questionHint: { color: C.textMuted, fontSize: 11, fontWeight: "700", marginTop: -4 },
  questionOptions: { gap: 8, paddingRight: 8 },
  questionOption: { minHeight: 36, justifyContent: "center", paddingHorizontal: 12, borderWidth: 1, borderColor: "#d7dae3", borderRadius: 999, backgroundColor: "#fff" },
  questionOptionActive: { borderColor: C.brand, backgroundColor: "#eff6ff" },
  questionOptionText: { color: C.textSec, fontSize: 12, fontWeight: "800" },
  questionOptionTextActive: { color: C.brand },
  toggleRow: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 2 },
  toggleText: { flex: 1, color: C.text, fontSize: 12, fontWeight: "800" },
  fieldError: { color: C.red, fontSize: 12, fontWeight: "800" },
  buttonRow: { flexDirection: "row", gap: 10 },
  backBtn: { minWidth: 96, minHeight: 56, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#d7dae3", borderRadius: 13, backgroundColor: "#fff" },
  backBtnText: { color: C.text, fontSize: 15, fontWeight: "900" },
  questionProgress: { alignItems: "center", paddingTop: 2 },
  questionProgressText: { color: C.textMuted, fontSize: 11, fontWeight: "900" },
  floatingActionWrap: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 10, paddingBottom: 2, backgroundColor: "#fff" },
  floatingBackButton: { width: 50, minHeight: 50, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#d7dae3", borderRadius: 999, backgroundColor: "#fff" },
  floatingNextButton: { flex: 1, minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, backgroundColor: "#111" },
  donePanel: { alignItems: "center", gap: 13, paddingVertical: 10 },
  doneIcon: { width: 68, height: 68, alignItems: "center", justifyContent: "center", borderRadius: 34, backgroundColor: C.green },
  manualForm: { gap: 10 },
  sheetField: { minHeight: 50, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 13, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 14, backgroundColor: "#fff" },
  sheetFieldMultiline: { minHeight: 82, alignItems: "flex-start", paddingTop: 14 },
  sheetInput: { flex: 1, color: C.text, fontSize: 14, fontWeight: "700", paddingVertical: 0 },
  sheetInputMultiline: { minHeight: 52, textAlignVertical: "top" },
  sheetPrimary: { alignSelf: "stretch", width: "100%", minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, marginTop: 4, paddingHorizontal: 24, borderRadius: 16, backgroundColor: "#111" },
  sheetPrimaryText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  qrPanel: { alignSelf: "stretch", alignItems: "center", gap: 12, paddingTop: 6 },
  qrCard: { width: 210, height: 210, alignItems: "center", justifyContent: "center", padding: 12, borderRadius: 24, backgroundColor: "#f8fafc" },
  qrImage: { width: "100%", height: "100%" },
  qrTitle: { color: C.text, fontSize: 18, fontWeight: "900" },
  qrSub: { maxWidth: 300, color: C.textSec, fontSize: 13, lineHeight: 19, fontWeight: "600", textAlign: "center" },
  qrShareGrid: { alignSelf: "stretch", width: "100%", flexDirection: "row", gap: 8, paddingTop: 4 },
  qrShareButton: { flex: 1, minWidth: 0, minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 14, backgroundColor: "#fff" },
  qrShareButtonPrimary: { borderColor: C.brand, backgroundColor: C.brand },
  qrShareButtonText: { color: C.text, fontSize: 12, fontWeight: "900" },
  qrShareButtonPrimaryText: { color: "#fff", fontSize: 12, fontWeight: "900" },
});

const communitySt = StyleSheet.create({
  sheet: { minHeight: "70%", maxHeight: "84%", borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: "#fff", paddingHorizontal: 14, paddingBottom: Platform.OS === "ios" ? 32 : 18 },
  handle: { width: 40, height: 4, alignSelf: "center", borderRadius: 2, backgroundColor: "#d0d5dd", marginTop: 11, marginBottom: 16 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  headerText: { flex: 1, minWidth: 0 },
  title: { color: C.text, fontSize: 21, lineHeight: 26, fontWeight: "900" },
  subtitle: { color: C.textSec, fontSize: 13, lineHeight: 18, fontWeight: "600", marginTop: 3 },
  closeButton: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border, borderRadius: 12, backgroundColor: C.card },
  searchBar: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: C.border, borderRadius: 10, backgroundColor: C.card },
  searchInput: { flex: 1, minWidth: 0, color: C.text, fontSize: 16, fontWeight: "700", paddingVertical: 0 },
  list: { flex: 1, marginTop: 10 },
  listContent: { paddingBottom: 20 },
  row: { minHeight: 62, width: "100%", flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 0, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  iconBox: { width: 42, height: 42, flexShrink: 0, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#eef2ff" },
  rowText: { flex: 1, minWidth: 0, justifyContent: "center" },
  rowTitle: { color: C.text, fontSize: 15, lineHeight: 19, fontWeight: "900" },
  rowSub: { color: C.textSec, fontSize: 13, lineHeight: 17, fontWeight: "700", marginTop: 1 },
  rowAction: { width: 28, flexShrink: 0, alignItems: "flex-end", justifyContent: "center" },
});

const reviewSt = StyleSheet.create({
  root: { flex: 1, backgroundColor: tourColors.bg, paddingTop: Platform.OS === "ios" ? 50 : 18 },
  scrollBody: { flex: 1 },
  scrollContent: { paddingBottom: 150 },
  commentsPageContent: { gap: 12, paddingHorizontal: SESSION_PAGE_PADDING, paddingTop: 12, paddingBottom: 130 },
  tabSticky: { backgroundColor: tourColors.bg, zIndex: 2 },
  tabBody: { gap: 13, paddingHorizontal: SESSION_PAGE_PADDING, paddingTop: 8 },
  reviewSnapshot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 34,
    marginHorizontal: SESSION_PAGE_PADDING,
    marginTop: 1,
    marginBottom: 6,
  },
  reviewScoreValue: { color: C.text, fontSize: 21, lineHeight: 24, fontWeight: "900", fontVariant: ["tabular-nums"] },
  reviewScoreUnit: { color: C.textMuted, fontSize: 10, fontWeight: "800" },
  reviewScoreLabel: { flex: 1, marginLeft: 6, color: C.textSec, fontSize: 11, fontWeight: "800" },
  transcriptLandmark: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginHorizontal: SESSION_PAGE_PADDING,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: tourColors.bg,
  },
  transcriptLandmarkDot: { width: 7, height: 7, borderRadius: 999 },
  transcriptLandmarkLabel: { flex: 1, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  transcriptLandmarkTime: { color: C.textMuted, fontSize: 11, fontWeight: "800", fontVariant: ["tabular-nums"] },
  transcriptLandmarkSearch: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: 9 },
  transcriptLandmarkSearchActive: { backgroundColor: "#eaf3ff" },
  transcriptLandmarkMoment: { minWidth: 26, height: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, paddingHorizontal: 5, borderRadius: 999, backgroundColor: C.aiBg },
  transcriptLandmarkMomentText: { color: C.ai, fontSize: 10, fontWeight: "900", fontVariant: ["tabular-nums"] },
  transcriptSearchWrap: { paddingHorizontal: SESSION_PAGE_PADDING, paddingTop: 5, paddingBottom: 8, backgroundColor: tourColors.bg },
  transcriptSearchInput: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 11, borderWidth: 1, borderColor: "#dbe3ef", borderRadius: 11, backgroundColor: "#fff" },
  transcriptSearchText: { flex: 1, minWidth: 0, color: C.text, fontSize: 14, fontWeight: "600", paddingVertical: 0 },
  transcriptSearchCount: { minWidth: 18, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 999, color: C.brand, fontSize: 10, fontWeight: "900", textAlign: "center", backgroundColor: "#eaf3ff", fontVariant: ["tabular-nums"] },
  transcriptSearchEmpty: { minHeight: 88, alignItems: "center", justifyContent: "center", gap: 7 },
  transcriptSearchEmptyText: { color: C.textMuted, fontSize: 13, fontWeight: "800" },
  reportCta: { minHeight: 62, marginHorizontal: SESSION_PAGE_PADDING, marginTop: 8, marginBottom: 10, paddingHorizontal: 13, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 11, borderWidth: 1, borderColor: "#dbeafe", backgroundColor: "#f7fbff" },
  reportCtaIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#eaf4ff" },
  reportCtaTitle: { color: C.text, fontSize: 13, fontWeight: "900" },
  reportCtaSub: { marginTop: 2, color: C.textSec, fontSize: 10, lineHeight: 14, fontWeight: "700" },
  sampleReadOnlyBanner: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 11, padding: 12, borderWidth: 1, borderColor: C.aiBorder, borderRadius: 14, backgroundColor: "#f8fbff" },
  sampleReadOnlyIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: C.aiBg },
  sampleReadOnlyTitle: { color: C.text, fontSize: 13, fontWeight: "900" },
  sampleReadOnlySub: { marginTop: 2, color: C.textSec, fontSize: 11, lineHeight: 15, fontWeight: "600" },
  coachingQueue: { gap: 9, paddingTop: 2 },
  coachingQueueHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    minHeight: 58,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#dbe5f0",
    borderRadius: 14,
    backgroundColor: "#f8fafc",
  },
  coachingQueueIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#eff6ff",
  },
  coachingQueueTitle: { color: C.text, fontSize: 13, fontWeight: "900" },
  coachingQueueSubtitle: { marginTop: 1, color: C.textSec, fontSize: 11, fontWeight: "700" },
  coachingQueueItem: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    backgroundColor: "#fff",
  },
  coachingQueueIndex: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: "#eff6ff" },
  coachingQueueIndexText: { color: C.brand, fontSize: 12, fontWeight: "900", fontVariant: ["tabular-nums"] },
  coachingQueueItemTitle: { color: C.text, fontSize: 13, lineHeight: 18, fontWeight: "900" },
  actionSheetBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15, 23, 42, 0.38)" },
  actionSheet: {
    maxHeight: "78%",
    gap: 12,
    paddingTop: 8,
    paddingHorizontal: SESSION_PAGE_PADDING,
    paddingBottom: Platform.OS === "ios" ? 28 : 18,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: "#fff",
  },
  actionSheetHandle: { alignSelf: "center", width: 36, height: 4, borderRadius: 999, backgroundColor: "#d0d5dd" },
  actionSheetHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingTop: 4 },
  actionSheetKicker: { color: C.brand, fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  actionSheetTitle: { marginTop: 2, color: C.text, fontSize: 17, lineHeight: 23, fontWeight: "900" },
  actionSheetContent: { gap: 12, paddingBottom: 2 },
  actionSheetSection: { gap: 5 },
  actionSheetSectionLabel: { color: C.textMuted, fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  actionSheetBody: { color: C.textSec, fontSize: 14, lineHeight: 21, fontWeight: "600" },
  actionMessage: { gap: 8, padding: 12, borderWidth: 1, borderColor: "#dbeafe", borderRadius: 14, backgroundColor: "#f8fbff" },
  actionMessageHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionMessageLabel: { color: C.brand, fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  actionMessageText: { color: C.text, fontSize: 13, lineHeight: 20, fontWeight: "600" },
  actionSheetActions: { flexDirection: "row", gap: 9, paddingTop: 2 },
  actionSheetDismiss: { minHeight: 46, flex: 1, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#d0d5dd", borderRadius: 12, backgroundColor: "#fff" },
  actionSheetDismissText: { color: C.textSec, fontSize: 13, fontWeight: "900" },
  actionSheetComplete: { minHeight: 46, flex: 1.35, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 12, backgroundColor: C.green },
  actionSheetCompleteText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  header: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  headerButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#e6eaf0", borderRadius: 12, backgroundColor: "#fff" },
  propertyPicker: { maxWidth: 210, minHeight: 36, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 14, borderRadius: 999, backgroundColor: "#eef2f7" },
  propertyText: { flexShrink: 1, color: "#647084", fontSize: 14, fontWeight: "800" },
  titleRow: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10 },
  title: { color: C.text, fontSize: 24, fontWeight: "900", letterSpacing: 0 },
  subtitle: { color: "#7b8496", fontSize: 13, fontWeight: "700", marginTop: 4 },
  reviewSummary: { flexDirection: "row", alignItems: "stretch", gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  scoreCompact: { width: 108, minHeight: 70, justifyContent: "center", paddingHorizontal: 14, borderWidth: 1, borderRadius: 16 },
  scoreCompactValue: { fontSize: 26, fontWeight: "900", lineHeight: 30, fontVariant: ["tabular-nums"] },
  scoreCompactLabel: { color: "#667085", fontSize: 10, fontWeight: "900", textTransform: "uppercase", marginTop: 2 },
  scorePill: { minWidth: 40, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, alignItems: "center", borderCurve: "continuous" },
  scorePillText: { fontSize: 13, fontWeight: "900", fontVariant: ["tabular-nums"] },
  actionsCta: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderWidth: 1, borderColor: "#dbeafe", borderRadius: 16, backgroundColor: "#fff" },
  actionsCtaIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#eff6ff" },
  actionsCtaTitle: { color: C.text, fontSize: 14, fontWeight: "900" },
  actionsCtaSub: { color: C.brand, fontSize: 11, fontWeight: "800", marginTop: 2 },
  actionCount: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12, backgroundColor: "#eef2ff" },
  actionCountText: { color: "#4338ca", fontSize: 10, fontWeight: "800" },
  modeRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  modeButton: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 13, paddingVertical: 8, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 999, backgroundColor: "#fff" },
  modeButtonActive: { borderColor: "#bfdbfe", backgroundColor: "#eff6ff" },
  modeText: { color: "#667085", fontSize: 12, fontWeight: "900" },
  modeTextActive: { color: C.brand },
  transcriptContent: { gap: 13, paddingHorizontal: SESSION_PAGE_PADDING, paddingTop: 8, paddingBottom: 150 },
  phaseSection: { gap: 2 },
  phaseDivider: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 12, paddingBottom: 5 },
  phaseDividerLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
  phaseDividerDot: { width: 6, height: 6, borderRadius: 999 },
  phaseDividerTitle: { fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  phaseDividerRule: { height: 1, flex: 1, backgroundColor: "#e8edf4" },
  phaseDividerTime: { color: "#98a2b3", fontSize: 11, fontWeight: "800" },
  turnRow: { backgroundColor: "transparent" },
  turnMain: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 9, paddingHorizontal: 8, borderRadius: 10 },
  turnMainAgent: { backgroundColor: "#f7fbff" },
  turnMainProspect: { backgroundColor: "rgba(255, 255, 255, 0.7)" },
  turnMainOther: { backgroundColor: "rgba(248, 250, 252, 0.7)" },
  turnMainActive: { backgroundColor: "#eaf3ff" },
  turnMainSelected: { borderWidth: 1, borderColor: "#60a5fa", backgroundColor: "#e0efff" },
  turnInitialSlot: { width: 22, alignItems: "center", paddingTop: 1 },
  turnInitial: { width: 22, height: 22, alignItems: "center", justifyContent: "center", borderRadius: 7 },
  turnInitialAgent: { backgroundColor: "#dcecff" },
  turnInitialProspect: { backgroundColor: "#eef2f6" },
  turnInitialOther: { backgroundColor: "#f2f4f7" },
  turnInitialText: { fontSize: 11, fontWeight: "900" },
  turnMeta: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 3 },
  turnSpeaker: { fontSize: 12, fontWeight: "900" },
  turnRole: { color: "#8a94a6", fontSize: 10, fontWeight: "800" },
  segmentTime: { color: "#98a2b3", fontSize: 11, fontWeight: "800", marginLeft: "auto" },
  segmentTimeActive: { color: C.brand },
  turnText: { color: "#344054", fontSize: 14, lineHeight: 20, fontWeight: "600" },
  turnTextActive: { color: C.text, fontWeight: "700" },
  annotationRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  annotationSheetBody: { fontSize: 15, fontWeight: "600", color: C.textSec, lineHeight: 22 },
  annotationSheetActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 4 },
  annotationSheetNav: { flexDirection: "row", alignItems: "center", gap: 8 },
  annotationSheetNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eff6ff",
  },
  annotationSheetNavCount: { fontSize: 13, fontWeight: "900", color: C.brand, fontVariant: ["tabular-nums"] },
  annotationSheetPlay: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: C.brand,
  },
  annotationSheetPlayText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  annotationChip: { minWidth: 28, height: 28, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingLeft: 6, paddingRight: 4, borderRadius: 999, borderWidth: 1, borderColor: "#dbeafe", backgroundColor: "#fff" },
  annotationText: { color: C.brand, fontSize: 10, fontWeight: "900" },
  annotationCountBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  annotationCountText: { color: "#fff", fontSize: 10, fontWeight: "900", fontVariant: ["tabular-nums"] },
  commentHint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  commentHintText: { flex: 1, color: "#1D4ED8", fontSize: 12, fontWeight: "700", lineHeight: 17 },
  commentKindBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 999, backgroundColor: "#f4f7fb" },
  commentKindText: { color: C.brand, fontSize: 8, fontWeight: "900", textTransform: "uppercase" },
  coachingMoment: { gap: 9, marginVertical: 6, padding: 12, borderWidth: 1, borderColor: C.aiBorder, borderRadius: 14, backgroundColor: "#f8fbff" },
  coachingMomentCompact: { marginLeft: 36, marginRight: 8, marginTop: 2 },
  coachingMomentHeader: { flexDirection: "row", alignItems: "center", gap: 7 },
  coachingMomentIcon: { width: 22, height: 22, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: C.aiBg },
  coachingMomentKicker: { flex: 1, color: C.ai, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  coachingMomentTime: { color: C.ai, fontSize: 11, fontWeight: "900" },
  coachingMomentBody: { color: C.text, fontSize: 13, fontWeight: "700", lineHeight: 19 },
  coachingSuggestion: { gap: 3, padding: 10, borderRadius: 10, backgroundColor: "#fff" },
  coachingSuggestionLabel: { color: C.ai, fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  coachingSuggestionText: { color: "#344054", fontSize: 13, fontWeight: "700", lineHeight: 18 },
  coachingQuote: { color: "#7b8496", fontSize: 12, lineHeight: 17, fontStyle: "italic" },
  coachingMomentActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  coachingMomentAction: { color: C.ai, fontSize: 11, fontWeight: "900" },
  selectionBar: {
    position: "absolute",
    left: SESSION_PAGE_PADDING,
    right: SESSION_PAGE_PADDING,
    bottom: Platform.OS === "ios" ? 142 : 126,
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 16,
    backgroundColor: "#fff",
    shadowColor: "#101828",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 12,
  },
  selectionClose: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "#f1f5f9" },
  selectionTitle: { color: C.text, fontSize: 12, fontWeight: "900" },
  selectionTime: { color: C.textMuted, fontSize: 10, fontWeight: "800", marginTop: 1 },
  selectionAction: { minHeight: 38, alignItems: "center", justifyContent: "center", gap: 2, paddingHorizontal: 7, borderRadius: 10, backgroundColor: "#eff6ff" },
  selectionActionText: { color: C.brand, fontSize: 9, fontWeight: "900" },
  commentModalBackdrop: { flex: 1, justifyContent: "center", padding: 22, backgroundColor: "rgba(15,23,42,0.45)" },
  commentModalCard: { gap: 14, padding: 16, borderRadius: 20, backgroundColor: "#fff", shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 16 },
  commentModalHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  commentModalIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#eff6ff" },
  commentModalTitle: { color: C.text, fontSize: 16, fontWeight: "900" },
  commentModalTime: { color: C.textMuted, fontSize: 11, fontWeight: "800", marginTop: 2 },
  commentModalInput: { minHeight: 110, padding: 12, borderWidth: 1, borderColor: "#dbe3ef", borderRadius: 14, color: C.text, fontSize: 15, fontWeight: "600", textAlignVertical: "top", backgroundColor: "#f8fafc" },
  commentModalSubmit: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 13, backgroundColor: C.brand },
  commentModalSubmitText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  processingTimeline: { alignSelf: "stretch", gap: 9, padding: 14, borderWidth: 1, borderColor: C.border, borderRadius: 12, backgroundColor: C.card },
  processingProgressHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  processingCurrentStep: { flexDirection: "row", alignItems: "center", gap: 8 },
  processingCurrentLabel: { color: C.text, fontSize: 13, fontWeight: "900" },
  processingStepCount: { color: C.textMuted, fontSize: 11, fontWeight: "800", fontVariant: ["tabular-nums"] },
  processingTrack: { height: 6, overflow: "hidden", borderRadius: 3, backgroundColor: "#e9eef5" },
  processingLabels: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  processingLabel: { color: C.textMuted, fontSize: 9, fontWeight: "700" },
  playerDock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 26 : 14,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: "rgba(255,255,255,0.98)",
    shadowColor: "#101828",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },
  phaseTrack: { height: 5, borderRadius: 4, backgroundColor: "#f3f4f6", position: "relative", overflow: "hidden" },
  phaseSegment: { position: "absolute", top: 0, bottom: 0, borderRadius: 2, opacity: 0.92 },
  phasePlayhead: { position: "absolute", top: -2, bottom: -2, width: 2, backgroundColor: "#111827" },
  waveformTrack: { height: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3 },
  waveformBar: { width: 3, borderRadius: 2, backgroundColor: C.brand },
  time: { color: "#667085", fontSize: 12, fontWeight: "800", fontVariant: ["tabular-nums"] },
  playbackRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  playbackMeta: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 },
  playbackControls: { flexDirection: "row", alignItems: "center", gap: 14 },
  speed: { minWidth: 28, color: C.text, fontSize: 13, fontWeight: "900" },
  playButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: C.brand, shadowColor: C.brand, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.2, shadowRadius: 8 },
});

const st = StyleSheet.create({
  root: { backgroundColor: C.bg, flex: 1 },
  flex1: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  screenTransition: { flex: 1 },
  scroll: { gap: 14, paddingHorizontal: 18, paddingTop: 56, paddingBottom: 32 },
  mainScroll: { gap: 14, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 120 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
  page: { gap: 14 },
  pulseDot: { width: 10, height: 10, borderRadius: 5 },
  shimmerCard: { minHeight: 76, justifyContent: "center", gap: 9, padding: 14, borderWidth: 1, borderColor: C.border, borderRadius: 12, backgroundColor: C.card },
  shimmerBar: { height: 12, borderRadius: 999, backgroundColor: "#e8eef7" },

  // Toast
  toast: { position: "absolute", bottom: 100, left: 20, right: 20, flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 8, zIndex: 999 },
  toastText: { color: "#fff", fontSize: 14, fontWeight: "700", flex: 1 },

  // Tab Bar
  tabBar: { position: "relative", flexDirection: "row", backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border, paddingBottom: Platform.OS === "web" ? 12 : 28, paddingTop: 9, overflow: "hidden" },
  tabBarIndicator: { position: "absolute", top: 4, height: 47, alignItems: "center", justifyContent: "center" },
  tabBarIndicatorPill: { width: "82%", height: 43, borderRadius: 16, backgroundColor: C.brand + "0D" },
  tabBarItem: { zIndex: 1, flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", gap: 2 },
  tabBarLabel: { fontSize: 10, fontWeight: "700", color: C.textMuted },
  tabBarLabelActive: { color: C.brand },

  // FAB
  fab: { position: "absolute", bottom: 96, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: C.brand, alignItems: "center", justifyContent: "center", shadowColor: C.brand, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },

  // Error
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, backgroundColor: C.redBg, borderRadius: 8, borderWidth: 1, borderColor: C.red + "20" },
  errorBannerText: { flex: 1, fontSize: 13, fontWeight: "700", color: C.red },
  errorRetryBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },

  // Dashboard
  dashGreet: { flexDirection: "row", alignItems: "center", gap: 14 },
  dashGreetText: { fontSize: 24, fontWeight: "900", color: C.text },
  dashProperty: { fontSize: 14, fontWeight: "700", color: C.textSec, marginTop: 2 },
  avatar48: { width: 48, height: 48, borderRadius: 8, backgroundColor: "#e9f2ff", alignItems: "center", justifyContent: "center" },
  avatar48Text: { color: C.brand, fontSize: 16, fontWeight: "900" },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricCard: { width: "48.5%", backgroundColor: C.card, borderRadius: 8, borderWidth: 1, borderColor: C.border, padding: 15, gap: 6 },
  metricValue: { fontSize: 28, fontWeight: "900", color: C.text },
  metricLabel: { fontSize: 12, fontWeight: "800", color: C.textSec, textTransform: "uppercase" },

  // Card
  card: { backgroundColor: C.card, borderRadius: 8, borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  cardTitle: { fontSize: 15, fontWeight: "800", color: C.text },
  cardRow: { backgroundColor: C.card, borderRadius: 8, borderWidth: 1, borderColor: C.border, flexDirection: "row", alignItems: "center", gap: 14, padding: 15 },
  cardRowIcon: { width: 40, height: 40, borderRadius: 8, backgroundColor: C.brand + "10", alignItems: "center", justifyContent: "center" },
  cardRowTitle: { fontSize: 15, fontWeight: "800", color: C.text },
  cardRowSub: { fontSize: 12, fontWeight: "600", color: C.textSec, marginTop: 1 },

  // Session Row
  sessionRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  sessionTitle: { fontSize: 15, fontWeight: "800", color: C.text },
  sessionMeta: { fontSize: 12, fontWeight: "600", color: C.textSec, marginTop: 2 },
  badge: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 11, fontWeight: "800" },
  scoreNum: { fontSize: 15, fontWeight: "900", marginLeft: 4 },

  // Section title
  sectionTitle: { fontSize: 17, fontWeight: "900", color: C.text, marginTop: 4 },

  // Page
  pageTitle: { fontSize: 27, fontWeight: "900", color: C.text },
  pageSub: { fontSize: 14, fontWeight: "700", color: C.textSec, marginTop: -8 },
  emptyTitle: { fontSize: 15, fontWeight: "800", color: C.text },

  // Search
  searchBar: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.card, borderRadius: 8, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, minHeight: 48 },
  searchInput: { flex: 1, fontSize: 15, fontWeight: "600", color: C.text },

  // Detail
  detailTitle: { fontSize: 28, fontWeight: "900", color: C.text },
  checkedInCard: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 13, paddingVertical: 10, borderWidth: 1, borderColor: C.border, borderRadius: 12, backgroundColor: C.card },
  checkedInAvatars: { flexDirection: "row", alignItems: "center", paddingRight: 3 },
  checkedInAvatar: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: C.card, borderRadius: 17, backgroundColor: "#e0f2fe" },
  checkedInAvatarOverlap: { marginLeft: -9 },
  checkedInAvatarText: { color: C.brand, fontSize: 13, fontWeight: "900" },
  checkedInName: { color: C.text, fontSize: 13, fontWeight: "800" },
  checkedInContact: { marginTop: 2, color: C.textSec, fontSize: 11, fontWeight: "600" },
  checkedInState: { width: 26, height: 26, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: C.greenBg },

  // Score Hero
  scoreHero: { backgroundColor: C.card, borderRadius: 8, borderWidth: 1, borderColor: C.border, padding: 18, gap: 18 },
  scoreRing: { width: 120, height: 120, borderRadius: 60, borderWidth: 8, alignItems: "center", justifyContent: "center" },
  scoreRingFill: { position: "absolute", width: 120, height: 120, borderRadius: 60, borderWidth: 8, transform: [{ rotate: "-90deg" }] },
  scoreRingNum: { fontSize: 36, fontWeight: "900" } as any,
  trackBg: { height: 6, borderRadius: 99, backgroundColor: "#f1f5f9", overflow: "hidden" },
  trackFill: { height: "100%", borderRadius: 99 },

  // Progress
  progressTrack: { height: 6, borderRadius: 99, backgroundColor: "#f1f5f9", overflow: "hidden", alignSelf: "stretch" },
  progressFill: { height: "100%", borderRadius: 99, backgroundColor: C.brand },
  uploadHeadingRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  uploadRing: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: C.brand + "10" },
  uploadInfoPanel: { alignSelf: "stretch", gap: 9, paddingTop: 2 },
  uploadFileName: { color: C.text, fontSize: 14, lineHeight: 18, fontWeight: "900" },
  uploadStatsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  uploadStatText: { color: C.text, fontSize: 12, fontWeight: "900" },
  uploadSubStatText: { color: C.textSec, fontSize: 12, fontWeight: "800" },

  // Tabs
  tabsRow: { backgroundColor: C.card, borderRadius: 8, borderWidth: 1, borderColor: C.border, padding: 4, flexGrow: 0 },
  tabPill: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 6 },
  tabPillActive: { backgroundColor: C.brand + "10" },
  tabPillText: { fontSize: 11, fontWeight: "800", color: C.textSec },
  tabPillTextActive: { color: C.brand },
  tabBadge: { backgroundColor: C.red, borderRadius: 10, minWidth: 18, height: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  tabBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },

  // Rubric
  rubricPctBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  questionRow: { flexDirection: "row", gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: "#f8fafc", borderLeftWidth: 3 },
  qIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  qPtsBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },

  // Speaker badge
  speakerBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  timeText: { fontSize: 11, fontWeight: "700", color: C.textMuted },

  // Audio player
  playBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.brand, alignItems: "center", justifyContent: "center" },
  timelineTrack: { height: 6, borderRadius: 99, backgroundColor: "#f1f5f9", overflow: "visible" },
  timelineFill: { height: "100%", borderRadius: 99, backgroundColor: C.brand },
  timelineThumb: { position: "absolute", top: -5, width: 16, height: 16, borderRadius: 8, backgroundColor: C.brand, borderWidth: 3, borderColor: "#fff", marginLeft: -8, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 3 },

  // Materials
  materialRow: { flexDirection: "row", gap: 12, padding: 14 },
  materialIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  materialName: { fontSize: 14, fontWeight: "800", color: C.text },
  materialDesc: { fontSize: 12, fontWeight: "600", color: C.textSec, marginTop: 2, lineHeight: 17 },
  materialMeta: { fontSize: 11, fontWeight: "700", color: C.textMuted, marginTop: 4, textTransform: "capitalize" },
  assetSummary: { flexDirection: "row", alignItems: "center", gap: 11, padding: 12, borderWidth: 1, borderColor: "#dbeafe", borderRadius: 8, backgroundColor: "#f5f9ff" },
  assetSummaryIcon: { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#eaf2ff" },

  // Rubric library and picker
  fieldLabel: { color: C.textSec, fontSize: 11, fontWeight: "900", marginBottom: 7, textTransform: "uppercase" },
  pickerValue: { color: C.text, fontSize: 14, fontWeight: "800" },
  pickerMeta: { color: C.textMuted, fontSize: 10, fontWeight: "700", marginTop: 2 },
  pickerMenu: { marginTop: 7, overflow: "hidden", borderWidth: 1, borderColor: C.border, borderRadius: 8, backgroundColor: C.card },
  pickerOption: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 12 },
  pickerOptionSelected: { backgroundColor: "#f3f7ff" },
  pickerOptionTitle: { color: C.text, fontSize: 13, fontWeight: "800" },
  defaultBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: C.greenBg },
  defaultBadgeText: { color: C.green, fontSize: 9, fontWeight: "900", textTransform: "uppercase" },
  defaultRubricCard: { minHeight: 118, flexDirection: "row", alignItems: "center", gap: 13, padding: 16, borderWidth: 1, borderColor: "#e9d5ff", borderRadius: 18, backgroundColor: "#fbf7ff" },
  defaultRubricIcon: { width: 50, height: 50, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: C.aiBg },
  defaultRubricTitle: { flex: 1, color: C.text, fontSize: 17, fontWeight: "900" },
  rubricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  rubricCard: { width: "48%", minHeight: 146, justifyContent: "space-between", gap: 12, padding: 13, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 16, backgroundColor: "#fff" },
  rubricCardBody: { gap: 4 },
  rubricCardTitle: { color: C.text, fontSize: 13, lineHeight: 17, fontWeight: "900" },
  rubricRow: { minHeight: 82, flexDirection: "row", alignItems: "center", gap: 11, padding: 13 },
  rubricListIcon: { width: 40, height: 40, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: C.aiBg },
  rubricTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  rubricAppliedText: { color: C.brand, fontSize: 10, fontWeight: "800", marginTop: 4 },
  rubricSectionHeader: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, backgroundColor: "#f8fafc" },
  rubricPoints: { color: C.brand, fontSize: 12, fontWeight: "900" },
  rubricItem: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 13 },
  rubricItemNumber: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#eef4ff" },
  rubricItemNumberText: { color: C.brand, fontSize: 10, fontWeight: "900" },
  rubricItemText: { color: C.text, fontSize: 13, fontWeight: "700", lineHeight: 19 },
  rubricItemNote: { color: C.textSec, fontSize: 11, fontWeight: "500", lineHeight: 16, marginTop: 4 },

  // Call recorder
  callRecorder: { flex: 1, backgroundColor: "#fff", paddingHorizontal: 22, paddingTop: Platform.OS === "ios" ? 56 : 24, paddingBottom: Platform.OS === "ios" ? 30 : 20 },
  callTopBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  callTopButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#f2f2f7" },
  callTopSpacer: { width: 42 },
  callLiveBadge: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 100, backgroundColor: C.brand + "12" },
  callLiveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.brand },
  callLiveText: { color: C.brand, fontSize: 10, fontWeight: "900" },
  callCenter: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 12 },
  callMicHalo: { width: 128, height: 128, borderRadius: 64, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,108,229,0.15)", marginBottom: 24 },
  callMicCore: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center", backgroundColor: C.brand, shadowColor: C.brand, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.38, shadowRadius: 24, elevation: 8 },
  callTitle: { color: "#636366", fontSize: 20, fontWeight: "800", textTransform: "uppercase" },
  callTimer: { color: "#111", fontSize: 36, fontWeight: "800", fontVariant: ["tabular-nums"], marginTop: 18, textAlign: "center" },
  waveform: { height: 54, flexDirection: "row", alignItems: "center", gap: 5, marginTop: 22 },
  waveBar: { width: 3, borderRadius: 2, backgroundColor: C.brand },
  callCaption: { color: "#98a2b3", fontSize: 12, fontWeight: "600", marginTop: 7 },
  callControls: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-around" },
  callAction: { width: 82, alignItems: "center", gap: 8 },
  callActionButton: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(25,23,23,0.06)" },
  callActionCount: { position: "absolute", top: -3, right: -2, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: C.brand, borderWidth: 2, borderColor: "#111318" },
  callActionCountText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  callStopButton: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: C.brand, shadowColor: C.brand, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 9 },
  callStopSquare: { width: 23, height: 23, borderRadius: 4, backgroundColor: "#fff" },
  callActionLabel: { color: C.text, fontSize: 10, fontWeight: "700" },
  recordingAssetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 46 },
  recordingAssetCard: { width: "48.5%", minHeight: 112, justifyContent: "flex-end", gap: 5, padding: 12, borderRadius: 16, backgroundColor: "#f2f2f7", shadowColor: "#000", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.06, shadowRadius: 8 },
  recordingAssetTitle: { color: C.text, fontSize: 13, fontWeight: "800" },
  recordingAssetSub: { color: "#636366", fontSize: 11, lineHeight: 15 },
  recordingAssetCheck: { position: "absolute", right: 9, top: 9 },
  recordingWaveRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  finishRecording: { alignSelf: "center", marginTop: 10, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, backgroundColor: "#eef2ff" },
  finishRecordingText: { color: C.brand, fontSize: 12, fontWeight: "900" },
  cancelSessionBtn: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 8, backgroundColor: C.redBg },
  cancelSessionText: { color: C.red, fontSize: 13, fontWeight: "800" },
  sheetBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(16,24,40,0.52)" },
  assetSheet: { maxHeight: "78%", minHeight: "52%", borderTopLeftRadius: 18, borderTopRightRadius: 18, backgroundColor: "#fff", paddingHorizontal: 18, paddingBottom: Platform.OS === "ios" ? 32 : 18 },
  communitySheet: { minHeight: "70%", overflow: "hidden" },
  communitySheetList: { paddingTop: 10, paddingBottom: 20 },
  communityEmpty: { alignItems: "center", gap: 8, paddingVertical: 32 },
  sheetHandle: { width: 40, height: 4, alignSelf: "center", borderRadius: 2, backgroundColor: "#d0d5dd", marginTop: 9, marginBottom: 14 },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  sheetTitle: { color: C.text, fontSize: 20, fontWeight: "900" },
  sheetSubtitle: { color: C.textSec, fontSize: 12, marginTop: 2 },
  assetSheetList: { flexGrow: 0, marginBottom: 12 },
  assetPickRow: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 11, borderWidth: 1, borderColor: "#e4e7ec", borderRadius: 8, backgroundColor: "#fff" },
  assetPickRowSelected: { borderColor: "#abefc6", backgroundColor: "#ecfdf3" },
  assetPickTitle: { color: C.text, fontSize: 13, fontWeight: "800" },
  assetPickMeta: { color: C.textSec, fontSize: 11, marginTop: 2 },
  assetPickAction: { color: C.brand, fontSize: 11, fontWeight: "900" },
  assetNotesInput: { minHeight: 74, maxHeight: 120, borderWidth: 1, borderColor: "#d0d5dd", borderRadius: 8, padding: 11, color: C.text, fontSize: 13, textAlignVertical: "top" },

  // Calendar
  pageHeadingRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  pageHeadingSub: { color: C.textSec, fontSize: 12, fontWeight: "600", marginTop: 2 },
  iconButton: { width: 42, height: 42, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  integrationStrip: { flexDirection: "row", alignItems: "center", gap: 11, padding: 12, borderWidth: 1, borderColor: "#d1fadf", borderRadius: 8, backgroundColor: "#f6fef9" },
  integrationIcon: { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#dcfae6" },
  integrationTitle: { color: C.text, fontSize: 13, fontWeight: "800" },
  integrationSub: { color: C.textSec, fontSize: 10, marginTop: 2 },
  connectedBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7, backgroundColor: "#dcfae6" },
  connectedBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
  connectedBadgeText: { color: C.green, fontSize: 10, fontWeight: "900" },
  calendarEventRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 13 },
  entrataEventIcon: { width: 38, height: 38, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: C.aiBg },
  calendarContact: { color: C.ai, fontSize: 10, fontWeight: "700", marginTop: 3 },
  calNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  calMonth: { fontSize: 17, fontWeight: "800", color: C.text },
  calDowRow: { flexDirection: "row", marginBottom: 6 },
  calDow: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "800", color: C.textMuted },
  calWeek: { flexDirection: "row" },
  calDayCell: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 8, borderRadius: 12, gap: 3 },
  calDayText: { fontSize: 14, fontWeight: "700", color: C.text },
  calDayToday: { backgroundColor: C.brand + "10" },
  calDayTextToday: { color: C.brand, fontWeight: "900" },
  calDaySelected: { backgroundColor: C.brand },
  calDayTextSelected: { color: "#fff", fontWeight: "900" },
  calDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.brand },
  calDots: { height: 5, flexDirection: "row", gap: 3 },

  // Settings
  settingsIdentity: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderWidth: 1, borderColor: C.border, borderRadius: 8, backgroundColor: C.card },
  settingsCommunityRow: { flexDirection: "row", alignItems: "center", gap: 12, width: "100%" },
  settingsSwitchButton: { minHeight: 38, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#eef4ff" },
  settingsSectionLabel: { color: C.textMuted, fontSize: 10, fontWeight: "900", marginTop: 4 },
  communitySettingRow: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 12 },
  communitySettingIcon: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#eef2ff" },
  communityRowBody: { flex: 1, minWidth: 0, gap: 2 },
  communitySettingName: { color: C.text, fontSize: 13, fontWeight: "800" },
  settingsChangeText: { color: C.brand, fontSize: 12, fontWeight: "900" },
  aliasSettingsCard: { gap: 13, padding: 14, borderWidth: 1, borderColor: C.border, borderRadius: 14, backgroundColor: C.card },
  aliasFieldGroup: { gap: 6 },
  aliasFieldLabel: { color: C.textSec, fontSize: 11, fontWeight: "900" },
  aliasInputRow: { minHeight: 48, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, borderWidth: 1, borderColor: "#d7dee8", borderRadius: 12, backgroundColor: "#f8fafc" },
  aliasPrefix: { color: C.textMuted, fontSize: 13, fontWeight: "700" },
  aliasInput: { flex: 1, minWidth: 0, paddingVertical: 10, color: C.text, fontSize: 14, fontWeight: "800" },
  aliasPreview: { color: C.brand, fontSize: 12, lineHeight: 17, fontWeight: "800" },
  aliasHelp: { color: C.textSec, fontSize: 11, lineHeight: 16 },
  aliasSaveButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, backgroundColor: C.brand },
  aliasSaveButtonDisabled: { opacity: 0.6 },
  aliasSaveText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  settingsVersion: { color: C.textMuted, fontSize: 11, textAlign: "center", marginTop: 4 },

  // Buttons
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.brand, borderRadius: 8, minHeight: 52, paddingHorizontal: 16 },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  outlineBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.card, borderRadius: 8, minHeight: 52, paddingHorizontal: 16, borderWidth: 1, borderColor: C.border },
  outlineBtnText: { color: C.textSec, fontSize: 15, fontWeight: "800" },
  darkBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.text, borderRadius: 8, minHeight: 52, paddingHorizontal: 16 },
  darkBtnText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  agentToggle: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, paddingHorizontal: 13, paddingVertical: 9 },
  agentToggleSelected: { borderColor: C.brand + "45", backgroundColor: C.brand + "08" },
  agentToggleCheck: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, alignItems: "center", justifyContent: "center" },
  agentToggleCheckSelected: { borderColor: C.brand, backgroundColor: C.brand },
  agentToggleTitle: { color: C.text, fontSize: 13, fontWeight: "900" },
  agentToggleCopy: { color: C.textSec, fontSize: 12, fontWeight: "600", lineHeight: 17, marginTop: 2 },

  // Form
  formTitle: { color: C.text, fontSize: 23, fontWeight: "900", lineHeight: 29 },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#f8fafc", borderColor: "#d7dee8", borderRadius: 8, borderWidth: 1, minHeight: 52, paddingHorizontal: 14 },
  inputField: { flex: 1, fontSize: 16, color: C.text, fontWeight: "600" },
  labelSmall: { fontSize: 11, fontWeight: "800", color: C.textMuted, textTransform: "uppercase" },

  // Segment picker
  segPill: { backgroundColor: "#f5f7fb", borderColor: "#d7dee8", borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 9 },
  segPillActive: { backgroundColor: "#eaf4ff", borderColor: C.brand },
  segText: { color: C.textSec, fontSize: 13, fontWeight: "800" },
  segTextActive: { color: C.brand },

  // Step dots
  stepDot: { alignItems: "center", backgroundColor: "#eef2f7", borderRadius: 999, height: 34, justifyContent: "center", width: 34 },
  stepDotActive: { backgroundColor: C.brand },
  stepDotDone: { backgroundColor: C.green },
  stepDotText: { color: C.textSec, fontSize: 13, fontWeight: "900" },
  stepLabel: { color: C.textSec, fontSize: 12, fontWeight: "800" },

  // Back
  backBtn: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.card, borderColor: C.border, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },

  // Avatars
  avatarLg: { alignItems: "center", backgroundColor: "#e9f2ff", borderRadius: 30, height: 84, justifyContent: "center", width: 84 },
  avatarLgText: { color: C.brand, fontSize: 26, fontWeight: "900" },
  avatar36: { alignItems: "center", backgroundColor: "#e9f2ff", borderRadius: 14, height: 42, justifyContent: "center", width: 42 },

});
