import { authenticatedFetch, getCurrentSession } from "@/auth";
import { CustomText } from "@/components/custom-text";
import { EmptyStateCard } from "@/components/empty-state-card";
import { GlassNavHeader, glassNavContentInset } from "@/components/glass-nav-header";
import { InfoBox } from "@/components/info-box";
import {
  LargeTitleCopy,
  LargeTitleHeader,
  largeTitleContentInset,
} from "@/components/large-title-header";
import { LiquidGlassIconButton } from "@/components/liquid-glass-icon-button";
import { LoadingDots } from "@/components/loading-dots";
import { MotionPressable } from "@/components/ui/motion";
import { impactHaptic, selectionHaptic } from "@/lib/haptics";
import { ACCENT, BACKGROUND, CARD, SMALL_CORNER, TEXT } from "@/theme/tokens";
import { tourColors as C } from "@/theme/tour-brand";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import Swipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Reanimated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isExpoGo } from "../runtime";
import { PracticeListSkeleton } from "./practice-loading";
import { ScenarioPickerModal, type PracticeScenario } from "./scenario-picker-modal";

type Scenario = PracticeScenario;

type Attempt = {
  id: string;
  scenario_id?: string | null;
  scenario_name?: string | null;
  scenario_difficulty?: string | null;
  score?: number | null;
  grade_status?: "passed" | "not-passed" | "needs-review" | null;
  duration_seconds?: number | null;
  created_at?: string;
};

type NativePracticeSessionProps = {
  scenario: Scenario | null;
  attemptId?: string;
  onBack: () => void;
};

const canUseNativePractice = Platform.OS !== "web" && !isExpoGo();
const PRACTICE_SWIPE_DELETE_WIDTH = 88;

function NativePracticeSessionHost(props: NativePracticeSessionProps) {
  const insets = useSafeAreaInsets();
  const Session = React.useMemo(() => {
    try {
      const loaded = require("./NativePracticeSession") as {
        NativePracticeSession?: React.ComponentType<NativePracticeSessionProps>;
      };
      return loaded.NativePracticeSession ?? null;
    } catch (error) {
      console.error("NativePracticeSession failed to load", error);
      return null;
    }
  }, []);

  if (!Session) {
    return (
      <View style={styles.root}>
        <View style={[styles.nativeUnavailable, { paddingTop: glassNavContentInset(insets.top) }]}>
          <EmptyStateCard
            icon="alert-circle-outline"
            title="Practice unavailable"
            subtitle="Live practice could not start. Go back and try again after the app reloads."
          />
          <Pressable onPress={props.onBack} style={styles.startBtn} accessibilityRole="button">
            <CustomText textStyle="title" style={styles.startBtnText}>
              Back to practice
            </CustomText>
          </Pressable>
        </View>
        <GlassNavHeader title="Practice" onBack={props.onBack} />
      </View>
    );
  }

  return <Session {...props} />;
}

export function PracticeSessionsScreen({
  onBack,
  onLiveChange,
  initialScenarioId,
  property,
}: {
  onBack?: () => void;
  onLiveChange?: (live: boolean) => void;
  initialScenarioId?: string;
  property?: string;
}) {
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [livePractice, setLivePractice] = useState(false);
  const [reviewAttemptId, setReviewAttemptId] = useState<string | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const initialScenarioOpenedRef = useRef<string | null>(null);
  const openSwipeableRef = useRef<SwipeableMethods | null>(null);

  useEffect(() => {
    onLiveChange?.(livePractice);
  }, [livePractice, onLiveChange]);

  useEffect(() => {
    return () => onLiveChange?.(false);
  }, [onLiveChange]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [scenarioRes, attemptsRes] = await Promise.all([
        authenticatedFetch("/api/roleplay/scenarios"),
        authenticatedFetch("/api/roleplay/attempts?scope=mine"),
      ]);
      const scenarioBody = await scenarioRes.json().catch(() => null) as { success?: boolean; scenarios?: Scenario[]; message?: string } | null;
      const attemptsBody = await attemptsRes.json().catch(() => null) as { success?: boolean; attempts?: Attempt[]; message?: string } | null;
      if (!scenarioRes.ok || !scenarioBody?.success) throw new Error(scenarioBody?.message ?? "Could not load practice scenarios.");
      if (!attemptsRes.ok || !attemptsBody?.success) throw new Error(attemptsBody?.message ?? "Could not load practice history.");
      setScenarios(scenarioBody.scenarios ?? []);
      setAttempts(attemptsBody.attempts ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load practice sessions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openPicker = useCallback(() => {
    if (!canUseNativePractice) {
      Alert.alert(
        "Development build required",
        "Live AI practice uses the Daily native call SDK. You can test the rest of Tour—including 360° capture—in Expo Go.",
      );
      return;
    }
    if (!getCurrentSession()) {
      Alert.alert("Sign in required", "Sign in again, then start your practice session.");
      return;
    }
    setPickerOpen(true);
  }, []);

  const openPractice = useCallback((scenario: Scenario) => {
    if (!canUseNativePractice) {
      Alert.alert(
        "Development build required",
        "Live AI practice uses the Daily native call SDK. You can test the rest of Tour—including 360° capture—in Expo Go.",
      );
      return;
    }
    if (!getCurrentSession()) {
      Alert.alert("Sign in required", "Sign in again, then start your practice session.");
      return;
    }
    setPickerOpen(false);
    setSelectedScenario(scenario);
    setLivePractice(true);
  }, []);

  useEffect(() => {
    if (!initialScenarioId || loading || error) return;
    if (initialScenarioOpenedRef.current === initialScenarioId) return;
    const scenario = scenarios.find((item) => item.id === initialScenarioId);
    if (!scenario) return;
    initialScenarioOpenedRef.current = initialScenarioId;
    openPractice(scenario);
  }, [error, initialScenarioId, loading, openPractice, scenarios]);

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

  const performDeleteAttempt = useCallback(
    async (attemptId: string) => {
      if (deletingId) return;
      setDeletingId(attemptId);
      closeOpenSwipeable();
      try {
        const response = await authenticatedFetch(
          `/api/roleplay/attempts?id=${encodeURIComponent(attemptId)}`,
          { method: "DELETE" },
        );
        const body = (await response.json().catch(() => null)) as
          | { success?: boolean; message?: string }
          | null;
        if (!response.ok || !body?.success) {
          throw new Error(body?.message ?? "Could not delete practice session.");
        }
        setAttempts((current) => current.filter((attempt) => attempt.id !== attemptId));
      } catch (caught) {
        Alert.alert(
          "Could not delete",
          caught instanceof Error ? caught.message : "Could not delete this practice session.",
        );
      } finally {
        setDeletingId(null);
      }
    },
    [closeOpenSwipeable, deletingId],
  );

  const confirmDeleteAttempt = useCallback(
    (attempt: Attempt) => {
      Alert.alert(
        "Delete practice session?",
        `Delete “${attempt.scenario_name || "this practice session"}”? This can’t be undone.`,
        [
          { text: "Cancel", style: "cancel", onPress: closeOpenSwipeable },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => void performDeleteAttempt(attempt.id),
          },
        ],
      );
    },
    [closeOpenSwipeable, performDeleteAttempt],
  );

  const openAttempt = useCallback(
    (attempt: Attempt) => {
      const matched = attempt.scenario_id
        ? scenarios.find((item) => item.id === attempt.scenario_id)
        : undefined;
      setSelectedScenario(
        matched ?? {
          id: attempt.scenario_id || "",
          name: attempt.scenario_name || "Practice",
          difficulty: (attempt.scenario_difficulty as Scenario["difficulty"]) || undefined,
        },
      );
      setReviewAttemptId(attempt.id);
    },
    [scenarios],
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (reviewAttemptId) {
    return (
      <NativePracticeSessionHost
        scenario={selectedScenario}
        attemptId={reviewAttemptId}
        onBack={() => {
          setReviewAttemptId(null);
          setSelectedScenario(null);
        }}
      />
    );
  }

  if (livePractice && canUseNativePractice) {
    return (
      <NativePracticeSessionHost
        scenario={selectedScenario}
        onBack={() => {
          setLivePractice(false);
          setSelectedScenario(null);
          void load();
          if (initialScenarioId) onBack?.();
        }}
      />
    );
  }

  const scenarioLabel = scenarios.length === 1 ? "scenario" : "scenarios";
  const subtitle = property
    ? loading
      ? property
      : `${property} · ${scenarios.length} ${scenarioLabel}`
    : loading
      ? "Rehearse with an AI prospect"
      : `${scenarios.length} ${scenarioLabel}`;

  return (
    <View style={styles.root}>
      <Reanimated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: largeTitleContentInset(insets.top) },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={ACCENT}
          />
        }
      >
        <LargeTitleCopy title="Practice" subtitle={subtitle} scrollY={scrollY} />

        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel="Start live practice"
          haptic="medium"
          onPress={openPicker}
          style={styles.startBtn}
        >
          <Ionicons name="mic" size={21} color={CARD} />
          <CustomText textStyle="title" style={styles.startBtnText}>
            Start live practice
          </CustomText>
        </MotionPressable>
        <InfoBox>
          Practice stays in the app. Your scenarios and graded results stay synced to this property.
        </InfoBox>

        {loading ? <PracticeListSkeleton /> : null}
        {error ? (
          <View style={styles.error}>
            <Ionicons name="alert-circle-outline" size={18} color={C.red} />
            <CustomText textStyle="label" selectable style={styles.errorText}>
              {error}
            </CustomText>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                selectionHaptic();
                void load();
              }}
              hitSlop={8}
            >
              <CustomText textStyle="label" style={styles.retry}>
                Retry
              </CustomText>
            </Pressable>
          </View>
        ) : null}

        {!loading && !error ? (
          <>
            <View style={styles.sectionHeading}>
              <CustomText textStyle="title" style={styles.sectionTitle}>
                Your recent practice
              </CustomText>
            </View>
            {attempts.length ? (
              <View>
                {attempts.slice(0, 8).map((attempt) => (
                  <AttemptRow
                    key={attempt.id}
                    attempt={attempt}
                    isDeleting={deletingId === attempt.id}
                    onOpen={() => openAttempt(attempt)}
                    onDelete={() => confirmDeleteAttempt(attempt)}
                    onSwipeOpen={handleSwipeOpen}
                    onSwipeClose={handleSwipeClose}
                    onCloseOpen={closeOpenSwipeable}
                    isAnyOpen={() => openSwipeableRef.current !== null}
                  />
                ))}
              </View>
            ) : (
              <EmptyStateCard
                icon="trophy-outline"
                title="No practice sessions yet"
                subtitle="Complete a live scenario to see a score and coaching history here."
              />
            )}
          </>
        ) : null}
      </Reanimated.ScrollView>

      <LargeTitleHeader
        title="Practice"
        scrollY={scrollY}
        leading={
          onBack ? (
            <LiquidGlassIconButton
              icon="arrow-back"
              accessibilityLabel="Back"
              onPress={onBack}
            />
          ) : undefined
        }
      />

      <ScenarioPickerModal
        visible={pickerOpen}
        scenarios={scenarios}
        loading={loading}
        onClose={() => setPickerOpen(false)}
        onSelect={openPractice}
      />
    </View>
  );
}

function AttemptRow({
  attempt,
  isDeleting,
  onOpen,
  onDelete,
  onSwipeOpen,
  onSwipeClose,
  onCloseOpen,
  isAnyOpen,
}: {
  attempt: Attempt;
  isDeleting: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onSwipeOpen: (methods: SwipeableMethods) => void;
  onSwipeClose: (methods: SwipeableMethods) => void;
  onCloseOpen: () => void;
  isAnyOpen: () => boolean;
}) {
  const swipeableRef = useRef<SwipeableMethods | null>(null);
  const passed = attempt.grade_status === "passed";
  const scoreColor = passed ? C.green : attempt.grade_status === "not-passed" ? C.red : C.amber;
  const title = attempt.scenario_name || "Practice scenario";
  return (
    <Swipeable
      ref={swipeableRef}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      containerStyle={styles.swipeContainer}
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
        <View style={styles.swipeActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete ${title}`}
            disabled={isDeleting}
            onPress={() => {
              impactHaptic();
              onDelete();
            }}
            style={({ pressed }) => [
              styles.deleteAction,
              (pressed || isDeleting) && styles.deleteActionPressed,
            ]}
          >
            {isDeleting ? (
              <LoadingDots color={CARD} size="small" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={20} color={CARD} />
                <CustomText textStyle="micro" style={styles.deleteActionText}>
                  Delete
                </CustomText>
              </>
            )}
          </Pressable>
        </View>
      )}
    >
      <MotionPressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${title}`}
        disabled={isDeleting}
        haptic="selection"
        onPress={() => {
          if (isAnyOpen()) {
            onCloseOpen();
            return;
          }
          onOpen();
        }}
        style={[styles.card, isDeleting && styles.cardDeleting]}
      >
        <View style={styles.flex}>
          <CustomText textStyle="title" numberOfLines={1} style={styles.cardTitle}>
            {title}
          </CustomText>
          <CustomText textStyle="caption" style={styles.cardMeta}>
            {attempt.created_at ? new Date(attempt.created_at).toLocaleDateString() : "Recent"}
            {attempt.duration_seconds ? ` · ${Math.max(1, Math.round(attempt.duration_seconds / 60))} min` : ""}
          </CustomText>
        </View>
        {attempt.score != null ? (
          <CustomText textStyle="title" style={[styles.attemptScore, { color: scoreColor }]}>
            {Math.round(attempt.score)}%
          </CustomText>
        ) : (
          <CustomText textStyle="micro" style={styles.pending}>
            Pending
          </CustomText>
        )}
      </MotionPressable>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BACKGROUND },
  nativeUnavailable: {
    flex: 1,
    justifyContent: "center",
    gap: 18,
    paddingHorizontal: 16,
  },
  scroll: {
    gap: 18,
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  flex: { flex: 1, minWidth: 0 },
  startBtn: {
    minHeight: 58,
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 14,
    borderRadius: 29,
    backgroundColor: ACCENT,
    boxShadow: "0 6px 14px rgba(0, 108, 229, 0.28)",
  },
  startBtnText: { color: CARD },
  error: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    padding: 14,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: C.redBg,
  },
  errorText: { flex: 1, color: C.red },
  retry: { color: ACCENT },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  sectionTitle: { flex: 1, color: TEXT },
  swipeContainer: {
    marginBottom: 10,
    borderRadius: SMALL_CORNER,
    overflow: "hidden",
  },
  swipeActions: { width: PRACTICE_SWIPE_DELETE_WIDTH },
  deleteAction: {
    flex: 1,
    width: PRACTICE_SWIPE_DELETE_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "#ef4444",
  },
  deleteActionPressed: { backgroundColor: "#dc2626", opacity: 0.92 },
  deleteActionText: { color: CARD },
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
  cardDeleting: { opacity: 0.55 },
  cardTitle: { flex: 1 },
  cardMeta: { marginTop: 5, color: C.textSec },
  attemptScore: { fontVariant: ["tabular-nums"] },
  pending: { color: C.textMuted },
});
