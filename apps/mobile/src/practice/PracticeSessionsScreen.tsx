import { authenticatedFetch, getCurrentSession } from "@/auth";
import { CustomText } from "@/components/custom-text";
import {
  LargeTitleCopy,
  LargeTitleHeader,
  largeTitleContentInset,
} from "@/components/large-title-header";
import { LiquidGlassIconButton } from "@/components/liquid-glass-icon-button";
import { MotionPressable } from "@/components/ui/motion";
import { selectionHaptic } from "@/lib/haptics";
import { ACCENT, BACKGROUND, CARD, LARGE_CORNER, SMALL_CORNER, TEXT } from "@/theme/tokens";
import { tourColors as C } from "@/theme/tour-brand";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import Reanimated, {
  FadeInDown,
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
  scenario_name?: string | null;
  scenario_difficulty?: string | null;
  score?: number | null;
  grade_status?: "passed" | "not-passed" | "needs-review" | null;
  duration_seconds?: number | null;
  created_at?: string;
};

type NativePracticeSessionProps = {
  scenario: Scenario | null;
  onBack: () => void;
};

const NativePracticeSession = Platform.OS !== "web" && !isExpoGo()
  ? (require("./NativePracticeSession").NativePracticeSession as React.ComponentType<NativePracticeSessionProps>)
  : null;

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
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const initialScenarioOpenedRef = useRef<string | null>(null);

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
    if (!NativePracticeSession) {
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
    if (!NativePracticeSession) {
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

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (livePractice && NativePracticeSession) {
    return (
      <NativePracticeSession
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
        <CustomText textStyle="micro" style={styles.webNote}>
          Practice stays in the app. Your scenarios and graded results stay synced to this property.
        </CustomText>

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
              attempts.slice(0, 8).map((attempt) => <AttemptRow key={attempt.id} attempt={attempt} />)
            ) : (
              <PracticeEmpty
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

function AttemptRow({ attempt }: { attempt: Attempt }) {
  const passed = attempt.grade_status === "passed";
  const scoreColor = passed ? C.green : attempt.grade_status === "not-passed" ? C.red : C.amber;
  return (
    <View style={styles.card}>
      <View style={styles.flex}>
        <CustomText textStyle="title" numberOfLines={1} style={styles.cardTitle}>
          {attempt.scenario_name || "Practice scenario"}
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
    </View>
  );
}

function PracticeEmpty({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}) {
  return (
    <Reanimated.View entering={FadeInDown.duration(260).springify()} style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={22} color={ACCENT} />
      </View>
      <CustomText textStyle="title">{title}</CustomText>
      <CustomText textStyle="caption" style={styles.emptySub}>
        {subtitle}
      </CustomText>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BACKGROUND },
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
  webNote: {
    marginTop: -6,
    color: C.textMuted,
    textAlign: "center",
  },
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
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 15,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  cardTitle: { flex: 1 },
  cardMeta: { marginTop: 5, color: C.textSec },
  attemptScore: { fontVariant: ["tabular-nums"] },
  pending: { color: C.textMuted },
  empty: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 28,
    borderRadius: LARGE_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "rgba(0, 108, 229, 0.08)",
  },
  emptySub: {
    color: C.textSec,
    textAlign: "center",
  },
});
