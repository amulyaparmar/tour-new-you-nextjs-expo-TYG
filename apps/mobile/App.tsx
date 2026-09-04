import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
  type AudioPlayer as ExpoAudioPlayer,
  type AudioStatus as ExpoAudioStatus,
} from "expo-audio";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useVideoPlayer, VideoView } from "expo-video";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppProviders } from "./src/components/app-providers";
import { LoadingDots } from "./src/components/loading-dots";
import {
  Alert,
  ActivityIndicator,
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
  FadeOut,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Swipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  NavigationContainer,
  type NavigationContainerRef,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
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
  buildSessionTourTitle,
  formatPersonName,
  formatSessionCardDescription,
  formatSessionCardMeta,
  defaultMemberPublicAlias,
  formatRecordingUploadTitle,
  rubricItemCount,
  rubricTotalPoints,
  type ProspectInterestCategory,
} from "@tour/shared";
import {
  findPhaseForTimestamp,
  processingStatusMessage,
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
  uploadPanoramaMaterial,
  uploadRubric,
  updateProfile,
  submitSupportRequest,
} from "./src/api";
import { getApiBaseUrl, getSiteBaseUrl } from "./src/config";
import { createLoadedAudioPlayer } from "./src/audio-player";
import { computeDashboardMetrics } from "./src/dashboard";
import type { UploadProgressInfo } from "./src/presignedUpload";
import {
  authorizedCommunitiesForSession,
  type MobileAuthSession,
  authenticatedFetch,
  clearSession,
  getCurrentSession,
  restoreSession,
  switchCommunity,
} from "./src/auth";
import { useEasUpdateCheck } from "./src/hooks/use-eas-update-check";
import {
  registerForPushNotifications,
  addNotificationResponseListener,
  addNotificationReceivedListener,
} from "./src/push-notifications";
import { trackAnalyticsEvent, setAnalyticsUserId } from "./src/analytics";
import { LoginScreen } from "./src/LoginScreen";
import { TourLogo, TourMark } from "./src/components/TourLogo";
import { CustomText, customTextVariants } from "./src/components/custom-text";
import {
  LargeTitleCopy,
  LargeTitleHeader,
  LARGE_TITLE_BAR_HEIGHT,
  largeTitleContentInset,
} from "./src/components/large-title-header";
import {
  GlassNavHeader,
  glassNavContentInset,
} from "./src/components/glass-nav-header";
import { LiquidGlassDropdown } from "./src/components/liquid-glass-dropdown";
import { LiquidGlassIconButton } from "./src/components/liquid-glass-icon-button";
import { LiquidGlassSearch } from "./src/components/liquid-glass-search";
import {
  LiveRecordingCard,
  LiveRecordingDock,
  RecordingExperienceHost,
  RecordingProvider,
  formatElapsed,
  useRecording,
  type LiveRecordingDraft,
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
import {
  beginDirectLocalUpload,
  drainSyncOutbox,
  endDirectLocalUpload,
  isOnline,
  startSyncOutbox,
} from "./src/offline/sync-outbox";
import {
  promoteLocalRecordingToCache,
  resolveSessionPlaybackUri,
} from "./src/session-audio-cache";
import {
  MotionPressable,
  AnimatedTabContent,
} from "./src/components/ui/motion";
import {
  CollapsibleSection,
  RubricTab,
  ScoreHero,
  SessionAiChatScreen,
  SessionAiFab,
  SessionAudioInsightsScreen,
  ProspectInsightsCard,
  SessionModeTabs,
  SessionPlayer,
  SessionReviewSkeleton,
  TourScreenHeader,
  SESSION_PAGE_PADDING,
  type SessionReviewMode,
} from "./src/components/session";
import {
  tourColors as C,
  tourColors,
  scoreColor,
} from "./src/theme/tour-brand";
import {
  ACCENT,
  BACKGROUND,
  CARD,
  FONT,
  LARGE_CORNER,
  SMALL_CORNER,
  TEXT,
} from "./src/theme/tokens";
import { selectionHaptic, impactHaptic } from "./src/lib/haptics";
import {
  TourBackButton as BackBtn,
  TourEmptyState as EmptyState,
  TourInput as Input,
  TourLoadingBox as LoadingBox,
  TourPrimaryButton as PrimaryBtn,
  TourSegPicker as SegPicker,
  TourStatusBadge,
} from "./src/components/tour";
import { CommunityPickerModal } from "@/components/community-picker-modal";
import { BottomSheetModal } from "@/components/bottom-sheet-modal";
import { CheckInSheet } from "./src/components/check-in/check-in-sheet";
import { ProfileEditorModal } from "./src/components/profile/profile-editor-modal";
import {
  ProfileEditorScreen,
  resolveCardAccent,
} from "./src/components/profile/profile-editor-screen";
import {
  PhotoAssetRecorder,
  type RecordedPhotoAsset,
} from "./src/assets/PhotoAssetRecorder";
import {
  VideoAssetRecorder,
  type RecordedVideoAsset,
} from "./src/assets/VideoAssetRecorder";
import {
  PanoramaAssetRecorder,
  type RecordedPanoramaAsset,
} from "./src/assets/PanoramaAssetRecorder";
import { PanoramaImageViewer } from "./src/assets/PanoramaImageViewer";
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
import { Text as UiText } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import {
  BulkUploadDock,
  BulkUploadFlow,
} from "./src/bulk-upload/BulkUploadFlow";
import { SessionReportScreen } from "./src/reports/SessionReportScreen";
import { PracticeSessionsScreen } from "./src/practice/PracticeSessionsScreen";

const loginBackground = require("./assets/videos/login-bg.mp4");

type ProspectData = {
  name: string;
  email: string;
  phone: string;
  moveIn: string;
  bedrooms: string;
  budget: string;
};
type MainTab = "home" | "sessions" | "calendar" | "materials" | "settings" | "practice";
type Screen =
  | { type: "main"; tab: MainTab }
  | {
      type: "session-detail";
      sessionId: string;
      sample?: boolean;
      autoStartRecording?: boolean;
    }
  | { type: "session-comments"; sessionId: string; sessionTitle?: string }
  | {
      type: "session-ai-chat";
      sessionId: string;
      sessionTitle?: string;
      prospectName?: string;
    }
  | {
      type: "session-audio-insights";
      sessionId: string;
      sessionTitle?: string;
      initialStatus?: AudioInsightsStatus;
      initialInsights?: AudioInsights | null;
    }
  | { type: "session-report"; sessionId: string }
  | { type: "bulk-upload"; batchId?: string }
  | { type: "create-session" }
  | { type: "practice"; scenarioId?: string }
  | { type: "audio-test" }
  | { type: "rubrics" }
  | { type: "profile" }
  | { type: "tour" };

type TourStep = "contact" | "preferences" | "ready";
type SlideDirection = "forward" | "back";
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

const PROCESSING_STATUSES = new Set([
  "transcribing",
  "segmenting",
  "analyzing",
]);
const SESSION_PROCESS_STEPS = [
  { id: "uploaded", label: "Uploaded", icon: "cloud-done-outline" },
  { id: "transcribing", label: "Transcript", icon: "mic-outline" },
  { id: "segmenting", label: "Segments", icon: "git-branch-outline" },
  { id: "analyzing", label: "Analysis", icon: "sparkles-outline" },
] as const;

function pendingUploadKey(sessionId: string) {
  return `tour.pendingRecordingUpload.${sessionId}`;
}

async function savePendingRecordingUpload(
  upload: PendingRecordingUpload & { localId?: string | null },
) {
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
    await AsyncStorage.setItem(
      pendingUploadKey(upload.sessionId),
      JSON.stringify(upload),
    );
  } catch {
    // Best-effort local retry metadata only.
  }
}

async function loadPendingRecordingUpload(
  sessionId: string,
): Promise<(PendingRecordingUpload & { localId?: string | null }) | null> {
  try {
    const local = findLocalSessionByRemoteId(sessionId);
    if (
      local &&
      (local.status === "ready_to_sync" ||
        local.status === "failed" ||
        local.status === "syncing")
    ) {
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
    const key = pendingUploadKey(sessionId);
    let raw = await AsyncStorage.getItem(key);
    if (!raw) {
      raw = await SecureStore.getItemAsync(key);
      if (raw) {
        await AsyncStorage.setItem(key, raw);
        await SecureStore.deleteItemAsync(key).catch(() => {});
      }
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingRecordingUpload;
    return parsed?.uri && parsed?.mimeType && parsed?.name ? parsed : null;
  } catch {
    return null;
  }
}

async function clearPendingRecordingUpload(
  sessionId: string,
  localId?: string | null,
) {
  try {
    // Keep local folders only while live audio is pending upload. After upload,
    // playback uses the audio cache / signed URL — not session meta cards.
    const resolvedLocalId =
      localId ?? findLocalSessionByRemoteId(sessionId)?.localId ?? null;
    if (resolvedLocalId) deleteLocalSession(resolvedLocalId);
    const key = pendingUploadKey(sessionId);
    await Promise.all([
      AsyncStorage.removeItem(key),
      SecureStore.deleteItemAsync(key).catch(() => {}),
    ]);
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
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtTime(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
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
    scale.value = withRepeat(
      withSequence(
        withTiming(1.45, { duration: 850, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 850, easing: Easing.in(Easing.quad) }),
      ),
      -1,
      false,
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.45, { duration: 850 }),
        withTiming(1, { duration: 850 }),
      ),
      -1,
      false,
    );
  }, [opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Reanimated.View
      style={[st.pulseDot, { backgroundColor: color }, animatedStyle]}
    />
  );
}

function LoadingShimmer({ rows = 3 }: { rows?: number }) {
  return (
    <View style={{ gap: 10 }}>
      {Array.from({ length: rows }).map((_, index) => (
        <View key={index} style={st.shimmerCard}>
          <View style={st.sessionSkeletonAvatar} />
          <View style={st.sessionSkeletonBody}>
            <View
              style={[
                st.shimmerBar,
                { width: index % 2 === 0 ? "68%" : "52%" },
              ]}
            />
            <View
              style={[
                st.shimmerBar,
                { width: index % 2 === 0 ? "44%" : "72%", height: 8 },
              ]}
            />
          </View>
          <View style={st.sessionSkeletonChevron} />
        </View>
      ))}
    </View>
  );
}

function AnimatedProgressFill({
  percent,
  color = C.brand,
}: {
  percent: number;
  color?: string;
}) {
  const progress = useSharedValue(percent);

  useEffect(() => {
    progress.value = withTiming(Math.max(0, Math.min(100, percent)), {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
  }, [percent, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${progress.value}%`,
  }));

  return (
    <Reanimated.View
      style={[st.progressFill, { backgroundColor: color }, animatedStyle]}
    />
  );
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
  const uploadedText = total
    ? `${formatBytes(stats.loaded)} of ${formatBytes(total)}`
    : formatBytes(fileSize);
  const speedText = stats.bytesPerSecond
    ? `${formatBytes(stats.bytesPerSecond)}/s`
    : "Waiting for transfer";
  const phaseLabel =
    stats.phase === "preparing"
      ? "Preparing secure upload"
      : stats.phase === "finalizing"
        ? "Finalizing recording"
        : "Uploading recording";

  return (
    <View style={[st.card, { padding: 20, gap: 14 }]}>
      <View style={{ alignItems: "center", gap: 10 }}>
        <View style={[st.uploadRing, error && { backgroundColor: C.redBg }]}>
          {error ? (
            <Ionicons name="cloud-offline-outline" size={28} color={C.red} />
          ) : (
            <LoadingDots size="small" color={C.brand} />
          )}
        </View>
        <Text style={st.formTitle}>{error ? "Upload Needs Retry" : title}</Text>
        <Text style={[st.pageSub, { textAlign: "center", marginTop: -6 }]}>
          {error || phaseLabel}
        </Text>
      </View>

      <View style={st.uploadInfoPanel}>
        <Text style={st.uploadFileName} numberOfLines={1}>
          {fileName || "Recording file"}
        </Text>
        <View style={st.progressTrack}>
          <AnimatedProgressFill
            percent={stats.percent}
            color={error ? C.red : C.brand}
          />
        </View>
        <View style={st.uploadStatsRow}>
          <Text style={st.uploadStatText}>{stats.percent}%</Text>
          <Text style={st.uploadStatText}>{uploadedText}</Text>
        </View>
        <View style={st.uploadStatsRow}>
          <Text style={st.uploadSubStatText}>{speedText}</Text>
          <Text style={st.uploadSubStatText}>
            {formatUploadEta(stats.etaSeconds)}
          </Text>
        </View>
      </View>

      {error && (onRetry || onChooseDifferent) ? (
        <View style={{ flexDirection: "row", gap: 10 }}>
          {onRetry ? (
            <Pressable
              onPress={onRetry}
              style={({ pressed }) => [
                st.primaryBtn,
                { flex: 1 },
                pressed && st.pressed,
              ]}
            >
              <Ionicons name="refresh" size={18} color="#fff" />
              <Text style={st.primaryBtnText}>Retry Upload</Text>
            </Pressable>
          ) : null}
          {onChooseDifferent ? (
            <Pressable
              onPress={onChooseDifferent}
              style={({ pressed }) => [
                st.outlineBtn,
                { flex: 1 },
                pressed && st.pressed,
              ]}
            >
              <Text style={st.outlineBtnText}>Choose File</Text>
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
  if (screen.type === "session-comments")
    return `session-comments:${screen.sessionId}`;
  if (screen.type === "session-ai-chat")
    return `session-ai:${screen.sessionId}`;
  if (screen.type === "session-audio-insights")
    return `session-audio:${screen.sessionId}`;
  if (screen.type === "session-report")
    return `session-report:${screen.sessionId}`;
  if (screen.type === "bulk-upload")
    return `bulk-upload:${screen.batchId ?? "new"}`;
  if (screen.type === "practice")
    return `practice:${screen.scenarioId ?? "list"}`;
  return screen.type;
}

function screenRank(screen: Screen) {
  if (screen.type === "main") {
    const index = TAB_ITEMS.findIndex((tab) => tab.id === screen.tab);
    return Math.max(0, index);
  }
  if (screen.type === "tour") return 11;
  if (screen.type === "create-session") return 12;
  if (screen.type === "practice") return 12;
  if (screen.type === "rubrics") return 12;
  if (screen.type === "profile") return 12;
  if (screen.type === "session-detail") return 13;
  if (screen.type === "session-comments") return 14;
  if (screen.type === "session-ai-chat") return 14;
  if (screen.type === "session-audio-insights") return 14;
  if (screen.type === "session-report") return 14;
  if (screen.type === "bulk-upload") return 13;
  return 0;
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
  // Full-page horizontal slides make heavy ScrollViews feel like they lag.
  // A short fade/lift keeps the hierarchy stable while the new tab mounts.
  // Keep the premium lift cue, but limit it to a tiny deterministic movement
  // so heavy dashboard content does not feel like it is catching up.
  const entering = FadeInDown.duration(180)
    .easing(Easing.out(Easing.cubic))
    .withInitialValues({ opacity: 0, transform: [{ translateY: 6 }] });
  const exiting = FadeOut.duration(100).easing(Easing.in(Easing.cubic));

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

let _showToast:
  | ((msg: string, type?: "error" | "success" | "info") => void)
  | null = null;

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{
    id: number;
    msg: string;
    type: "error" | "success" | "info";
  } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const insets = useSafeAreaInsets();
  const toastY = useSharedValue(-42);
  const toastOpacity = useSharedValue(0);

  const finishToastDismiss = useCallback(() => setToast(null), []);
  const dismissToast = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    toastY.value = withTiming(-72, { duration: 170 });
    toastOpacity.value = withTiming(0, { duration: 150 }, (finished) => {
      if (finished) runOnJS(finishToastDismiss)();
    });
  }, [finishToastDismiss, toastOpacity, toastY]);

  _showToast = useCallback(
    (msg: string, type?: "error" | "success" | "info") => {
      const t = type ?? "info";
      setToast({ id: Date.now(), msg, type: t });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(dismissToast, 3500);
    },
    [dismissToast],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  useEffect(() => {
    if (!toast) return;
    toastY.value = -42;
    toastOpacity.value = 0;
    toastY.value = withSpring(0, { damping: 20, stiffness: 250, mass: 0.8 });
    toastOpacity.value = withTiming(1, { duration: 170 });
  }, [toast?.id, toastOpacity, toastY]);

  const toastGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-7, 7])
        .failOffsetX([-32, 32])
        .onUpdate((event) => {
          if (event.translationY > 10) return;
          toastY.value = Math.max(-100, event.translationY);
          toastOpacity.value = Math.max(
            0.2,
            1 - Math.abs(event.translationY) / 110,
          );
        })
        .onEnd((event) => {
          if (event.translationY < -38 || event.velocityY < -620) {
            runOnJS(dismissToast)();
            return;
          }
          toastY.value = withSpring(0, { damping: 20, stiffness: 270 });
          toastOpacity.value = withTiming(1, { duration: 130 });
        }),
    [dismissToast, toastOpacity, toastY],
  );

  const toastAnimatedStyle = useAnimatedStyle(() => ({
    opacity: toastOpacity.value,
    transform: [{ translateY: toastY.value }],
  }));

  const accent =
    toast?.type === "error"
      ? C.red
      : toast?.type === "success"
        ? C.green
        : C.brand;
  const tint =
    toast?.type === "error"
      ? "rgba(255,235,235,0.72)"
      : toast?.type === "success"
        ? "rgba(232,250,240,0.72)"
        : "rgba(226,242,255,0.72)";
  const iconName: keyof typeof Ionicons.glyphMap =
    toast?.type === "error"
      ? "alert-circle"
      : toast?.type === "success"
        ? "checkmark-circle"
        : "information-circle";

  return (
    <View style={{ flex: 1 }}>
      {children}
      {toast && (
        <GestureDetector gesture={toastGesture}>
          <Reanimated.View
            style={[
              st.toast,
              { top: Math.max(insets.top, 10) + 8 },
              toastAnimatedStyle,
            ]}
          >
            <BlurView
              intensity={72}
              tint="light"
              style={[st.toastGlass, { backgroundColor: tint }]}
            >
              <View style={[st.toastIcon, { backgroundColor: accent + "16" }]}>
                <Ionicons name={iconName} size={19} color={accent} />
              </View>
              <Text style={st.toastText}>{toast.msg}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Dismiss notification"
                hitSlop={10}
                onPress={dismissToast}
                style={({ pressed }) => [st.toastClose, pressed && st.pressed]}
              >
                <Ionicons name="close" size={18} color={C.textSec} />
              </Pressable>
            </BlurView>
          </Reanimated.View>
        </GestureDetector>
      )}
    </View>
  );
}

function showToast(msg: string, type?: "error" | "success" | "info") {
  _showToast?.(msg, type);
}

function OfflineSyncHost({
  onOpenRemoteSession,
}: {
  onOpenRemoteSession: (sessionId: string) => void;
}) {
  const recoveryShownRef = useRef(false);

  useEffect(() => {
    // Local session folders are for live-recording audio recovery/upload only.
    // Drop uploaded or empty meta so stale cards never reappear in the UI.
    for (const session of listLocalSessions()) {
      if (session.status === "uploaded" || !session.draft) {
        if (
          session.status === "uploaded" ||
          !getRecordingUri(session.localId)
        ) {
          deleteLocalSession(session.localId);
        }
      }
    }
    const stop = startSyncOutbox();
    return stop;
  }, []);

  useEffect(() => {
    if (recoveryShownRef.current) return;
    const recoverable = listRecoverableRecordingSessions().filter((session) =>
      Boolean(getRecordingUri(session.localId) || session.recordingSourceUri),
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
            for (const session of recoverable)
              deleteLocalSession(session.localId);
          },
        },
        {
          text: "Keep & sync",
          onPress: () => {
            for (const session of recoverable) {
              markReadyToSync(session.localId, {
                durationSec:
                  session.durationSec ?? Math.max(1, session.elapsedSec),
                sourceUri:
                  getRecordingUri(session.localId) ??
                  session.recordingSourceUri,
                remoteSessionId: session.remoteSessionId,
                draft: session.draft ?? emptyLiveDraft(),
                fileName: session.fileName,
                mimeType: session.mimeType,
              });
            }
            void drainSyncOutbox().then(() => {
              const leftover = listLocalSessions().find(
                (s) => s.localId === first.localId,
              );
              if (!leftover) {
                showToast("Recording uploaded", "success");
                if (first.remoteSessionId)
                  onOpenRemoteSession(first.remoteSessionId);
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

type ProfileStackParamList = {
  Main: undefined;
  Profile: undefined;
};

const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

function ProfileNavigation({
  showProfile,
  onCloseProfile,
  session,
  onSaved,
  onStartTour,
  children,
}: {
  showProfile: boolean;
  onCloseProfile: () => void;
  session: MobileAuthSession;
  onSaved: (session: MobileAuthSession) => void;
  onStartTour: () => void;
  children: React.ReactNode;
}) {
  const navigationRef =
    useRef<NavigationContainerRef<ProfileStackParamList>>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!ready || !navigationRef.current) return;
    const current = navigationRef.current.getCurrentRoute()?.name;
    if (showProfile && current !== "Profile") {
      navigationRef.current.navigate("Profile");
    } else if (!showProfile && current === "Profile") {
      navigationRef.current.goBack();
    }
  }, [ready, showProfile]);

  return (
    <NavigationContainer ref={navigationRef} onReady={() => setReady(true)}>
      <ProfileStack.Navigator
        initialRouteName="Main"
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
          gestureEnabled: true,
          contentStyle: { backgroundColor: "#f7f8fb" },
        }}
      >
        <ProfileStack.Screen name="Main">{() => children}</ProfileStack.Screen>
        <ProfileStack.Screen name="Profile">
          {({ navigation }: { navigation: { goBack: () => void } }) => (
            <ProfileEditorScreen
              session={session}
              onBack={() => {
                onCloseProfile();
                navigation.goBack();
              }}
              onSaved={onSaved}
              onStartTour={onStartTour}
            />
          )}
        </ProfileStack.Screen>
      </ProfileStack.Navigator>
    </NavigationContainer>
  );
}

type SessionStackParamList = {
  Sessions: undefined;
  Detail: undefined;
};

const SessionStack = createNativeStackNavigator<SessionStackParamList>();

function SessionNavigation({
  showDetail,
  sessionId,
  autoStartRecording,
  sample,
  onClose,
  children,
  onOpenComments,
  onOpenAiChat,
  onOpenAudioInsights,
  onOpenReport,
}: {
  showDetail: boolean;
  sessionId: string | null;
  autoStartRecording?: boolean;
  sample?: boolean;
  onClose: () => void;
  children: React.ReactNode;
  onOpenComments: (meta: { sessionId: string; sessionTitle?: string }) => void;
  onOpenAiChat: (meta: {
    sessionId: string;
    sessionTitle?: string;
    prospectName?: string;
  }) => void;
  onOpenAudioInsights: (meta: {
    sessionId: string;
    sessionTitle?: string;
    initialStatus?: AudioInsightsStatus;
    initialInsights?: AudioInsights | null;
  }) => void;
  onOpenReport: (sessionId: string) => void;
}) {
  const navigationRef =
    useRef<NavigationContainerRef<SessionStackParamList>>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!ready || !navigationRef.current) return;
    const current = navigationRef.current.getCurrentRoute()?.name;
    if (showDetail && sessionId && current !== "Detail") {
      navigationRef.current.navigate("Detail");
    } else if (!showDetail && current === "Detail") {
      navigationRef.current.goBack();
    }
  }, [ready, sessionId, showDetail]);

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => setReady(true)}
      onStateChange={() => {
        if (
          showDetail &&
          navigationRef.current?.getCurrentRoute()?.name === "Sessions"
        ) {
          onClose();
        }
      }}
    >
      <SessionStack.Navigator
        initialRouteName="Sessions"
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
          gestureEnabled: true,
          contentStyle: { backgroundColor: "#f7f8fb" },
        }}
      >
        <SessionStack.Screen name="Sessions">
          {() => children}
        </SessionStack.Screen>
        <SessionStack.Screen name="Detail">
          {({ navigation }: { navigation: { goBack: () => void } }) => {
            if (!sessionId) return null;
            const back = () => {
              navigation.goBack();
              onClose();
            };
            return sample ? (
              <SampleSessionDetailScreen sessionId={sessionId} onBack={back} />
            ) : (
              <SessionDetailScreen
                sessionId={sessionId}
                autoStartRecording={Boolean(autoStartRecording)}
                onBack={back}
                onOpenComments={onOpenComments}
                onOpenAiChat={onOpenAiChat}
                onOpenAudioInsights={onOpenAudioInsights}
                onOpenReport={onOpenReport}
              />
            );
          }}
        </SessionStack.Screen>
      </SessionStack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  useEasUpdateCheck();
  const player = useVideoPlayer(loginBackground, (vp) => {
    vp.loop = true;
    vp.muted = true;
  });

  const [screen, setScreen] = useState<Screen>({ type: "main", tab: "home" });
  const [authSession, setAuthSession] = useState<MobileAuthSession | null>(
    null,
  );
  const [authLoading, setAuthLoading] = useState(true);
  const [tourStep, setTourStep] = useState<TourStep>("contact");
  const [prospect, setProspect] = useState<ProspectData>({
    name: "",
    email: "",
    phone: "",
    moveIn: "",
    bedrooms: "2 bed",
    budget: "$2,200 - $2,600",
  });
  const [transitionDirection, setTransitionDirection] =
    useState<SlideDirection>("forward");
  const [pendingCreateUpload, setPendingCreateUpload] =
    useState<PendingCreateSessionUpload | null>(null);
  const screenRef = useRef<Screen>(screen);
  const lastMainTabRef = useRef<MainTab>("home");

  screenRef.current = screen;
  if (
    screen.type === "main" &&
    TAB_ITEMS.some((item) => item.id === screen.tab)
  ) {
    lastMainTabRef.current = screen.tab;
  }

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

  const tourIdx = useMemo(
    () => tourSteps.findIndex((s) => s.id === tourStep),
    [tourStep],
  );
  const routeKey =
    screen.type === "main" || screen.type === "profile"
      ? screen.type === "main" && screen.tab === "sessions"
        ? "sessions-stack"
        : "main-profile-stack"
      : screen.type === "session-detail"
        ? "sessions-stack"
        : screenKey(screen);
  const nav = useCallback(
    (next: Screen) => {
      setTransitionDirection(
        screenRank(next) >= screenRank(screen) ? "forward" : "back",
      );
      setScreen(next);
    },
    [screen],
  );

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

  const renderMainTabs = (tab: MainTab) => (
    <MainTabs
      key={authSession.workspace.community.id}
      tab={tab}
      onTab={(t) => nav({ type: "main", tab: t })}
      onSession={(id, opts) =>
        nav({
          type: "session-detail",
          sessionId: id,
          autoStartRecording: opts?.autoStartRecording,
        })
      }
      onSampleSession={(id) =>
        nav({ type: "session-detail", sessionId: id, sample: true })
      }
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
  );

  return (
    <AppProviders>
      <View style={st.root}>
        <StatusBar style="dark" />
        <RecordingProvider onNotify={showToast}>
          <ToastProvider>
            <OfflineSyncHost
              onOpenRemoteSession={(sessionId) =>
                nav({ type: "session-detail", sessionId })
              }
            />
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              enabled={screen.type !== "main"}
              style={st.flex1}
            >
              <ScreenTransition
                transitionKey={routeKey}
                direction={transitionDirection}
              >
                {((screen.type === "main" && screen.tab !== "sessions") ||
                  screen.type === "profile") && (
                  <ProfileNavigation
                    showProfile={screen.type === "profile"}
                    onCloseProfile={() => nav({ type: "main", tab: "home" })}
                    session={authSession}
                    onSaved={setAuthSession}
                    onStartTour={() => {
                      setTourStep("contact");
                      nav({ type: "tour" });
                    }}
                  >
                    {renderMainTabs(
                      screen.type === "main" ? screen.tab : "home",
                    )}
                  </ProfileNavigation>
                )}
                {((screen.type === "main" && screen.tab === "sessions") ||
                  screen.type === "session-detail") && (
                  <SessionNavigation
                    showDetail={screen.type === "session-detail"}
                    sessionId={
                      screen.type === "session-detail" ? screen.sessionId : null
                    }
                    autoStartRecording={
                      screen.type === "session-detail"
                        ? screen.autoStartRecording
                        : false
                    }
                    sample={
                      screen.type === "session-detail" ? screen.sample : false
                    }
                    onClose={() => nav({ type: "main", tab: "sessions" })}
                    onOpenComments={(meta) =>
                      nav({ type: "session-comments", ...meta })
                    }
                    onOpenAiChat={(meta) =>
                      nav({ type: "session-ai-chat", ...meta })
                    }
                    onOpenAudioInsights={(meta) =>
                      nav({ type: "session-audio-insights", ...meta })
                    }
                    onOpenReport={(sessionId) =>
                      nav({ type: "session-report", sessionId })
                    }
                  >
                    {renderMainTabs("sessions")}
                  </SessionNavigation>
                )}
                {screen.type === "session-comments" && (
                  <SessionCommentsScreen
                    sessionId={screen.sessionId}
                    sessionTitle={screen.sessionTitle}
                    onBack={() =>
                      nav({
                        type: "session-detail",
                        sessionId: screen.sessionId,
                      })
                    }
                  />
                )}
                {screen.type === "session-ai-chat" && (
                  <SessionAiChatScreen
                    sessionId={screen.sessionId}
                    sessionTitle={screen.sessionTitle}
                    prospectName={screen.prospectName}
                    onBack={() =>
                      nav({
                        type: "session-detail",
                        sessionId: screen.sessionId,
                      })
                    }
                  />
                )}
                {screen.type === "session-audio-insights" && (
                  <SessionAudioInsightsScreen
                    sessionId={screen.sessionId}
                    sessionTitle={screen.sessionTitle}
                    initialStatus={screen.initialStatus}
                    initialInsights={screen.initialInsights ?? null}
                    onBack={() =>
                      nav({
                        type: "session-detail",
                        sessionId: screen.sessionId,
                      })
                    }
                  />
                )}
                {screen.type === "session-report" && (
                  <SessionReportScreen
                    sessionId={screen.sessionId}
                    onBack={() =>
                      nav({
                        type: "session-detail",
                        sessionId: screen.sessionId,
                      })
                    }
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
                    onOpenSession={(sessionId) =>
                      nav({ type: "session-detail", sessionId })
                    }
                    onNotify={showToast}
                  />
                )}
                {screen.type === "create-session" && (
                  <CreateSessionScreen
                    onBack={() =>
                      nav({ type: "main", tab: lastMainTabRef.current })
                    }
                    onCreated={(id) =>
                      nav({ type: "session-detail", sessionId: id })
                    }
                    onLiveRecordingOpened={() => {
                      if (screenRef.current.type === "create-session") {
                        nav({ type: "main", tab: lastMainTabRef.current });
                      }
                    }}
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
                {screen.type === "practice" && (
                  <PracticeSessionsScreen
                    initialScenarioId={screen.scenarioId}
                    property={property}
                    onBack={() => nav({ type: "main", tab: "practice" })}
                  />
                )}
                {screen.type === "audio-test" && (
                  <AudioTestScreen
                    onBack={() => nav({ type: "main", tab: "home" })}
                  />
                )}
                {screen.type === "rubrics" && (
                  <RubricsScreen
                    session={authSession}
                    onBack={() => nav({ type: "main", tab: "settings" })}
                    onSession={(id) =>
                      nav({ type: "session-detail", sessionId: id })
                    }
                  />
                )}
                {screen.type === "tour" && (
                  <ScrollView
                    contentInsetAdjustmentBehavior="automatic"
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={st.scroll}
                  >
                    <TourStepper
                      session={authSession}
                      idx={tourIdx}
                      prospect={prospect}
                      step={tourStep}
                      onBack={() => nav({ type: "profile" })}
                      onChange={(k, v) =>
                        setProspect((c) => ({ ...c, [k]: v }))
                      }
                      onStep={setTourStep}
                    />
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
  const propertyLabel =
    property
      .replace(/\s*(?:[·|—-]\s*)?entrata\s+sync(?:ed|ing)?\b/gi, "")
      .trim() || property;
  return (
    <View style={homeSt.topBar}>
      <View style={homeSt.topBarSide}>{left}</View>
      <View style={homeSt.topBarCenter}>
        <LiquidGlassDropdown
          label={propertyLabel}
          accessibilityLabel="Switch property"
          onPress={onCommunityPress}
        />
      </View>
      <View style={[homeSt.topBarSide, homeSt.topBarSideEnd]}>{right}</View>
    </View>
  );
}

// ═══════════════════════════════════════
// Bottom Tab Navigation
// ═══════════════════════════════════════

const TAB_ITEMS: Array<{
  id: MainTab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
}> = [
  { id: "home", label: "Home", icon: "home-outline", iconActive: "home" },
  {
    id: "sessions",
    label: "Sessions",
    icon: "list-outline",
    iconActive: "list",
  },
  {
    id: "materials",
    label: "Assets",
    icon: "folder-outline",
    iconActive: "folder",
  },
  {
    id: "practice",
    label: "Practice",
    icon: "sparkles-outline",
    iconActive: "sparkles",
  },
];

function MainTabs({
  tab,
  onTab,
  onSession,
  onSampleSession,
  onCreate,
  onAudioTest,
  onGuestRegistration,
  onProfile,
  onRubrics,
  onSignOut,
  authSession,
  onAuthSession,
  agentName,
  property,
}: {
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
  const upcomingSessionsQuery = useSessionsQuery({
    limit: 10,
    upcoming: true,
    sort: "scheduled_asc",
  });
  const materialsQuery = useMaterialsQuery();
  const calendarQuery = useCalendarEventsQuery();
  const profileQuery = useProfileQuery();
  const sessions = sessionsQuery.data?.sessions ?? [];
  const upcomingSessions = upcomingSessionsQuery.data?.sessions ?? [];
  const materials = materialsQuery.data?.materials ?? [];
  const tourLibrary = materialsQuery.data?.tourLibrary ?? null;
  const propertyWebsite = materialsQuery.data?.propertyWebsite ?? null;
  const calendarEvents = calendarQuery.data?.events ?? [];
  const profile = profileQuery.data;
  const loading =
    sessionsQuery.isLoading ||
    upcomingSessionsQuery.isLoading ||
    calendarQuery.isLoading;
  const materialsLoading = materialsQuery.isLoading;
  const [refreshing, setRefreshing] = useState(false);
  const error =
    sessionsQuery.error ??
    upcomingSessionsQuery.error ??
    calendarQuery.error ??
    materialsQuery.error ??
    null;
  const communityPickerOpen = useAppStore((state) => state.communityPickerOpen);
  const communityQuery = useAppStore((state) => state.communityQuery);
  const setCommunityPickerOpen = useAppStore(
    (state) => state.setCommunityPickerOpen,
  );
  const setCommunityQuery = useAppStore((state) => state.setCommunityQuery);
  const resetCommunityPicker = useAppStore(
    (state) => state.resetCommunityPicker,
  );
  const [switchingCommunityId, setSwitchingCommunityId] = useState<
    string | null
  >(null);
  const [tabTransitionDirection, setTabTransitionDirection] =
    useState<SlideDirection>("forward");
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [practiceLive, setPracticeLive] = useState(false);
  const checkInStartingRef = useRef(false);
  const [checkInBinding, setCheckInBinding] = useState<{
    sessionId: string | null;
    url: string | null;
  } | null>(null);
  const publicMemberAlias = defaultMemberPublicAlias({
    alias: authSession.workspace.teamMember?.alias,
    name:
      authSession.workspace.teamMember?.name ||
      authSession.workspace.user.fullName,
    email: authSession.workspace.user.email,
    id: authSession.workspace.teamMember?.id || authSession.workspace.user.id,
  });
  const tabIndicatorX = useSharedValue(
    (tabBarWidth / TAB_ITEMS.length) *
      Math.max(
        0,
        TAB_ITEMS.findIndex((item) => item.id === tab),
      ),
  );
  const tabIndicatorStyle = useAnimatedStyle(() => ({
    width: tabBarWidth / TAB_ITEMS.length,
    transform: [{ translateX: tabIndicatorX.value }],
  }));

  useEffect(() => {
    const activeIndex = TAB_ITEMS.findIndex((item) => item.id === tab);
    if (activeIndex < 0) return;
    tabIndicatorX.value = withTiming(
      (tabBarWidth / TAB_ITEMS.length) * activeIndex,
      { duration: 220, easing: Easing.out(Easing.cubic) },
    );
  }, [tab, tabBarWidth, tabIndicatorX]);

  useEffect(() => {
    if (tab !== "practice") setPracticeLive(false);
  }, [tab]);

  useEffect(() => {
    if (!profile) return;
    const next = getCurrentSession();
    if (next) onAuthSession(next);
  }, [profile, onAuthSession]);

  useEffect(() => {
    setCheckInOpen(false);
    setCheckInBinding(null);
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
  }, [
    calendarQuery,
    materialsQuery,
    profileQuery,
    sessionsQuery,
    upcomingSessionsQuery,
  ]);

  const chooseCommunity = useCallback(
    async (communityId: string) => {
      if (communityId === authSession.workspace.community.id) {
        setCommunityPickerOpen(false);
        return;
      }
      setSwitchingCommunityId(communityId);
      try {
        const nextSession = await switchCommunity(communityId);
        onAuthSession(nextSession);
        resetCommunityPicker();
        showToast(
          `Switched to ${nextSession.workspace.community.name}`,
          "success",
        );
        void queryClient.invalidateQueries({ queryKey: queryKeys.all() });
      } catch (caught) {
        showToast(
          caught instanceof Error
            ? caught.message
            : "Could not switch property",
          "error",
        );
      } finally {
        setSwitchingCommunityId(null);
      }
    },
    [
      authSession.workspace.community.id,
      onAuthSession,
      queryClient,
      resetCommunityPicker,
    ],
  );

  const showScrollView =
    tab !== "home" &&
    tab !== "sessions" &&
    tab !== "materials" &&
    tab !== "practice" &&
    tab !== "settings";
  const handleTabPress = useCallback(
    (nextTab: MainTab) => {
      const currentIndex = TAB_ITEMS.findIndex((item) => item.id === tab);
      const nextIndex = TAB_ITEMS.findIndex((item) => item.id === nextTab);
      setTabTransitionDirection(nextIndex >= currentIndex ? "forward" : "back");
      onTab(nextTab);
    },
    [onTab, tab],
  );

  const openSessionCheckIn = useCallback(async () => {
    if (checkInStartingRef.current) return;

    checkInStartingRef.current = true;
    setCheckInBinding({ sessionId: null, url: null });
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

  return (
    <View
      style={[
        st.flex1,
        (tab === "home" ||
          tab === "materials" ||
          tab === "sessions" ||
          tab === "practice" ||
          tab === "settings") &&
          homeSt.pageBg,
      ]}
    >
      {showScrollView && (
        <ScreenTransition
          transitionKey={`tab:${tab}`}
          direction={tabTransitionDirection}
        >
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={st.mainScroll}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={C.brand}
              />
            }
          >
            {error && (
              <ErrorBanner
                message={
                  error instanceof Error ? error.message : "Failed to load data"
                }
                onRetry={() => void onRefresh()}
              />
            )}
            {tab === "calendar" && (
              <CalendarScreen
                sessions={sessions}
                upcomingSessions={upcomingSessions}
                entrataEvents={calendarEvents}
                onSession={onSession}
                onReload={async () => {
                  await calendarQuery.refetch();
                }}
                onCommunityPress={() => setCommunityPickerOpen(true)}
                property={property}
              />
            )}
          </ScrollView>
        </ScreenTransition>
      )}

      {tab === "home" && (
        <ScreenTransition
          transitionKey="tab:home"
          direction={tabTransitionDirection}
        >
          <DashboardScreen
            sessions={sessions}
            upcomingSessions={upcomingSessions}
            materials={materials}
            materialCount={materials.length}
            tourLibrary={tourLibrary}
            loading={loading}
            materialsLoading={materialsLoading}
            refreshing={refreshing}
            error={error}
            onRefresh={onRefresh}
            onSession={onSession}
            onProfile={() => setProfileEditorOpen(true)}
            onCheckIn={() => void openSessionCheckIn()}
            onCreate={onCreate}
            onAudioTest={onAudioTest}
            onAssets={() => handleTabPress("materials")}
            onCommunityPress={() => setCommunityPickerOpen(true)}
            onSettings={() => handleTabPress("settings")}
            agentName={agentName}
            userTitle={
              profile?.title ??
              authSession.workspace.user.title ??
              "Leasing Consultant"
            }
            userPhone={
              profile?.phone ?? authSession.workspace.user.phone ?? null
            }
            userEmail={authSession.workspace.user.email}
            cardAccent={
              profile?.cardAccent ??
              authSession.workspace.user.cardAccent ??
              "#006CE5"
            }
            property={property}
          />
        </ScreenTransition>
      )}

      {tab === "sessions" && (
        <ScreenTransition
          transitionKey="tab:sessions"
          direction={tabTransitionDirection}
        >
          <SessionsListScreen
            authSession={authSession}
            onBack={() => handleTabPress("home")}
            onCommunityPress={() => setCommunityPickerOpen(true)}
            onSession={onSession}
            onSampleSession={onSampleSession}
            onCreate={onCreate}
            initialSessions={sessions}
            property={property}
          />
        </ScreenTransition>
      )}

      {tab === "materials" && (
        <ScreenTransition
          transitionKey="tab:materials"
          direction={tabTransitionDirection}
        >
          <MaterialsScreen
            materials={materials}
            tourLibrary={tourLibrary}
            loading={materialsLoading}
            refreshing={refreshing}
            onRefresh={onRefresh}
            onReload={async () => {
              await materialsQuery.refetch();
            }}
            property={property}
          />
        </ScreenTransition>
      )}

      {tab === "practice" && (
        <ScreenTransition
          transitionKey="tab:practice"
          direction={tabTransitionDirection}
        >
          <PracticeSessionsScreen
            property={property}
            onLiveChange={setPracticeLive}
          />
        </ScreenTransition>
      )}

      {tab === "settings" && (
        <ScreenTransition
          transitionKey="tab:settings"
          direction={tabTransitionDirection}
        >
          <SettingsScreen
            session={authSession}
            propertyWebsite={propertyWebsite}
            aiTrainingDataFeedback={
              profile?.aiTrainingDataFeedback ??
              authSession.workspace.user.aiTrainingDataFeedback ??
              false
            }
            onAiTrainingDataFeedback={async (enabled) => {
              const nextProfile = await updateProfile({
                aiTrainingDataFeedback: enabled,
              });
              await queryClient.invalidateQueries({
                queryKey: queryKeys.profile(),
              });
              onAuthSession({
                ...authSession,
                workspace: {
                  ...authSession.workspace,
                  user: {
                    ...authSession.workspace.user,
                    aiTrainingDataFeedback:
                      nextProfile.aiTrainingDataFeedback,
                  },
                },
              });
            }}
            onSessionChange={onAuthSession}
            onBack={() => handleTabPress("home")}
            onProfile={onProfile}
            onRubrics={onRubrics}
            onSignOut={onSignOut}
          />
        </ScreenTransition>
      )}

      {!practiceLive ? (
        <View style={st.tabBar}>
          <Reanimated.View
            pointerEvents="none"
            style={[st.tabBarIndicator, tabIndicatorStyle]}
          >
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
              <Ionicons
                name={tab === t.id ? t.iconActive : t.icon}
                size={22}
                color={tab === t.id ? C.brand : C.textMuted}
              />
              <Text
                style={[st.tabBarLabel, tab === t.id && st.tabBarLabelActive]}
              >
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <ProfileEditorModal
        visible={profileEditorOpen}
        session={authSession}
        onClose={() => setProfileEditorOpen(false)}
        onSaved={onAuthSession}
      />
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
          onClose={() => setCheckInOpen(false)}
          property={property}
          propertyId={
            authSession.workspace.community.propertyTygId ||
            authSession.workspace.community.id
          }
          agentName={agentName}
          repSlug={publicMemberAlias}
          sessionId={checkInBinding.sessionId}
          checkInUrl={checkInBinding.url}
          onCheckedIn={(sessionId) => {
            setCheckInOpen(false);
            setCheckInBinding(null);
            onSession(sessionId, { autoStartRecording: true });
          }}
        />
      ) : null}
    </View>
  );
}

// ═══════════════════════════════════════
// Error Banner
// ═══════════════════════════════════════

function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Card style={errorBannerSt.card}>
      <CardContent style={errorBannerSt.content}>
        <Ionicons name="cloud-offline-outline" size={18} color={C.red} />
        <UiText style={errorBannerSt.text} numberOfLines={2}>
          {message}
        </UiText>
        {onRetry ? (
          <Button
            variant="ghost"
            size="icon"
            onPress={onRetry}
            style={errorBannerSt.retry}
          >
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
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 0,
  },
  text: { flex: 1, fontSize: 14, fontWeight: "600", color: "#ef4444" },
  retry: { width: 36, height: 36 },
});

// ═══════════════════════════════════════
// Dashboard
// ═══════════════════════════════════════

function DashboardScreen({
  sessions,
  upcomingSessions,
  materials,
  materialCount,
  tourLibrary,
  loading,
  materialsLoading,
  refreshing,
  error,
  onRefresh,
  onSession,
  onProfile,
  onCheckIn,
  onCreate,
  onAudioTest,
  onAssets,
  onCommunityPress,
  onSettings,
  agentName,
  userTitle,
  userPhone,
  userEmail,
  cardAccent,
  property,
}: {
  sessions: SessionSummary[];
  upcomingSessions: SessionSummary[];
  materials: Material[];
  materialCount: number;
  tourLibrary: TourLibraryLink | null;
  loading: boolean;
  materialsLoading: boolean;
  refreshing: boolean;
  error: unknown;
  onRefresh: () => Promise<void>;
  onSession: (id: string, opts?: { autoStartRecording?: boolean }) => void;
  onProfile: () => void;
  onCheckIn: () => void;
  onCreate: () => void;
  onAudioTest: () => void;
  onAssets: () => void;
  onCommunityPress: () => void;
  onSettings: () => void;
  agentName: string;
  userTitle: string;
  userPhone: string | null;
  userEmail: string;
  cardAccent: string;
  property: string;
}) {
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(
    null,
  );
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });
  const { width: dashboardWidth } = useWindowDimensions();
  const assetTileWidth = Math.max(148, Math.min(168, (dashboardWidth - 40) / 2.15));
  const todayTours = useMemo(() => {
    const todayKey = new Date().toDateString();
    return upcomingSessions
      .filter(
        (session) =>
          session.status === "in_progress" ||
          (session.scheduledAt &&
            new Date(session.scheduledAt).toDateString() === todayKey),
      )
      .slice(0, 2);
  }, [upcomingSessions]);
  const initials = agentName
    .split(" ")
    .map((name) => name[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const accent = resolveCardAccent(cardAccent);

  return (
    <View style={[st.flex1, homeSt.pageBg]}>
      <Reanimated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[
          st.mainScroll,
          {
            paddingTop: insets.top + LARGE_TITLE_BAR_HEIGHT + 18,
            gap: 18,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={ACCENT}
          />
        }
      >
        {error ? (
          <ErrorBanner
            message={
              error instanceof Error ? error.message : "Failed to load data"
            }
            onRetry={() => void onRefresh()}
          />
        ) : null}
      <MotionPressable
        onPress={onProfile}
        haptic="selection"
        style={homeSt.profileCard}
      >
        <View style={[homeSt.profileHeader, { backgroundColor: accent }]} />
        <View style={homeSt.profileBody}>
          <View
            style={[homeSt.profileAvatarLarge, { backgroundColor: accent }]}
          >
            <CustomText
              textStyle="hero"
              style={[homeSt.profileAvatarLargeText, { color: CARD }]}
            >
              {initials}
            </CustomText>
          </View>
          <CustomText textStyle="hero" style={homeSt.profileNameLarge}>
            {agentName}
          </CustomText>
          <CustomText textStyle="body" style={homeSt.profileRoleLarge}>
            {userTitle || "Leasing Consultant"}
          </CustomText>
          <CustomText textStyle="body" style={homeSt.profileProperty}>
            {property}
          </CustomText>

          <View style={homeSt.contactList}>
            <ProfileContact icon="mail" text={userEmail || "team@tour.video"} />
            <ProfileContact
              icon="call"
              text={userPhone?.trim() || "Add phone in profile"}
            />
          </View>
          <CustomText textStyle="caption" style={homeSt.editProfileHint}>
            Tap to edit card color & details
          </CustomText>
        </View>
      </MotionPressable>

      <LiveRecordingCard />

      <View style={homeSt.actionPillRow}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            impactHaptic(Haptics.ImpactFeedbackStyle.Medium);
            onCheckIn();
          }}
          style={({ pressed }) => [
            homeSt.checkInPill,
            pressed && homeSt.actionPillPressed,
          ]}
        >
          <Ionicons name="navigate" size={21} color={CARD} />
          <CustomText textStyle="title" style={homeSt.checkInPillText}>
            Check-In
          </CustomText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            impactHaptic(Haptics.ImpactFeedbackStyle.Medium);
            onCreate();
          }}
          style={({ pressed }) => [
            homeSt.checkInPill,
            homeSt.newSessionPill,
            pressed && homeSt.actionPillPressed,
          ]}
        >
          <Ionicons name="mic" size={21} color={CARD} />
          <CustomText textStyle="title" style={homeSt.checkInPillText}>
            New Session
          </CustomText>
        </Pressable>
      </View>

      <View style={homeSt.sectionStack}>
        {todayTours.length > 0 && (
          <HomeSection title="Needs your attention">
            <View style={homeSt.focusStack}>
              {todayTours.map((session) => (
                <MotionPressable
                  key={session.id}
                  onPress={() => onSession(session.id)}
                  haptic="selection"
                  style={[homeSt.tourCard, homeSt.card]}
                >
                  <View style={st.flex1}>
                    <CustomText textStyle="title" numberOfLines={1}>
                      {buildSessionTourTitle({
                        title: session.title,
                        agentName: session.agentName,
                        prospectName:
                          session.prospectName ?? session.leads?.[0]?.name,
                      })}
                    </CustomText>
                    <View style={homeSt.tourMetaRow}>
                      <CustomText textStyle="micro" style={homeSt.timePill}>
                        {session.status === "in_progress"
                          ? "Now"
                          : session.scheduledAt
                            ? fmtTime(session.scheduledAt)
                            : "Today"}
                      </CustomText>
                      <CustomText
                        textStyle="caption"
                        numberOfLines={1}
                        style={homeSt.tourMeta}
                      >
                        {formatPersonName(session.prospectName) ??
                          formatPersonName(session.agentName) ??
                          "Guest ready for tour"}
                      </CustomText>
                    </View>
                    {formatSessionCardDescription(session) ? (
                      <CustomText
                        textStyle="caption"
                        numberOfLines={2}
                        style={homeSt.tourMeta}
                      >
                        {formatSessionCardDescription(session)}
                      </CustomText>
                    ) : null}
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={C.textMuted}
                  />
                </MotionPressable>
              ))}
            </View>
          </HomeSection>
        )}

        <HomeSection
          title="Assets"
          subtitle={
            !materialsLoading && materials.length === 0
              ? "Reusable tour assets will appear here."
              : undefined
          }
          action="Open"
          onAction={onAssets}
        >
          <View style={homeSt.assetPreviewStack}>
            {materialsLoading && materials.length === 0 ? (
              <View style={homeSt.assetPreviewLoading}>
                <LoadingDots size="small" color={ACCENT} />
                <CustomText textStyle="caption" style={homeSt.emptyInline}>
                  Loading property assets…
                </CustomText>
              </View>
            ) : materials.length > 0 ? (
              <ScrollView
                horizontal
                nestedScrollEnabled
                directionalLockEnabled
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToInterval={assetTileWidth + 8}
                disableIntervalMomentum
                style={homeSt.mediaRowBleed}
                contentContainerStyle={homeSt.mediaRow}
              >
                {materials.map((material) => {
                  const previewUrl = materialPreviewUrl(material);
                  const assetUrl = materialUrl(material);
                  const panorama = isPanoramaMaterial(material);
                  const canPlay = Boolean(
                    !panorama && assetUrl && isVideoLikeUrl(assetUrl),
                  );
                  const canOpen = Boolean(assetUrl);
                  return (
                    <MotionPressable
                      key={material.id}
                      accessibilityLabel={`Preview ${material.name}`}
                      onPress={() => setSelectedMaterial(material)}
                      haptic="selection"
                      style={[assetSt.card, { width: assetTileWidth }]}
                    >
                      <View style={assetSt.thumb}>
                        {previewUrl ? (
                          <Image
                            source={{ uri: previewUrl }}
                            style={assetSt.thumbImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={assetSt.fallbackIcon}>
                            <Ionicons
                              name={
                                canPlay
                                  ? "play"
                                  : canOpen
                                    ? "image-outline"
                                    : "document-outline"
                              }
                              size={22}
                              color={ACCENT}
                            />
                          </View>
                        )}
                        <LinearGradient
                          pointerEvents="none"
                          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.58)"]}
                          style={assetSt.captionFade}
                        />
                        {panorama ? (
                          <View style={assetSt.panoramaBadge}>
                            <Ionicons
                              name="globe-outline"
                              size={12}
                              color={CARD}
                            />
                            <CustomText
                              textStyle="micro"
                              style={assetSt.panoramaBadgeText}
                            >
                              360°
                            </CustomText>
                          </View>
                        ) : canPlay ? (
                          <View pointerEvents="none" style={assetSt.playWrap}>
                            <View style={assetSt.playBadge}>
                              <Ionicons name="play" size={13} color={CARD} />
                            </View>
                          </View>
                        ) : null}
                        <View pointerEvents="none" style={assetSt.caption}>
                          <CustomText
                            textStyle="title"
                            numberOfLines={1}
                            style={assetSt.captionTitle}
                          >
                            {material.name}
                          </CustomText>
                          <CustomText
                            textStyle="micro"
                            numberOfLines={1}
                            style={assetSt.captionMeta}
                          >
                            {material.type} · {fmtDate(material.createdAt)}
                          </CustomText>
                        </View>
                      </View>
                    </MotionPressable>
                  );
                })}
              </ScrollView>
            ) : null}

            <MotionPressable
              accessibilityLabel="Open property assets"
              onPress={onAssets}
              haptic="selection"
              style={homeSt.assetLinkCard}
            >
              <View
                style={[
                  homeSt.assetLinkIcon,
                  tourLibrary && homeSt.assetLinkIconConnected,
                ]}
              >
                <Ionicons
                  name={tourLibrary ? "play" : "folder-outline"}
                  size={22}
                  color={tourLibrary ? CARD : ACCENT}
                />
              </View>
              <View style={st.flex1}>
                <CustomText textStyle="title">
                  {tourLibrary
                    ? "Tour Library connected"
                    : "Local property assets"}
                </CustomText>
                <CustomText textStyle="micro" style={homeSt.assetLinkMeta}>
                  {tourLibrary
                    ? `${materialCount} local and Tour.video resources`
                    : `${materialCount} resources stored for this property`}
                </CustomText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
            </MotionPressable>
          </View>
        </HomeSection>
      </View>
      </Reanimated.ScrollView>
      <MaterialPreviewModal
        material={selectedMaterial}
        property={property}
        onClose={() => setSelectedMaterial(null)}
      />
      <LargeTitleHeader scrollY={scrollY} fadeStart={0} fadeEnd={44}>
        <CommunityTopBar
          property={property}
          onCommunityPress={onCommunityPress}
          left={<TourLogo width={74} />}
          right={
            <LiquidGlassIconButton
              icon="settings"
              iconSize={21}
              accessibilityLabel="Settings"
              onPress={onSettings}
            />
          }
        />
      </LargeTitleHeader>
    </View>
  );
}

function materialPreviewUrl(material: Material) {
  const candidate =
    material.media?.imageUrl ??
    material.media?.gifUrl ??
    (material.fileUrl &&
    /\.(?:jpe?g|png|gif)(?:[?#].*)?$/i.test(material.fileUrl)
      ? material.fileUrl
      : null);
  if (!candidate) return null;
  return candidate.startsWith("/")
    ? `${getApiBaseUrl()}${candidate}`
    : candidate;
}

function isPanoramaMaterial(material: Material) {
  if (
    /\/api\/recordings\/panorama-[^/]+\.jpe?g(?:[?#].*)?$/i.test(
      material.fileUrl ?? "",
    )
  ) {
    return true;
  }
  if (!material.parsedText) return false;
  try {
    const metadata = JSON.parse(material.parsedText) as {
      kind?: unknown;
      projection?: unknown;
    };
    return (
      metadata.kind === "panorama-360" ||
      metadata.projection === "equirectangular"
    );
  } catch {
    return false;
  }
}

async function openMaterial(material: Material) {
  const url = materialUrl(material);
  if (!url) return;
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(
      "Couldn't open media",
      "The video link is unavailable right now.",
    );
  }
}

function ProfileContact({
  icon,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}) {
  return (
    <View style={homeSt.profileContactRow}>
      <View style={homeSt.profileContactIcon}>
        <Ionicons name={icon} size={15} color={TEXT} />
      </View>
      <CustomText
        textStyle="body"
        numberOfLines={1}
        style={homeSt.profileContactText}
      >
        {text}
      </CustomText>
    </View>
  );
}

function HomeSection({
  title,
  subtitle,
  action,
  showLogo = false,
  onAction,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  showLogo?: boolean;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 12 }}>
      <View style={homeSt.sectionHeading}>
        <View style={homeSt.sectionHeader}>
          {showLogo && <TourLogo width={58} />}
          <CustomText textStyle="title" style={{ flex: 1 }}>
            {title}
          </CustomText>
          {action && (
            <Pressable
              onPress={onAction}
              disabled={!onAction}
              hitSlop={8}
              style={({ pressed }) => [
                homeSt.sectionActionHit,
                pressed && st.pressed,
              ]}
            >
              <CustomText textStyle="label" style={homeSt.sectionAction}>
                {action}
              </CustomText>
              <Ionicons name="arrow-forward" size={14} color={ACCENT} />
            </Pressable>
          )}
        </View>
        {subtitle ? (
          <CustomText textStyle="caption" style={homeSt.sectionSubtitle}>
            {subtitle}
          </CustomText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function MetricCard({
  icon,
  label,
  value,
  color,
  delay = 0,
  live = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
  delay?: number;
  live?: boolean;
}) {
  return (
    <Reanimated.View
      entering={FadeInUp.delay(delay).duration(360).springify()}
      style={homeSt.metricCard}
    >
      <Card style={metricSt.card}>
        <CardContent style={metricSt.content}>
          {live ? (
            <PulseDot color={color} />
          ) : (
            <Ionicons name={icon} size={20} color={color} />
          )}
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
  value: {
    fontSize: 24,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
    color: C.text,
  },
  label: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    color: C.textMuted,
  },
});

function CardRow({
  icon,
  title,
  sub,
  onPress,
  destructive = false,
  trailing,
  disabled = false,
  accessibilityRole = "button",
  accessibilityState,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
  onPress: () => void;
  destructive?: boolean;
  trailing?: React.ReactNode;
  disabled?: boolean;
  accessibilityRole?: "button" | "switch" | "link";
  accessibilityState?: { checked?: boolean };
}) {
  return (
    <MotionPressable
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      disabled={disabled}
      haptic="selection"
      onPress={onPress}
      style={settingsSt.card}
    >
      <View
        style={[
          settingsSt.iconWrap,
          destructive && settingsSt.iconWrapDestructive,
        ]}
      >
        <Ionicons
          name={icon}
          size={20}
          color={destructive ? C.red : ACCENT}
        />
      </View>
      <View style={st.flex1}>
        <CustomText
          textStyle="title"
          style={destructive ? settingsSt.destructiveTitle : undefined}
        >
          {title}
        </CustomText>
        <CustomText textStyle="caption" style={settingsSt.rowSub}>
          {sub}
        </CustomText>
      </View>
      {trailing ?? (
        <Ionicons
          name={destructive ? "log-out-outline" : "chevron-forward"}
          size={18}
          color={destructive ? C.red : C.textMuted}
        />
      )}
    </MotionPressable>
  );
}

function SessionRow({
  session,
  onPress,
  isLast,
}: {
  session: SessionSummary;
  onPress: () => void;
  isLast: boolean;
}) {
  const colors = session.id.startsWith("local:")
    ? { bg: C.amberBg, text: C.amber }
    : (STATUS_COLORS[session.status] ?? { bg: "#eaf4ff", text: C.brand });
  const label = sessionStatusLabel(session);
  return (
    <MotionPressable
      onPress={onPress}
      haptic="selection"
      style={[st.sessionRow, !isLast && st.rowBorder]}
    >
      <View style={st.flex1}>
        <Text style={st.sessionTitle} numberOfLines={1}>
          {session.title}
        </Text>
        <Text style={st.sessionMeta} numberOfLines={1}>
          {formatSessionCardMeta(session)}
        </Text>
        {formatSessionCardDescription(session) ? (
          <Text style={st.sessionMeta} numberOfLines={2}>
            {formatSessionCardDescription(session)}
          </Text>
        ) : null}
      </View>
      <TourStatusBadge label={label} bg={colors.bg} color={colors.text} />
      {session.overallScore !== null && (
        <Text
          style={[st.scoreNum, { color: scoreColor(session.overallScore) }]}
        >
          {session.overallScore}%
        </Text>
      )}
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

const SORT_OPTS: {
  value: SortOption;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
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
  const needsReview = ["uploaded", "failed", "analysis_ready"].includes(
    session.status,
  );
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
            style={({ pressed }) => [
              slst.deleteAction,
              (pressed || isDeleting) && slst.deleteActionPressed,
            ]}
          >
            {isDeleting ? (
              <LoadingDots color={CARD} size="small" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={20} color={CARD} />
                <CustomText textStyle="micro" style={slst.deleteActionText}>
                  Delete
                </CustomText>
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
        style={[slst.sessionCard, isDeleting && slst.sessionCardDeleting]}
        disabled={isDeleting}
      >
        <View style={st.flex1}>
          <View style={slst.sessionNameRow}>
            {session.status === "in_progress" && <PulseDot color="#f04438" />}
            <CustomText textStyle="title" style={slst.sessionName} numberOfLines={1}>
              {session.title}
            </CustomText>
          </View>
          <CustomText textStyle="caption" style={slst.sessionMeta} numberOfLines={1}>
            {checkedInSummary || formatSessionCardMeta(session)}
          </CustomText>
          {formatSessionCardDescription(session) ? (
            <CustomText textStyle="caption" numberOfLines={2} style={slst.sessionDescription}>
              {formatSessionCardDescription(session)}
            </CustomText>
          ) : null}
        </View>
        <View style={slst.sessionRight}>
          <View style={[slst.syncBadge, badgeReviewStyle && slst.reviewBadge]}>
            <CustomText
              textStyle="micro"
              style={[slst.syncText, badgeReviewStyle && slst.reviewText]}
            >
              {badgeLabel}
            </CustomText>
          </View>
          {session.overallScore !== null && (
            <CustomText textStyle="title" style={slst.sessionScore}>
              {session.overallScore}
            </CustomText>
          )}
        </View>
      </MotionPressable>
    </Swipeable>
  );
}

function SampleSessionListRow({
  session,
  onOpen,
}: {
  session: SessionSummary;
  onOpen: () => void;
}) {
  return (
    <MotionPressable
      onPress={onOpen}
      haptic="selection"
      style={[slst.sessionCard, slst.sampleSessionCard]}
    >
      <View style={slst.sampleSessionIcon}>
        <Ionicons name="sparkles" size={18} color={C.purple} />
      </View>
      <View style={st.flex1}>
        <CustomText textStyle="title" style={slst.sessionName} numberOfLines={1}>
          {session.title}
        </CustomText>
        <CustomText textStyle="caption" style={slst.sessionMeta} numberOfLines={1}>
          {[session.location, session.prospectName]
            .filter(Boolean)
            .join(" · ") || "40Fifty Lofts example"}
        </CustomText>
      </View>
      <View style={slst.sessionRight}>
        <View style={slst.sampleBadge}>
          <CustomText textStyle="micro" style={slst.sampleBadgeText}>
            SAMPLE
          </CustomText>
        </View>
        {session.overallScore !== null && (
          <CustomText textStyle="title" style={slst.sessionScore}>
            {session.overallScore}
          </CustomText>
        )}
      </View>
      <Ionicons name="chevron-forward" size={17} color={C.textMuted} />
    </MotionPressable>
  );
}

function SessionsListScreen({
  authSession,
  onSession,
  onSampleSession,
  onCreate,
  initialSessions,
  property,
}: {
  authSession: MobileAuthSession;
  onBack: () => void;
  onCommunityPress: () => void;
  onSession: (id: string) => void;
  onSampleSession: (id: string) => void;
  onCreate: () => void;
  initialSessions: SessionSummary[];
  property: string;
}) {
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showSamples, setShowSamples] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const search = useAppStore((state) => state.sessionsSearch);
  const statusFilter = useAppStore((state) => state.sessionsStatusFilter);
  const sort = useAppStore((state) => state.sessionsSort);
  const showSearch = useAppStore((state) => state.showSessionsSearch);
  const setSearch = useAppStore((state) => state.setSessionsSearch);
  const setStatusFilter = useAppStore((state) => state.setSessionsStatusFilter);
  const setSort = useAppStore((state) => state.setSessionsSort);
  const setShowSearch = useAppStore((state) => state.setShowSessionsSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const deleteSessionMutation = useDeleteSessionMutation();

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const openSwipeableRef = useRef<SwipeableMethods | null>(null);

  const teamMembers = useMemo(() => {
    const seen = new Set<string>();
    return authSession.workspace.community.teamMembers
      .map((member) => ({
        ...member,
        agentId:
          member.alias?.trim() || member.id?.trim() || member.email.trim(),
      }))
      .filter((member) => {
        const key = member.email.trim().toLowerCase();
        if (!member.agentId || !key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((left, right) =>
        left.name.localeCompare(right.name, undefined, { sensitivity: "base" }),
      );
  }, [authSession.workspace.community.teamMembers]);
  const currentTeamMember = useMemo(() => {
    const currentEmail = authSession.workspace.user.email.trim().toLowerCase();
    return (
      teamMembers.find(
        (member) =>
          member.userId === authSession.workspace.user.id ||
          member.email.trim().toLowerCase() === currentEmail,
      ) ?? null
    );
  }, [
    authSession.workspace.user.email,
    authSession.workspace.user.id,
    teamMembers,
  ]);
  const currentAgentId =
    currentTeamMember?.agentId ?? `user:${authSession.workspace.user.id}`;
  const selectedTeamMember =
    teamMembers.find((member) => member.agentId === selectedAgentId) ?? null;
  const sessionViewLabel = showSamples
    ? "Samples"
    : selectedAgentId
      ? selectedAgentId === currentAgentId
        ? "You"
        : (selectedTeamMember?.name ?? "Team member")
      : "Your Team";

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => setDebouncedSearch(search),
      search ? 350 : 0,
    );
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const sessionsQuery = useInfiniteSessionsQuery({
    limit: SESSIONS_PAGE_SIZE,
    sort,
    search: debouncedSearch.trim() || undefined,
    agentId: showSamples ? undefined : (selectedAgentId ?? undefined),
  });

  // Remote-only list. Local folders hold in-flight live audio, not session cards.
  const fetchedSessions = useMemo(
    () =>
      sessionsQuery.data?.pages.flatMap((pageData) => pageData.sessions) ?? [],
    [sessionsQuery.data],
  );
  const canUseInitialSessions =
    sort === "newest" &&
    !debouncedSearch.trim() &&
    selectedAgentId === null &&
    !showSamples;
  const sessions =
    sessionsQuery.isSuccess || fetchedSessions.length > 0
      ? fetchedSessions
      : canUseInitialSessions
        ? initialSessions.slice(0, SESSIONS_PAGE_SIZE)
        : [];
  const sampleSessionsQuery = useSampleSessionsQuery(showSamples);
  const sampleSessions = sampleSessionsQuery.data?.sessions ?? [];
  const samplePropertyName =
    sampleSessionsQuery.data?.propertyName ?? "1540 Place Apartments";
  const visibleSessions = showSamples ? sampleSessions : sessions;
  const hasMore = sessionsQuery.hasNextPage;
  const loading = sessionsQuery.isLoading && sessions.length === 0;
  const loadingMore = sessionsQuery.isFetchingNextPage;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await drainSyncOutbox();
    const requests: Promise<unknown>[] = [sessionsQuery.refetch()];
    if (showSamples) requests.push(sampleSessionsQuery.refetch());
    await Promise.all(requests);
    setRefreshing(false);
  }, [sampleSessionsQuery, sessionsQuery, showSamples]);

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

  const performDeleteSession = useCallback(
    async (sessionId: string) => {
      if (deletingId) return;
      setDeletingId(sessionId);
      closeOpenSwipeable();
      try {
        await deleteSessionMutation.mutateAsync(sessionId);
        showToast("Session deleted", "success");
      } catch (caught) {
        showToast(
          caught instanceof Error ? caught.message : "Could not delete session",
          "error",
        );
      } finally {
        setDeletingId(null);
      }
    },
    [closeOpenSwipeable, deleteSessionMutation, deletingId],
  );

  const confirmDeleteSession = useCallback(
    (session: SessionSummary) => {
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
    },
    [closeOpenSwipeable, performDeleteSession],
  );

  const openSession = useCallback(
    (session: SessionSummary) => {
      onSession(session.id);
    },
    [onSession],
  );

  const listSessions = useMemo(() => {
    return visibleSessions.filter((session) => {
      if (showSamples) return true;
      if (statusFilter === "all") return true;
      if (statusFilter === "needs_review")
        return ["uploaded", "failed", "analysis_ready"].includes(
          session.status,
        );
      if (statusFilter === "feedback")
        return (
          ["analysis_ready", "reviewed"].includes(session.status) ||
          session.overallScore !== null
        );
      return true;
    });
  }, [showSamples, statusFilter, visibleSessions]);

  const sessionMetrics = useMemo(
    () => computeDashboardMetrics(visibleSessions),
    [visibleSessions],
  );
  const averageScore =
    sessionMetrics.averageScore !== null
      ? `${sessionMetrics.averageScore}%`
      : "--";

  const renderItem = useCallback(
    ({ item: session }: { item: SessionSummary }) => {
      if (showSamples) {
        return (
          <SampleSessionListRow
            session={session}
            onOpen={() => onSampleSession(session.id)}
          />
        );
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
    },
    [
      closeOpenSwipeable,
      confirmDeleteSession,
      deletingId,
      handleSwipeClose,
      handleSwipeOpen,
      onSampleSession,
      onSession,
      openSession,
      showSamples,
    ],
  );

  const keyExtractor = useCallback((item: SessionSummary) => item.id, []);
  const activeFilterCount =
    Number(selectedAgentId !== null || showSamples) +
    Number(statusFilter !== "all") +
    Number(sort !== "newest");
  const selectSessionView = useCallback(
    (agentId: string | null, samples = false) => {
      selectionHaptic();
      setSelectedAgentId(agentId);
      setShowSamples(samples);
      setFiltersOpen(false);
    },
    [],
  );

  const ListHeader = useMemo(
    () => (
      <View style={slst.header}>
        <View style={slst.titleRow}>
          <View style={st.flex1}>
            <LargeTitleCopy
              title={showSamples ? "Sample sessions" : "Sessions"}
              subtitle={
                showSamples
                  ? `Curated from ${samplePropertyName} · Read only`
                  : `${property} · ${sessionViewLabel}`
              }
              scrollY={scrollY}
            />
          </View>
          {loading ? (
            <View style={slst.avgPill}>
              <View style={slst.metricSkeletonIcon} />
              <View style={slst.metricSkeletonValue} />
              <View style={slst.metricSkeletonLabel} />
            </View>
          ) : (
            <View style={slst.avgPill}>
              <Ionicons
                name="analytics-outline"
                size={14}
                color={
                  sessionMetrics.averageScore !== null
                    ? scoreColor(sessionMetrics.averageScore)
                    : ACCENT
                }
              />
              <CustomText textStyle="title" style={slst.avgPillValue}>
                {averageScore}
              </CustomText>
              <CustomText textStyle="micro" style={slst.avgPillLabel}>
                Avg
              </CustomText>
            </View>
          )}
        </View>

        {showSamples ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowSamples(false)}
            style={slst.sampleModeBanner}
          >
            <View style={slst.sampleModeIcon}>
              <Ionicons name="sparkles" size={16} color={C.purple} />
            </View>
            <View style={st.flex1}>
              <CustomText textStyle="title" style={slst.sampleModeTitle}>
                Exploring real examples
              </CustomText>
              <CustomText textStyle="caption" style={slst.sampleModeSub}>
                These never affect {property}’s sessions or scores.
              </CustomText>
            </View>
            <CustomText textStyle="label" style={slst.sampleModeAction}>
              Back
            </CustomText>
          </Pressable>
        ) : null}
      </View>
    ),
    [
      averageScore,
      loading,
      property,
      samplePropertyName,
      scrollY,
      sessionMetrics.averageScore,
      sessionViewLabel,
      showSamples,
    ],
  );

  const ListFooter = useMemo(() => {
    if (showSamples) return null;
    if (loadingMore)
      return (
        <LoadingDots style={{ paddingVertical: 20 }} color={ACCENT} />
      );
    if (!hasMore && sessions.length > 0)
      return (
        <CustomText textStyle="caption" style={slst.endText}>
          All sessions loaded
        </CustomText>
      );
    return null;
  }, [hasMore, loadingMore, sessions.length, showSamples]);

  const ListEmpty = useMemo(() => {
    if (loading || (showSamples && sampleSessionsQuery.isLoading))
      return (
        <View style={{ paddingTop: 20 }}>
          <LoadingShimmer rows={5} />
        </View>
      );
    if (showSamples && sampleSessionsQuery.error) {
      return (
        <View style={{ gap: 12 }}>
          <ErrorBanner
            message={
              sampleSessionsQuery.error instanceof Error
                ? sampleSessionsQuery.error.message
                : "Could not load sample sessions"
            }
            onRetry={() => void sampleSessionsQuery.refetch()}
          />
          <PrimaryBtn
            label="Back to my sessions"
            icon="arrow-back"
            onPress={() => setShowSamples(false)}
          />
        </View>
      );
    }
    if (showSamples) {
      return (
        <EmptyState
          icon="albums-outline"
          title="Samples unavailable"
          subtitle="The curated examples could not be loaded."
        />
      );
    }
    if (!search && statusFilter === "all") {
      return (
        <Reanimated.View
          entering={FadeInDown.duration(280).springify()}
          style={slst.sampleEmptyCard}
        >
          <View style={slst.sampleEmptyIcon}>
            <Ionicons name="sparkles" size={25} color={C.purple} />
          </View>
          <CustomText textStyle="hero" style={slst.sampleEmptyTitle}>
            No sessions yet
          </CustomText>
          <CustomText textStyle="body" style={slst.sampleEmptySub}>
            Record a new session to get started.
          </CustomText>
          <View style={slst.emptyActions}>
            <MotionPressable
              onPress={() => setShowSamples(true)}
              haptic="selection"
              style={slst.samplePrimaryButton}
            >
              <Ionicons name="play-circle-outline" size={20} color={CARD} />
              <CustomText textStyle="title" style={slst.samplePrimaryText}>
                View sample sessions
              </CustomText>
              <Ionicons name="arrow-forward" size={18} color={CARD} />
            </MotionPressable>
            <MotionPressable
              onPress={onCreate}
              haptic="medium"
              style={slst.emptySecondaryButton}
            >
              <Ionicons name="mic-outline" size={20} color={ACCENT} />
              <CustomText textStyle="title" style={slst.emptySecondaryText}>
                Record new session
              </CustomText>
              <Ionicons name="arrow-forward" size={18} color={ACCENT} />
            </MotionPressable>
          </View>
        </Reanimated.View>
      );
    }
    return (
      <EmptyState
        icon={
          search || statusFilter !== "all" ? "search-outline" : "albums-outline"
        }
        title={
          search || statusFilter !== "all"
            ? "No matching sessions"
            : "No sessions yet"
        }
        subtitle="Recent tours will appear here"
      />
    );
  }, [
    loading,
    onCreate,
    sampleSessionsQuery,
    search,
    sessions.length,
    showSamples,
    statusFilter,
  ]);

  return (
    <View style={[st.flex1, homeSt.pageBg]}>
      <Reanimated.FlatList
        style={st.flex1}
        scrollEnabled
        nestedScrollEnabled
        data={listSessions}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onScroll={onScroll}
        scrollEventThrottle={16}
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
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        updateCellsBatchingPeriod={32}
        windowSize={7}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ACCENT}
          />
        }
        contentContainerStyle={[
          slst.list,
          { paddingTop: largeTitleContentInset(insets.top) },
        ]}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
      />
      <LargeTitleHeader
        title={showSamples ? "Sample sessions" : "Sessions"}
        scrollY={scrollY}
        hideCompactTitle={showSearch}
        trailing={
          <>
            <LiquidGlassSearch
              expanded={showSearch}
              value={search}
              onChangeText={setSearch}
              onExpand={() => setShowSearch(true)}
              onCollapse={() => {
                setShowSearch(false);
                Keyboard.dismiss();
              }}
              placeholder="Search sessions"
            />
            <View style={slst.filterHeaderSlot}>
              <LiquidGlassIconButton
                icon="options-outline"
                accessibilityLabel="Open session filters"
                onPress={() => setFiltersOpen(true)}
              />
              {activeFilterCount > 0 ? (
                <View pointerEvents="none" style={slst.filterHeaderBadge}>
                  <CustomText
                    textStyle="micro"
                    style={slst.filterHeaderBadgeText}
                  >
                    {activeFilterCount}
                  </CustomText>
                </View>
              ) : null}
            </View>
          </>
        }
      />
      <Modal
        visible={filtersOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        allowSwipeDismissal
        onRequestClose={() => setFiltersOpen(false)}
      >
        <View style={slst.filterModalRoot}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              slst.filterModalContent,
              {
                paddingTop: 6 + 56 + 8,
                paddingBottom: Math.max(insets.bottom, 16) + 24,
              },
            ]}
          >
          <View style={slst.filterSheetSection}>
            <CustomText textStyle="micro" style={slst.filterSheetLabel}>
              Sessions
            </CustomText>
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{
                checked: !showSamples && selectedAgentId === null,
              }}
              onPress={() => selectSessionView(null)}
              style={[
                slst.filterViewRow,
                !showSamples &&
                  selectedAgentId === null &&
                  slst.filterViewRowActive,
              ]}
            >
              <View
                style={[
                  slst.filterViewIcon,
                  !showSamples &&
                    selectedAgentId === null &&
                    slst.filterViewIconActive,
                ]}
              >
                <Ionicons
                  name="people"
                  size={18}
                  color={
                    !showSamples && selectedAgentId === null
                      ? ACCENT
                      : C.textSec
                  }
                />
              </View>
              <View style={st.flex1}>
                <CustomText textStyle="title" style={slst.filterViewTitle}>
                  Your Team
                </CustomText>
                <CustomText textStyle="caption" style={slst.filterViewSubtitle}>
                  Sessions from everyone at this property
                </CustomText>
              </View>
              {!showSamples && selectedAgentId === null ? (
                <Ionicons name="checkmark-circle" size={20} color={ACCENT} />
              ) : null}
            </Pressable>
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{
                checked: !showSamples && selectedAgentId === currentAgentId,
              }}
              onPress={() => selectSessionView(currentAgentId)}
              style={[
                slst.filterViewRow,
                !showSamples &&
                  selectedAgentId === currentAgentId &&
                  slst.filterViewRowActive,
              ]}
            >
              <View
                style={[
                  slst.filterViewIcon,
                  !showSamples &&
                    selectedAgentId === currentAgentId &&
                    slst.filterViewIconActive,
                ]}
              >
                <Ionicons
                  name="person"
                  size={18}
                  color={
                    !showSamples && selectedAgentId === currentAgentId
                      ? ACCENT
                      : C.textSec
                  }
                />
              </View>
              <View style={st.flex1}>
                <CustomText textStyle="title" style={slst.filterViewTitle}>
                  You
                </CustomText>
                <CustomText textStyle="caption" style={slst.filterViewSubtitle}>
                  {currentTeamMember?.name ||
                    authSession.workspace.user.fullName ||
                    authSession.workspace.user.email}
                </CustomText>
              </View>
              {!showSamples && selectedAgentId === currentAgentId ? (
                <Ionicons name="checkmark-circle" size={20} color={ACCENT} />
              ) : null}
            </Pressable>
          </View>

          {teamMembers.some((member) => member.agentId !== currentAgentId) ? (
            <View style={slst.filterSheetSection}>
              <CustomText textStyle="micro" style={slst.filterSheetLabel}>
                Team members
              </CustomText>
              {teamMembers
                .filter((member) => member.agentId !== currentAgentId)
                .map((member) => {
                  const active =
                    !showSamples && selectedAgentId === member.agentId;
                  const initials =
                    member.name
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase())
                      .join("") || "?";
                  return (
                    <Pressable
                      key={member.agentId}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      onPress={() => selectSessionView(member.agentId)}
                      style={[
                        slst.filterViewRow,
                        active && slst.filterViewRowActive,
                      ]}
                    >
                      <View
                        style={[
                          slst.filterMemberAvatar,
                          active && slst.filterViewIconActive,
                        ]}
                      >
                        <CustomText
                          textStyle="title"
                          style={[
                            slst.filterMemberInitials,
                            active && slst.filterMemberInitialsActive,
                          ]}
                        >
                          {initials}
                        </CustomText>
                      </View>
                      <View style={st.flex1}>
                        <CustomText
                          textStyle="title"
                          style={slst.filterViewTitle}
                        >
                          {member.name}
                        </CustomText>
                        <CustomText
                          textStyle="caption"
                          style={slst.filterViewSubtitle}
                        >
                          {member.title || member.role || member.email}
                        </CustomText>
                      </View>
                      {active ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color={ACCENT}
                        />
                      ) : null}
                    </Pressable>
                  );
                })}
            </View>
          ) : null}

          <View style={slst.filterSheetSection}>
            <CustomText textStyle="micro" style={slst.filterSheetLabel}>
              Status
            </CustomText>
            <View style={slst.filterOptions}>
              {FILTER_CHIPS.map((chip) => {
                const active = statusFilter === chip.value;
                return (
                  <Pressable
                    key={chip.value}
                    onPress={() => {
                      selectionHaptic();
                      setStatusFilter(chip.value);
                    }}
                    style={[
                      slst.filterOption,
                      active && slst.filterOptionActive,
                    ]}
                  >
                    <CustomText
                      textStyle="label"
                      style={[
                        slst.filterOptionText,
                        active && slst.filterOptionTextActive,
                      ]}
                    >
                      {chip.label}
                    </CustomText>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={slst.filterSheetSection}>
            <CustomText textStyle="micro" style={slst.filterSheetLabel}>
              Sort by
            </CustomText>
            <View style={slst.filterOptions}>
              {SORT_OPTS.map((option) => {
                const active = sort === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      selectionHaptic();
                      setSort(option.value);
                    }}
                    style={[
                      slst.filterOption,
                      active && slst.filterOptionActive,
                    ]}
                  >
                    <Ionicons
                      name={option.icon}
                      size={15}
                      color={active ? ACCENT : C.textMuted}
                    />
                    <CustomText
                      textStyle="label"
                      style={[
                        slst.filterOptionText,
                        active && slst.filterOptionTextActive,
                      ]}
                    >
                      {option.label}
                    </CustomText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>
          <View pointerEvents="box-none" style={slst.filterModalHeaderWrap}>
            <LinearGradient
              colors={[
                BACKGROUND,
                "rgba(242, 242, 247, 0.62)",
                "rgba(242, 242, 247, 0)",
              ]}
              locations={[0, 0.5, 1]}
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
            />
            <View pointerEvents="box-none" style={slst.filterModalHeader}>
              <CustomText textStyle="hero" style={st.flex1}>
                Filter
              </CustomText>
              <LiquidGlassIconButton
                icon="close"
                accessibilityLabel="Close filters"
                onPress={() => setFiltersOpen(false)}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const slst = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 120 },
  header: { gap: 28, marginBottom: 20 },
  sampleHeadingSub: {
    marginTop: 3,
    color: C.textMuted,
  },
  metricSkeletonIcon: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: BACKGROUND,
  },
  metricSkeletonValue: {
    width: 22,
    height: 15,
    borderRadius: 5,
    backgroundColor: BACKGROUND,
  },
  metricSkeletonLabel: {
    width: 18,
    height: 9,
    borderRadius: 4,
    backgroundColor: BACKGROUND,
  },
  sampleModeBanner: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 12,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  sampleModeIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: C.purpleBg,
  },
  sampleModeTitle: {},
  sampleModeSub: {
    marginTop: 2,
    color: C.textSec,
    lineHeight: 15,
  },
  sampleModeAction: { color: ACCENT },
  sampleEmptyCard: {
    alignItems: "center",
    gap: 12,
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderRadius: LARGE_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  sampleEmptyIcon: {
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: C.purpleBg,
  },
  sampleEmptyTitle: {
    letterSpacing: -0.25,
  },
  sampleEmptySub: {
    maxWidth: 330,
    color: C.textSec,
    textAlign: "center",
  },
  emptyActions: { alignSelf: "stretch", gap: 9, marginTop: 3 },
  samplePrimaryButton: {
    alignSelf: "stretch",
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 2,
    paddingHorizontal: 16,
    borderRadius: 25,
    backgroundColor: ACCENT,
  },
  samplePrimaryText: {
    flex: 1,
    color: CARD,
    textAlign: "center",
  },
  emptySecondaryButton: {
    alignSelf: "stretch",
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 16,
    borderRadius: 25,
    backgroundColor: BACKGROUND,
  },
  emptySecondaryText: {
    flex: 1,
    color: ACCENT,
    textAlign: "center",
  },
  filterHeaderSlot: {
    width: 42,
    height: 42,
    overflow: "visible",
  },
  filterHeaderBadge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: ACCENT,
  },
  filterHeaderBadgeText: { color: CARD, fontSize: 10 },
  filterCount: {
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: ACCENT,
  },
  filterCountText: { color: CARD, fontSize: 10 },
  sep: { height: 1, backgroundColor: BACKGROUND },
  endText: {
    textAlign: "center",
    paddingVertical: 20,
    color: C.textMuted,
  },
  skeleton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 6,
  },
  skelBar: { height: 12, borderRadius: 6, backgroundColor: BACKGROUND },
  filterModalRoot: {
    flex: 1,
    overflow: "visible",
    backgroundColor: BACKGROUND,
  },
  filterModalHeaderWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 6 + 56 + 56,
    zIndex: 20,
    overflow: "visible",
    backgroundColor: "transparent",
  },
  filterModalHeader: {
    minHeight: 56,
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    overflow: "visible",
    zIndex: 2,
  },
  filterModalContent: {
    gap: 18,
    paddingHorizontal: 16,
  },
  filterSheetSection: { gap: 8 },
  filterSheetLabel: {
    color: C.textMuted,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  filterViewRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  filterViewRowActive: { backgroundColor: "#eff6ff" },
  filterViewIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: BACKGROUND,
  },
  filterViewIconActive: { backgroundColor: "#dbeafe" },
  filterViewTitle: {},
  filterViewSubtitle: {
    marginTop: 2,
    color: C.textMuted,
    lineHeight: 14,
  },
  filterMemberAvatar: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    backgroundColor: BACKGROUND,
  },
  filterMemberInitials: { color: C.textSec, fontSize: 12 },
  filterMemberInitialsActive: { color: ACCENT },
  filterOptions: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  filterOption: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    borderRadius: 18,
    backgroundColor: CARD,
  },
  filterOptionActive: { backgroundColor: "#eff6ff" },
  filterOptionText: { color: C.textSec },
  filterOptionTextActive: { color: ACCENT },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  avgPill: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: CARD,
  },
  avgPillValue: {
    fontVariant: ["tabular-nums"],
  },
  avgPillLabel: {
    color: C.textMuted,
    textTransform: "uppercase",
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: CARD,
  },
  filterChipActive: { backgroundColor: "#eff6ff" },
  filterChipText: { color: C.textSec },
  filterChipTextActive: { color: ACCENT },
  attentionChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: CARD,
  },
  attentionText: { color: "#f59e0b" },
  swipeContainer: {
    marginBottom: 10,
    borderRadius: SMALL_CORNER,
    overflow: "hidden",
  },
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
  deleteActionText: { color: CARD },
  sessionCard: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 15,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  sampleSessionCard: {
    marginBottom: 10,
    backgroundColor: CARD,
  },
  sampleSessionIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: C.purpleBg,
  },
  sampleBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: C.purpleBg,
  },
  sampleBadgeText: { color: C.purple, fontSize: 8 },
  sessionCardDeleting: { opacity: 0.55 },
  sessionNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  sessionName: { flex: 1, fontSize: 15 },
  sessionMeta: { color: C.textSec, marginTop: 5 },
  sessionDescription: {
    color: C.textSec,
    marginTop: 4,
    lineHeight: 16,
  },
  sessionRight: { alignItems: "flex-end", gap: 5 },
  syncBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: "#ebf5ff",
  },
  syncText: { color: ACCENT, fontSize: 9 },
  reviewBadge: { backgroundColor: "#fffbeb" },
  reviewText: { color: "#f59e0b" },
  sessionScore: { fontVariant: ["tabular-nums"] },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#f04438" },
});

// ═══════════════════════════════════════
// Calendar
// ═══════════════════════════════════════

const calSt = StyleSheet.create({
  upcomingBlock: { gap: 12 },
  upcomingHeaderCount: {
    minWidth: 30,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 9,
    borderRadius: 14,
    backgroundColor: C.brand + "12",
  },
  upcomingHeaderCountText: { color: C.brand, fontSize: 11, fontWeight: "900" },
  upcomingGroups: { gap: 16 },
  upcomingGroup: { gap: 8 },
  upcomingGroupHeader: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 2,
  },
  upcomingGroupMarker: {
    width: 4,
    height: 30,
    borderRadius: 2,
    backgroundColor: C.brand,
  },
  upcomingGroupLabel: { color: C.text, fontSize: 13, fontWeight: "900" },
  upcomingGroupDate: {
    color: C.textMuted,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  upcomingGroupCount: {
    minWidth: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 7,
    borderRadius: 12,
    backgroundColor: "#EEF4FF",
  },
  upcomingGroupCountText: { color: C.brand, fontSize: 10, fontWeight: "900" },
  selectedDayBlock: { gap: 10 },
  selectedDayHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 2,
  },
  selectedDayEyebrow: {
    color: C.brand,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  selectedDayTitle: {
    color: C.text,
    fontSize: 19,
    fontWeight: "900",
    marginTop: 2,
  },
  selectedDayCount: {
    minWidth: 30,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 9,
    borderRadius: 14,
    backgroundColor: "#F2F4F7",
  },
  selectedDayCountText: { color: C.textSec, fontSize: 11, fontWeight: "900" },
  connectionFooter: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: "#e6ebf2",
  },
  connectionIcon: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: "#ecfdf3",
  },
  connectionTitle: { color: C.text, fontSize: 12, fontWeight: "900" },
  connectionMeta: {
    color: C.textMuted,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  liveStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#ecfdf3",
  },
  liveStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.green,
  },
  liveStatusText: { color: C.green, fontSize: 9, fontWeight: "900" },
});

function CalendarScreen({
  sessions,
  upcomingSessions,
  entrataEvents,
  onSession,
  onReload,
  onCommunityPress,
  property,
}: {
  sessions: SessionSummary[];
  upcomingSessions: SessionSummary[];
  entrataEvents: CalendarEvent[];
  onSession: (id: string) => void;
  onReload: () => Promise<void>;
  onCommunityPress: () => void;
  property: string;
}) {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  const [monthOffset, setMonthOffset] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const viewDate = useMemo(
    () => new Date(today.getFullYear(), today.getMonth() + monthOffset, 1),
    [monthOffset],
  );
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthLabel = viewDate.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const itemsByDay = useMemo(() => {
    const map: Record<
      number,
      Array<
        | { source: "session"; session: SessionSummary }
        | { source: "entrata"; event: CalendarEvent }
      >
    > = {};
    for (const s of sessions) {
      if (!s.scheduledAt) continue;
      const d = new Date(s.scheduledAt);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        (map[day] ??= []).push({ source: "session", session: s });
      }
    }
    for (const event of entrataEvents) {
      const [eventYear, eventMonth, eventDay] = event.appointment_date
        .split("-")
        .map(Number);
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
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  const [selectedDay, setSelectedDay] = useState<number | null>(
    today.getDate(),
  );
  const dayItems = selectedDay ? (itemsByDay[selectedDay] ?? []) : [];
  const upcomingFiveDaySessions = useMemo(() => {
    const windowStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    ).getTime();
    const windowEnd = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 5,
    ).getTime();
    return upcomingSessions.filter((session) => {
      if (session.status === "in_progress") return true;
      if (!session.scheduledAt) return false;
      const scheduledTime = new Date(session.scheduledAt).getTime();
      return (
        !Number.isNaN(scheduledTime) &&
        scheduledTime >= windowStart &&
        scheduledTime < windowEnd
      );
    });
  }, [todayKey, upcomingSessions]);
  const upcomingGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        label: string;
        dateLabel: string;
        sessions: SessionSummary[];
      }
    >();
    const tomorrow = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1,
    );
    const isSameDay = (left: Date, right: Date) =>
      left.getFullYear() === right.getFullYear() &&
      left.getMonth() === right.getMonth() &&
      left.getDate() === right.getDate();

    for (const session of upcomingFiveDaySessions) {
      const scheduled = session.scheduledAt
        ? new Date(session.scheduledAt)
        : null;
      const validScheduled =
        scheduled && !Number.isNaN(scheduled.getTime()) ? scheduled : null;
      const key =
        session.status === "in_progress"
          ? "in-progress"
          : validScheduled
            ? `${validScheduled.getFullYear()}-${validScheduled.getMonth() + 1}-${validScheduled.getDate()}`
            : "unscheduled";
      const label =
        session.status === "in_progress"
          ? "Happening now"
          : validScheduled && isSameDay(validScheduled, today)
            ? "Today"
            : validScheduled && isSameDay(validScheduled, tomorrow)
              ? "Tomorrow"
              : validScheduled
                ? validScheduled.toLocaleDateString(undefined, {
                    weekday: "long",
                  })
                : "Scheduled";
      const dateLabel =
        session.status === "in_progress"
          ? "Live now"
          : validScheduled
            ? validScheduled.toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
              })
            : "Date to be confirmed";
      const group = groups.get(key);
      if (group) {
        group.sessions.push(session);
      } else {
        groups.set(key, { key, label, dateLabel, sessions: [session] });
      }
    }
    return [...groups.values()];
  }, [todayKey, upcomingFiveDaySessions]);

  useEffect(() => {
    setSelectedDay(monthOffset === 0 ? today.getDate() : null);
  }, [monthOffset]);

  async function runSync() {
    setSyncing(true);
    try {
      const result = await syncCalendar();
      await onReload();
      showToast(`${result?.eventsSynced ?? 0} Entrata tours synced`, "success");
    } catch (caught) {
      showToast(
        caught instanceof Error ? caught.message : "Entrata sync failed",
        "error",
      );
    } finally {
      setSyncing(false);
    }
  }

  return (
    <View style={st.page}>
      <CommunityTopBar
        property={property}
        onCommunityPress={onCommunityPress}
        left={<TourLogo width={62} />}
        right={
          <Pressable
            onPress={() => void runSync()}
            disabled={syncing}
            style={({ pressed }) => [homeSt.headerIcon, pressed && st.pressed]}
          >
            {syncing ? (
              <LoadingDots size="small" color={C.brand} />
            ) : (
              <Ionicons name="sync" size={18} color={C.text} />
            )}
          </Pressable>
        }
      />
      <View style={st.pageHeadingRow}>
        <View style={st.flex1}>
          <Text style={st.pageTitle}>Calendar</Text>
          <Text style={st.pageHeadingSub}>
            {entrataEvents.length} Entrata tours · {sessions.length} sessions
          </Text>
        </View>
      </View>

      <View style={st.card}>
        <View style={{ padding: 16 }}>
          <View style={st.calNav}>
            <Pressable onPress={() => setMonthOffset((p) => p - 1)}>
              <Ionicons name="chevron-back" size={22} color={C.text} />
            </Pressable>
            <Text style={st.calMonth}>{monthLabel}</Text>
            <Pressable onPress={() => setMonthOffset((p) => p + 1)}>
              <Ionicons name="chevron-forward" size={22} color={C.text} />
            </Pressable>
          </View>
          <View style={st.calDowRow}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <Text key={d} style={st.calDow}>
                {d}
              </Text>
            ))}
          </View>
          {weeks.map((w, wi) => (
            <View key={wi} style={st.calWeek}>
              {w.map((d, di) => {
                if (d === null) return <View key={di} style={st.calDayCell} />;
                const isToday =
                  d === today.getDate() &&
                  month === today.getMonth() &&
                  year === today.getFullYear();
                const dayItems = itemsByDay[d] ?? [];
                const hasSessions = dayItems.some(
                  (item) => item.source === "session",
                );
                const hasEntrata = dayItems.some(
                  (item) => item.source === "entrata",
                );
                const isSelected = d === selectedDay;
                return (
                  <Pressable
                    key={di}
                    onPress={() => setSelectedDay(d === selectedDay ? null : d)}
                    style={[
                      st.calDayCell,
                      isSelected && st.calDaySelected,
                      isToday && !isSelected && st.calDayToday,
                    ]}
                  >
                    <Text
                      style={[
                        st.calDayText,
                        isToday && st.calDayTextToday,
                        isSelected && st.calDayTextSelected,
                      ]}
                    >
                      {d}
                    </Text>
                    <View style={st.calDots}>
                      {hasEntrata && (
                        <View
                          style={[
                            st.calDot,
                            { backgroundColor: isSelected ? "#fff" : C.purple },
                          ]}
                        />
                      )}
                      {hasSessions && (
                        <View
                          style={[
                            st.calDot,
                            { backgroundColor: isSelected ? "#fff" : C.brand },
                          ]}
                        />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      {selectedDay !== null && (
        <View style={calSt.selectedDayBlock}>
          <View style={calSt.selectedDayHeader}>
            <View style={st.flex1}>
              <Text style={calSt.selectedDayEyebrow}>Selected date</Text>
              <Text style={calSt.selectedDayTitle}>
                {new Date(year, month, selectedDay).toLocaleDateString(
                  undefined,
                  { weekday: "long", month: "long", day: "numeric" },
                )}
              </Text>
            </View>
            <View style={calSt.selectedDayCount}>
              <Text style={calSt.selectedDayCountText}>{dayItems.length}</Text>
            </View>
          </View>
          {dayItems.length === 0 ? (
            <EmptyState
              icon="calendar-outline"
              title="No calendar items"
              subtitle={`Nothing scheduled for ${monthLabel.split(" ")[0]} ${selectedDay}`}
            />
          ) : (
            <View style={st.card}>
              {dayItems.map((item, index) =>
                item.source === "session" ? (
                  <SessionRow
                    key={item.session.id}
                    session={item.session}
                    onPress={() => onSession(item.session.id)}
                    isLast={index === dayItems.length - 1}
                  />
                ) : (
                  <Pressable
                    key={item.event.id}
                    disabled={!item.event.session_id}
                    onPress={() =>
                      item.event.session_id && onSession(item.event.session_id)
                    }
                    style={({ pressed }) => [
                      st.calendarEventRow,
                      index < dayItems.length - 1 && st.rowBorder,
                      pressed && st.pressed,
                    ]}
                  >
                    <View style={st.entrataEventIcon}>
                      <Ionicons
                        name={
                          item.event.event_type === "virtual"
                            ? "videocam-outline"
                            : "business-outline"
                        }
                        size={18}
                        color={C.purple}
                      />
                    </View>
                    <View style={st.flex1}>
                      <Text style={st.sessionTitle} numberOfLines={1}>
                        {item.event.prospect_name ?? "Entrata tour"}
                      </Text>
                      <Text style={st.sessionMeta}>
                        {formatEntrataClock(item.event.time_from)} ·{" "}
                        {item.event.event_type === "virtual"
                          ? "Virtual"
                          : "In person"}
                      </Text>
                      {(item.event.prospect_email ||
                        item.event.prospect_phone) && (
                        <Text style={st.calendarContact} numberOfLines={1}>
                          {item.event.prospect_email ??
                            item.event.prospect_phone}
                        </Text>
                      )}
                    </View>
                    <View style={[st.badge, { backgroundColor: C.purpleBg }]}>
                      <Text style={[st.badgeText, { color: C.purple }]}>
                        {item.event.status.replaceAll("_", " ")}
                      </Text>
                    </View>
                    {item.event.session_id && (
                      <Ionicons
                        name="chevron-forward"
                        size={17}
                        color={C.textMuted}
                      />
                    )}
                  </Pressable>
                ),
              )}
            </View>
          )}
        </View>
      )}

      <View style={calSt.upcomingBlock}>
        <View style={homeSt.sectionHeader}>
          <Text style={homeSt.sectionTitle}>Tours in the Next 5 Days</Text>
          <View style={calSt.upcomingHeaderCount}>
            <Text style={calSt.upcomingHeaderCountText}>
              {upcomingFiveDaySessions.length}
            </Text>
          </View>
        </View>
        {upcomingFiveDaySessions.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title="No scheduled tours in the next 5 days"
            subtitle="Newly scheduled tours will appear here"
          />
        ) : (
          <View style={calSt.upcomingGroups}>
            {upcomingGroups.map((group) => (
              <View key={group.key} style={calSt.upcomingGroup}>
                <View style={calSt.upcomingGroupHeader}>
                  <View style={calSt.upcomingGroupMarker} />
                  <View style={st.flex1}>
                    <Text style={calSt.upcomingGroupLabel}>{group.label}</Text>
                    <Text style={calSt.upcomingGroupDate}>
                      {group.dateLabel}
                    </Text>
                  </View>
                  <View style={calSt.upcomingGroupCount}>
                    <Text style={calSt.upcomingGroupCountText}>
                      {group.sessions.length}
                    </Text>
                  </View>
                </View>
                <View style={homeSt.focusStack}>
                  {group.sessions.map((session) => (
                    <MotionPressable
                      key={session.id}
                      onPress={() => onSession(session.id)}
                      haptic="selection"
                      style={homeSt.tourCard}
                    >
                      <View style={st.flex1}>
                        <Text style={homeSt.tourTitle} numberOfLines={1}>
                          {session.title}
                        </Text>
                        <View style={homeSt.tourMetaRow}>
                          <Text style={homeSt.timePill}>
                            {session.status === "in_progress"
                              ? "Now"
                              : session.scheduledAt
                                ? fmtTime(session.scheduledAt)
                                : "Scheduled"}
                          </Text>
                          <Text style={homeSt.tourMeta} numberOfLines={1}>
                            {session.prospectName ?? "Prospect details pending"}
                          </Text>
                        </View>
                        {formatSessionCardDescription(session) ? (
                          <Text style={homeSt.tourMeta} numberOfLines={2}>
                            {formatSessionCardDescription(session)}
                          </Text>
                        ) : null}
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={C.textMuted}
                      />
                    </MotionPressable>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={calSt.connectionFooter}>
        <View style={calSt.connectionIcon}>
          <Ionicons name="checkmark" size={15} color={C.green} />
        </View>
        <View style={st.flex1}>
          <Text style={calSt.connectionTitle}>Entrata connected</Text>
          <Text style={calSt.connectionMeta}>
            {entrataEvents.length} synced{" "}
            {entrataEvents.length === 1 ? "tour" : "tours"}
          </Text>
        </View>
        <View style={calSt.liveStatus}>
          <View style={calSt.liveStatusDot} />
          <Text style={calSt.liveStatusText}>Live</Text>
        </View>
      </View>
    </View>
  );
}

function formatEntrataClock(value: string | null) {
  if (!value) return "Time TBD";
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return value;
  const date = new Date(2000, 0, 1, Number(match[1]), Number(match[2]));
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

// ═══════════════════════════════════════
// Materials
// ═══════════════════════════════════════

const assetSt = StyleSheet.create({
  header: { gap: 14 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  titleText: { flex: 1, minWidth: 0 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cardWrap: { width: (Dimensions.get("window").width - 40) / 2 },
  card: {
    overflow: "hidden",
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: BACKGROUND,
  },
  thumb: {
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: BACKGROUND,
  },
  thumbImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  captionFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 72,
  },
  caption: { position: "absolute", left: 10, right: 10, bottom: 9, gap: 1 },
  captionTitle: { color: CARD },
  captionMeta: { color: "rgba(255,255,255,0.78)", fontSize: 10 },
  playBadge: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
    borderRadius: 15,
    backgroundColor: "rgba(15,23,42,0.86)",
  },
  playWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  panoramaBadge: {
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
  panoramaBadgeText: { color: CARD },
  fallbackIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: SMALL_CORNER,
    backgroundColor: CARD,
  },
  previewRoot: { flex: 1, overflow: "visible", backgroundColor: BACKGROUND },
  previewBody: { flex: 1, paddingHorizontal: 16 },
  previewHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    overflow: "visible",
    backgroundColor: "transparent",
  },
  previewTitleRow: {
    minHeight: 56,
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    overflow: "visible",
  },
  previewTitle: { flex: 1, minWidth: 0, color: TEXT },
  previewFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    overflow: "visible",
    paddingHorizontal: 16,
  },
  previewFooterFade: {
    position: "absolute",
    left: 0,
    right: 0,
    top: -56,
    height: 56,
  },
  modalMeta: { color: C.textSec, marginTop: 2, textTransform: "capitalize" },
  modalPreview: {
    width: "100%",
    aspectRatio: 16 / 9,
    overflow: "hidden",
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: "#000",
  },
  modalImage: { width: "100%", height: "100%" },
  modalPanorama: { width: "100%", height: "100%" },
  modalPanoramaStatus: {
    position: "absolute",
    left: 12,
    bottom: 12,
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: "rgba(15,23,42,0.78)",
  },
  modalPanoramaStatusText: { color: CARD },
  modalFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  modalDesc: { color: C.textSec, marginTop: 10 },
  websiteLink: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  websiteLinkIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: BACKGROUND,
  },
  websiteLinkMeta: { color: C.textSec, marginTop: 2 },
  tourLibraryFooter: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 12,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  tourLibraryFooterIcon: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: BACKGROUND,
  },
  tourLibraryFooterMeta: { color: C.textSec, marginTop: 2 },
  addSheet: {
    overflow: "visible",
    paddingTop: 2,
    paddingHorizontal: 0,
    borderTopLeftRadius: LARGE_CORNER,
    borderTopRightRadius: LARGE_CORNER,
    borderCurve: "continuous",
    backgroundColor: BACKGROUND,
  },
  addTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    overflow: "visible",
  },
  addHeaderCopy: { flex: 1, minWidth: 0 },
  addOptions: {
    marginTop: 14,
    marginHorizontal: 18,
    overflow: "hidden",
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  assetMenuItem: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
  },
  assetMenuItemPressed: { backgroundColor: BACKGROUND },
  assetMenuIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: BACKGROUND,
  },
  assetMenuIconCamera: { backgroundColor: "#fff7ed" },
  assetMenuIconVideo: { backgroundColor: "#f3e8ff" },
  assetMenuIcon360: { backgroundColor: "#ecfdf5" },
  assetMenuItemMeta: { marginTop: 2, color: C.textSec },
});

function AssetTypeMenu({
  visible,
  onClose,
  onPhoto,
  onCamera,
  onVideo,
  onPanorama,
}: {
  visible: boolean;
  onClose: () => void;
  onPhoto: () => void;
  onCamera: () => void;
  onVideo: () => void;
  onPanorama: () => void;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const sheetHeight = Math.min(430, Math.round(windowHeight * 0.52));

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      sheetHeight={sheetHeight}
      sheetStyle={assetSt.addSheet}
      dragHeader={
        <View style={assetSt.addTitleRow}>
          <View style={assetSt.addHeaderCopy}>
            <CustomText textStyle="hero">Add New Asset</CustomText>
          </View>
          <LiquidGlassIconButton
            icon="close"
            accessibilityLabel="Close add asset"
            onPress={onClose}
          />
        </View>
      }
    >
      <View style={assetSt.addOptions}>
        <AssetTypeMenuItem
          icon="image-outline"
          iconStyle={assetSt.assetMenuIcon}
          iconColor={ACCENT}
          title="Photo library"
          meta="Choose an existing photo"
          onPress={onPhoto}
        />
        <AssetTypeMenuItem
          icon="camera-outline"
          iconStyle={[assetSt.assetMenuIcon, assetSt.assetMenuIconCamera]}
          iconColor="#ea580c"
          title="Camera"
          meta="Take a new photo"
          onPress={onCamera}
        />
        <AssetTypeMenuItem
          icon="videocam-outline"
          iconStyle={[assetSt.assetMenuIcon, assetSt.assetMenuIconVideo]}
          iconColor={C.purple}
          title="Video"
          meta="Record a new video asset"
          onPress={onVideo}
        />
        <AssetTypeMenuItem
          icon="scan-outline"
          iconStyle={[assetSt.assetMenuIcon, assetSt.assetMenuIcon360]}
          iconColor="#059669"
          title="360° photo"
          meta="Choose 1× detail or 0.5× fast capture"
          onPress={onPanorama}
        />
      </View>
    </BottomSheetModal>
  );
}

function AssetTypeMenuItem({
  icon,
  iconStyle,
  iconColor,
  title,
  meta,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconStyle: StyleProp<ViewStyle>;
  iconColor: string;
  title: string;
  meta: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        assetSt.assetMenuItem,
        pressed && assetSt.assetMenuItemPressed,
      ]}
    >
      <View style={iconStyle}>
        <Ionicons name={icon} size={21} color={iconColor} />
      </View>
      <View style={st.flex1}>
        <CustomText textStyle="title">{title}</CustomText>
        <CustomText textStyle="micro" style={assetSt.assetMenuItemMeta}>
          {meta}
        </CustomText>
      </View>
      <Ionicons name="chevron-forward" size={17} color={C.textMuted} />
    </Pressable>
  );
}

function MaterialsScreen({
  materials,
  tourLibrary,
  loading,
  refreshing,
  onRefresh,
  onReload,
  property,
}: {
  materials: Material[];
  tourLibrary: TourLibraryLink | null;
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  onReload: () => Promise<void>;
  property: string;
}) {
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<Material | null>(null);
  const [assetMenuOpen, setAssetMenuOpen] = useState(false);
  const [photoRecorderOpen, setPhotoRecorderOpen] = useState(false);
  const [videoRecorderOpen, setVideoRecorderOpen] = useState(false);
  const [panoramaRecorderOpen, setPanoramaRecorderOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const tourLibraryAssetCount = materials.filter((material) =>
    material.id.startsWith("tour-api-"),
  ).length;
  const visibleMaterials = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return materials;
    return materials.filter((material) =>
      material.name.toLowerCase().includes(query),
    );
  }, [materials, searchQuery]);

  async function addLibraryPhoto() {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Photo access is off",
          "Allow Tour to access your photo library in Settings, then try again.",
          [
            { text: "Not now", style: "cancel" },
            {
              text: "Open Settings",
              onPress: () => void Linking.openSettings(),
            },
          ],
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.9,
        selectionLimit: 1,
      });
      const photo = result.assets?.[0];
      if (result.canceled || !photo) return;
      const mimeType = photo.mimeType ?? "image/jpeg";
      const mimeExtension =
        mimeType.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
      const fileName =
        photo.fileName ?? `tour-photo-${Date.now()}.${mimeExtension}`;

      setUploading(true);
      await uploadMaterial(photo.uri, mimeType, fileName);
      await onReload();
      showToast("Photo added to this community", "success");
    } catch (caught) {
      showToast(
        caught instanceof Error ? caught.message : "Could not upload photo",
        "error",
      );
    } finally {
      setUploading(false);
    }
  }

  async function uploadRecordedVideo(asset: RecordedVideoAsset) {
    await uploadMaterial(asset.uri, asset.mimeType, asset.fileName, {
      name: asset.name,
      description: asset.description,
      type: "other",
    });
    await onReload().catch(() => undefined);
    showToast("Video asset added to this community", "success");
  }

  async function uploadRecordedPhoto(asset: RecordedPhotoAsset) {
    await uploadMaterial(asset.uri, asset.mimeType, asset.fileName, {
      name: asset.name,
      description: asset.description,
      type: "other",
    });
    await onReload().catch(() => undefined);
    showToast("Photo asset added to this community", "success");
  }

  async function uploadRecordedPanorama(asset: RecordedPanoramaAsset) {
    await uploadPanoramaMaterial(asset);
    await onReload().catch(() => undefined);
    showToast("360° photo added to this community", "success");
  }

  function choosePhoto() {
    setAssetMenuOpen(false);
    setTimeout(() => void addLibraryPhoto(), 180);
  }

  function chooseCamera() {
    setAssetMenuOpen(false);
    setTimeout(() => setPhotoRecorderOpen(true), 180);
  }

  function chooseVideo() {
    setAssetMenuOpen(false);
    setTimeout(() => setVideoRecorderOpen(true), 180);
  }

  function choosePanorama() {
    setAssetMenuOpen(false);
    setTimeout(() => setPanoramaRecorderOpen(true), 180);
  }

  return (
    <View style={[st.flex1, homeSt.pageBg]}>
      <Reanimated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[
          st.mainScroll,
          { paddingTop: largeTitleContentInset(insets.top), gap: 18 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={ACCENT}
          />
        }
      >
        <View style={assetSt.header}>
          <LargeTitleCopy
            title="Assets"
            subtitle={`${property} · ${materials.length} ${materials.length === 1 ? "asset" : "assets"}`}
            scrollY={scrollY}
          />
        </View>

        {loading ? (
          <LoadingBox />
        ) : visibleMaterials.length === 0 ? (
          <EmptyState
            icon={searchQuery.trim() ? "search-outline" : "folder-open-outline"}
            title={searchQuery.trim() ? "No matches" : "No materials"}
            subtitle={
              searchQuery.trim()
                ? "No assets match that title."
                : "Tour videos and community resources will appear here"
            }
          />
        ) : (
          <View style={assetSt.grid}>
            {visibleMaterials.map((material) => {
              const previewUrl = materialPreviewUrl(material);
              const assetUrl = materialUrl(material);
              const panorama = isPanoramaMaterial(material);
              const canPlay = Boolean(
                !panorama && assetUrl && isVideoLikeUrl(assetUrl),
              );
              const canOpen = Boolean(assetUrl);
              return (
                <View key={material.id} style={assetSt.cardWrap}>
                  <Pressable
                    onPress={() => setSelected(material)}
                    style={({ pressed }) => [
                      assetSt.card,
                      pressed && st.pressed,
                    ]}
                  >
                    <View style={assetSt.thumb}>
                      {previewUrl ? (
                        <Image
                          source={{ uri: previewUrl }}
                          style={assetSt.thumbImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={assetSt.fallbackIcon}>
                          <Ionicons
                            name={
                              canPlay
                                ? "play"
                                : canOpen
                                  ? "image-outline"
                                  : "document-outline"
                            }
                            size={22}
                            color={ACCENT}
                          />
                        </View>
                      )}
                      <LinearGradient
                        pointerEvents="none"
                        colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.58)"]}
                        style={assetSt.captionFade}
                      />
                      {panorama ? (
                        <View style={assetSt.panoramaBadge}>
                          <Ionicons
                            name="globe-outline"
                            size={12}
                            color={CARD}
                          />
                          <CustomText
                            textStyle="micro"
                            style={assetSt.panoramaBadgeText}
                          >
                            360°
                          </CustomText>
                        </View>
                      ) : canPlay ? (
                        <View pointerEvents="none" style={assetSt.playWrap}>
                          <View style={assetSt.playBadge}>
                            <Ionicons name="play" size={13} color={CARD} />
                          </View>
                        </View>
                      ) : null}
                      <View pointerEvents="none" style={assetSt.caption}>
                        <CustomText
                          textStyle="title"
                          numberOfLines={1}
                          style={assetSt.captionTitle}
                        >
                          {material.name}
                        </CustomText>
                        <CustomText
                          textStyle="micro"
                          numberOfLines={1}
                          style={assetSt.captionMeta}
                        >
                          {material.type} · {fmtDate(material.createdAt)}
                        </CustomText>
                      </View>
                    </View>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        {tourLibrary ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Open the connected Tour Library"
            onPress={() => void Linking.openURL(tourLibrary.url)}
            style={({ pressed }) => [
              assetSt.tourLibraryFooter,
              pressed && st.pressed,
            ]}
          >
            <View style={assetSt.tourLibraryFooterIcon}>
              <Ionicons name="checkmark" size={15} color={ACCENT} />
            </View>
            <View style={st.flex1}>
              <CustomText textStyle="title">Connected Tour Library</CustomText>
              <CustomText
                textStyle="micro"
                style={assetSt.tourLibraryFooterMeta}
              >
                {tourLibraryAssetCount} synced{" "}
                {tourLibraryAssetCount === 1 ? "asset" : "assets"}
              </CustomText>
            </View>
            <Ionicons name="open-outline" size={17} color={C.textMuted} />
          </Pressable>
        ) : null}
      </Reanimated.ScrollView>

      <LargeTitleHeader
        title="Assets"
        scrollY={scrollY}
        hideCompactTitle={searchOpen}
        trailing={
          <>
            <LiquidGlassSearch
              expanded={searchOpen}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onExpand={() => setSearchOpen(true)}
              onCollapse={() => {
                setSearchOpen(false);
                setSearchQuery("");
                Keyboard.dismiss();
              }}
            />
            <LiquidGlassIconButton
              icon="add"
              iconSize={32}
              accessibilityLabel="Add new asset"
              disabled={uploading}
              onPress={() => setAssetMenuOpen(true)}
            />
          </>
        }
      />

      <MaterialPreviewModal
        material={selected}
        property={property}
        onClose={() => setSelected(null)}
      />
      <AssetTypeMenu
        visible={assetMenuOpen}
        onClose={() => setAssetMenuOpen(false)}
        onPhoto={choosePhoto}
        onCamera={chooseCamera}
        onVideo={chooseVideo}
        onPanorama={choosePanorama}
      />
      <VideoAssetRecorder
        visible={videoRecorderOpen}
        onClose={() => setVideoRecorderOpen(false)}
        onUpload={uploadRecordedVideo}
      />
      <PhotoAssetRecorder
        visible={photoRecorderOpen}
        onClose={() => setPhotoRecorderOpen(false)}
        onUpload={uploadRecordedPhoto}
      />
      <PanoramaAssetRecorder
        visible={panoramaRecorderOpen}
        onClose={() => setPanoramaRecorderOpen(false)}
        onUpload={uploadRecordedPanorama}
      />
    </View>
  );
}

function MaterialPreviewModal({
  material,
  property,
  onClose,
}: {
  material: Material | null;
  property: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const url = material ? materialUrl(material) : null;
  const previewUrl = material ? materialPreviewUrl(material) : null;
  const panoramaUrl =
    material && url && isPanoramaMaterial(material) ? url : null;
  const videoUrl = !panoramaUrl && url && isVideoLikeUrl(url) ? url : null;
  const [panoramaReady, setPanoramaReady] = useState(false);
  const headerHeight = 6 + 56 + 16;
  const footerHeight = 58 + 10 + Math.max(insets.bottom, 16);

  useEffect(() => {
    setPanoramaReady(false);
  }, [material?.id]);

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
    <Modal
      visible={Boolean(material)}
      animationType="slide"
      presentationStyle="pageSheet"
      allowSwipeDismissal
      onRequestClose={onClose}
    >
      <View style={assetSt.previewRoot}>
        <View
          style={[
            assetSt.previewBody,
            { paddingTop: headerHeight, paddingBottom: footerHeight + 8 },
          ]}
        >
          <View style={assetSt.modalPreview}>
            {panoramaUrl ? (
              <>
                <PanoramaImageViewer
                  uri={panoramaUrl}
                  onReady={() => setPanoramaReady(true)}
                  style={assetSt.modalPanorama}
                />
                <View pointerEvents="none" style={assetSt.modalPanoramaStatus}>
                  {panoramaReady ? (
                    <Ionicons name="hand-left-outline" size={13} color={CARD} />
                  ) : (
                    <LoadingDots size="small" color={CARD} />
                  )}
                  <CustomText
                    textStyle="micro"
                    style={assetSt.modalPanoramaStatusText}
                  >
                    {panoramaReady
                      ? "Drag to view your panorama"
                      : "Loading panorama…"}
                  </CustomText>
                </View>
              </>
            ) : videoUrl ? (
              <MaterialVideoPreview source={videoUrl} />
            ) : previewUrl ? (
              <Image
                source={{ uri: previewUrl }}
                style={assetSt.modalImage}
                resizeMode="cover"
              />
            ) : (
              <View style={assetSt.modalFallback}>
                <Ionicons
                  name={url ? "play-circle-outline" : "document-outline"}
                  size={52}
                  color={ACCENT}
                />
              </View>
            )}
          </View>
          {material ? (
            <View style={{ marginTop: 14, gap: 2 }}>
              <CustomText textStyle="title" numberOfLines={2}>
                {material.name}
              </CustomText>
              <CustomText textStyle="caption" style={assetSt.modalMeta}>
                {material.type} · {fmtDate(material.createdAt)}
              </CustomText>
              {material.description ? (
                <CustomText textStyle="caption" style={assetSt.modalDesc}>
                  {material.description}
                </CustomText>
              ) : null}
            </View>
          ) : null}
        </View>

        <View
          pointerEvents="box-none"
          style={[assetSt.previewHeader, { height: headerHeight + 40 }]}
        >
          <LinearGradient
            colors={[
              BACKGROUND,
              "rgba(242, 242, 247, 0.62)",
              "rgba(242, 242, 247, 0)",
            ]}
            locations={[0, 0.5, 1]}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
          />
          <View pointerEvents="box-none" style={assetSt.previewTitleRow}>
            <CustomText
              textStyle="hero"
              numberOfLines={1}
              style={assetSt.previewTitle}
            >
              {property}
            </CustomText>
            <LiquidGlassIconButton
              icon="close"
              accessibilityLabel="Close media preview"
              onPress={onClose}
            />
          </View>
        </View>

        <View
          pointerEvents="box-none"
          style={[
            assetSt.previewFooter,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <LinearGradient
            colors={[
              "rgba(242, 242, 247, 0)",
              "rgba(242, 242, 247, 0.62)",
              BACKGROUND,
            ]}
            locations={[0, 0.45, 1]}
            pointerEvents="none"
            style={assetSt.previewFooterFade}
          />
          <View style={homeSt.actionPillRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                impactHaptic(Haptics.ImpactFeedbackStyle.Medium);
                void shareSelected();
              }}
              style={({ pressed }) => [
                homeSt.checkInPill,
                pressed && homeSt.actionPillPressed,
              ]}
            >
              <Ionicons name="share-social-outline" size={21} color={CARD} />
              <CustomText textStyle="title" style={homeSt.checkInPillText}>
                Share
              </CustomText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={!url}
              onPress={() => {
                impactHaptic(Haptics.ImpactFeedbackStyle.Medium);
                void downloadSelected();
              }}
              style={({ pressed }) => [
                homeSt.checkInPill,
                homeSt.newSessionPill,
                !url && { opacity: 0.55 },
                pressed && homeSt.actionPillPressed,
              ]}
            >
              <Ionicons name="download-outline" size={21} color={CARD} />
              <CustomText textStyle="title" style={homeSt.checkInPillText}>
                Download
              </CustomText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function isVideoLikeUrl(url: string) {
  if (/^file:\/\//i.test(url)) return true;
  return /\.(mp4|mov|m4v|webm)(?:[?#].*)?$/i.test(url);
}

function materialDownloadName(material: Material, url: string) {
  const cleanName =
    material.name
      .trim()
      .replace(/[^a-z0-9._-]+/gi, "-")
      .replace(/^-+|-+$/g, "") || "tour-asset";
  const path = (() => {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  })();
  const extension =
    path.match(/\.([a-z0-9]{2,6})(?:$|[?#])/i)?.[0] ??
    (material.media?.videoUrl ? ".mp4" : "");
  return cleanName.toLowerCase().endsWith(extension.toLowerCase())
    ? cleanName
    : `${cleanName}${extension}`;
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
      : (
          await FileSystem.File.downloadFileAsync(
            url,
            new FileSystem.File(
              FileSystem.Paths.document,
              `${Date.now()}-${materialDownloadName(material, url)}`,
            ),
            { idempotent: true },
          )
        ).uri;

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
  return (
    <VideoView
      player={player}
      style={assetSt.modalImage}
      contentFit="contain"
      nativeControls
    />
  );
}

// ═══════════════════════════════════════
// Audio Diagnostics
// ═══════════════════════════════════════

function AudioTestScreen({ onBack }: { onBack: () => void }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [uri, setUri] = useState<string | null>(null);
  const player = useAudioPlayer(uri, { updateInterval: 250 });
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState("Ready to test your microphone.");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerLoaded, setPlayerLoaded] = useState(false);

  useEffect(() => {
    setPlayerLoaded(false);
    setIsPlaying(false);
    try {
      const subscription = player.addListener(
        "playbackStatusUpdate",
        (nextStatus) => {
          setPlayerLoaded(nextStatus.isLoaded);
          setIsPlaying(nextStatus.playing);
          if (nextStatus.didJustFinish) setStatus("Playback finished.");
        },
      );
      return () => subscription.remove();
    } catch {
      return undefined;
    }
  }, [player]);

  useEffect(() => {
    if (!recording) return undefined;
    const startedAt = Date.now();
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt) / 1000)),
      250,
    );
    return () => clearInterval(timer);
  }, [recording]);

  async function startTestRecording() {
    if (busy || recording) return;
    setBusy(true);
    try {
      player.pause();
      setUri(null);
      setFileSize(null);
      setElapsed(0);

      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setStatus(
          "Microphone permission was denied. Enable it for Tour in iOS Settings and try again.",
        );
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
      setStatus(
        "Recording. Speak for a few seconds, then stop and play it back.",
      );
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (caught) {
      setStatus(
        caught instanceof Error
          ? caught.message
          : "Could not start audio test.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function stopTestRecording() {
    if (!recording || busy) return;
    setBusy(true);
    setRecording(false);
    try {
      await recorder.stop();
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
      const nextUri = recorder.uri;
      setUri(nextUri);
      setStatus(
        nextUri
          ? "Recording saved. Play it back below."
          : "Recording stopped, but no file URI was returned.",
      );

      if (nextUri) {
        const file = new FileSystem.File(nextUri);
        setFileSize(file.exists ? file.size : null);
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (caught) {
      setStatus(
        caught instanceof Error
          ? caught.message
          : "Could not stop the recording.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function playOrPause() {
    if (!uri || busy) return;
    setBusy(true);
    try {
      if (isPlaying) {
        player.pause();
        setStatus("Playback paused.");
        return;
      }

      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
      player.play();
      setStatus("Playing recorded audio.");
    } catch (caught) {
      setStatus(
        caught instanceof Error
          ? caught.message
          : "Could not play this recording.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function resetTest() {
    if (busy) return;
    player.pause();
    if (recording) {
      setRecording(false);
      await recorder.stop().catch(() => {});
    }
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    }).catch(() => {});
    setUri(null);
    setFileSize(null);
    setElapsed(0);
    setStatus("Ready to test your microphone.");
  }

  async function closeAudioTest() {
    if (recording) {
      setRecording(false);
      await recorder.stop().catch(() => {});
    }
    if (isPlaying) player.pause();
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    }).catch(() => {});
    onBack();
  }

  const canPlay = Boolean(uri) && playerLoaded && !recording;
  const sizeLabel =
    fileSize === null
      ? "Not measured"
      : fileSize < 1024
        ? `${fileSize} B`
        : `${(fileSize / 1024).toFixed(1)} KB`;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={st.scroll}
    >
      <View style={st.page}>
        <BackBtn label="Home" onPress={() => void closeAudioTest()} />
        <Text style={st.pageTitle}>Audio Test</Text>
        <Text style={st.pageSub}>
          Check microphone capture and playback before using live transcription.
        </Text>

        <View style={audioTestSt.hero}>
          <View
            style={[
              audioTestSt.micRing,
              recording && audioTestSt.micRingRecording,
            ]}
          >
            <Ionicons
              name={recording ? "radio" : "mic-outline"}
              size={42}
              color={recording ? C.red : C.brand}
            />
          </View>
          <Text style={audioTestSt.timer}>{formatElapsed(elapsed)}</Text>
          <Text style={audioTestSt.status}>{status}</Text>
        </View>

        <View style={audioTestSt.controls}>
          {recording ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Stop test recording"
              disabled={busy}
              onPress={stopTestRecording}
              style={({ pressed }) => [
                audioTestSt.stopButton,
                pressed && st.pressed,
                busy && { opacity: 0.5 },
              ]}
            >
              <Ionicons name="stop" size={22} color="#fff" />
              <Text style={audioTestSt.primaryText}>Stop</Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Start test recording"
              disabled={busy}
              onPress={startTestRecording}
              style={({ pressed }) => [
                audioTestSt.recordButton,
                pressed && st.pressed,
                busy && { opacity: 0.5 },
              ]}
            >
              <Ionicons name="mic" size={22} color="#fff" />
              <Text style={audioTestSt.primaryText}>Record Test Clip</Text>
            </Pressable>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              isPlaying ? "Pause test playback" : "Play test recording"
            }
            disabled={!canPlay || busy}
            onPress={playOrPause}
            style={({ pressed }) => [
              audioTestSt.secondaryButton,
              (!canPlay || busy) && { opacity: 0.5 },
              pressed && st.pressed,
            ]}
          >
            <Ionicons
              name={isPlaying ? "pause" : "play"}
              size={20}
              color={C.brand}
            />
            <Text style={audioTestSt.secondaryText}>
              {isPlaying ? "Pause" : "Play Back"}
            </Text>
          </Pressable>
        </View>

        <View style={audioTestSt.infoCard}>
          <AudioTestRow
            label="Captured file"
            value={uri ? "Created" : "None yet"}
          />
          <AudioTestRow label="File size" value={sizeLabel} />
          <AudioTestRow label="URI" value={uri ?? "Record a clip first"} />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reset audio test"
          onPress={resetTest}
          style={({ pressed }) => [
            audioTestSt.resetButton,
            pressed && st.pressed,
          ]}
        >
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
      <Text style={audioTestSt.infoValue} numberOfLines={2}>
        {value}
      </Text>
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

  const [phase, setPhase] = useState<"choose" | "uploading" | "details">(
    pendingUpload ? "uploading" : "choose",
  );
  const [uploadStats, setUploadStats] =
    useState<UploadStats>(initialUploadStats());
  const [sessionId, setSessionId] = useState<string | null>(
    pendingUpload?.sessionId ?? null,
  );
  const [fileName, setFileName] = useState(pendingUpload?.name ?? "");
  const [fileSizeMB, setFileSizeMB] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createOptionsReady, setCreateOptionsReady] = useState(false);
  const recorderOpenedRef = useRef(false);
  const startRecordingRef = useRef<() => void>(() => {});
  const pendingUploadStartedRef = useRef<string | null>(null);

  const [title, setTitle] = useState("");
  const [prospect, setProspect] = useState(pendingUpload?.draft.prospect ?? "");
  const [customerInterests, setCustomerInterests] = useState<
    SessionCustomerInterest[]
  >([]);
  const [location, setLocation] = useState(pendingUpload?.draft.location ?? "");
  const [notes, setNotes] = useState(pendingUpload?.draft.notes ?? "");
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [rubricId, setRubricId] = useState<string | null>(
    pendingUpload?.draft.rubricId ?? null,
  );
  const [rubricOpen, setRubricOpen] = useState(false);
  const [assets, setAssets] = useState<Material[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>(
    pendingUpload?.draft.selectedAssetIds ?? [],
  );
  const [uploaderIsAgent, setUploaderIsAgent] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchRubrics(),
      fetchMaterials().catch(() => ({ materials: [] as Material[] })),
    ])
      .then(([{ rubrics: list }, materialData]) => {
        setRubrics(list);
        setAssets(
          materialData.materials.filter((material) => materialUrl(material)),
        );
        if (list.length > 0) {
          const defaultRubric = list.find((r) => r.isDefault) ?? list[0];
          if (defaultRubric) setRubricId(defaultRubric.id);
        }
      })
      .catch(() => {
        /* rubric picker optional */
      })
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
    const nextRubricId =
      draftOverrides?.rubricId !== undefined
        ? draftOverrides.rubricId
        : rubricId;
    const nextUploaderIsAgent =
      draftOverrides?.uploaderIsAgent ?? uploaderIsAgent;
    let sid = existingSessionId ?? sessionId;
    let durableUri = uri;
    let directUploadLocalId: string | null = null;
    let shouldDrainOutbox = false;
    try {
      if (localId) {
        const verifiedUri = await ensureDurableRecording(localId, uri);
        if (!verifiedUri) {
          throw new Error(
            "Recording file could not be read after it was saved. Please keep this screen open and retry.",
          );
        }
        durableUri = verifiedUri;
        beginDirectLocalUpload(localId);
        directUploadLocalId = localId;
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

      const automaticTitle = formatRecordingUploadTitle(new Date());
      const hasCustomTitle = Boolean(title.trim());
      if (!sid) {
        if (!(await isOnline())) {
          showToast("Saved on device — will upload when online", "info");
          recorderOpenedRef.current = false;
          setPhase("choose");
          shouldDrainOutbox = true;
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
      if (draftOverrides?.prospect !== undefined)
        setProspect(draftOverrides.prospect);
      if (draftOverrides?.location !== undefined)
        setLocation(draftOverrides.location);
      if (draftOverrides?.rubricId !== undefined && draftOverrides.rubricId)
        setRubricId(draftOverrides.rubricId);
      if (draftOverrides?.uploaderIsAgent !== undefined)
        setUploaderIsAgent(draftOverrides.uploaderIsAgent);

      await uploadRecording(
        sid,
        durableUri,
        mimeType,
        name,
        durationSec,
        (next) => setUploadStats(uploadStatsFromProgress(next)),
      );
      promoteLocalRecordingToCache(sid, durableUri);
      await clearPendingRecordingUpload(sid, localId);
      void trackAnalyticsEvent("session_upload_complete", { sessionId: sid });
      setUploadStats((current) => ({
        ...current,
        phase: "finalizing",
        percent: 100,
        etaSeconds: 0,
      }));
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
        online
          ? err instanceof Error
            ? err.message
            : "Upload failed"
          : "Saved on device — will upload when online",
        online ? "error" : "info",
      );
      recorderOpenedRef.current = false;
      setPhase("choose");
      shouldDrainOutbox = true;
    } finally {
      if (directUploadLocalId) endDirectLocalUpload(directUploadLocalId);
      if (shouldDrainOutbox) void drainSyncOutbox();
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
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
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
          const verifiedUri = await ensureDurableRecording(localId, result.uri);
          if (!verifiedUri) {
            snapshot.clearLiveSession();
            showToast("Failed to save recording", "error");
            return;
          }
          durableUri = verifiedUri;
          updateLocalSession(localId, {
            status: "recording",
            minimized: true,
            durationSec: result.durationSec,
            remoteSessionId: meta.sessionId,
            draft,
            fileName: `tour-${Date.now()}.m4a`,
            mimeType: "audio/m4a",
          });
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

  async function pickFile(uploadDraft?: LiveRecordingDraft) {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["video/*", "audio/*"],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const file = result.assets[0];
      if (uploadDraft) {
        setNotes(uploadDraft.notes);
        setProspect(uploadDraft.prospect);
        setLocation(uploadDraft.location);
        setSelectedAssetIds(uploadDraft.selectedAssetIds);
        setUploaderIsAgent(Boolean(uploadDraft.uploaderIsAgent));
        if (uploadDraft.rubricId) setRubricId(uploadDraft.rubricId);
      }
      const activeLocalId = rec.localId;
      if (rec.isRecording) await rec.stop();
      if (activeLocalId) deleteLocalSession(activeLocalId);
      rec.clearLiveSession();
      await uploadFile(
        file.uri,
        file.mimeType ?? "video/mp4",
        file.name ?? "recording.mp4",
        file.size,
        undefined,
        undefined,
        uploadDraft
          ? {
              notes: uploadDraft.notes,
              prospect: uploadDraft.prospect,
              location: uploadDraft.location,
              rubricId: uploadDraft.rubricId,
              uploaderIsAgent: uploadDraft.uploaderIsAgent,
            }
          : undefined,
      );
    } catch {
      showToast("Could not select file", "error");
    }
  }

  useEffect(() => {
    if (!createOptionsReady || phase !== "choose" || recorderOpenedRef.current)
      return;
    recorderOpenedRef.current = true;
    const frame = requestAnimationFrame(() => startRecordingRef.current());
    return () => cancelAnimationFrame(frame);
  }, [createOptionsReady, phase]);

  async function submitAndProcess() {
    if (!sessionId) return;
    setSubmitting(true);

    const patchBody: Record<string, unknown> = {};
    if (title.trim()) patchBody.title = title.trim();
    if (prospect.trim()) patchBody.prospectName = prospect.trim();
    if (location.trim()) patchBody.location = location.trim();
    if (notes.trim()) patchBody.notes = notes.trim();
    if (rubricId) patchBody.rubricId = rubricId;
    if (customerInterests.length > 0)
      patchBody.customerInterests = customerInterests;

    if (Object.keys(patchBody).length > 0) {
      try {
        await authenticatedFetch(`/api/sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchBody),
        });
      } catch {
        /* best effort */
      }
    }

    onCreated(sessionId);
  }

  // ── Prepare and open the full recorder ──
  if (phase === "choose") {
    return (
      <View style={[st.flex1, st.center]}>
        <ActivityIndicator color={C.brand} />
        <Text
          style={{
            marginTop: 10,
            color: C.textSec,
            fontSize: 13,
            fontWeight: "700",
          }}
        >
          Preparing recorder…
        </Text>
      </View>
    );
  }

  // ── Uploading ──
  if (phase === "uploading") {
    return (
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={st.scroll}
      >
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
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={st.scroll}
    >
      <View style={st.page}>
        <BackBtn label="Sessions" onPress={onBack} />
        <Text style={st.pageTitle}>New Session</Text>

        <View style={[st.card, { overflow: "hidden" }]}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              padding: 14,
              backgroundColor: C.greenBg,
              borderBottomWidth: 1,
              borderBottomColor: "#e2e8f0",
            }}
          >
            <Ionicons name="checkmark-circle" size={20} color={C.green} />
            <View style={st.flex1}>
              <Text style={{ fontSize: 13, fontWeight: "800", color: C.green }}>
                Recording uploaded
              </Text>
              <Text
                style={{ fontSize: 12, fontWeight: "600", color: C.textSec }}
                numberOfLines={1}
              >
                {fileName}
                {fileSizeMB ? ` (${fileSizeMB} MB)` : ""}
              </Text>
            </View>
          </View>

          <View style={{ padding: 18, gap: 14 }}>
            <Text style={st.formTitle}>Session Details</Text>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: C.textSec,
                marginTop: -8,
              }}
            >
              Add context to improve your analysis
            </Text>
            <AgentIdentityToggle
              selected={uploaderIsAgent}
              agentName={agentName}
              onToggle={() => {
                setUploaderIsAgent((value) => !value);
                void Haptics.selectionAsync();
              }}
            />
            <Input
              placeholder="Session title"
              value={title}
              onChangeText={setTitle}
              icon="text-outline"
            />
            <Input
              placeholder="Prospect name"
              value={prospect}
              onChangeText={setProspect}
              icon="person-outline"
            />
            <ProspectInterestPicker
              interests={customerInterests}
              onChange={setCustomerInterests}
            />
            <Input
              placeholder="Location / unit"
              value={location}
              onChangeText={setLocation}
              icon="location-outline"
            />
            {rubrics.length > 0 && (
              <View>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "800",
                    color: C.textSec,
                    marginBottom: 8,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Evaluation rubric
                </Text>
                <Pressable
                  onPress={() => setRubricOpen((o) => !o)}
                  style={({ pressed }) => [st.inputWrap, pressed && st.pressed]}
                >
                  <Ionicons
                    name="clipboard-outline"
                    size={18}
                    color={C.textMuted}
                  />
                  <Text
                    style={[st.inputField, { flex: 1, paddingVertical: 0 }]}
                    numberOfLines={1}
                  >
                    {rubrics.find((r) => r.id === rubricId)?.name ??
                      "Select a rubric"}
                  </Text>
                  <Ionicons
                    name={rubricOpen ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={C.textMuted}
                  />
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
                        style={({ pressed }) => [
                          {
                            padding: 12,
                            borderRadius: 12,
                            backgroundColor:
                              rubric.id === rubricId ? C.brand + "12" : C.bg,
                          },
                          pressed && st.pressed,
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: "700",
                            color: C.text,
                          }}
                        >
                          {rubric.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            )}
            <Input
              placeholder="Notes or focus areas"
              value={notes}
              onChangeText={setNotes}
              icon="document-text-outline"
              multiline
            />
            <PrimaryBtn
              label={submitting ? "Opening..." : "Continue"}
              onPress={() => void submitAndProcess()}
              icon="arrow-forward"
              disabled={submitting}
            />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

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
      onPress={onToggle}
      disabled={disabled}
      style={({ pressed }) => [
        st.agentToggle,
        selected && st.agentToggleSelected,
        pressed && st.pressed,
        disabled && { opacity: 0.6 },
      ]}
    >
      <View
        style={[st.agentToggleCheck, selected && st.agentToggleCheckSelected]}
      >
        {selected ? (
          <Ionicons name="checkmark" size={14} color="white" />
        ) : null}
      </View>
      <View style={st.flex1}>
        <Text style={st.agentToggleTitle}>I am the leasing agent</Text>
        <Text style={st.agentToggleCopy}>
          {selected
            ? `Use ${agentName?.trim() || "my profile name"} for this session.`
            : "Leave unchecked to let AI identify the agent from audio."}
        </Text>
      </View>
    </Pressable>
  );
}

const MOBILE_INTEREST_CHOICES: Array<{
  category: ProspectInterestCategory;
  detail: string;
}> = [
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
  const selected = new Set(
    interests.map((interest) => interest.detail.toLowerCase()),
  );

  function addInterest(category: ProspectInterestCategory, detail: string) {
    const clean = detail.trim().slice(0, 120);
    if (!clean || selected.has(clean.toLowerCase()) || interests.length >= 8)
      return;
    onChange([
      ...interests,
      {
        id: `mobile-${Date.now()}-${interests.length}`,
        category,
        detail: clean,
      },
    ]);
    setCustomInterest("");
  }

  return (
    <View style={prospectFormSt.wrap}>
      <View style={prospectFormSt.heading}>
        <View style={prospectFormSt.icon}>
          <Ionicons name="heart-outline" size={16} color={C.brand} />
        </View>
        <View style={st.flex1}>
          <Text style={prospectFormSt.title}>Prospect interests</Text>
          <Text style={prospectFormSt.subtitle}>
            Optional context for a more tailored analysis
          </Text>
        </View>
      </View>

      {interests.length > 0 ? (
        <View style={prospectFormSt.selectedList}>
          {interests.map((interest) => (
            <Pressable
              key={interest.id}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${interest.detail}`}
              onPress={() =>
                onChange(interests.filter((item) => item.id !== interest.id))
              }
              style={prospectFormSt.selectedChip}
            >
              <Text style={prospectFormSt.selectedChipText}>
                {interest.detail}
              </Text>
              <Ionicons name="close" size={14} color={C.brand} />
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={prospectFormSt.optionList}>
        {MOBILE_INTEREST_CHOICES.filter(
          (choice) => !selected.has(choice.detail.toLowerCase()),
        ).map((choice) => (
          <Pressable
            key={choice.detail}
            accessibilityRole="button"
            accessibilityLabel={`Add ${choice.detail}`}
            onPress={() => addInterest(choice.category, choice.detail)}
            style={({ pressed }) => [
              prospectFormSt.option,
              pressed && st.pressed,
            ]}
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
            style={({ pressed }) => [
              prospectFormSt.addButton,
              !customInterest.trim() && prospectFormSt.addButtonDisabled,
              pressed && st.pressed,
            ]}
          >
            <Ionicons name="add" size={18} color="#fff" />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const prospectFormSt = StyleSheet.create({
  wrap: {
    gap: 10,
    padding: 13,
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 14,
    backgroundColor: "#f8fbff",
  },
  heading: { flexDirection: "row", alignItems: "center", gap: 9 },
  icon: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#eaf2ff",
  },
  title: { color: C.text, fontSize: 13, fontWeight: "900" },
  subtitle: {
    marginTop: 1,
    color: C.textSec,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",
  },
  selectedList: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  selectedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#eaf2ff",
  },
  selectedChipText: { color: C.brand, fontSize: 12, fontWeight: "800" },
  optionList: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#d7dee8",
    borderRadius: 999,
    backgroundColor: "#fff",
  },
  optionText: { color: C.textSec, fontSize: 11, fontWeight: "700" },
  customRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 40,
    paddingLeft: 10,
    borderWidth: 1,
    borderColor: "#d7dee8",
    borderRadius: 11,
    backgroundColor: "#fff",
  },
  customInput: {
    flex: 1,
    minWidth: 0,
    color: C.text,
    fontSize: 13,
    fontWeight: "700",
    paddingVertical: 9,
  },
  addButton: {
    width: 36,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: C.brand,
  },
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

function transcriptAnnotationChipIcon(
  kind: TranscriptAnnotation["kind"],
): keyof typeof Ionicons.glyphMap {
  if (kind === "ai_note") return "sparkles";
  if (kind === "key_moment") return "film-outline";
  return "chatbubble-outline";
}

function transcriptAnnotationChipColor(kind: TranscriptAnnotation["kind"]) {
  return kind === "ai_note" ? C.purple : C.brand;
}

function SampleSessionDetailScreen({
  sessionId,
  onBack,
}: {
  sessionId: string;
  onBack: () => void;
}) {
  const sampleQuery = useSampleSessionQuery(sessionId);
  const sample = sampleQuery.data;

  if (sampleQuery.isLoading && !sample)
    return <SessionReviewSkeleton onBack={onBack} />;
  if (!sample) {
    return (
      <View style={[st.flex1, st.center, { gap: 12, padding: 24 }]}>
        <Ionicons name="alert-circle-outline" size={48} color={C.red} />
        <Text style={[st.emptyTitle, { textAlign: "center" }]}>
          {sampleQuery.error instanceof Error
            ? sampleQuery.error.message
            : "Sample session not found"}
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

function CheckedInVisitorsCard({
  leads,
  description,
}: {
  leads: SessionSummary["leads"];
  description: string;
}) {
  return (
    <View style={st.checkedInCard}>
      <View style={st.checkedInHeader}>
        <View style={st.checkedInIcon}>
          <Ionicons name="people" size={18} color={C.green} />
        </View>
        <View style={st.flex1}>
          <Text style={st.checkedInTitle}>Checked in</Text>
          <Text style={st.checkedInSubtitle}>{description}</Text>
        </View>
      </View>
      {leads.map((lead) => (
        <View
          key={`${lead.createdAt}-${lead.email ?? ""}-${lead.phone ?? ""}`}
          style={st.checkedInPerson}
        >
          <View style={st.checkedInAvatar}>
            <Text style={st.checkedInAvatarText}>
              {lead.name.slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={st.flex1}>
            <Text style={st.checkedInName}>{lead.name}</Text>
            <Text style={st.checkedInContact} numberOfLines={1}>
              {[lead.email, lead.phone].filter(Boolean).join(" · ") ||
                lead.reason ||
                "Contact details pending"}
            </Text>
          </View>
        </View>
      ))}
    </View>
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
  onOpenAiChat: (meta: {
    sessionId: string;
    sessionTitle?: string;
    prospectName?: string;
  }) => void;
  onOpenReport: (sessionId: string) => void;
  onOpenAudioInsights: (meta: {
    sessionId: string;
    sessionTitle?: string;
    initialStatus?: AudioInsightsStatus;
    initialInsights?: AudioInsights | null;
  }) => void;
}) {
  const [tab, setTab] = useState<DTab>("transcript");
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
  const shouldFetchAudioInsights =
    session?.audioInsightsStatus === "ready" ||
    session?.audioInsightsStatus === "processing";
  const audioInsightsQuery = useAudioInsightsQuery(
    sessionId,
    shouldFetchAudioInsights,
  );
  const audioInsightsStatus =
    audioInsightsQuery.data?.status ??
    session?.audioInsightsStatus ??
    "pending";
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
      shouldFetchAudioInsights
        ? audioInsightsQuery.refetch()
        : Promise.resolve(),
    ]);
  }, [
    actionsQuery,
    analysisQuery,
    audioInsightsQuery,
    commentsQuery,
    sessionQuery,
    shouldFetchAudioInsights,
    transcriptQuery,
  ]);

  useEffect(() => {
    if (!session || analysis || !PROCESSING_STATUSES.has(session.status))
      return;
    const poll = setInterval(() => {
      if (AppState.currentState === "active") {
        void sessionQuery.refetch();
        void analysisQuery.refetch();
      }
    }, 4000);
    return () => clearInterval(poll);
  }, [analysis, analysisQuery, session, sessionQuery]);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (loading && !session) return <SessionReviewSkeleton onBack={onBack} />;

  if (!session)
    return (
      <View style={[st.flex1, st.center, { gap: 12 }]}>
        <Ionicons name="alert-circle-outline" size={48} color={C.red} />
        <Text style={st.emptyTitle}>
          {error instanceof Error ? error.message : "Session not found"}
        </Text>
        <BackBtn label="Sessions" onPress={onBack} />
      </View>
    );

  const hasAnalysis = !!analysis;
  const sc = STATUS_COLORS[session.status] ?? { bg: "#eaf4ff", text: C.brand };
  const sl = STATUS_LABELS[session.status] ?? session.status;
  const isProcessable = ["uploaded", "failed"].includes(session.status);

  if (hasAnalysis) {
    return (
      <SessionReviewExperience
        session={session}
        analysis={analysis}
        transcript={transcript}
        phases={phases}
        comments={comments}
        actions={actions}
        sessionId={sessionId}
        onBack={onBack}
        onReload={load}
        onOpenComments={() =>
          onOpenComments({
            sessionId,
            sessionTitle: session.title,
          })
        }
        onOpenAiChat={() =>
          onOpenAiChat({
            sessionId,
            sessionTitle: session.title,
            prospectName: session.prospectName ?? undefined,
          })
        }
        onOpenAudioInsights={() =>
          onOpenAudioInsights({
            sessionId,
            sessionTitle: session.title,
            initialStatus: audioInsightsStatus,
            initialInsights: audioInsights,
          })
        }
        onOpenReport={() => onOpenReport(sessionId)}
      />
    );
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[st.scroll, st.sessionDetailScroll]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={C.brand}
        />
      }
    >
      <View style={st.page}>
        {error && (
          <ErrorBanner
            message={
              error instanceof Error ? error.message : "Failed to load session"
            }
            onRetry={load}
          />
        )}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <BackBtn label="Sessions" onPress={onBack} />
          <View style={st.flex1} />
          <View style={[st.badge, { backgroundColor: sc.bg }]}>
            <Text style={[st.badgeText, { color: sc.text }]}>{sl}</Text>
          </View>
        </View>

        <Text style={st.detailTitle}>{session.title}</Text>
        <View style={{ gap: 3 }}>
          {session.scheduledAt && (
            <DetailMeta
              icon="calendar-outline"
              text={`${fmtDate(session.scheduledAt)} ${fmtTime(session.scheduledAt)}`}
            />
          )}
          {session.prospectName && (
            <DetailMeta icon="person-outline" text={session.prospectName} />
          )}
          {session.location && (
            <DetailMeta icon="location-outline" text={session.location} />
          )}
        </View>

        {(session.leads?.length ?? 0) > 0 ? (
          <CheckedInVisitorsCard
            leads={session.leads ?? []}
            description={`${session.leads?.length} ${(session.leads?.length ?? 0) === 1 ? "visitor" : "visitors"} ready for this tour`}
          />
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
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={st.tabsRow}
              contentContainerStyle={{ gap: 2 }}
            >
              {(
                [
                  ["transcript", "Transcript", "chatbubble-outline"],
                  ["overview", "Overview", "grid-outline"],
                  ["rubric", "Rubric", "clipboard-outline"],
                  ["actions", "Actions", "rocket-outline"],
                  ["comments", "Comments", "chatbubbles-outline"],
                ] as const
              ).map(([id, label, icon]) => (
                <Pressable
                  key={id}
                  onPress={() => setTab(id as DTab)}
                  style={[st.tabPill, tab === id && st.tabPillActive]}
                >
                  <Ionicons
                    name={icon as any}
                    size={14}
                    color={tab === id ? C.brand : C.textMuted}
                  />
                  <Text
                    style={[st.tabPillText, tab === id && st.tabPillTextActive]}
                  >
                    {label}
                  </Text>
                  {id === "actions" &&
                    actions.filter((a) => a.status === "open").length > 0 && (
                      <View style={st.tabBadge}>
                        <Text style={st.tabBadgeText}>
                          {actions.filter((a) => a.status === "open").length}
                        </Text>
                      </View>
                    )}
                  {id === "comments" && comments.length > 0 && (
                    <View style={[st.tabBadge, { backgroundColor: C.brand }]}>
                      <Text style={st.tabBadgeText}>{comments.length}</Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </ScrollView>

            {tab === "overview" && (
              <OverviewTab
                analysis={analysis}
                transcript={transcript}
                sessionId={sessionId}
                hasRecording={session.status !== "scheduled"}
              />
            )}
            {tab === "rubric" && <RubricTab analysis={analysis} />}
            {tab === "transcript" && <TranscriptTab transcript={transcript} />}
            {tab === "actions" && (
              <ActionsTab
                actions={actions}
                sessionId={sessionId}
                onUpdate={load}
              />
            )}
            {tab === "comments" && (
              <CommentsTab
                comments={comments}
                sessionId={sessionId}
                onUpdate={load}
              />
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

function SessionReviewExperience({
  session,
  analysis,
  transcript,
  phases,
  comments,
  actions,
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
  const [sound, setSound] = useState<ExpoAudioPlayer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(
    transcript[0]?.id ?? null,
  );
  const [reviewMode, setReviewMode] = useState<SessionReviewMode>("transcript");
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<string[]>([]);
  const [commentComposerOpen, setCommentComposerOpen] = useState(false);
  const [selectionAnnotationKind, setSelectionAnnotationKind] = useState<
    "comment" | "key_moment"
  >("comment");
  const [selectionComment, setSelectionComment] = useState("");
  const [selectionBusy, setSelectionBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [followPlayback, setFollowPlayback] = useState(true);
  const [expandedAnnotation, setExpandedAnnotation] = useState<{
    segmentId: string;
    kind: TranscriptAnnotation["kind"];
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

  useEffect(() => {
    setLocalActions(actions);
  }, [actions]);
  useEffect(() => {
    reviewModeRef.current = reviewMode;
  }, [reviewMode]);
  useEffect(() => {
    followPlaybackRef.current = followPlayback;
  }, [followPlayback]);

  const scrollToSegment = useCallback((segment: any, animated = true) => {
    if (!segment) return;
    setActiveSegmentId(segment.id);
    const y = segmentY.current[segment.id];
    if (typeof y === "number")
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated });
  }, []);

  useEffect(() => {
    let mounted = true;
    let loadedSound: ExpoAudioPlayer | undefined;
    let removeStatusListener: (() => void) | undefined;
    void (async () => {
      try {
        await setAudioModeAsync({ playsInSilentMode: true });
        const resolved = await resolveSessionPlaybackUri(sessionId);
        const player = await createLoadedAudioPlayer(resolved.uri);
        if (!mounted) {
          player.remove();
          return;
        }
        loadedSound = player;
        setSound(player);
        setDuration(player.duration || 0);
        const subscription = player.addListener(
          "playbackStatusUpdate",
          (status: ExpoAudioStatus) => {
            if (!mounted) return;
            const nextPosition = status.currentTime;
            setPosition(nextPosition);
            if (status.duration) setDuration(status.duration);
            setPlaying(status.playing);
            const segment = transcript.find(
              (item) =>
                nextPosition >= item.startTime && nextPosition < item.endTime,
            );
            if (segment) {
              setActiveSegmentId(segment.id);
              if (
                status.playing &&
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
          },
        );
        removeStatusListener = () => subscription.remove();
      } catch {
        showToast("Audio is unavailable for this session", "error");
      }
    })();
    return () => {
      mounted = false;
      removeStatusListener?.();
      loadedSound?.remove();
    };
  }, [sessionId, scrollToSegment, transcript]);

  const seekToSeconds = useCallback(
    async (seconds: number, shouldPlay = false) => {
      if (!sound) return;
      const next = Math.max(0, Math.min(duration || seconds, seconds));
      await sound.seekTo(next);
      setPosition(next);
      if (shouldPlay) sound.play();
      const segment =
        transcript.find(
          (item) => next >= item.startTime && next < item.endTime,
        ) ?? transcript[0];
      if (reviewModeRef.current === "transcript" && followPlaybackRef.current)
        scrollToSegment(segment);
    },
    [duration, scrollToSegment, sound, transcript],
  );

  function setPlaybackFollowing(next: boolean) {
    followPlaybackRef.current = next;
    setFollowPlayback(next);
  }

  function returnToPlayingTranscript() {
    setPlaybackFollowing(true);
    const segment =
      transcript.find(
        (item) => position >= item.startTime && position < item.endTime,
      ) ?? transcript[0];
    if (segment) scrollToSegment(segment);
  }

  async function togglePlayback() {
    if (!sound) return;
    if (playing) sound.pause();
    else {
      void trackAnalyticsEvent("session_playback_start", { sessionId });
      sound.play();
    }
  }

  async function changeSpeed() {
    if (!sound) return;
    const next =
      speed === 1 ? 1.25 : speed === 1.25 ? 1.5 : speed === 1.5 ? 2 : 1;
    sound.setPlaybackRate(next);
    setSpeed(next);
  }

  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;
  const focusSection = useMemo(() => {
    const sections = analysis.sectionScores;
    if (!sections.length) return null;
    return sections.reduce((min, sec) => (sec.score < min.score ? sec : min))
      .section;
  }, [analysis.sectionScores]);
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
      if (
        comment.timestampSec == null ||
        comment.parentId ||
        transcript.length === 0
      )
        continue;
      const nearest = transcript.reduce(
        (best, segment) =>
          Math.abs(segment.startTime - comment.timestampSec!) <
          Math.abs(best.startTime - comment.timestampSec!)
            ? segment
            : best,
        transcript[0],
      );
      mapped.set(nearest.id, [...(mapped.get(nearest.id) ?? []), comment]);
    }
    return mapped;
  }, [comments, transcript]);
  const selectedSegments = useMemo(
    () =>
      transcript.filter((segment) => selectedSegmentIds.includes(segment.id)),
    [selectedSegmentIds, transcript],
  );
  const selectionRange = useMemo(() => {
    if (selectedSegments.length === 0) return null;
    const start = Math.min(
      ...selectedSegments.map((segment) => segment.startTime),
    );
    const end = Math.max(...selectedSegments.map((segment) => segment.endTime));
    return { start, end };
  }, [selectedSegments]);
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return transcript.filter(
      (segment) =>
        segment.text?.toLowerCase().includes(query) ||
        segment.speaker?.toLowerCase().includes(query),
    );
  }, [searchQuery, transcript]);
  function beginSegmentSelection(segmentId: string) {
    impactHaptic();
    longPressedSegmentRef.current = segmentId;
    setSelectedSegmentIds([segmentId]);
  }

  function beginCommentOnSegment(segmentId: string) {
    impactHaptic();
    longPressedSegmentRef.current = segmentId;
    setSelectedSegmentIds([segmentId]);
    setSelectionAnnotationKind("comment");
    setCommentComposerOpen(true);
  }

  function openSelectionComposer(kind: "comment" | "key_moment") {
    impactHaptic();
    setSelectionAnnotationKind(kind);
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
        : [...current, segmentId],
    );
  }

  function openTranscriptAtSegment(segment: any) {
    reviewModeRef.current = "transcript";
    setReviewMode("transcript");
    setPlaybackFollowing(true);
    void seekToSeconds(segment.startTime, true);
    requestAnimationFrame(() => scrollToSegment(segment));
  }

  async function saveSelectionAnnotation() {
    const note = selectionComment.trim();
    if (
      !selectionRange ||
      selectedSegments.length === 0 ||
      (selectionAnnotationKind === "comment" && !note)
    )
      return;
    const excerpt = selectedSegments
      .map((segment) => `${segment.speaker}: ${segment.text}`)
      .join("\n");
    setSelectionBusy(true);
    try {
      await postCommentMutation.mutateAsync({
        body: selectionAnnotationKind === "key_moment" ? note || excerpt : note,
        kind: selectionAnnotationKind,
        timestampSec: selectionRange.start,
        authorName: getCurrentSession()?.workspace.user.fullName ?? undefined,
      });
      setCommentComposerOpen(false);
      setSelectionComment("");
      setSelectedSegmentIds([]);
      showToast(
        selectionAnnotationKind === "key_moment"
          ? "Key moment saved"
          : "Comment added to transcript",
        "success",
      );
      onReload();
    } catch {
      showToast(
        selectionAnnotationKind === "key_moment"
          ? "Could not save key moment"
          : "Could not add comment",
        "error",
      );
    } finally {
      setSelectionBusy(false);
    }
  }

  async function createSelectionClip() {
    if (!selectionRange || selectedSegments.length === 0) return;
    setSelectionBusy(true);
    const excerpt = selectedSegments
      .map((segment) => `${segment.speaker}: ${segment.text}`)
      .join("\n");
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
      {
        text:
          comments.length > 0 ? `Comments (${comments.length})` : "Comments",
        onPress: onOpenComments,
      },
      { text: "Audio insights", onPress: onOpenAudioInsights },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  const transcriptGroups = useMemo(() => {
    if (!transcript.length)
      return [] as Array<{
        id: string;
        label: string;
        startTime: number;
        color: string;
        segments: any[];
      }>;
    if (!phases?.spans.length) {
      return [
        {
          id: "all",
          label: "Transcript",
          startTime: transcript[0]?.startTime ?? 0,
          color: C.brand,
          segments: transcript,
        },
      ];
    }
    return phases.spans
      .map((span, index) => {
        const segments = transcript.filter(
          (segment) =>
            segment.startTime >= span.startTime &&
            segment.startTime < span.endTime,
        );
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
        onScrollBeginDrag={() => {
          if (reviewMode === "transcript") {
            userDragging.current = true;
            setPlaybackFollowing(false);
          }
        }}
        onMomentumScrollEnd={() => {
          userDragging.current = false;
        }}
        onScrollEndDrag={() => {
          userDragging.current = false;
        }}
      >
        <View>
          <TourScreenHeader
            onBack={onBack}
            title={session.title}
            subtitle={[
              session.prospectName || "Recorded tour",
              duration ? fmtSec(duration) : null,
              `${analysis.overallScore}% score`,
            ]
              .filter(Boolean)
              .join(" · ")}
            onMorePress={readOnly ? undefined : openSessionMoreMenu}
            moreAccessibilityLabel="Session options"
          />
          {!readOnly ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open PDF report"
              onPress={onOpenReport}
              style={({ pressed }) => [
                reviewSt.reportCta,
                pressed && st.pressed,
              ]}
            >
              <View style={reviewSt.reportCtaIcon}>
                <Ionicons
                  name="document-text-outline"
                  size={20}
                  color={C.brand}
                />
              </View>
              <View style={st.flex1}>
                <Text style={reviewSt.reportCtaTitle}>PDF report</Text>
                <Text style={reviewSt.reportCtaSub}>
                  Preview, share, save, or choose an analysis version
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color={C.brand} />
            </Pressable>
          ) : null}
        </View>

        <View style={reviewSt.tabSticky}>
          <SessionModeTabs
            value={reviewMode}
            modes={
              readOnly
                ? ["rubric", "prospect", "transcript", "search", "coaching"]
                : undefined
            }
            commentCount={
              comments.filter((comment) => !comment.parentId).length
            }
            onChange={(mode) => {
              if (mode === "ai") {
                onOpenAiChat();
                return;
              }
              setReviewMode(mode);
            }}
          />
        </View>

        <View
          style={reviewSt.tabBody}
          onLayout={(event) => {
            tabBodyY.current = event.nativeEvent.layout.y;
          }}
        >
          {readOnly ? (
            <View style={reviewSt.sampleReadOnlyBanner}>
              <View style={reviewSt.sampleReadOnlyIcon}>
                <Ionicons name="sparkles" size={16} color={C.purple} />
              </View>
              <View style={st.flex1}>
                <Text style={reviewSt.sampleReadOnlyTitle}>
                  40Fifty Lofts sample
                </Text>
                <Text style={reviewSt.sampleReadOnlySub}>
                  Read only · Explore the scoring, coaching, audio, and
                  transcript.
                </Text>
              </View>
            </View>
          ) : null}
          {!readOnly && session.leads?.length > 0 ? (
            <CheckedInVisitorsCard
              leads={session.leads}
              description={`${session.leads.length} ${session.leads.length === 1 ? "visitor" : "visitors"} joined this session`}
            />
          ) : null}
          {reviewMode === "rubric" && (
            <AnimatedTabContent tabKey="rubric">
              <View style={{ gap: 12 }}>
                {focusSection ? (
                  <View style={reviewSt.focusBanner}>
                    <Text style={reviewSt.focusBannerLabel}>Focus area</Text>
                    <Text style={reviewSt.focusBannerValue}>
                      {focusSection}
                    </Text>
                  </View>
                ) : null}
                <RubricTab analysis={analysis} />
                <CollapsibleSection title="Analysis summary">
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: C.textSec,
                      lineHeight: 21,
                    }}
                  >
                    {analysis.summary}
                  </Text>
                </CollapsibleSection>
                {analysis.strengths.length > 0 ? (
                  <CollapsibleSection
                    title="Strengths"
                    defaultOpen={analysis.overallScore >= 70}
                  >
                    {analysis.strengths.map((strength, index) => (
                      <BulletItem
                        key={index}
                        text={strength}
                        color={C.textSec}
                      />
                    ))}
                  </CollapsibleSection>
                ) : null}
              </View>
            </AnimatedTabContent>
          )}
          {reviewMode === "prospect" && (
            <AnimatedTabContent tabKey="prospect">
              <ProspectInsightsCard
                analysis={analysis}
                providedInterests={session.customerInterests ?? []}
              />
            </AnimatedTabContent>
          )}
          {reviewMode === "search" && (
            <AnimatedTabContent tabKey="search">
              <View style={reviewSt.searchPanel}>
                <View style={reviewSt.searchInputWrap}>
                  <Ionicons name="search" size={18} color={C.textMuted} />
                  <TextInput
                    autoFocus
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search transcript or speaker"
                    placeholderTextColor={C.textMuted}
                    returnKeyType="search"
                    style={reviewSt.searchInput}
                  />
                  {searchQuery ? (
                    <Pressable onPress={() => setSearchQuery("")} hitSlop={10}>
                      <Ionicons
                        name="close-circle"
                        size={18}
                        color={C.textMuted}
                      />
                    </Pressable>
                  ) : null}
                </View>
                {!searchQuery.trim() ? (
                  <Text style={reviewSt.searchHint}>
                    Search names, phrases, questions, or moments from this
                    session.
                  </Text>
                ) : searchResults.length === 0 ? (
                  <EmptyState
                    icon="search-outline"
                    title="No matches"
                    subtitle="Try another word or phrase."
                  />
                ) : (
                  <View style={reviewSt.searchResults}>
                    <Text style={reviewSt.searchCount}>
                      {searchResults.length} result
                      {searchResults.length === 1 ? "" : "s"}
                    </Text>
                    {searchResults.map((segment) => (
                      <Pressable
                        key={segment.id}
                        onPress={() => openTranscriptAtSegment(segment)}
                        style={reviewSt.searchResult}
                      >
                        <View style={reviewSt.searchResultIcon}>
                          <Ionicons name="play" size={13} color={C.brand} />
                        </View>
                        <View style={st.flex1}>
                          <View style={reviewSt.searchResultMeta}>
                            <Text style={reviewSt.searchResultSpeaker}>
                              {segment.speaker}
                            </Text>
                            <Text style={reviewSt.searchResultTime}>
                              {fmtSec(segment.startTime)}
                            </Text>
                          </View>
                          <Text
                            style={reviewSt.searchResultText}
                            numberOfLines={3}
                          >
                            {segment.text}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            </AnimatedTabContent>
          )}
          {reviewMode === "coaching" && (
            <AnimatedTabContent tabKey="coaching">
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
            <AnimatedTabContent tabKey="comments">
              <CommentsTab
                comments={comments}
                sessionId={sessionId}
                onUpdate={onReload}
              />
            </AnimatedTabContent>
          )}
          {reviewMode === "transcript" && transcript.length === 0 && (
            <AnimatedTabContent tabKey="transcript-empty">
              <EmptyState
                icon="chatbubble-outline"
                title="No transcript yet"
                subtitle="The transcript will appear after processing."
              />
            </AnimatedTabContent>
          )}
          {reviewMode === "transcript" && transcript.length > 0 && (
            <View style={reviewSt.commentHint}>
              <Ionicons name="hand-left-outline" size={14} color={C.brand} />
              <Text style={reviewSt.commentHintText}>
                Long-press to select lines, or double-tap a line to comment at
                that timestamp.
              </Text>
            </View>
          )}
          {reviewMode === "transcript" &&
            transcriptGroups.map((group) => (
              <View
                key={group.id}
                style={reviewSt.phaseSection}
                onLayout={(event) => {
                  phaseY.current[group.id] = event.nativeEvent.layout.y;
                }}
              >
                <View style={reviewSt.phaseDivider}>
                  <View
                    style={[
                      reviewSt.phaseDividerLine,
                      { backgroundColor: group.color },
                    ]}
                  />
                  <Text
                    style={[reviewSt.phaseDividerTitle, { color: group.color }]}
                  >
                    {group.label}
                  </Text>
                  <Text style={reviewSt.phaseDividerTime}>
                    {fmtSec(group.startTime)}
                  </Text>
                </View>
                {group.segments.map((segment, index) => {
                  const active = segment.id === activeSegmentId;
                  const selected = selectedSegmentIds.includes(segment.id);
                  const isAgent = segment.speaker
                    ?.toLowerCase()
                    .includes("agent");
                  const prev = group.segments[index - 1];
                  const showInitial = !prev || prev.speaker !== segment.speaker;
                  const moments = coachingMoments.filter(
                    (moment) =>
                      moment.seconds !== null &&
                      moment.seconds >= segment.startTime &&
                      moment.seconds < segment.endTime,
                  );
                  const segmentComments =
                    commentsBySegment.get(segment.id) ?? [];
                  return (
                    <Reanimated.View
                      key={segment.id || index}
                      entering={FadeInDown.delay(
                        Math.min(index * 18, 180),
                      ).duration(240)}
                      onLayout={(event) => {
                        segmentY.current[segment.id] =
                          tabBodyY.current +
                          (phaseY.current[group.id] ?? 0) +
                          event.nativeEvent.layout.y;
                      }}
                      style={[
                        reviewSt.turnRow,
                        active && reviewSt.turnRowActive,
                        selected && reviewSt.turnRowSelected,
                      ]}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityHint={
                          readOnly
                            ? "Tap to play from this timestamp."
                            : "Tap to play from this timestamp. Long press to select transcript segments."
                        }
                        onLongPress={
                          readOnly
                            ? undefined
                            : () => beginSegmentSelection(segment.id)
                        }
                        delayLongPress={360}
                        onPress={() => handleTranscriptPress(segment)}
                        style={reviewSt.turnMain}
                      >
                        <View style={reviewSt.turnInitialSlot}>
                          {showInitial && (
                            <Text
                              style={[
                                reviewSt.turnInitial,
                                {
                                  color: isAgent
                                    ? tourColors.agent
                                    : tourColors.prospect,
                                },
                              ]}
                            >
                              {isAgent ? "A" : "P"}
                            </Text>
                          )}
                        </View>
                        <View style={st.flex1}>
                          <View style={reviewSt.turnMeta}>
                            <Text
                              style={[
                                reviewSt.turnSpeaker,
                                {
                                  color: isAgent
                                    ? tourColors.agent
                                    : tourColors.prospect,
                                },
                              ]}
                            >
                              {segment.speaker ||
                                (isAgent ? "Agent" : "Prospect")}
                            </Text>
                            <Text style={reviewSt.segmentTime}>
                              {fmtSec(segment.startTime)}
                            </Text>
                          </View>
                          <Text style={reviewSt.turnText}>{segment.text}</Text>
                        </View>
                      </Pressable>
                      {(() => {
                        const allGroups: Array<{
                          kind: TranscriptAnnotation["kind"];
                          items: TranscriptAnnotation[];
                        }> = [
                          {
                            kind: "ai_note",
                            items: moments.map((moment) => ({
                              id: moment.id,
                              kind: "ai_note" as const,
                              title: "AI coaching note",
                              body: [
                                moment.explanation,
                                moment.suggestedImprovement
                                  ? `Try: ${moment.suggestedImprovement}`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join("\n\n"),
                              timestampSec: moment.seconds,
                            })),
                          },
                          {
                            kind: "comment",
                            items: segmentComments
                              .filter(
                                (comment) => comment.kind !== "key_moment",
                              )
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
                              .filter(
                                (comment) => comment.kind === "key_moment",
                              )
                              .map((comment) => ({
                                id: comment.id,
                                kind: "key_moment" as const,
                                title: "Key moment",
                                body: comment.body,
                                timestampSec: comment.timestampSec,
                              })),
                          },
                        ];
                        const groups = allGroups.filter(
                          (group) => group.items.length > 0,
                        );
                        if (groups.length === 0) return null;
                        const currentExpandedAnnotation = expandedAnnotation;
                        const expandedKind =
                          currentExpandedAnnotation &&
                          currentExpandedAnnotation.segmentId === segment.id
                            ? currentExpandedAnnotation.kind
                            : null;
                        const inlineGroup = expandedKind
                          ? (groups.find(
                              (group) => group.kind === expandedKind,
                            ) ?? null)
                          : null;
                        return (
                          <>
                            <View
                              style={[
                                reviewSt.annotationRow,
                                { marginLeft: 36 },
                              ]}
                            >
                              {groups.map((group) => {
                                const color = transcriptAnnotationChipColor(
                                  group.kind,
                                );
                                const label = transcriptAnnotationChipLabel(
                                  group.kind,
                                );
                                const count = group.items.length;
                                const isExpanded = expandedKind === group.kind;
                                return (
                                  <Pressable
                                    key={group.kind}
                                    accessibilityRole="button"
                                    accessibilityLabel={`${count} ${label}`}
                                    accessibilityState={{
                                      expanded: isExpanded,
                                    }}
                                    onPress={() =>
                                      setExpandedAnnotation((current) =>
                                        current &&
                                        current.segmentId === segment.id &&
                                        current.kind === group.kind
                                          ? null
                                          : {
                                              segmentId: segment.id,
                                              kind: group.kind,
                                            },
                                      )
                                    }
                                    style={[
                                      reviewSt.annotationChip,
                                      isExpanded &&
                                        reviewSt.annotationChipExpanded,
                                      isExpanded && {
                                        borderColor: color + "44",
                                        backgroundColor: color + "0d",
                                      },
                                    ]}
                                  >
                                    <Ionicons
                                      name={transcriptAnnotationChipIcon(
                                        group.kind,
                                      )}
                                      size={12}
                                      color={color}
                                    />
                                    <Text
                                      style={[
                                        reviewSt.annotationText,
                                        { color },
                                      ]}
                                    >
                                      {label}
                                    </Text>
                                    <View
                                      style={[
                                        reviewSt.annotationCountBadge,
                                        { backgroundColor: color },
                                      ]}
                                    >
                                      <Text
                                        style={reviewSt.annotationCountText}
                                      >
                                        {count > 99 ? "99+" : String(count)}
                                      </Text>
                                    </View>
                                    <Ionicons
                                      name={
                                        isExpanded
                                          ? "chevron-up"
                                          : "chevron-down"
                                      }
                                      size={12}
                                      color={color}
                                    />
                                  </Pressable>
                                );
                              })}
                            </View>
                            {inlineGroup
                              ? (() => {
                                  const color = transcriptAnnotationChipColor(
                                    inlineGroup.kind,
                                  );
                                  const isAi = inlineGroup.kind === "ai_note";
                                  return (
                                    <Reanimated.View
                                      entering={FadeInDown.duration(180)}
                                      style={reviewSt.inlineAnnotationStack}
                                    >
                                      {inlineGroup.items.map(
                                        (item, itemIndex) => (
                                          <View
                                            key={item.id}
                                            style={[
                                              reviewSt.inlineAnnotationCard,
                                              {
                                                borderColor: isAi
                                                  ? "#e9d5ff"
                                                  : "#bfdbfe",
                                                backgroundColor: isAi
                                                  ? "#faf5ff"
                                                  : "#eff6ff",
                                              },
                                            ]}
                                          >
                                            <View
                                              style={
                                                reviewSt.inlineAnnotationHeader
                                              }
                                            >
                                              <View
                                                style={[
                                                  reviewSt.inlineAnnotationIcon,
                                                  {
                                                    backgroundColor:
                                                      color + "14",
                                                  },
                                                ]}
                                              >
                                                <Ionicons
                                                  name={transcriptAnnotationChipIcon(
                                                    inlineGroup.kind,
                                                  )}
                                                  size={14}
                                                  color={color}
                                                />
                                              </View>
                                              <Text
                                                style={[
                                                  reviewSt.inlineAnnotationTitle,
                                                  { color },
                                                ]}
                                              >
                                                {isAi &&
                                                inlineGroup.items.length > 1
                                                  ? `AI coaching note ${itemIndex + 1}`
                                                  : item.title}
                                              </Text>
                                              <Text
                                                style={[
                                                  reviewSt.inlineAnnotationTime,
                                                  { color },
                                                ]}
                                              >
                                                {item.timestampSec != null
                                                  ? fmtSec(item.timestampSec)
                                                  : ""}
                                              </Text>
                                            </View>
                                            <Text
                                              style={
                                                reviewSt.inlineAnnotationBody
                                              }
                                            >
                                              {item.body}
                                            </Text>
                                            {item.timestampSec != null ? (
                                              <Pressable
                                                accessibilityRole="button"
                                                accessibilityLabel={`Play from this ${transcriptAnnotationChipLabel(item.kind).toLowerCase()}`}
                                                onPress={() =>
                                                  void seekToSeconds(
                                                    item.timestampSec!,
                                                    true,
                                                  )
                                                }
                                                style={({ pressed }) => [
                                                  reviewSt.inlineAnnotationPlay,
                                                  {
                                                    backgroundColor:
                                                      color + "14",
                                                  },
                                                  pressed && st.pressed,
                                                ]}
                                              >
                                                <Ionicons
                                                  name="play"
                                                  size={12}
                                                  color={color}
                                                />
                                                <Text
                                                  style={[
                                                    reviewSt.inlineAnnotationPlayText,
                                                    { color },
                                                  ]}
                                                >
                                                  Play from here
                                                </Text>
                                              </Pressable>
                                            ) : null}
                                          </View>
                                        ),
                                      )}
                                    </Reanimated.View>
                                  );
                                })()
                              : null}
                          </>
                        );
                      })()}
                    </Reanimated.View>
                  );
                })}
              </View>
            ))}
        </View>
      </ScrollView>

      {!readOnly && selectedSegmentIds.length > 0 && selectionRange ? (
        <View style={reviewSt.selectionBar}>
          <Pressable
            onPress={() => setSelectedSegmentIds([])}
            style={reviewSt.selectionClose}
          >
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
            onPress={() => openSelectionComposer("comment")}
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
            {selectionBusy ? (
              <LoadingDots size="small" color={C.brand} />
            ) : (
              <Ionicons name="film-outline" size={17} color={C.brand} />
            )}
            <Text style={reviewSt.selectionActionText}>Create clip</Text>
          </Pressable>
        </View>
      ) : !readOnly ? (
        <SessionAiFab
          onPress={onOpenAiChat}
          bottomOffset={Platform.OS === "ios" ? 118 : 104}
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
        visible={commentComposerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCommentComposerOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={reviewSt.commentDrawerBackdrop}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setCommentComposerOpen(false)}
          />
          <View style={reviewSt.commentDrawerCard}>
            <View style={reviewSt.commentDrawerHandle} />
            <View style={reviewSt.commentModalHeader}>
              <View style={reviewSt.commentModalIcon}>
                <Ionicons
                  name={
                    selectionAnnotationKind === "key_moment"
                      ? "bookmark-outline"
                      : "chatbubble-outline"
                  }
                  size={18}
                  color={C.brand}
                />
              </View>
              <View style={st.flex1}>
                <Text style={reviewSt.commentModalTitle}>
                  Add to transcript
                </Text>
                <Text style={reviewSt.commentModalTime}>
                  {selectionRange
                    ? `${fmtSec(selectionRange.start)}–${fmtSec(selectionRange.end)}`
                    : ""}
                </Text>
              </View>
              <Pressable
                onPress={() => setCommentComposerOpen(false)}
                hitSlop={10}
              >
                <Ionicons name="close" size={21} color={C.textMuted} />
              </Pressable>
            </View>

            <View style={reviewSt.commentKindSwitcher}>
              {(["comment", "key_moment"] as const).map((kind) => {
                const active = selectionAnnotationKind === kind;
                return (
                  <Pressable
                    key={kind}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    onPress={() => setSelectionAnnotationKind(kind)}
                    style={[
                      reviewSt.commentKindOption,
                      active && reviewSt.commentKindOptionActive,
                    ]}
                  >
                    <Ionicons
                      name={
                        kind === "key_moment"
                          ? "bookmark-outline"
                          : "chatbubble-outline"
                      }
                      size={14}
                      color={active ? C.brand : C.textMuted}
                    />
                    <Text
                      style={[
                        reviewSt.commentKindOptionText,
                        active && reviewSt.commentKindOptionTextActive,
                      ]}
                    >
                      {kind === "key_moment" ? "Key moment" : "Comment"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={reviewSt.commentSelectionPreview}>
              <View style={reviewSt.commentSelectionPreviewHeader}>
                <Text style={reviewSt.commentSelectionPreviewLabel}>
                  Selected transcript
                </Text>
                <Text style={reviewSt.commentSelectionPreviewCount}>
                  {selectedSegments.length} selected
                </Text>
              </View>
              <ScrollView
                style={reviewSt.commentSelectionPreviewScroll}
                nestedScrollEnabled
              >
                {selectedSegments.map((segment) => (
                  <View
                    key={segment.id}
                    style={reviewSt.commentSelectionPreviewTurn}
                  >
                    <Text style={reviewSt.commentSelectionPreviewSpeaker}>
                      {segment.speaker}
                    </Text>
                    <Text style={reviewSt.commentSelectionPreviewText}>
                      {segment.text}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>

            <TextInput
              autoFocus={selectionAnnotationKind === "comment"}
              multiline
              value={selectionComment}
              onChangeText={setSelectionComment}
              placeholder={
                selectionAnnotationKind === "key_moment"
                  ? "Why is this moment important? (optional)"
                  : "Add a comment..."
              }
              placeholderTextColor={C.textMuted}
              style={reviewSt.commentModalInput}
            />
            <Pressable
              disabled={
                (selectionAnnotationKind === "comment" &&
                  !selectionComment.trim()) ||
                selectionBusy
              }
              onPress={() => void saveSelectionAnnotation()}
              style={[
                reviewSt.commentModalSubmit,
                ((selectionAnnotationKind === "comment" &&
                  !selectionComment.trim()) ||
                  selectionBusy) && { opacity: 0.5 },
              ]}
            >
              {selectionBusy ? (
                <LoadingDots size="small" color="#fff" />
              ) : (
                <Ionicons
                  name={
                    selectionAnnotationKind === "key_moment"
                      ? "bookmark"
                      : "send"
                  }
                  size={16}
                  color="#fff"
                />
              )}
              <Text style={reviewSt.commentModalSubmitText}>
                {selectionAnnotationKind === "key_moment"
                  ? "Save key moment"
                  : "Add comment"}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function DetailMeta({
  icon,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Ionicons name={icon} size={14} color={C.textSec} />
      <Text style={{ fontSize: 13, fontWeight: "700", color: C.textSec }}>
        {text}
      </Text>
    </View>
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
    <MotionPressable
      onPress={onSeek}
      haptic="selection"
      entering={FadeInDown.duration(260).springify()}
      style={[
        reviewSt.coachingMoment,
        compact && reviewSt.coachingMomentCompact,
      ]}
    >
      <View style={reviewSt.coachingMomentHeader}>
        <View style={reviewSt.coachingMomentIcon}>
          <Ionicons name="flash" size={13} color={C.purple} />
        </View>
        <Text style={reviewSt.coachingMomentKicker}>Coachable Moment</Text>
        <Text style={reviewSt.coachingMomentTime}>{moment.timestamp}</Text>
      </View>
      <Text style={reviewSt.coachingMomentBody}>{moment.explanation}</Text>
      {moment.suggestedImprovement ? (
        <View style={reviewSt.coachingSuggestion}>
          <Text style={reviewSt.coachingSuggestionLabel}>Try</Text>
          <Text style={reviewSt.coachingSuggestionText}>
            {moment.suggestedImprovement}
          </Text>
        </View>
      ) : null}
      {!compact && moment.transcriptQuote ? (
        <Text style={reviewSt.coachingQuote} numberOfLines={2}>
          "{moment.transcriptQuote}"
        </Text>
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
    <View>
      <Text style={st.fieldLabel}>Evaluation rubric</Text>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [st.inputWrap, pressed && st.pressed]}
      >
        <Ionicons name="clipboard-outline" size={18} color={C.textMuted} />
        <View style={st.flex1}>
          <Text style={st.pickerValue} numberOfLines={1}>
            {selected?.name ?? "Select rubric"}
          </Text>
          {selected && (
            <Text style={st.pickerMeta}>
              {rubricTotalPoints(selected.definition)} pts ·{" "}
              {rubricItemCount(selected.definition)} items
            </Text>
          )}
        </View>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={18}
          color={C.textMuted}
        />
      </Pressable>
      {open && (
        <View style={st.pickerMenu}>
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
                  {rubric.definition.sections.length} sections ·{" "}
                  {rubricItemCount(rubric.definition)} items
                </Text>
              </View>
              {rubric.isDefault && (
                <View style={st.defaultBadge}>
                  <Text style={st.defaultBadgeText}>Default</Text>
                </View>
              )}
              {value === rubric.id && (
                <Ionicons name="checkmark-circle" size={19} color={C.brand} />
              )}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function ProcessingTimeline({ status }: { status: string }) {
  const activeIndex = Math.max(
    0,
    SESSION_PROCESS_STEPS.findIndex((step) => step.id === status),
  );
  const isComplete = status === "analysis_ready" || status === "reviewed";

  return (
    <View style={reviewSt.processingTimeline}>
      {SESSION_PROCESS_STEPS.map((step, index) => {
        const done = isComplete || index < activeIndex;
        const active = !isComplete && index === activeIndex;
        const color = done ? C.green : active ? C.brand : C.textMuted;
        return (
          <View key={step.id} style={reviewSt.processingStep}>
            <View
              style={[
                reviewSt.processingStepIcon,
                active && reviewSt.processingStepIconActive,
                done && reviewSt.processingStepIconDone,
              ]}
            >
              {active ? (
                <PulseDot color={C.brand} />
              ) : (
                <Ionicons
                  name={(done ? "checkmark" : step.icon) as any}
                  size={16}
                  color={color}
                />
              )}
            </View>
            <Text
              style={[
                reviewSt.processingStepText,
                (active || done) && { color },
              ]}
            >
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function processingTitle(status: string) {
  switch (status) {
    case "uploaded":
      return "Preparing Your Tour";
    case "transcribing":
      return "Creating Transcript";
    case "segmenting":
      return "Organizing Tour Moments";
    case "analyzing":
      return "Scoring Conversation";
    default:
      return "Preparing Insights";
  }
}

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
  autoStartRecording?: boolean;
  initialNotes?: string | null;
  initialLeads: SessionLead[];
  initialAttachments: SessionAttachment[];
  onDone: () => void;
}) {
  const rec = useRecording();
  const [phase, setPhase] = useState<
    "idle" | "uploading" | "details" | "processing" | "done" | "error"
  >(PROCESSING_STATUSES.has(status) ? "processing" : "idle");
  const [uploadStats, setUploadStats] =
    useState<UploadStats>(initialUploadStats());
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<"upload" | "processing" | null>(
    null,
  );
  const [pickedFile, setPickedFile] = useState<RecordingUploadFile | null>(
    null,
  );
  const [pendingLocalId, setPendingLocalId] = useState<string | null>(null);
  const [pendingUploadChecked, setPendingUploadChecked] = useState(false);

  // Details form fields
  const [dTitle, setDTitle] = useState("");
  const [dProspect, setDProspect] = useState("");
  const [dLocation, setDLocation] = useState("");
  const [dNotes, setDNotes] = useState(initialNotes ?? "");
  const [assets, setAssets] = useState<Material[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>(
    initialAttachments
      .map((attachment) => attachment.materialId)
      .filter((id): id is string => Boolean(id)),
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
        setAssets(
          materialData.materials.filter((material) => materialUrl(material)),
        );
        if (!initialRubricId) {
          const fallbackRubricId =
            list.find((rubric) => rubric.isDefault)?.id ?? list[0]?.id ?? null;
          setRubricId(fallbackRubricId);
          if (fallbackRubricId) {
            void applyRubricToSession(sessionId, fallbackRubricId).catch(
              () => {},
            );
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
      setErrMsg(
        "Analysis did not complete. Retry when you have a stable connection.",
      );
      setErrorKind("processing");
      setPhase("error");
    }
  }, [status]);

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
      setErrMsg(
        "Upload did not finish. Retry when you have a stable connection.",
      );
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
      showToast(
        caught instanceof Error ? caught.message : "Could not apply rubric",
        "error",
      );
    }
  }

  async function uploadPickedFile(
    file: RecordingUploadFile,
    localId?: string | null,
  ) {
    setPickedFile(file);
    setPhase("uploading");
    setErrMsg(null);
    setErrorKind(null);
    setUploadStats(initialUploadStats(file.size));
    let durableUri = file.uri;
    let directUploadLocalId: string | null = null;
    let shouldDrainOutbox = false;
    try {
      if (localId) {
        const verifiedUri = await ensureDurableRecording(localId, file.uri);
        if (!verifiedUri) {
          throw new Error(
            "Recording file could not be read after it was saved. Please keep this screen open and retry.",
          );
        }
        durableUri = verifiedUri;
        beginDirectLocalUpload(localId);
        directUploadLocalId = localId;
        markReadyToSync(localId, {
          durationSec: file.durationSec ?? 1,
          sourceUri: durableUri,
          remoteSessionId: sessionId,
          fileName: file.name,
          mimeType: file.mimeType,
        });
      }

      if (!(await isOnline())) {
        setPhase("error");
        setErrorKind("upload");
        setErrMsg("Saved on device — will upload when online.");
        showToast("Saved on device — will upload when online", "info");
        shouldDrainOutbox = true;
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
      promoteLocalRecordingToCache(sessionId, durableUri);
      await clearPendingRecordingUpload(sessionId, localId);
      void trackAnalyticsEvent("session_upload_complete", { sessionId });
      setUploadStats((current) => ({
        ...current,
        phase: "finalizing",
        percent: 100,
        etaSeconds: 0,
      }));
      showToast("Recording uploaded", "success");
      setPhase("details");
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
      showToast(
        caught instanceof Error ? caught.message : "Upload failed",
        "error",
      );
      shouldDrainOutbox = true;
    } finally {
      if (directUploadLocalId) endDirectLocalUpload(directUploadLocalId);
      if (shouldDrainOutbox) void drainSyncOutbox();
    }
  }

  function startSessionRecording() {
    rec.openExperience({
      meta: {
        sessionId,
        title: dTitle.trim() || sessionTitle?.trim() || "Tour conversation",
        prospectName: dProspect.trim() || prospectName?.trim() || null,
        propertyName: dLocation.trim() || propertyName?.trim() || null,
        agentName: agentName?.trim() || null,
        source: "session-detail",
      },
      draft: {
        notes: dNotes,
        assets,
        selectedAssetIds,
        participants: initialLeads,
        attachments: initialAttachments,
        prospect: dProspect.trim() || prospectName?.trim() || "",
        location: dLocation.trim() || propertyName?.trim() || "",
        rubricId,
      },
      onBeforeRecordingStart: async () => {
        if (await isOnline()) {
          const response = await authenticatedFetch(
            `/api/sessions/${sessionId}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "in_progress" }),
            },
          );
          if (!response.ok)
            throw new Error("Could not activate the tour session");
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
            const response = await authenticatedFetch(
              `/api/sessions/${sessionId}`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "scheduled" }),
              },
            );
            if (!response.ok) throw new Error("Could not reset the session");
          }
          showToast(
            "Recording cancelled. Session returned to scheduled.",
            "success",
          );
          await onDone();
        } catch (caught) {
          showToast(
            caught instanceof Error
              ? caught.message
              : "Could not cancel the session",
            "error",
          );
        } finally {
          setCancelling(false);
        }
      },
      onFinish: async (snapshot) => {
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
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
          const verifiedUri = await ensureDurableRecording(localId, result.uri);
          if (!verifiedUri) {
            snapshot.clearLiveSession();
            showToast("Failed to save recording", "error");
            return;
          }
          durableUri = verifiedUri;
          updateLocalSession(localId, {
            status: "recording",
            minimized: true,
            durationSec: result.durationSec,
            remoteSessionId: sessionId,
            draft: snapshot.draft,
            fileName: `tour-${Date.now()}.m4a`,
            mimeType: "audio/m4a",
          });
        }
        snapshot.clearLiveSession();
        setDNotes(notes);
        await uploadPickedFile(
          {
            uri: durableUri,
            mimeType: "audio/m4a",
            name: `tour-${Date.now()}.m4a`,
            durationSec: result.durationSec,
          },
          localId,
        );
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
      showToast(
        "Recording cancelled. Session returned to scheduled.",
        "success",
      );
      await onDone();
    } catch (caught) {
      showToast(
        caught instanceof Error
          ? caught.message
          : "Could not cancel the session",
        "error",
      );
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
        {
          text: "Cancel recording",
          style: "destructive",
          onPress: () => void cancelSessionRecording(),
        },
      ],
    );
  }

  async function pickAndUpload() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["video/*", "audio/*"],
        copyToCacheDirectory: true,
      });
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
        showToast(
          err instanceof Error ? err.message : "Upload failed",
          "error",
        );
      }
    }
  }

  async function submitDetailsAndProcess() {
    // Save session details if anything was filled in
    const patchBody: Record<string, string> = {};
    if (dTitle.trim()) patchBody.title = dTitle.trim();
    if (dProspect.trim()) patchBody.prospectName = dProspect.trim();
    if (dLocation.trim()) patchBody.location = dLocation.trim();
    if (dNotes.trim()) patchBody.notes = dNotes.trim();

    if (Object.keys(patchBody).length > 0) {
      try {
        await authenticatedFetch(`/api/sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchBody),
        });
      } catch {
        /* best effort */
      }
    }

    // Process the already-uploaded recording
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
      showToast(
        err instanceof Error ? err.message : "Processing failed",
        "error",
      );
    }
  }

  async function startProcess() {
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
      showToast(
        err instanceof Error ? err.message : "Processing failed",
        "error",
      );
    }
  }

  // Resume an uploaded session only after its evaluation rubric is resolved.
  useEffect(() => {
    if (
      status !== "uploaded" ||
      phase !== "idle" ||
      !rubricsLoaded ||
      !pendingUploadChecked
    )
      return;
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
  if (
    phase === "idle" &&
    (status === "scheduled" || status === "in_progress")
  ) {
    return (
      <View style={[st.card, { padding: 20, gap: 14 }]}>
        <View style={{ alignItems: "center", gap: 8 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: C.brand + "10",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="mic-outline" size={28} color={C.brand} />
          </View>
          <Text style={st.formTitle}>
            {status === "in_progress" ? "Resume this tour" : "Start this tour"}
          </Text>
          <Text style={[st.pageSub, { textAlign: "center" }]}>
            Record live audio or upload an existing recording.
          </Text>
        </View>
        {rubrics.length > 0 && (
          <RubricPicker
            rubrics={rubrics}
            value={rubricId}
            open={rubricOpen}
            onToggle={() => setRubricOpen((current) => !current)}
            onSelect={(id) => void selectRubric(id)}
          />
        )}
        <PrimaryBtn
          label="Record Audio"
          onPress={startSessionRecording}
          icon="mic-outline"
        />
        <Pressable
          onPress={pickAndUpload}
          style={({ pressed }) => [st.outlineBtn, pressed && st.pressed]}
        >
          <Ionicons
            name="document-attach-outline"
            size={18}
            color={C.textSec}
          />
          <Text style={st.outlineBtnText}>Upload File</Text>
        </Pressable>
        {status === "in_progress" && (
          <Pressable
            disabled={cancelling}
            onPress={confirmCancelSession}
            style={({ pressed }) => [
              st.cancelSessionBtn,
              pressed && st.pressed,
            ]}
          >
            {cancelling ? (
              <LoadingDots size="small" color={C.red} />
            ) : (
              <Ionicons name="close-circle-outline" size={18} color={C.red} />
            )}
            <Text style={st.cancelSessionText}>
              {cancelling ? "Cancelling..." : "Cancel active session"}
            </Text>
          </Pressable>
        )}
      </View>
    );
  }

  // ── Details form after upload ──
  if (phase === "details") {
    const fileSizeMB = pickedFile?.size
      ? (pickedFile.size / 1024 / 1024).toFixed(1)
      : null;
    return (
      <View style={[st.card, { overflow: "hidden" }]}>
        {/* Upload success header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            padding: 14,
            backgroundColor: C.greenBg,
            borderBottomWidth: 1,
            borderBottomColor: "#e2e8f0",
          }}
        >
          <Ionicons name="checkmark-circle" size={20} color={C.green} />
          <View style={st.flex1}>
            <Text style={{ fontSize: 13, fontWeight: "800", color: C.green }}>
              Recording uploaded
            </Text>
            <Text
              style={{ fontSize: 12, fontWeight: "600", color: C.textSec }}
              numberOfLines={1}
            >
              {pickedFile?.name}
              {fileSizeMB ? ` (${fileSizeMB} MB)` : ""}
            </Text>
          </View>
        </View>

        {/* Session details form */}
        <View style={{ padding: 18, gap: 14 }}>
          <Text style={st.formTitle}>Session Details</Text>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              color: C.textSec,
              marginTop: -8,
            }}
          >
            Add context before processing (optional)
          </Text>
          <Input
            placeholder="Session title"
            value={dTitle}
            onChangeText={setDTitle}
            icon="text-outline"
          />
          <Input
            placeholder="Prospect name"
            value={dProspect}
            onChangeText={setDProspect}
            icon="person-outline"
          />
          <Input
            placeholder="Location / unit"
            value={dLocation}
            onChangeText={setDLocation}
            icon="location-outline"
          />
          {rubrics.length > 0 && (
            <RubricPicker
              rubrics={rubrics}
              value={rubricId}
              open={rubricOpen}
              onToggle={() => setRubricOpen((current) => !current)}
              onSelect={(id) => void selectRubric(id)}
            />
          )}
          <Input
            placeholder="Notes or focus areas"
            value={dNotes}
            onChangeText={setDNotes}
            icon="document-text-outline"
            multiline
          />
          <PrimaryBtn
            label="Start Processing"
            onPress={submitDetailsAndProcess}
            icon="analytics-outline"
          />
          <Pressable
            onPress={() => submitDetailsAndProcess()}
            style={({ pressed }) => [pressed && st.pressed]}
          >
            <Text
              style={{
                textAlign: "center",
                fontSize: 13,
                fontWeight: "700",
                color: C.textMuted,
                paddingVertical: 6,
              }}
            >
              Skip, process now
            </Text>
          </Pressable>
        </View>
      </View>
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
      <View style={[st.card, { padding: 20, gap: 14, alignItems: "center" }]}>
        <LoadingDots size="large" color={C.brand} />
        <Text style={st.formTitle}>{processingTitle(status)}</Text>
        <Text style={[st.pageSub, { textAlign: "center" }]}>
          {processingStatusMessage(status)}
        </Text>
        <ProcessingTimeline status={status} />
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
    return uploadError ? (
      <UploadStatusCard
        fileName={pickedFile?.name}
        fileSize={pickedFile?.size}
        stats={uploadStats}
        error={errMsg ?? "Upload failed"}
        onRetry={
          pickedFile
            ? () => void uploadPickedFile(pickedFile, pendingLocalId)
            : undefined
        }
        onChooseDifferent={() => void pickAndUpload()}
      />
    ) : (
      <View style={[st.card, { padding: 20, gap: 12 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Ionicons name="alert-circle" size={24} color={C.red} />
          <Text style={[st.formTitle, { color: C.red }]}>
            Processing Failed
          </Text>
        </View>
        {errMsg && (
          <Text style={{ fontSize: 13, fontWeight: "600", color: C.textSec }}>
            {errMsg}
          </Text>
        )}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            onPress={startProcess}
            style={({ pressed }) => [
              st.primaryBtn,
              { flex: 1 },
              pressed && st.pressed,
            ]}
          >
            <Text style={st.primaryBtnText}>Retry Analysis</Text>
          </Pressable>
          <Pressable
            onPress={pickAndUpload}
            style={({ pressed }) => [
              st.outlineBtn,
              { flex: 1 },
              pressed && st.pressed,
            ]}
          >
            <Text style={st.outlineBtnText}>Upload Different</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Fallback: uploaded but not yet processing
  return (
    <View style={[st.card, { padding: 20, gap: 12 }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Ionicons name="checkmark-circle" size={20} color={C.green} />
        <Text style={{ fontSize: 14, fontWeight: "700", color: C.green }}>
          Recording uploaded
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <PrimaryBtn
          label="Process Now"
          onPress={startProcess}
          icon="analytics-outline"
        />
        <Pressable
          onPress={pickAndUpload}
          style={({ pressed }) => [st.outlineBtn, pressed && st.pressed]}
        >
          <Text style={st.outlineBtnText}>Re-upload</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════
// Overview Tab + Audio Player
// ═══════════════════════════════════════

function OverviewTab({
  analysis,
  transcript,
  sessionId,
  hasRecording,
}: {
  analysis: AnalysisResult;
  transcript: any[];
  sessionId: string;
  hasRecording: boolean;
}) {
  return (
    <View style={{ gap: 12 }}>
      {hasRecording && (
        <AudioPlayer sessionId={sessionId} transcript={transcript} />
      )}

      <InfoCard title="Executive Summary" icon="document-text-outline">
        {analysis.summary}
      </InfoCard>

      <View style={[st.card, { borderLeftWidth: 3, borderLeftColor: C.green }]}>
        <View style={{ padding: 16, gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="thumbs-up-outline" size={16} color={C.green} />
            <Text style={[st.cardTitle, { color: C.green }]}>Strengths</Text>
          </View>
          {analysis.strengths.map((s, i) => (
            <BulletItem key={i} text={s} color={C.green} />
          ))}
        </View>
      </View>

      <View style={[st.card, { borderLeftWidth: 3, borderLeftColor: C.amber }]}>
        <View style={{ padding: 16, gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="trending-up-outline" size={16} color={C.amber} />
            <Text style={[st.cardTitle, { color: C.amber }]}>
              Opportunities
            </Text>
          </View>
          {analysis.opportunities.map((o, i) => (
            <BulletItem key={i} text={o} color={C.amber} />
          ))}
        </View>
      </View>

      {analysis.suggestedRewrite && (
        <View
          style={[st.card, { borderLeftWidth: 3, borderLeftColor: C.brand }]}
        >
          <View style={{ padding: 16, gap: 8 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={16}
                color={C.brand}
              />
              <Text style={[st.cardTitle, { color: C.brand }]}>
                Coaching Script
              </Text>
            </View>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: C.textSec,
                lineHeight: 21,
                fontStyle: "italic",
              }}
            >
              "{analysis.suggestedRewrite}"
            </Text>
          </View>
        </View>
      )}

      {analysis.fairHousingFlags && analysis.fairHousingFlags.length > 0 && (
        <View
          style={[
            st.card,
            { backgroundColor: C.redBg, borderColor: C.red + "30" },
          ]}
        >
          <View style={{ padding: 16, gap: 8 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Ionicons name="shield-outline" size={16} color={C.red} />
              <Text style={[st.cardTitle, { color: C.red }]}>
                Fair Housing Flags
              </Text>
            </View>
            {analysis.fairHousingFlags.map((f, i) => (
              <Text
                key={i}
                style={{ fontSize: 13, fontWeight: "600", color: C.red }}
              >
                • {f}
              </Text>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function AudioPlayer({
  sessionId,
  transcript,
}: {
  sessionId: string;
  transcript: any[];
}) {
  const [sound, setSound] = useState<ExpoAudioPlayer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let mounted = true;
    let s: ExpoAudioPlayer | undefined;
    let removeStatusListener: (() => void) | undefined;

    (async () => {
      try {
        await setAudioModeAsync({ playsInSilentMode: true });
        const resolved = await resolveSessionPlaybackUri(sessionId);
        const loaded = await createLoadedAudioPlayer(resolved.uri);
        if (!mounted) {
          loaded.remove();
          return;
        }
        s = loaded;
        setSound(loaded);
        setLoadError(false);
        setDur(loaded.duration || 0);
        const subscription = loaded.addListener(
          "playbackStatusUpdate",
          (st: ExpoAudioStatus) => {
            if (!mounted) return;
            setPos(st.currentTime);
            if (st.duration) setDur(st.duration);
            setPlaying(st.playing);
            if (st.didJustFinish) {
              setPlaying(false);
              setPos(0);
            }
          },
        );
        removeStatusListener = () => subscription.remove();
      } catch {
        if (mounted) setLoadError(true);
      }
    })();
    return () => {
      mounted = false;
      removeStatusListener?.();
      s?.remove();
    };
  }, [sessionId, retryToken]);

  async function togglePlay() {
    if (!sound) return;
    if (playing) {
      sound.pause();
      setPlaying(false);
    } else {
      sound.play();
      setPlaying(true);
    }
  }

  async function seekTo(frac: number) {
    if (!sound || dur === 0) return;
    await sound.seekTo(frac * dur);
    setPos(frac * dur);
  }

  const pct = dur > 0 ? (pos / dur) * 100 : 0;
  const activeSeg = transcript.find(
    (s) => pos >= s.startTime && pos < s.endTime,
  );

  if (loadError) {
    return (
      <View
        style={[
          st.card,
          { padding: 16, flexDirection: "row", alignItems: "center", gap: 10 },
        ]}
      >
        <Ionicons name="alert-circle-outline" size={20} color={C.textMuted} />
        <Text
          style={{ fontSize: 13, fontWeight: "600", color: C.textSec, flex: 1 }}
        >
          Audio unavailable
        </Text>
        <Pressable
          onPress={() => {
            setLoadError(false);
            setSound(null);
            setRetryToken((n) => n + 1);
          }}
          style={({ pressed }) => pressed && st.pressed}
        >
          <Text style={{ fontSize: 13, fontWeight: "800", color: C.brand }}>
            Retry
          </Text>
        </Pressable>
      </View>
    );
  }

  if (!sound) {
    return (
      <View
        style={[
          st.card,
          { padding: 16, flexDirection: "row", alignItems: "center", gap: 10 },
        ]}
      >
        <LoadingDots size="small" color={C.brand} />
        <Text style={{ fontSize: 13, fontWeight: "600", color: C.textSec }}>
          Loading audio...
        </Text>
      </View>
    );
  }

  return (
    <View style={[st.card, { overflow: "hidden" }]}>
      <View style={{ padding: 16, gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable
            onPress={togglePlay}
            style={({ pressed }) => [st.playBtn, pressed && st.pressed]}
          >
            <Ionicons
              name={playing ? "pause" : "play"}
              size={22}
              color="#fff"
            />
          </Pressable>
          <View style={st.flex1}>
            <Pressable
              onPress={(e) => {
                const w = Dimensions.get("window").width - 120;
                seekTo(
                  Math.max(
                    0,
                    Math.min(1, (e.nativeEvent as any).locationX / w),
                  ),
                );
              }}
            >
              <View style={st.timelineTrack}>
                <View style={[st.timelineFill, { width: `${pct}%` as any }]} />
                <View style={[st.timelineThumb, { left: `${pct}%` as any }]} />
              </View>
            </Pressable>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: 4,
              }}
            >
              <Text style={st.timeText}>{fmtSec(pos)}</Text>
              <Text style={st.timeText}>{fmtSec(dur)}</Text>
            </View>
          </View>
        </View>
        {activeSeg && (
          <View
            style={{
              backgroundColor: C.brand + "08",
              borderRadius: 10,
              padding: 10,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "800",
                color: C.brand,
                marginBottom: 2,
              }}
            >
              {activeSeg.speaker}
            </Text>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: C.text,
                lineHeight: 19,
              }}
            >
              {activeSeg.text}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function InfoCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: string;
}) {
  return (
    <View style={st.card}>
      <View style={{ padding: 16, gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name={icon} size={16} color={C.text} />
          <Text style={st.cardTitle}>{title}</Text>
        </View>
        <Text
          style={{
            fontSize: 14,
            fontWeight: "600",
            color: C.textSec,
            lineHeight: 21,
          }}
        >
          {children}
        </Text>
      </View>
    </View>
  );
}

function BulletItem({ text, color }: { text: string; color: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
      <Ionicons
        name="ellipse"
        size={6}
        color={color}
        style={{ marginTop: 7 }}
      />
      <Text
        style={{
          flex: 1,
          fontSize: 14,
          fontWeight: "600",
          color: C.textSec,
          lineHeight: 21,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

// ═══════════════════════════════════════
// Transcript Tab
// ═══════════════════════════════════════

function TranscriptTab({ transcript }: { transcript: any[] }) {
  if (!transcript.length)
    return (
      <EmptyState
        icon="chatbubble-outline"
        title="No transcript"
        subtitle="Process a recording to generate the transcript"
      />
    );
  return (
    <View style={st.card}>
      <View style={{ padding: 16 }}>
        {transcript.map((seg, i) => {
          const isAgent = seg.speaker?.toLowerCase().includes("agent");
          return (
            <View
              key={seg.id || i}
              style={[
                { paddingVertical: 10 },
                i > 0 && { borderTopWidth: 1, borderTopColor: "#f1f5f9" },
              ]}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <View
                  style={[
                    st.speakerBadge,
                    { backgroundColor: isAgent ? C.brand + "15" : C.purpleBg },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "800",
                      color: isAgent ? C.brand : C.purple,
                    }}
                  >
                    {seg.speaker}
                  </Text>
                </View>
                <Text style={st.timeText}>{fmtSec(seg.startTime)}</Text>
              </View>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: C.text,
                  lineHeight: 21,
                }}
              >
                {seg.text}
              </Text>
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
  onActionsChange?: (
    next: FollowUpAction[] | ((prev: FollowUpAction[]) => FollowUpAction[]),
  ) => void;
  readOnly?: boolean;
}) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const updateActionMutation = useUpdateActionStatusMutation(sessionId);
  const priorityRank = { high: 0, medium: 1, low: 2 } as const;
  const open = actions
    .filter((a) => a.status === "open")
    .sort(
      (left, right) =>
        (priorityRank[left.priority] ?? 1) -
        (priorityRank[right.priority] ?? 1),
    );
  const done = actions.filter((a) => a.status !== "open");

  async function handleStatus(id: string, status: "completed" | "dismissed") {
    const previous = actions;
    onActionsChange?.((prev) =>
      prev.map((action) => (action.id === id ? { ...action, status } : action)),
    );
    setUpdatingId(id);
    try {
      await updateActionMutation.mutateAsync({ actionId: id, status });
      showToast(
        status === "completed" ? "Marked as done" : "Dismissed",
        "success",
      );
      onUpdate();
    } catch {
      onActionsChange?.(previous);
      showToast("Failed to update", "error");
    } finally {
      setUpdatingId(null);
    }
  }

  if (!actions.length)
    return (
      <EmptyState
        icon="rocket-outline"
        title="No actions"
        subtitle="Follow-up actions will appear after analysis"
      />
    );

  const defaultPi = {
    icon: "remove-circle" as keyof typeof Ionicons.glyphMap,
    color: C.amber,
  };
  const priorityIcon: Record<
    string,
    { icon: keyof typeof Ionicons.glyphMap; color: string }
  > = {
    high: { icon: "arrow-up-circle", color: C.red },
    medium: defaultPi,
    low: { icon: "arrow-down-circle", color: C.green },
  };

  return (
    <View style={{ gap: 12 }}>
      {actions.length > 0 ? (
        <View style={reviewSt.focusBanner}>
          <Text style={reviewSt.focusBannerLabel}>Progress</Text>
          <Text style={reviewSt.focusBannerValue}>
            {done.length} of {actions.length} complete
          </Text>
        </View>
      ) : null}
      {open.length > 0 &&
        open.map((a) => {
          const pi = priorityIcon[a.priority] ?? defaultPi;
          return (
            <View key={a.id} style={st.card}>
              <View style={{ padding: 16, gap: 10 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <Ionicons
                    name={pi.icon}
                    size={20}
                    color={pi.color}
                    style={{ marginTop: 1 }}
                  />
                  <View style={st.flex1}>
                    <Text
                      style={{ fontSize: 15, fontWeight: "800", color: C.text }}
                      numberOfLines={2}
                    >
                      {a.title}
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "600",
                        color: C.textSec,
                        lineHeight: 20,
                        marginTop: 2,
                      }}
                    >
                      {a.description}
                    </Text>
                  </View>
                </View>
                {a.suggestedMessage && (
                  <View
                    style={{
                      backgroundColor: "#f8fafc",
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "800",
                        color: C.textMuted,
                        textTransform: "uppercase",
                        marginBottom: 4,
                      }}
                    >
                      Suggested message
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "600",
                        color: C.text,
                        lineHeight: 20,
                        fontStyle: "italic",
                      }}
                    >
                      {a.suggestedMessage}
                    </Text>
                  </View>
                )}
                {!readOnly && (
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Pressable
                      onPress={() => handleStatus(a.id, "completed")}
                      disabled={updatingId === a.id}
                      style={({ pressed }) => [
                        {
                          flex: 1,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          backgroundColor: C.green,
                          borderRadius: 12,
                          paddingVertical: 10,
                        },
                        pressed && st.pressed,
                      ]}
                    >
                      {updatingId === a.id ? (
                        <LoadingDots size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons
                            name="checkmark-circle-outline"
                            size={16}
                            color="#fff"
                          />
                          <Text
                            style={{
                              color: "#fff",
                              fontSize: 14,
                              fontWeight: "800",
                            }}
                          >
                            Complete
                          </Text>
                        </>
                      )}
                    </Pressable>
                    <Pressable
                      onPress={() => handleStatus(a.id, "dismissed")}
                      disabled={updatingId === a.id}
                      style={({ pressed }) => [
                        {
                          flex: 1,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          backgroundColor: "#f1f5f9",
                          borderRadius: 12,
                          paddingVertical: 10,
                        },
                        pressed && st.pressed,
                      ]}
                    >
                      <Ionicons
                        name="close-circle-outline"
                        size={16}
                        color={C.textSec}
                      />
                      <Text
                        style={{
                          color: C.textSec,
                          fontSize: 14,
                          fontWeight: "800",
                        }}
                      >
                        Dismiss
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      {done.length > 0 ? (
        <CollapsibleSection title={`Completed (${done.length})`}>
          {done.map((a) => (
            <View
              key={a.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                opacity: 0.7,
              }}
            >
              <Ionicons
                name={
                  a.status === "completed" ? "checkmark-circle" : "close-circle"
                }
                size={18}
                color={a.status === "completed" ? C.green : C.textMuted}
              />
              <Text
                style={{
                  flex: 1,
                  fontSize: 14,
                  fontWeight: "700",
                  color: C.text,
                }}
                numberOfLines={1}
              >
                {a.title}
              </Text>
            </View>
          ))}
        </CollapsibleSection>
      ) : null}
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
    if (!title && sessionQuery.data?.session?.title)
      setTitle(sessionQuery.data.session.title);
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={C.brand}
          />
        }
        contentContainerStyle={reviewSt.commentsPageContent}
      >
        {error ? (
          <ErrorBanner
            message={
              error instanceof Error ? error.message : "Could not load comments"
            }
            onRetry={load}
          />
        ) : null}
        {loading ? (
          <LoadingBox />
        ) : (
          <CommentsTab
            comments={comments}
            sessionId={sessionId}
            onUpdate={load}
          />
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
      await postCommentMutation.mutateAsync({
        body: body.trim(),
        parentId: replyToId,
      });
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
  const getReplies = (parentId: string) =>
    comments.filter((c) => c.parentId === parentId);

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
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: C.brand + "10",
                borderRadius: 8,
                padding: 8,
              }}
            >
              <Ionicons
                name="return-down-forward-outline"
                size={14}
                color={C.brand}
              />
              <Text
                style={{
                  flex: 1,
                  fontSize: 12,
                  fontWeight: "700",
                  color: C.brand,
                }}
              >
                Replying to comment
              </Text>
              <Pressable onPress={() => setReplyToId(null)}>
                <Ionicons name="close-circle" size={18} color={C.textMuted} />
              </Pressable>
            </View>
          )}
          <TextInput
            placeholder="Add a comment..."
            placeholderTextColor={C.textMuted}
            value={body}
            onChangeText={setBody}
            multiline
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: C.text,
              minHeight: 60,
              textAlignVertical: "top",
            }}
          />
          <Pressable
            onPress={handlePost}
            disabled={!body.trim() || submitting}
            style={({ pressed }) => [
              st.primaryBtn,
              { minHeight: 42 },
              pressed && st.pressed,
              (!body.trim() || submitting) && { opacity: 0.5 },
            ]}
          >
            <Ionicons name="send-outline" size={16} color="#fff" />
            <Text style={[st.primaryBtnText, { fontSize: 14 }]}>
              {submitting ? "Posting..." : "Post Comment"}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Comments list */}
      {topLevel.length === 0 ? (
        <EmptyState
          icon="chatbubbles-outline"
          title="No comments yet"
          subtitle="Be the first to add feedback on this session"
        />
      ) : (
        topLevel.map((c) => (
          <View key={c.id} style={st.card}>
            <View style={{ padding: 14, gap: 8 }}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: C.brand + "15",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{ fontSize: 12, fontWeight: "900", color: C.brand }}
                  >
                    {c.authorName[0]?.toUpperCase()}
                  </Text>
                </View>
                <Text
                  style={{ fontSize: 13, fontWeight: "800", color: C.text }}
                >
                  {c.authorName}
                </Text>
                <View style={reviewSt.commentKindBadge}>
                  <Ionicons
                    name={
                      c.kind === "key_moment" ? "star" : "chatbubble-outline"
                    }
                    size={10}
                    color={c.kind === "key_moment" ? C.purple : C.brand}
                  />
                  <Text
                    style={[
                      reviewSt.commentKindText,
                      c.kind === "key_moment" && { color: C.purple },
                    ]}
                  >
                    {c.kind === "key_moment" ? "Key moment" : "Manual"}
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "600",
                    color: C.textMuted,
                  }}
                >
                  {relativeTime(c.createdAt)}
                </Text>
                {c.timestampSec !== null && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 3,
                      backgroundColor: C.brand + "10",
                      borderRadius: 99,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                    }}
                  >
                    <Ionicons name="time-outline" size={10} color={C.brand} />
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "800",
                        color: C.brand,
                      }}
                    >
                      {fmtSec(c.timestampSec)}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }} />
                <Pressable
                  onPress={() => setReplyToId(c.id)}
                  style={{ padding: 4 }}
                >
                  <Ionicons
                    name="return-down-forward-outline"
                    size={16}
                    color={C.textMuted}
                  />
                </Pressable>
                <Pressable
                  onPress={() => handleDelete(c.id)}
                  style={{ padding: 4 }}
                >
                  <Ionicons
                    name="trash-outline"
                    size={16}
                    color={C.textMuted}
                  />
                </Pressable>
              </View>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: C.textSec,
                  lineHeight: 21,
                }}
              >
                {c.body}
              </Text>

              {/* Replies */}
              {getReplies(c.id).map((r) => (
                <View
                  key={r.id}
                  style={{
                    marginLeft: 28,
                    marginTop: 8,
                    paddingLeft: 10,
                    borderLeftWidth: 2,
                    borderLeftColor: C.brand + "20",
                    gap: 6,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        backgroundColor: C.brand + "10",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 9,
                          fontWeight: "900",
                          color: C.brand,
                        }}
                      >
                        {r.authorName[0]?.toUpperCase()}
                      </Text>
                    </View>
                    <Text
                      style={{ fontSize: 12, fontWeight: "800", color: C.text }}
                    >
                      {r.authorName}
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "600",
                        color: C.textMuted,
                      }}
                    >
                      {relativeTime(r.createdAt)}
                    </Text>
                    <View style={{ flex: 1 }} />
                    <Pressable
                      onPress={() => handleDelete(r.id)}
                      style={{ padding: 4 }}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={14}
                        color={C.textMuted}
                      />
                    </Pressable>
                  </View>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "600",
                      color: C.textSec,
                      lineHeight: 20,
                    }}
                  >
                    {r.body}
                  </Text>
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
      Alert.alert(
        "Could not open Tour.you",
        `Open ${url} in your browser to manage rubric settings.`,
      );
    }
  }

  function applicationsFor(rubricId: string) {
    return sessions.filter((item) => item.rubricId === rubricId);
  }

  const defaultRubric =
    rubrics.find((rubric) => rubric.isDefault) ?? rubrics[0] ?? null;
  const otherRubrics = defaultRubric
    ? rubrics.filter((rubric) => rubric.id !== defaultRubric.id)
    : rubrics;

  return (
    <View style={st.flex1}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={st.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={C.brand}
          />
        }
      >
        <View style={st.page}>
          <View style={st.pageHeadingRow}>
            <BackBtn label="Settings" onPress={onBack} />
            <View style={st.flex1} />
          </View>
          <View>
            <Text style={st.pageTitle}>Rubrics</Text>
            <Text style={st.pageHeadingSub}>
              {session.workspace.community.name}
            </Text>
          </View>
          {error && (
            <ErrorBanner
              message={
                error instanceof Error
                  ? error.message
                  : "Could not load rubrics"
              }
              onRetry={load}
            />
          )}
          <MotionPressable
            onPress={() => void openRubricSettings()}
            haptic="selection"
            style={st.defaultRubricCard}
          >
            <View
              style={[
                st.defaultRubricIcon,
                { backgroundColor: C.brand + "10" },
              ]}
            >
              <Ionicons name="open-outline" size={22} color={C.brand} />
            </View>
            <View style={st.flex1}>
              <Text style={st.defaultRubricTitle}>
                Manage rubric settings on Tour.you
              </Text>
              <Text style={st.materialMeta}>
                Clone frozen templates, edit criteria, and manage this
                property’s rubrics on the web.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
          </MotionPressable>
          {loading ? (
            <LoadingBox />
          ) : rubrics.length === 0 ? (
            <EmptyState
              icon="clipboard-outline"
              title="No rubrics"
              subtitle="Evaluation templates will appear here"
            />
          ) : (
            <>
              {defaultRubric && (
                <MotionPressable
                  onPress={() => setSelected(defaultRubric)}
                  haptic="selection"
                  style={st.defaultRubricCard}
                >
                  <View style={st.defaultRubricIcon}>
                    <Ionicons
                      name="clipboard-outline"
                      size={23}
                      color={C.purple}
                    />
                  </View>
                  <View style={st.flex1}>
                    <View style={st.rubricTitleRow}>
                      <Text style={st.defaultRubricTitle} numberOfLines={2}>
                        {defaultRubric.name}
                      </Text>
                      <View style={st.defaultBadge}>
                        <Text style={st.defaultBadgeText}>Default</Text>
                      </View>
                    </View>
                    <Text style={st.materialMeta}>
                      {defaultRubric.definition.sections.length} sections ·{" "}
                      {rubricItemCount(defaultRubric.definition)} items ·{" "}
                      {rubricTotalPoints(defaultRubric.definition)} pts
                    </Text>
                    <Text style={st.rubricAppliedText}>
                      {applicationsFor(defaultRubric.id).length} session
                      {applicationsFor(defaultRubric.id).length === 1
                        ? ""
                        : "s"}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={C.textMuted}
                  />
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
                      <View style={st.rubricListIcon}>
                        <Ionicons
                          name="clipboard-outline"
                          size={19}
                          color={C.purple}
                        />
                      </View>
                      <View style={st.rubricCardBody}>
                        <Text style={st.rubricCardTitle} numberOfLines={2}>
                          {rubric.name}
                        </Text>
                        <Text style={st.materialMeta} numberOfLines={1}>
                          {rubric.definition.sections.length} sections ·{" "}
                          {rubricItemCount(rubric.definition)} items
                        </Text>
                        <Text style={st.rubricAppliedText}>
                          {applications.length} session
                          {applications.length === 1 ? "" : "s"}
                        </Text>
                      </View>
                    </MotionPressable>
                  );
                })}
              </View>
            </>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={Boolean(selected)}
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        {selected && (
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={st.scroll}
          >
            <View style={st.page}>
              <View style={st.pageHeadingRow}>
                <BackBtn label="Rubrics" onPress={() => setSelected(null)} />
                <View style={st.flex1} />
                {selected.isDefault && (
                  <View style={st.defaultBadge}>
                    <Text style={st.defaultBadgeText}>Default</Text>
                  </View>
                )}
              </View>
              <Text style={st.detailTitle}>{selected.name}</Text>
              <Text style={st.pageHeadingSub}>
                {rubricItemCount(selected.definition)} criteria ·{" "}
                {rubricTotalPoints(selected.definition)} points
              </Text>
              {selected.definition.sections.map((section) => (
                <View key={section.name} style={st.card}>
                  <View style={st.rubricSectionHeader}>
                    <View style={st.flex1}>
                      <Text style={st.cardTitle}>{section.name}</Text>
                      <Text style={st.materialMeta}>
                        {section.items.length} items
                      </Text>
                    </View>
                    <Text style={st.rubricPoints}>
                      {section.items.reduce(
                        (sum, item) => sum + item.points,
                        0,
                      )}{" "}
                      pts
                    </Text>
                  </View>
                  {section.items.map((item, index) => (
                    <View
                      key={item.id}
                      style={[st.rubricItem, index > 0 && st.rowBorder]}
                    >
                      <View style={st.rubricItemNumber}>
                        <Text style={st.rubricItemNumberText}>{index + 1}</Text>
                      </View>
                      <View style={st.flex1}>
                        <Text style={st.rubricItemText}>{item.text}</Text>
                        {item.note && (
                          <Text style={st.rubricItemNote}>{item.note}</Text>
                        )}
                      </View>
                      <Text style={st.rubricPoints}>{item.points}</Text>
                    </View>
                  ))}
                </View>
              ))}
              {selected.definition.compliance &&
                selected.definition.compliance.length > 0 && (
                  <View style={st.card}>
                    <View style={st.rubricSectionHeader}>
                      <Text style={st.cardTitle}>Compliance</Text>
                    </View>
                    {selected.definition.compliance.map((item, index) => (
                      <View
                        key={item.id}
                        style={[st.rubricItem, index > 0 && st.rowBorder]}
                      >
                        <Ionicons
                          name="shield-checkmark-outline"
                          size={18}
                          color={C.green}
                        />
                        <View style={st.flex1}>
                          <Text style={st.rubricItemText}>{item.text}</Text>
                          {item.note && (
                            <Text style={st.rubricItemNote}>{item.note}</Text>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              <Text style={st.sectionTitle}>Applied sessions</Text>
              {applicationsFor(selected.id).length === 0 ? (
                <EmptyState
                  icon="albums-outline"
                  title="No applications yet"
                  subtitle="Choose this rubric when starting or opening a scheduled session"
                />
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

function SettingsScreen({
  session,
  onSessionChange,
  onBack,
  onProfile,
  onRubrics,
  onSignOut,
  aiTrainingDataFeedback,
  onAiTrainingDataFeedback,
  propertyWebsite,
}: {
  session: MobileAuthSession;
  onSessionChange: (session: MobileAuthSession) => void;
  onBack: () => void;
  onProfile: () => void;
  onRubrics: () => void;
  onSignOut: () => void;
  aiTrainingDataFeedback: boolean;
  onAiTrainingDataFeedback: (enabled: boolean) => Promise<void>;
  propertyWebsite: string | null;
}) {
  const insets = useSafeAreaInsets();
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [communityPickerOpen, setCommunityPickerOpen] = useState(false);
  const [communityQuery, setCommunityQuery] = useState("");
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const teamRole = session.workspace.teamMember?.role || "Property Team";
  const displayName = session.workspace.user.fullName ?? "Team member";
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ||
    session.workspace.user.email[0]?.toUpperCase() ||
    "?";
  const authorizedPropertyCount =
    authorizedCommunitiesForSession(session).length;
  const accent = resolveCardAccent(session.workspace.user.cardAccent);
  const propertyName = session.workspace.community.name;
  const propertyWebsiteUrl = propertyWebsite
    ? /^https?:\/\//i.test(propertyWebsite)
      ? propertyWebsite
      : `https://${propertyWebsite}`
    : null;
  const propertyWebsiteDisplay = propertyWebsite
    ?.replace(/^https?:\/\//i, "")
    .replace(/\/$/, "");

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
      showToast(
        caught instanceof Error ? caught.message : "Could not switch property",
        "error",
      );
    } finally {
      setSwitchingId(null);
    }
  }

  async function sendFeedback() {
    const message = feedbackText.trim();
    if (!message) {
      showToast("Tell us what we can improve first.", "info");
      return;
    }
    try {
      await submitSupportRequest({
        name: session.workspace.user.fullName ?? "Tour mobile user",
        email: session.workspace.user.email,
        message,
      });
      setFeedbackText("");
      setFeedbackOpen(false);
      showToast("Feedback sent to the Tour support team.", "success");
    } catch {
      showToast("Could not send feedback. Please try again.", "error");
    }
  }

  async function toggleAiTrainingDataFeedback() {
    if (savingPrivacy) return;
    setSavingPrivacy(true);
    try {
      await onAiTrainingDataFeedback(!aiTrainingDataFeedback);
      showToast(
        !aiTrainingDataFeedback
          ? "AI training data feedback enabled"
          : "AI training data feedback disabled",
        "success",
      );
    } catch (caught) {
      showToast(
        caught instanceof Error
          ? caught.message
          : "Could not save privacy setting",
        "error",
      );
    } finally {
      setSavingPrivacy(false);
    }
  }

  return (
    <View style={[st.flex1, homeSt.pageBg]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[
          settingsSt.scroll,
          { paddingTop: glassNavContentInset(insets.top) },
        ]}
      >
        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel="Edit profile card"
          haptic="selection"
          onPress={onProfile}
          style={settingsSt.card}
        >
          <View style={[settingsSt.avatar, { backgroundColor: accent }]}>
            <CustomText textStyle="title" style={settingsSt.avatarText}>
              {initials}
            </CustomText>
          </View>
          <View style={st.flex1}>
            <CustomText textStyle="title" numberOfLines={1}>
              {displayName}
            </CustomText>
            <CustomText textStyle="caption" style={settingsSt.rowSub}>
              {session.workspace.user.title ?? teamRole} · Tap to edit card
            </CustomText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
        </MotionPressable>

        <CustomText textStyle="title" style={settingsSt.sectionTitle}>
          Active property
        </CustomText>
        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel="Switch active property"
          haptic="selection"
          onPress={() => setCommunityPickerOpen(true)}
          style={settingsSt.card}
        >
          <View style={settingsSt.iconWrap}>
            <Ionicons name="business-outline" size={20} color={ACCENT} />
          </View>
          <View style={st.flex1}>
            <CustomText textStyle="title" numberOfLines={1}>
              {propertyName}
            </CustomText>
            <CustomText textStyle="caption" style={settingsSt.rowSub}>
              {authorizedPropertyCount} available{" "}
              {authorizedPropertyCount === 1 ? "property" : "properties"}
            </CustomText>
          </View>
          <CustomText textStyle="label" style={settingsSt.switchLabel}>
            Switch
          </CustomText>
        </MotionPressable>
        {propertyWebsiteUrl ? (
          <MotionPressable
            accessibilityRole="link"
            accessibilityLabel={`Open ${propertyName} website`}
            haptic="selection"
            onPress={() => void Linking.openURL(propertyWebsiteUrl)}
            style={settingsSt.card}
          >
            <View style={settingsSt.iconWrap}>
              <Ionicons name="globe-outline" size={20} color={ACCENT} />
            </View>
            <View style={st.flex1}>
              <CustomText textStyle="title">Property website</CustomText>
              <CustomText
                textStyle="caption"
                style={settingsSt.rowSub}
                numberOfLines={1}
              >
                {propertyWebsiteDisplay}
              </CustomText>
            </View>
            <Ionicons name="open-outline" size={18} color={ACCENT} />
          </MotionPressable>
        ) : null}

        <CustomText textStyle="title" style={settingsSt.sectionTitle}>
          Evaluation
        </CustomText>
        <CardRow
          icon="clipboard-outline"
          title="Rubrics"
          sub="Templates, criteria, and session applications"
          onPress={onRubrics}
        />

        <CustomText textStyle="title" style={settingsSt.sectionTitle}>
          Support
        </CustomText>
        <CardRow
          icon="chatbubble-ellipses-outline"
          title="Share feedback"
          sub="Help us make the next Tour better"
          onPress={() => setFeedbackOpen(true)}
        />

        <CustomText textStyle="title" style={settingsSt.sectionTitle}>
          Privacy
        </CustomText>
        <CardRow
          icon="sparkles-outline"
          title="AI Training Data feedback"
          sub={
            aiTrainingDataFeedback
              ? "On · helps improve AI features"
              : "Off · your eligible feedback is not used for training"
          }
          accessibilityRole="switch"
          accessibilityState={{ checked: aiTrainingDataFeedback }}
          disabled={savingPrivacy}
          onPress={() => void toggleAiTrainingDataFeedback()}
          trailing={
            <View pointerEvents="none">
              <Switch
                accessible={false}
                value={aiTrainingDataFeedback}
                disabled={savingPrivacy}
                trackColor={{ false: "#d1d5db", true: ACCENT }}
                ios_backgroundColor="#d1d5db"
              />
            </View>
          }
        />
        <CardRow
          icon="hand-left-outline"
          title="Privacy Policy"
          sub="How Tour.you handles your data"
          accessibilityRole="link"
          onPress={() =>
            void Linking.openURL(`${getSiteBaseUrl()}/privacy-policy`)
          }
        />

        <CustomText textStyle="title" style={settingsSt.sectionTitle}>
          Account
        </CustomText>
        <CardRow
          icon="log-out-outline"
          title="Log out"
          sub="Remove this account from this device"
          onPress={() => setLogoutOpen(true)}
          destructive
        />
        <CustomText textStyle="caption" style={settingsSt.version}>
          Tour mobile 0.1.0 · Host Your Voice
        </CustomText>
      </ScrollView>

      <GlassNavHeader title="Settings" onBack={onBack} />

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
        visible={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        sheetHeight={430}
        keyboardAvoiding
        dragHeader={
          <View style={settingsSt.sheetHeader}>
            <View style={settingsSt.iconWrap}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={20}
                color={ACCENT}
              />
            </View>
            <View style={st.flex1}>
              <CustomText textStyle="title">Share Feedback</CustomText>
              <CustomText textStyle="caption" style={settingsSt.rowSub}>
                Tell us what would make the next Tour better.
              </CustomText>
            </View>
          </View>
        }
      >
        <View style={settingsSt.sheetBody}>
          <CustomText textStyle="title">What should we improve?</CustomText>
          <TextInput
            multiline
            maxLength={4000}
            value={feedbackText}
            onChangeText={setFeedbackText}
            placeholder="What do you love, need help with, found, or feel is missing?"
            placeholderTextColor={C.textMuted}
            style={[customTextVariants.body, settingsSt.input]}
            textAlignVertical="top"
          />
          <CustomText textStyle="micro" style={settingsSt.counter}>
            {feedbackText.length}/4000
          </CustomText>
          <MotionPressable
            accessibilityRole="button"
            haptic="medium"
            onPress={() => void sendFeedback()}
            style={settingsSt.primaryButton}
          >
            <Ionicons name="send-outline" size={17} color={CARD} />
            <CustomText textStyle="title" style={settingsSt.primaryButtonText}>
              Send feedback
            </CustomText>
          </MotionPressable>
          <MotionPressable
            accessibilityRole="button"
            haptic="selection"
            onPress={() => setFeedbackOpen(false)}
            style={settingsSt.cancelButton}
          >
            <CustomText textStyle="label" style={settingsSt.cancelText}>
              Not now
            </CustomText>
          </MotionPressable>
        </View>
      </BottomSheetModal>
      <BottomSheetModal
        visible={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        sheetHeight={310}
        dragHeader={
          <View style={settingsSt.sheetHeader}>
            <View style={[settingsSt.iconWrap, settingsSt.iconWrapDestructive]}>
              <Ionicons name="log-out-outline" size={20} color={C.red} />
            </View>
            <View style={st.flex1}>
              <CustomText textStyle="title">Log out of Tour?</CustomText>
              <CustomText textStyle="caption" style={settingsSt.rowSub}>
                Your account will be removed from this device.
              </CustomText>
            </View>
          </View>
        }
      >
        <View style={settingsSt.sheetBody}>
          <CustomText textStyle="caption" style={settingsSt.sheetNote}>
            You’ll need a new email verification code the next time you sign in.
          </CustomText>
          <MotionPressable
            accessibilityRole="button"
            haptic="medium"
            onPress={onSignOut}
            style={settingsSt.logoutButton}
          >
            <CustomText textStyle="title" style={settingsSt.primaryButtonText}>
              Log out
            </CustomText>
          </MotionPressable>
          <MotionPressable
            accessibilityRole="button"
            haptic="selection"
            onPress={() => setLogoutOpen(false)}
            style={settingsSt.cancelButton}
          >
            <CustomText textStyle="label" style={settingsSt.cancelText}>
              Cancel
            </CustomText>
          </MotionPressable>
        </View>
      </BottomSheetModal>
    </View>
  );
}

const settingsSt = StyleSheet.create({
  scroll: {
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  card: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 15,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: CARD },
  iconWrap: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: BACKGROUND,
  },
  iconWrapDestructive: { backgroundColor: C.redBg },
  destructiveTitle: { color: C.red },
  rowSub: { marginTop: 3, color: C.textSec },
  switchLabel: { color: ACCENT },
  sectionTitle: { marginTop: 10 },
  version: {
    marginTop: 8,
    color: C.textMuted,
    textAlign: "center",
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  sheetBody: { flex: 1, gap: 10, paddingTop: 16 },
  sheetNote: { color: C.textSec, lineHeight: 19 },
  input: {
    flex: 1,
    minHeight: 120,
    padding: 14,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: BACKGROUND,
    color: TEXT,
    lineHeight: 20,
  },
  counter: {
    alignSelf: "flex-end",
    color: C.textMuted,
    fontVariant: ["tabular-nums"],
  },
  primaryButton: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: 25,
    backgroundColor: ACCENT,
    boxShadow: "0 6px 14px rgba(0, 108, 229, 0.28)",
  },
  primaryButtonText: { color: CARD },
  logoutButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 25,
    backgroundColor: C.red,
  },
  cancelButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { color: C.textSec },
});

// ═══════════════════════════════════════
// Profile & Tour (preserved)
// ═══════════════════════════════════════

function TourStepper({
  session,
  idx,
  prospect,
  step,
  onBack,
  onChange,
  onStep,
}: {
  session: MobileAuthSession;
  idx: number;
  prospect: ProspectData;
  step: TourStep;
  onBack: () => void;
  onChange: (k: keyof ProspectData, v: string) => void;
  onStep: (s: TourStep) => void;
}) {
  const name = session.workspace.user.fullName ?? "Team member";
  return (
    <View style={st.page}>
      <BackBtn label="Profile" onPress={onBack} />
      <View
        style={[
          st.card,
          { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
        ]}
      >
        <View style={st.avatar36}>
          <Text style={{ color: C.brand, fontSize: 13, fontWeight: "900" }}>
            {name[0]?.toUpperCase()}
          </Text>
        </View>
        <View style={st.flex1}>
          <Text style={{ fontSize: 17, fontWeight: "900", color: C.text }}>
            {name}
          </Text>
          <Text style={{ fontSize: 12, fontWeight: "700", color: C.textSec }}>
            {session.workspace.user.email}
          </Text>
        </View>
      </View>
      <View style={[st.card, { flexDirection: "row", padding: 14, gap: 10 }]}>
        {tourSteps.map((s, i) => (
          <View key={s.id} style={{ flex: 1, alignItems: "center", gap: 8 }}>
            <View
              style={[
                st.stepDot,
                i === idx && st.stepDotActive,
                i < idx && st.stepDotDone,
              ]}
            >
              <Text
                style={[
                  st.stepDotText,
                  (i === idx || i < idx) && { color: "#fff" },
                ]}
              >
                {i + 1}
              </Text>
            </View>
            <Text style={[st.stepLabel, i === idx && { color: C.text }]}>
              {s.label}
            </Text>
          </View>
        ))}
      </View>
      <View style={[st.card, { padding: 18 }]}>
        {step === "contact" && (
          <View style={{ gap: 14 }}>
            <Text style={st.formTitle}>Your contact information</Text>
            <Input
              placeholder="Full name"
              value={prospect.name}
              onChangeText={(v) => onChange("name", v)}
              icon="person-outline"
            />
            <Input
              placeholder="Email"
              value={prospect.email}
              onChangeText={(v) => onChange("email", v)}
              icon="mail-outline"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Input
              placeholder="Phone"
              value={prospect.phone}
              onChangeText={(v) => onChange("phone", v)}
              icon="call-outline"
              keyboardType="phone-pad"
            />
            <PrimaryBtn
              label="Continue to preferences"
              onPress={() => onStep("preferences")}
              icon="arrow-forward"
            />
          </View>
        )}
        {step === "preferences" && (
          <View style={{ gap: 14 }}>
            <Text style={st.formTitle}>What should the tour focus on?</Text>
            <Input
              placeholder="Target move-in date"
              value={prospect.moveIn}
              onChangeText={(v) => onChange("moveIn", v)}
              icon="calendar-outline"
            />
            <SegPicker
              label="Bedrooms"
              options={["Studio", "1 bed", "2 bed", "3 bed"]}
              value={prospect.bedrooms}
              onChange={(v) => onChange("bedrooms", v)}
            />
            <SegPicker
              label="Budget"
              options={["<$2,000", "$2,200 - $2,600", "$2,600+"]}
              value={prospect.budget}
              onChange={(v) => onChange("budget", v)}
            />
            <PrimaryBtn
              label="Review and start tour"
              onPress={() => onStep("ready")}
              icon="arrow-forward"
            />
          </View>
        )}
        {step === "ready" && (
          <View style={{ gap: 14 }}>
            <Text style={st.formTitle}>Ready to start</Text>
            <View
              style={{
                backgroundColor: "#f8fafc",
                borderRadius: 22,
                padding: 16,
                gap: 12,
              }}
            >
              <SRow label="Prospect" value={prospect.name || "Guest"} />
              <SRow
                label="Contact"
                value={prospect.email || prospect.phone || "—"}
              />
              <SRow
                label="Focus"
                value={`${prospect.bedrooms} \u00B7 ${prospect.budget}`}
              />
              <SRow label="Move-in" value={prospect.moveIn || "Flexible"} />
            </View>
            <Pressable
              style={({ pressed }) => [st.darkBtn, pressed && st.pressed]}
            >
              <Ionicons name="flag-outline" size={18} color="#fff" />
              <Text style={st.darkBtnText}>Start tour</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

function SRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{ fontSize: 13, fontWeight: "800", color: C.textSec }}>
        {label}
      </Text>
      <Text style={{ fontSize: 13, fontWeight: "900", color: C.text }}>
        {value}
      </Text>
    </View>
  );
}

// ═══════════════════════════════════════
// Shared components (see src/components/tour)
// ═══════════════════════════════════════

const W = Dimensions.get("window").width;

const audioTestSt = StyleSheet.create({
  hero: {
    alignItems: "center",
    gap: 12,
    padding: 22,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
    backgroundColor: "#fff",
  },
  micRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.brand + "10",
  },
  micRingRecording: { backgroundColor: C.red + "12" },
  timer: {
    color: C.text,
    fontSize: 42,
    lineHeight: 48,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  status: {
    color: C.textSec,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  controls: { gap: 10 },
  recordButton: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 18,
    borderRadius: 29,
    backgroundColor: C.red,
  },
  stopButton: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 18,
    borderRadius: 29,
    backgroundColor: C.red,
  },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  secondaryButton: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 27,
    backgroundColor: "#f5f9ff",
  },
  secondaryText: { color: C.brand, fontSize: 15, fontWeight: "900" },
  infoCard: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  infoRow: {
    minHeight: 58,
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  infoLabel: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  infoValue: { color: C.text, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  resetButton: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 23,
  },
  resetText: { color: C.textSec, fontSize: 13, fontWeight: "800" },
});

const homeSt = StyleSheet.create({
  pageBg: { backgroundColor: BACKGROUND },
  card: {
    backgroundColor: CARD,
    borderWidth: 0,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    alignItems: "center",
  },
  topBar: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 },
  topBarSide: {
    width: 74,
    flexShrink: 0,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  topBarSideEnd: { alignItems: "flex-end" },
  topBarCenter: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e2e2",
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  profileCard: {
    overflow: "hidden",
    borderRadius: LARGE_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
    shadowColor: "#101828",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 4,
  },
  profileHeader: { height: 112, backgroundColor: "#111" },
  profileBody: {
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 24,
    paddingTop: 0,
    paddingBottom: 24,
  },
  profileAvatarLarge: {
    width: 88,
    height: 88,
    marginTop: -44,
    borderWidth: 4,
    borderColor: CARD,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#d1d5db",
  },
  profileAvatarLargeText: { color: CARD, fontSize: 30 },
  profileNameLarge: { color: TEXT, marginTop: 12, textAlign: "center" },
  profileRoleLarge: { color: "#5f6673" },
  profileProperty: { color: "#7b8496" },
  editProfileHint: { marginTop: 10, color: "#98A2B3" },
  contactList: { alignSelf: "stretch", gap: 14, marginTop: 22 },
  profileContactRow: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  profileContactIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BACKGROUND,
  },
  profileContactText: { flex: 1, color: TEXT },
  actionPillRow: { flexDirection: "row", gap: 10 },
  checkInPill: {
    flex: 1,
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 14,
    borderRadius: 29,
    backgroundColor: "#2f343c",
    boxShadow: "0 6px 14px rgba(47, 52, 60, 0.28)",
  },
  newSessionPill: {
    backgroundColor: ACCENT,
    boxShadow: "0 6px 14px rgba(0, 108, 229, 0.28)",
  },
  actionPillPressed: { boxShadow: "none", transform: [{ scale: 0.975 }] },
  checkInPillText: { color: CARD },
  practiceCard: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    padding: 14,
    borderWidth: 1,
    borderColor: "#c7d7fe",
    borderRadius: 18,
    backgroundColor: "#f8fbff",
  },
  practiceIcon: {
    width: 45,
    height: 45,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: C.brand,
  },
  practiceTitle: { color: C.text, fontSize: 14, fontWeight: "900" },
  practiceMeta: {
    marginTop: 3,
    color: C.textSec,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700",
  },
  audioTestCard: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 13,
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 18,
    backgroundColor: "#f5f9ff",
  },
  audioTestIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eaf2ff",
  },
  audioTestTitle: { color: C.text, fontSize: 14, fontWeight: "900" },
  audioTestSub: {
    color: C.textSec,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  businessCard: {
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 20,
    backgroundColor: "#fff",
    shadowColor: "#101828",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 2,
  },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.brand,
  },
  profileAvatarText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  profileName: { color: "#000", fontSize: 14, fontWeight: "800" },
  profileRole: { color: C.textSec, fontSize: 11, marginTop: 3 },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  contactText: { flex: 1, color: C.textSec, fontSize: 11 },
  smsButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: C.brand,
  },
  smsButtonText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  metricCard: { width: (W - 47) / 2 },
  commandGrid: { flexDirection: "row", gap: 9 },
  commandButton: {
    flex: 1,
    minHeight: 92,
    justifyContent: "space-between",
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    backgroundColor: "#fff",
  },
  commandIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  commandTitle: { color: C.text, fontSize: 13, fontWeight: "900" },
  commandSub: {
    color: C.textSec,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  focusStack: { gap: 9 },
  focusCard: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 11,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    backgroundColor: "#fff",
  },
  focusIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  focusTitle: { color: C.text, fontSize: 13, fontWeight: "900" },
  focusMeta: {
    color: C.textSec,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 3,
  },
  focusScore: {
    fontSize: 18,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  sectionStack: { gap: 32, marginTop: 28 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 7,
  },
  sectionHeading: { gap: 2 },
  sectionTitle: {
    flex: 1,
    color: TEXT,
    fontSize: 17,
    fontFamily: FONT.extrabold,
  },
  sectionSubtitle: { color: C.textSec },
  sectionAction: { color: ACCENT },
  sectionActionHit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  tourCard: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: SMALL_CORNER,
    backgroundColor: CARD,
  },
  tourTitle: { color: TEXT, fontSize: 15, fontFamily: FONT.extrabold },
  tourMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 8,
  },
  timePill: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: "800",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: "rgba(0,108,229,0.07)",
  },
  tourMeta: { flex: 1, color: C.textSec, fontSize: 12, fontWeight: "600" },
  assetPreviewStack: { gap: 12 },
  assetPreviewLoading: {
    minHeight: 132,
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  mediaRowBleed: { marginHorizontal: -16 },
  mediaRow: { gap: 8, paddingHorizontal: 16 },
  mediaTile: {
    minHeight: 132,
    justifyContent: "space-between",
    gap: 8,
    padding: 8,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  mediaThumb: {
    flex: 1,
    minHeight: 82,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
    borderRadius: 10,
    borderCurve: "continuous",
    backgroundColor: BACKGROUND,
  },
  mediaPreviewImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  mediaFallbackIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    backgroundColor: CARD,
  },
  mediaPlayBadge: {
    position: "absolute",
    right: 7,
    bottom: 7,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.86)",
    borderRadius: 12,
    backgroundColor: "rgba(15,23,42,0.88)",
  },
  mediaLabel: { color: TEXT },
  emptyInline: { color: C.textSec },
  assetLinkCard: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    padding: 14,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  assetLinkIcon: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: "#eef4ff",
  },
  assetLinkIconConnected: { backgroundColor: ACCENT },
  assetLinkTitle: { color: TEXT, fontSize: 14, fontFamily: FONT.extrabold },
  assetLinkMeta: { color: C.textSec, lineHeight: 16, marginTop: 3 },
  statusPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 9, fontWeight: "900" },
  actionCard: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  qrBrandCenter: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  actionTitle: { color: "#000", fontSize: 14, fontWeight: "900" },
  actionSub: { color: C.textSec, fontSize: 12, marginTop: 3 },
  createButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: C.brand,
  },
  createButtonText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  insightCard: {
    minHeight: 105,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderColor: C.brand,
    borderRadius: 16,
    backgroundColor: "#fff",
  },
  insightText: {
    color: C.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  insightLink: {
    color: C.brand,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 10,
  },
  sheetScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  sheetKeyboard: { flex: 1, justifyContent: "flex-end" },
  checkInSheet: {
    position: "relative",
    maxHeight: "88%",
    gap: 8,
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: Platform.OS === "ios" ? 16 : 12,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: "#fff",
  },
  sheet: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#fff",
  },
  sheetHandleHitbox: {
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 28,
    marginBottom: 6,
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#d1d5db",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sheetTitle: { color: "#111827", fontSize: 24, fontWeight: "900" },
  sheetSub: { color: "#7b8496", fontSize: 13, fontWeight: "700", marginTop: 2 },
  sheetClose: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 20,
    backgroundColor: "#fff",
  },
  sheetTabs: {
    flexDirection: "row",
    gap: 6,
    padding: 4,
    borderRadius: 17,
    backgroundColor: "#f3f4f6",
    marginBottom: 10,
  },
  sheetTab: {
    flex: 1,
    minHeight: 39,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 13,
  },
  sheetTabActive: {
    backgroundColor: "#fff",
    shadowColor: "#101828",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 1,
  },
  sheetTabText: { color: C.textMuted, fontSize: 13, fontWeight: "900" },
  sheetTabTextActive: { color: C.brand },
  checkInSheetBody: { flex: 1, minHeight: 0, gap: 8, overflow: "hidden" },
  checkInStepPane: { flex: 1, minHeight: 0 },
  checkInScroll: { flex: 1, minHeight: 0 },
  checkInForm: { gap: 10, paddingBottom: 14 },
  checkInFormKeyboard: { paddingBottom: 110 },
  skipButton: {
    alignSelf: "flex-end",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  skipText: { color: "#0b0b0c", fontSize: 21, fontWeight: "900" },
  checkInHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 2,
  },
  formHeadAvatar: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "#111827",
  },
  formHeadText: {
    flex: 1,
    color: "#111318",
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
  },
  formRow2: { flexDirection: "row", gap: 9 },
  floatingField: {
    flex: 1,
    minHeight: 56,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#d7dae3",
    borderRadius: 14,
    backgroundColor: "#fff",
  },
  floatingFieldHighlighted: {
    borderColor: C.brand,
    borderWidth: 2,
    shadowColor: C.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 2,
  },
  floatingLabel: {
    position: "absolute",
    left: 12,
    top: -8,
    paddingHorizontal: 5,
    color: "#4b5563",
    fontSize: 11,
    fontWeight: "900",
    backgroundColor: "#fff",
  },
  floatingInput: {
    color: "#111318",
    fontSize: 16,
    fontWeight: "600",
    paddingVertical: 0,
  },
  phoneRow: { flexDirection: "row", gap: 9 },
  phoneCc: {
    width: 84,
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#d7dae3",
    borderRadius: 14,
    backgroundColor: "#fff",
  },
  phoneFlag: { fontSize: 15 },
  phoneCcInput: {
    flex: 1,
    minWidth: 34,
    color: "#111318",
    fontSize: 15,
    fontWeight: "800",
    paddingVertical: 0,
  },
  phoneCcText: { color: "#111318", fontSize: 19, fontWeight: "800" },
  addJobButton: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#d7d7d7",
    borderRadius: 999,
    backgroundColor: "#fff",
  },
  addJobText: { color: "#111318", fontSize: 13, fontWeight: "900" },
  nextButton: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderRadius: 999,
    backgroundColor: "#111",
  },
  nextButtonText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  checkInDestination: {
    color: C.textMuted,
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
  },
  stepHeader: { gap: 2, marginBottom: 2 },
  stepKicker: {
    color: C.brand,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  questionTitle: {
    color: C.text,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "900",
  },
  questionField: { gap: 8 },
  questionLabel: { color: C.text, fontSize: 13, fontWeight: "900" },
  questionHint: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: "700",
    marginTop: -4,
  },
  questionOptions: { gap: 8, paddingRight: 8 },
  questionOption: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#d7dae3",
    borderRadius: 999,
    backgroundColor: "#fff",
  },
  questionOptionActive: { borderColor: C.brand, backgroundColor: "#eff6ff" },
  questionOptionText: { color: C.textSec, fontSize: 12, fontWeight: "800" },
  questionOptionTextActive: { color: C.brand },
  toggleRow: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 2,
  },
  toggleText: { flex: 1, color: C.text, fontSize: 12, fontWeight: "800" },
  fieldError: { color: C.red, fontSize: 12, fontWeight: "800" },
  buttonRow: { flexDirection: "row", gap: 10 },
  backBtn: {
    minWidth: 96,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#d7dae3",
    borderRadius: 13,
    backgroundColor: "#fff",
  },
  backBtnText: { color: C.text, fontSize: 15, fontWeight: "900" },
  questionProgress: { alignItems: "center", paddingTop: 2 },
  questionProgressText: { color: C.textMuted, fontSize: 11, fontWeight: "900" },
  floatingActionWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 10,
    paddingBottom: 2,
    backgroundColor: "#fff",
  },
  floatingBackButton: {
    width: 50,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#d7dae3",
    borderRadius: 999,
    backgroundColor: "#fff",
  },
  floatingNextButton: {
    flex: 1,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    backgroundColor: "#111",
  },
  donePanel: { alignItems: "center", gap: 13, paddingVertical: 10 },
  doneIcon: {
    width: 68,
    height: 68,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 34,
    backgroundColor: C.green,
  },
  manualForm: { gap: 10 },
  sheetField: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    backgroundColor: "#fff",
  },
  sheetFieldMultiline: {
    minHeight: 82,
    alignItems: "flex-start",
    paddingTop: 14,
  },
  sheetInput: {
    flex: 1,
    color: C.text,
    fontSize: 14,
    fontWeight: "700",
    paddingVertical: 0,
  },
  sheetInputMultiline: { minHeight: 52, textAlignVertical: "top" },
  sheetPrimary: {
    alignSelf: "stretch",
    width: "100%",
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 4,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: "#111",
  },
  sheetPrimaryText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  qrPanel: {
    alignSelf: "stretch",
    alignItems: "center",
    gap: 12,
    paddingTop: 6,
  },
  qrCard: {
    width: 210,
    height: 210,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 24,
    backgroundColor: "#f8fafc",
  },
  qrImage: { width: "100%", height: "100%" },
  qrTitle: { color: C.text, fontSize: 18, fontWeight: "900" },
  qrSub: {
    maxWidth: 300,
    color: C.textSec,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    textAlign: "center",
  },
  qrShareGrid: {
    alignSelf: "stretch",
    width: "100%",
    flexDirection: "row",
    gap: 8,
    paddingTop: 4,
  },
  qrShareButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    backgroundColor: "#fff",
  },
  qrShareButtonPrimary: { borderColor: C.brand, backgroundColor: C.brand },
  qrShareButtonText: { color: C.text, fontSize: 12, fontWeight: "900" },
  qrShareButtonPrimaryText: { color: "#fff", fontSize: 12, fontWeight: "900" },
});

const communitySt = StyleSheet.create({
  sheet: {
    minHeight: "70%",
    maxHeight: "84%",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingBottom: Platform.OS === "ios" ? 32 : 18,
  },
  handle: {
    width: 40,
    height: 4,
    alignSelf: "center",
    borderRadius: 2,
    backgroundColor: "#d0d5dd",
    marginTop: 11,
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { color: C.text, fontSize: 21, lineHeight: 26, fontWeight: "900" },
  subtitle: {
    color: C.textSec,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    marginTop: 3,
  },
  closeButton: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    backgroundColor: C.card,
  },
  searchBar: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    backgroundColor: C.card,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: C.text,
    fontSize: 16,
    fontWeight: "700",
    paddingVertical: 0,
  },
  list: { flex: 1, marginTop: 10 },
  listContent: { paddingBottom: 20 },
  row: {
    minHeight: 62,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 0,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  iconBox: {
    width: 42,
    height: 42,
    flexShrink: 0,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef2ff",
  },
  rowText: { flex: 1, minWidth: 0, justifyContent: "center" },
  rowTitle: { color: C.text, fontSize: 15, lineHeight: 19, fontWeight: "900" },
  rowSub: {
    color: C.textSec,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
    marginTop: 1,
  },
  rowAction: {
    width: 28,
    flexShrink: 0,
    alignItems: "flex-end",
    justifyContent: "center",
  },
});

const reviewSt = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tourColors.bg,
    paddingTop: Platform.OS === "ios" ? 50 : 18,
  },
  scrollBody: { flex: 1 },
  scrollContent: { paddingBottom: 150 },
  commentsPageContent: {
    gap: 12,
    paddingHorizontal: SESSION_PAGE_PADDING,
    paddingTop: 12,
    paddingBottom: 130,
  },
  tabSticky: { backgroundColor: tourColors.bg, zIndex: 2 },
  tabBody: { gap: 13, paddingHorizontal: SESSION_PAGE_PADDING, paddingTop: 8 },
  reportCta: {
    minHeight: 62,
    marginHorizontal: SESSION_PAGE_PADDING,
    marginTop: 8,
    marginBottom: 10,
    paddingHorizontal: 13,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#f7fbff",
  },
  reportCtaIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eaf4ff",
  },
  reportCtaTitle: { color: C.text, fontSize: 13, fontWeight: "900" },
  reportCtaSub: {
    marginTop: 2,
    color: C.textSec,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700",
  },
  sampleReadOnlyBanner: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 12,
    borderWidth: 1,
    borderColor: "#ddd6fe",
    borderRadius: 14,
    backgroundColor: "#faf7ff",
  },
  sampleReadOnlyIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: C.purpleBg,
  },
  sampleReadOnlyTitle: { color: C.text, fontSize: 13, fontWeight: "900" },
  sampleReadOnlySub: {
    marginTop: 2,
    color: C.textSec,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",
  },
  focusBanner: {
    gap: 2,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#eff6ff",
  },
  focusBannerLabel: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    color: "#667085",
  },
  focusBannerValue: {
    fontSize: 15,
    fontWeight: "900",
    color: "#101828",
  },
  searchPanel: { gap: 12, paddingTop: 4 },
  searchInputWrap: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: "#dbe3ef",
    borderRadius: 14,
    backgroundColor: "#fff",
  },
  searchInput: { flex: 1, color: C.text, fontSize: 15, fontWeight: "600" },
  searchHint: {
    paddingHorizontal: 4,
    color: C.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  searchResults: { gap: 8 },
  searchCount: {
    color: C.textMuted,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  searchResult: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    backgroundColor: "#fff",
  },
  searchResultIcon: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#eff6ff",
  },
  searchResultMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 3,
  },
  searchResultSpeaker: {
    flex: 1,
    color: C.brand,
    fontSize: 11,
    fontWeight: "900",
  },
  searchResultTime: {
    color: C.textMuted,
    fontSize: 10,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  searchResultText: {
    color: C.textSec,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  header: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e6eaf0",
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  propertyPicker: {
    maxWidth: 210,
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#eef2f7",
  },
  propertyText: {
    flexShrink: 1,
    color: "#647084",
    fontSize: 14,
    fontWeight: "800",
  },
  titleRow: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10 },
  title: { color: C.text, fontSize: 24, fontWeight: "900", letterSpacing: 0 },
  subtitle: { color: "#7b8496", fontSize: 13, fontWeight: "700", marginTop: 4 },
  reviewSummary: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  scoreCompact: {
    width: 108,
    minHeight: 70,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 16,
  },
  scoreCompactValue: {
    fontSize: 26,
    fontWeight: "900",
    lineHeight: 30,
    fontVariant: ["tabular-nums"],
  },
  scoreCompactLabel: {
    color: "#667085",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    marginTop: 2,
  },
  scorePill: {
    minWidth: 40,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    borderCurve: "continuous",
  },
  scorePillText: {
    fontSize: 13,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  actionsCta: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 16,
    backgroundColor: "#fff",
  },
  actionsCtaIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#eff6ff",
  },
  actionsCtaTitle: { color: C.text, fontSize: 14, fontWeight: "900" },
  actionsCtaSub: {
    color: C.brand,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
  },
  actionCount: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "#eef2ff",
  },
  actionCountText: { color: "#4338ca", fontSize: 10, fontWeight: "800" },
  modeRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  modeButton: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 999,
    backgroundColor: "#fff",
  },
  modeButtonActive: { borderColor: "#bfdbfe", backgroundColor: "#eff6ff" },
  modeText: { color: "#667085", fontSize: 12, fontWeight: "900" },
  modeTextActive: { color: C.brand },
  transcriptContent: {
    gap: 13,
    paddingHorizontal: SESSION_PAGE_PADDING,
    paddingTop: 8,
    paddingBottom: 150,
  },
  phaseSection: { gap: 4 },
  phaseDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 10,
    paddingBottom: 7,
  },
  phaseDividerLine: { width: 4, height: 18, borderRadius: 2 },
  phaseDividerTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  phaseDividerTime: { color: "#98a2b3", fontSize: 11, fontWeight: "800" },
  turnRow: { borderRadius: 12, backgroundColor: "transparent" },
  turnRowActive: {
    backgroundColor: "#eaf4ff",
    borderLeftWidth: 3,
    borderLeftColor: C.brand,
  },
  turnRowSelected: {
    backgroundColor: "#e0efff",
    borderWidth: 1,
    borderColor: "#60a5fa",
  },
  turnMain: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  turnInitialSlot: { width: 20, alignItems: "center", paddingTop: 1 },
  turnInitial: { fontSize: 12, fontWeight: "900" },
  turnMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 3,
  },
  turnSpeaker: { fontSize: 12, fontWeight: "900" },
  segmentTime: {
    color: "#98a2b3",
    fontSize: 11,
    fontWeight: "800",
    marginLeft: "auto",
  },
  turnText: {
    color: "#344054",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  annotationRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  annotationChip: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 8,
    paddingRight: 4,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#fff",
  },
  annotationChipExpanded: {
    borderColor: "#ddd6fe",
    backgroundColor: "#faf5ff",
  },
  annotationText: { color: C.brand, fontSize: 10, fontWeight: "900" },
  annotationCountBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  annotationCountText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  inlineAnnotationStack: {
    gap: 7,
    marginLeft: 36,
    marginTop: 7,
    marginRight: 8,
  },
  inlineAnnotationCard: {
    gap: 8,
    padding: 11,
    borderWidth: 1,
    borderRadius: 12,
  },
  inlineAnnotationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  inlineAnnotationIcon: {
    width: 25,
    height: 25,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  inlineAnnotationTitle: { flex: 1, fontSize: 11, fontWeight: "900" },
  inlineAnnotationTime: {
    fontSize: 10,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  inlineAnnotationBody: {
    color: C.textSec,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  inlineAnnotationPlay: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 28,
    paddingHorizontal: 9,
    borderRadius: 999,
  },
  inlineAnnotationPlayText: { fontSize: 10, fontWeight: "900" },
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
  commentHintText: {
    flex: 1,
    color: "#1D4ED8",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  commentKindBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#f4f7fb",
  },
  commentKindText: {
    color: C.brand,
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  coachingMoment: {
    gap: 9,
    marginVertical: 6,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e9d5ff",
    borderRadius: 14,
    backgroundColor: "#fbf7ff",
  },
  coachingMomentCompact: { marginLeft: 36, marginRight: 8, marginTop: 2 },
  coachingMomentHeader: { flexDirection: "row", alignItems: "center", gap: 7 },
  coachingMomentIcon: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: C.purpleBg,
  },
  coachingMomentKicker: {
    flex: 1,
    color: C.purple,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  coachingMomentTime: { color: "#8b5cf6", fontSize: 11, fontWeight: "900" },
  coachingMomentBody: {
    color: C.text,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  coachingSuggestion: {
    gap: 3,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#fff",
  },
  coachingSuggestionLabel: {
    color: C.purple,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  coachingSuggestionText: {
    color: "#344054",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  coachingQuote: {
    color: "#7b8496",
    fontSize: 12,
    lineHeight: 17,
    fontStyle: "italic",
  },
  coachingMomentActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  coachingMomentAction: { color: C.purple, fontSize: 11, fontWeight: "900" },
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
  selectionClose: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
  },
  selectionTitle: { color: C.text, fontSize: 12, fontWeight: "900" },
  selectionTime: {
    color: C.textMuted,
    fontSize: 10,
    fontWeight: "800",
    marginTop: 1,
  },
  selectionAction: {
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: 7,
    borderRadius: 10,
    backgroundColor: "#eff6ff",
  },
  selectionActionText: { color: C.brand, fontSize: 9, fontWeight: "900" },
  commentDrawerBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15,23,42,0.18)",
  },
  commentDrawerCard: {
    gap: 13,
    maxHeight: "78%",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 28 : 16,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: "#fff",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 18,
  },
  commentDrawerHandle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    marginBottom: 2,
    borderRadius: 999,
    backgroundColor: "#d0d5dd",
  },
  commentModalHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  commentModalIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#eff6ff",
  },
  commentModalTitle: { color: C.text, fontSize: 16, fontWeight: "900" },
  commentModalTime: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
  },
  commentKindSwitcher: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderRadius: 14,
    backgroundColor: "#f2f4f7",
  },
  commentKindOption: {
    flex: 1,
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 11,
  },
  commentKindOptionActive: {
    backgroundColor: "#fff",
    shadowColor: "#101828",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  commentKindOptionText: {
    color: C.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  commentKindOptionTextActive: { color: C.brand },
  commentSelectionPreview: {
    gap: 8,
    padding: 11,
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 14,
    backgroundColor: "#f8fbff",
  },
  commentSelectionPreviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  commentSelectionPreviewLabel: {
    color: C.brand,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  commentSelectionPreviewCount: {
    color: C.textMuted,
    fontSize: 10,
    fontWeight: "800",
  },
  commentSelectionPreviewScroll: { maxHeight: 112 },
  commentSelectionPreviewTurn: { gap: 2, marginBottom: 8 },
  commentSelectionPreviewSpeaker: {
    color: C.text,
    fontSize: 11,
    fontWeight: "900",
  },
  commentSelectionPreviewText: {
    color: C.textSec,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  commentModalInput: {
    minHeight: 92,
    maxHeight: 132,
    padding: 12,
    borderWidth: 1,
    borderColor: "#dbe3ef",
    borderRadius: 14,
    color: C.text,
    fontSize: 15,
    fontWeight: "600",
    textAlignVertical: "top",
    backgroundColor: "#f8fafc",
  },
  commentModalSubmit: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 13,
    backgroundColor: C.brand,
  },
  commentModalSubmitText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  processingTimeline: {
    alignSelf: "stretch",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 2,
    paddingTop: 8,
  },
  processingStep: { flex: 1, alignItems: "center", gap: 6, minWidth: 58 },
  processingStepIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  processingStepIconActive: {
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
  },
  processingStepIconDone: {
    borderColor: "#bbf7d0",
    backgroundColor: C.greenBg,
  },
  processingStepText: {
    color: C.textMuted,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "800",
    textAlign: "center",
  },
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
  phaseTrack: {
    height: 5,
    borderRadius: 4,
    backgroundColor: "#f3f4f6",
    position: "relative",
    overflow: "hidden",
  },
  phaseSegment: {
    position: "absolute",
    top: 0,
    bottom: 0,
    borderRadius: 2,
    opacity: 0.92,
  },
  phasePlayhead: {
    position: "absolute",
    top: -2,
    bottom: -2,
    width: 2,
    backgroundColor: "#111827",
  },
  waveformTrack: {
    height: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  waveformBar: { width: 3, borderRadius: 2, backgroundColor: C.brand },
  time: {
    color: "#667085",
    fontSize: 12,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  playbackRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  playbackMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 1,
  },
  playbackControls: { flexDirection: "row", alignItems: "center", gap: 14 },
  speed: { minWidth: 28, color: C.text, fontSize: 13, fontWeight: "900" },
  playButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: C.brand,
    shadowColor: C.brand,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
});

const st = StyleSheet.create({
  root: { backgroundColor: C.bg, flex: 1 },
  flex1: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  screenTransition: { flex: 1 },
  scroll: { gap: 14, paddingHorizontal: 18, paddingTop: 56, paddingBottom: 32 },
  sessionDetailScroll: { paddingTop: 14 },
  mainScroll: {
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 120,
  },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
  page: { gap: 14 },
  pulseDot: { width: 10, height: 10, borderRadius: 5 },
  shimmerCard: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    backgroundColor: C.card,
  },
  shimmerBar: { height: 12, borderRadius: 999, backgroundColor: "#e8eef7" },
  sessionSkeletonAvatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#e8eef7",
  },
  sessionSkeletonBody: { flex: 1, gap: 9 },
  sessionSkeletonChevron: {
    width: 8,
    height: 8,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: "#dbe3ef",
    transform: [{ rotate: "45deg" }],
  },

  // Toast
  toast: {
    position: "absolute",
    left: 14,
    right: 14,
    zIndex: 999,
    borderRadius: 20,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 22,
    elevation: 14,
  },
  toastGlass: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    overflow: "hidden",
    padding: 11,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.82)",
    borderRadius: 20,
  },
  toastIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
  },
  toastText: {
    flex: 1,
    color: C.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
  },
  toastClose: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.56)",
  },

  // Tab Bar
  tabBar: {
    position: "relative",
    flexDirection: "row",
    backgroundColor: C.card,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingBottom: Platform.OS === "web" ? 12 : 28,
    paddingTop: 9,
    overflow: "hidden",
  },
  tabBarIndicator: {
    position: "absolute",
    top: 4,
    height: 47,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBarIndicatorPill: {
    width: "82%",
    height: 43,
    borderRadius: 16,
    backgroundColor: C.brand + "0D",
  },
  tabBarItem: {
    zIndex: 1,
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  tabBarLabel: { fontSize: 10, fontWeight: "700", color: C.textMuted },
  tabBarLabelActive: { color: C.brand },

  // FAB
  fab: {
    position: "absolute",
    bottom: 96,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.brand,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },

  // Error
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    backgroundColor: C.redBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.red + "20",
  },
  errorBannerText: { flex: 1, fontSize: 13, fontWeight: "700", color: C.red },
  errorRetryBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },

  // Dashboard
  dashGreet: { flexDirection: "row", alignItems: "center", gap: 14 },
  dashGreetText: { fontSize: 24, fontWeight: "900", color: C.text },
  dashProperty: {
    fontSize: 14,
    fontWeight: "700",
    color: C.textSec,
    marginTop: 2,
  },
  avatar48: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#e9f2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  avatar48Text: { color: C.brand, fontSize: 16, fontWeight: "900" },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricCard: {
    width: "48.5%",
    backgroundColor: C.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    padding: 15,
    gap: 6,
  },
  metricValue: { fontSize: 28, fontWeight: "900", color: C.text },
  metricLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: C.textSec,
    textTransform: "uppercase",
  },

  // Card
  card: {
    backgroundColor: C.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  cardTitle: { fontSize: 15, fontWeight: "800", color: C.text },
  cardRow: {
    backgroundColor: C.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 15,
  },
  cardRowIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: C.brand + "10",
    alignItems: "center",
    justifyContent: "center",
  },
  cardRowTitle: { fontSize: 15, fontWeight: "800", color: C.text },
  cardRowSub: {
    fontSize: 12,
    fontWeight: "600",
    color: C.textSec,
    marginTop: 1,
  },

  // Session Row
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  sessionTitle: { fontSize: 15, fontWeight: "800", color: C.text },
  sessionMeta: {
    fontSize: 12,
    fontWeight: "600",
    color: C.textSec,
    marginTop: 2,
  },
  badge: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 11, fontWeight: "800" },
  scoreNum: { fontSize: 15, fontWeight: "900", marginLeft: 4 },

  // Section title
  sectionTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: C.text,
    marginTop: 4,
  },

  // Page
  pageTitle: { fontSize: 27, fontWeight: "900", color: C.text },
  pageSub: { fontSize: 14, fontWeight: "700", color: C.textSec, marginTop: -8 },
  emptyTitle: { fontSize: 15, fontWeight: "800", color: C.text },

  // Search
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  searchInput: { flex: 1, fontSize: 15, fontWeight: "600", color: C.text },

  // Detail
  detailTitle: { fontSize: 28, fontWeight: "900", color: C.text },
  checkedInCard: {
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 16,
    backgroundColor: "#f0fdf4",
  },
  checkedInHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkedInIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: "#dcfce7",
  },
  checkedInTitle: { color: C.text, fontSize: 15, fontWeight: "900" },
  checkedInSubtitle: {
    marginTop: 2,
    color: C.textSec,
    fontSize: 11,
    fontWeight: "600",
  },
  checkedInPerson: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  checkedInAvatar: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: "#e0f2fe",
  },
  checkedInAvatarText: { color: C.brand, fontSize: 13, fontWeight: "900" },
  checkedInName: { color: C.text, fontSize: 13, fontWeight: "800" },
  checkedInContact: {
    marginTop: 2,
    color: C.textSec,
    fontSize: 11,
    fontWeight: "600",
  },

  // Score Hero
  scoreHero: {
    backgroundColor: C.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
    gap: 18,
  },
  scoreRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreRingFill: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 8,
    transform: [{ rotate: "-90deg" }],
  },
  scoreRingNum: { fontSize: 36, fontWeight: "900" } as any,
  trackBg: {
    height: 6,
    borderRadius: 99,
    backgroundColor: "#f1f5f9",
    overflow: "hidden",
  },
  trackFill: { height: "100%", borderRadius: 99 },

  // Progress
  progressTrack: {
    height: 6,
    borderRadius: 99,
    backgroundColor: "#f1f5f9",
    overflow: "hidden",
    alignSelf: "stretch",
  },
  progressFill: { height: "100%", borderRadius: 99, backgroundColor: C.brand },
  uploadRing: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.brand + "10",
  },
  uploadInfoPanel: {
    alignSelf: "stretch",
    gap: 9,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    backgroundColor: "#f8fafc",
  },
  uploadFileName: {
    color: C.text,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
  },
  uploadStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  uploadStatText: { color: C.text, fontSize: 12, fontWeight: "900" },
  uploadSubStatText: { color: C.textSec, fontSize: 12, fontWeight: "800" },

  // Tabs
  tabsRow: {
    backgroundColor: C.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    padding: 4,
    flexGrow: 0,
  },
  tabPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  tabPillActive: { backgroundColor: C.brand + "10" },
  tabPillText: { fontSize: 11, fontWeight: "800", color: C.textSec },
  tabPillTextActive: { color: C.brand },
  tabBadge: {
    backgroundColor: C.red,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  tabBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },

  // Rubric
  rubricPctBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  questionRow: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f8fafc",
    borderLeftWidth: 3,
  },
  qIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  qPtsBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },

  // Speaker badge
  speakerBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  timeText: { fontSize: 11, fontWeight: "700", color: C.textMuted },

  // Audio player
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineTrack: {
    height: 6,
    borderRadius: 99,
    backgroundColor: "#f1f5f9",
    overflow: "visible",
  },
  timelineFill: { height: "100%", borderRadius: 99, backgroundColor: C.brand },
  timelineThumb: {
    position: "absolute",
    top: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: C.brand,
    borderWidth: 3,
    borderColor: "#fff",
    marginLeft: -8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },

  // Materials
  materialRow: { flexDirection: "row", gap: 12, padding: 14 },
  materialIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  materialName: { fontSize: 14, fontWeight: "800", color: C.text },
  materialDesc: {
    fontSize: 12,
    fontWeight: "600",
    color: C.textSec,
    marginTop: 2,
    lineHeight: 17,
  },
  materialMeta: {
    fontSize: 11,
    fontWeight: "700",
    color: C.textMuted,
    marginTop: 4,
    textTransform: "capitalize",
  },
  assetSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 12,
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 8,
    backgroundColor: "#f5f9ff",
  },
  assetSummaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eaf2ff",
  },

  // Rubric library and picker
  fieldLabel: {
    color: C.textSec,
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 7,
    textTransform: "uppercase",
  },
  pickerValue: { color: C.text, fontSize: 14, fontWeight: "800" },
  pickerMeta: {
    color: C.textMuted,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  pickerMenu: {
    marginTop: 7,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    backgroundColor: C.card,
  },
  pickerOption: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 12,
  },
  pickerOptionSelected: { backgroundColor: "#f3f7ff" },
  pickerOptionTitle: { color: C.text, fontSize: 13, fontWeight: "800" },
  defaultBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: C.greenBg,
  },
  defaultBadgeText: {
    color: C.green,
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  defaultRubricCard: {
    minHeight: 118,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e9d5ff",
    borderRadius: 18,
    backgroundColor: "#fbf7ff",
  },
  defaultRubricIcon: {
    width: 50,
    height: 50,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.purpleBg,
  },
  defaultRubricTitle: {
    flex: 1,
    color: C.text,
    fontSize: 17,
    fontWeight: "900",
  },
  rubricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  rubricCard: {
    width: "48%",
    minHeight: 146,
    justifyContent: "space-between",
    gap: 12,
    padding: 13,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 16,
    backgroundColor: "#fff",
  },
  rubricCardBody: { gap: 4 },
  rubricCardTitle: {
    color: C.text,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
  },
  rubricRow: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 13,
  },
  rubricListIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.purpleBg,
  },
  rubricTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  rubricAppliedText: {
    color: C.brand,
    fontSize: 10,
    fontWeight: "800",
    marginTop: 4,
  },
  rubricSectionHeader: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    backgroundColor: "#f8fafc",
  },
  rubricPoints: { color: C.brand, fontSize: 12, fontWeight: "900" },
  rubricItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 13,
  },
  rubricItemNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef4ff",
  },
  rubricItemNumberText: { color: C.brand, fontSize: 10, fontWeight: "900" },
  rubricItemText: {
    color: C.text,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  rubricItemNote: {
    color: C.textSec,
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 16,
    marginTop: 4,
  },

  // Call recorder
  callRecorder: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 22,
    paddingTop: Platform.OS === "ios" ? 56 : 24,
    paddingBottom: Platform.OS === "ios" ? 30 : 20,
  },
  callTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  callTopButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f2f2f7",
  },
  callTopSpacer: { width: 42 },
  callLiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 100,
    backgroundColor: C.brand + "12",
  },
  callLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.brand,
  },
  callLiveText: { color: C.brand, fontSize: 10, fontWeight: "900" },
  callCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 12,
  },
  callMicHalo: {
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(79,70,229,0.17)",
    marginBottom: 24,
  },
  callMicCore: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.brand,
    shadowColor: C.brand,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.38,
    shadowRadius: 24,
    elevation: 8,
  },
  callTitle: {
    color: "#636366",
    fontSize: 20,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  callTimer: {
    color: "#111",
    fontSize: 36,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    marginTop: 18,
    textAlign: "center",
  },
  waveform: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 22,
  },
  waveBar: { width: 3, borderRadius: 2, backgroundColor: C.brand },
  callCaption: {
    color: "#98a2b3",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 7,
  },
  callControls: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-around",
  },
  callAction: { width: 82, alignItems: "center", gap: 8 },
  callActionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(25,23,23,0.06)",
  },
  callActionCount: {
    position: "absolute",
    top: -3,
    right: -2,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.brand,
    borderWidth: 2,
    borderColor: "#111318",
  },
  callActionCountText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  callStopButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.brand,
    shadowColor: C.brand,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 9,
  },
  callStopSquare: {
    width: 23,
    height: 23,
    borderRadius: 4,
    backgroundColor: "#fff",
  },
  callActionLabel: { color: C.text, fontSize: 10, fontWeight: "700" },
  recordingAssetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 46,
  },
  recordingAssetCard: {
    width: "48.5%",
    minHeight: 112,
    justifyContent: "flex-end",
    gap: 5,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#f2f2f7",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  recordingAssetTitle: { color: C.text, fontSize: 13, fontWeight: "800" },
  recordingAssetSub: { color: "#636366", fontSize: 11, lineHeight: 15 },
  recordingAssetCheck: { position: "absolute", right: 9, top: 9 },
  recordingWaveRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  finishRecording: {
    alignSelf: "center",
    marginTop: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#eef2ff",
  },
  finishRecordingText: { color: C.brand, fontSize: 12, fontWeight: "900" },
  cancelSessionBtn: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 8,
    backgroundColor: C.redBg,
  },
  cancelSessionText: { color: C.red, fontSize: 13, fontWeight: "800" },
  sheetBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(16,24,40,0.52)",
  },
  assetSheet: {
    maxHeight: "78%",
    minHeight: "52%",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: "#fff",
    paddingHorizontal: 18,
    paddingBottom: Platform.OS === "ios" ? 32 : 18,
  },
  communitySheet: { minHeight: "70%", overflow: "hidden" },
  communitySheetList: { paddingTop: 10, paddingBottom: 20 },
  communityEmpty: { alignItems: "center", gap: 8, paddingVertical: 32 },
  sheetHandle: {
    width: 40,
    height: 4,
    alignSelf: "center",
    borderRadius: 2,
    backgroundColor: "#d0d5dd",
    marginTop: 9,
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  sheetTitle: { color: C.text, fontSize: 20, fontWeight: "900" },
  sheetSubtitle: { color: C.textSec, fontSize: 12, marginTop: 2 },
  assetSheetList: { flexGrow: 0, marginBottom: 12 },
  assetPickRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: "#e4e7ec",
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  assetPickRowSelected: { borderColor: "#abefc6", backgroundColor: "#ecfdf3" },
  assetPickTitle: { color: C.text, fontSize: 13, fontWeight: "800" },
  assetPickMeta: { color: C.textSec, fontSize: 11, marginTop: 2 },
  assetPickAction: { color: C.brand, fontSize: 11, fontWeight: "900" },
  assetNotesInput: {
    minHeight: 74,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: "#d0d5dd",
    borderRadius: 8,
    padding: 11,
    color: C.text,
    fontSize: 13,
    textAlignVertical: "top",
  },

  // Calendar
  pageHeadingRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  pageHeadingSub: {
    color: C.textSec,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  integrationStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 12,
    borderWidth: 1,
    borderColor: "#d1fadf",
    borderRadius: 8,
    backgroundColor: "#f6fef9",
  },
  integrationIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dcfae6",
  },
  integrationTitle: { color: C.text, fontSize: 13, fontWeight: "800" },
  integrationSub: { color: C.textSec, fontSize: 10, marginTop: 2 },
  connectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: "#dcfae6",
  },
  connectedBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.green,
  },
  connectedBadgeText: { color: C.green, fontSize: 10, fontWeight: "900" },
  calendarEventRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 13,
  },
  entrataEventIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.purpleBg,
  },
  calendarContact: {
    color: C.purple,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 3,
  },
  calNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  calMonth: { fontSize: 17, fontWeight: "800", color: C.text },
  calDowRow: { flexDirection: "row", marginBottom: 6 },
  calDow: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "800",
    color: C.textMuted,
  },
  calWeek: { flexDirection: "row" },
  calDayCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 12,
    gap: 3,
  },
  calDayText: { fontSize: 14, fontWeight: "700", color: C.text },
  calDayToday: { backgroundColor: C.brand + "10" },
  calDayTextToday: { color: C.brand, fontWeight: "900" },
  calDaySelected: { backgroundColor: C.brand },
  calDayTextSelected: { color: "#fff", fontWeight: "900" },
  calDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.brand },
  calDots: { height: 5, flexDirection: "row", gap: 3 },

  // Buttons
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.brand,
    borderRadius: 8,
    minHeight: 52,
    paddingHorizontal: 16,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  outlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.card,
    borderRadius: 8,
    minHeight: 52,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  outlineBtnText: { color: C.textSec, fontSize: 15, fontWeight: "800" },
  darkBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.text,
    borderRadius: 8,
    minHeight: 52,
    paddingHorizontal: 16,
  },
  darkBtnText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  agentToggle: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "#f8fafc",
    padding: 12,
  },
  agentToggleSelected: {
    borderColor: C.brand,
    backgroundColor: C.brand + "10",
  },
  agentToggleCheck: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    alignItems: "center",
    justifyContent: "center",
  },
  agentToggleCheckSelected: { borderColor: C.brand, backgroundColor: C.brand },
  agentToggleTitle: { color: C.text, fontSize: 13, fontWeight: "900" },
  agentToggleCopy: {
    color: C.textSec,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
    marginTop: 2,
  },

  // Form
  formTitle: { color: C.text, fontSize: 23, fontWeight: "900", lineHeight: 29 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#f8fafc",
    borderColor: "#d7dee8",
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  inputField: { flex: 1, fontSize: 16, color: C.text, fontWeight: "600" },
  labelSmall: {
    fontSize: 11,
    fontWeight: "800",
    color: C.textMuted,
    textTransform: "uppercase",
  },

  // Segment picker
  segPill: {
    backgroundColor: "#f5f7fb",
    borderColor: "#d7dee8",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  segPillActive: { backgroundColor: "#eaf4ff", borderColor: C.brand },
  segText: { color: C.textSec, fontSize: 13, fontWeight: "800" },
  segTextActive: { color: C.brand },

  // Step dots
  stepDot: {
    alignItems: "center",
    backgroundColor: "#eef2f7",
    borderRadius: 999,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  stepDotActive: { backgroundColor: C.brand },
  stepDotDone: { backgroundColor: C.green },
  stepDotText: { color: C.textSec, fontSize: 13, fontWeight: "900" },
  stepLabel: { color: C.textSec, fontSize: 12, fontWeight: "800" },

  // Back
  backBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.card,
    borderColor: C.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  // Avatars
  avatarLg: {
    alignItems: "center",
    backgroundColor: "#e9f2ff",
    borderRadius: 30,
    height: 84,
    justifyContent: "center",
    width: 84,
  },
  avatarLgText: { color: C.brand, fontSize: 26, fontWeight: "900" },
  avatar36: {
    alignItems: "center",
    backgroundColor: "#e9f2ff",
    borderRadius: 14,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
});
