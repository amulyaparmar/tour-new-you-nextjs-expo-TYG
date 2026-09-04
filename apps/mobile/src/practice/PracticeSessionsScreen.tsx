import { authenticatedFetch, getCurrentSession } from "@/auth";
import {
  TourBackButton as BackBtn,
  TourEmptyState as EmptyState,
  TourPrimaryButton as PrimaryBtn,
} from "@/components/tour";
import { tourColors as C } from "@/theme/tour-brand";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { isExpoGo } from "../runtime";
import { PracticeListSkeleton } from "./practice-loading";

type Scenario = {
  id: string;
  name: string;
  description?: string;
  difficulty?: "easy" | "medium" | "hard";
  firstMessage?: string;
  passThreshold?: number;
};

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
}: {
  onBack?: () => void;
  onLiveChange?: (live: boolean) => void;
  initialScenarioId?: string;
}) {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [livePractice, setLivePractice] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
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

  const openPractice = useCallback((scenario?: Scenario) => {
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
    const selected = scenario ?? scenarios[0] ?? null;
    if (!selected) {
      Alert.alert("No practice scenarios", "Create a scenario on the web first, then return here to start a live practice call.");
      return;
    }
    setSelectedScenario(selected);
    setLivePractice(true);
  }, [scenarios]);

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

  return (
    <ScrollView
      style={styles.scrollView}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={C.brand} />}
    >
      <View style={styles.page}>
        {onBack ? <BackBtn label="Practice" onPress={onBack} /> : null}
        <View style={styles.hero}>
          <View style={styles.heroIcon}><Ionicons name="sparkles" size={24} color="#fff" /></View>
          <Text style={styles.title}>Practice sessions</Text>
          <Text style={styles.subtitle}>Rehearse live conversations with an AI prospect and return here to review your graded attempts.</Text>
        </View>
        <PrimaryBtn label="Start live practice" icon="mic-outline" onPress={() => openPractice()} />
        <Text style={styles.webNote}>Practice stays in the app. Your scenarios and graded results stay synced to this property.</Text>

        {loading ? <PracticeListSkeleton /> : null}
        {error ? (
          <View style={styles.error}>
            <Ionicons name="alert-circle-outline" size={18} color={C.red} />
            <View style={styles.flex}><Text style={styles.errorText}>{error}</Text></View>
            <Pressable onPress={() => void load()}><Text style={styles.retry}>Retry</Text></Pressable>
          </View>
        ) : null}

        {!loading && !error ? (
          <>
            <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Scenarios</Text><Text style={styles.sectionMeta}>{scenarios.length}</Text></View>
            {scenarios.length ? scenarios.map((scenario) => (
              <Pressable key={scenario.id} accessibilityRole="button" accessibilityLabel={`Start ${scenario.name} practice`} onPress={() => openPractice(scenario)} style={({ pressed }) => [styles.scenario, pressed && styles.pressed]}>
                <View style={styles.scenarioIcon}><Ionicons name="chatbubbles-outline" size={19} color={C.brand} /></View>
                <View style={styles.flex}>
                  <View style={styles.scenarioTop}><Text style={styles.scenarioTitle}>{scenario.name}</Text>{scenario.difficulty ? <DifficultyBadge difficulty={scenario.difficulty} /> : null}</View>
                  {scenario.description ? <Text style={styles.scenarioDesc} numberOfLines={2}>{scenario.description}</Text> : null}
                  {scenario.passThreshold != null ? <Text style={styles.threshold}>Pass at {scenario.passThreshold}%</Text> : null}
                </View>
                <Ionicons name="arrow-forward" size={18} color={C.textMuted} />
              </Pressable>
            )) : <EmptyState icon="sparkles-outline" title="No scenarios yet" subtitle="Create a practice scenario on Tour.you, then pull to refresh." />}

            <View style={[styles.sectionHeading, styles.historyHeading]}><Text style={styles.sectionTitle}>Your recent practice</Text></View>
            {attempts.length ? attempts.slice(0, 8).map((attempt) => <AttemptRow key={attempt.id} attempt={attempt} />) : (
              <EmptyState icon="trophy-outline" title="No practice sessions yet" subtitle="Complete a live scenario to see a score and coaching history here." />
            )}
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: NonNullable<Scenario["difficulty"]> }) {
  const color = difficulty === "hard" ? C.red : difficulty === "easy" ? C.green : C.amber;
  return <View style={[styles.difficulty, { backgroundColor: `${color}18` }]}><Text style={[styles.difficultyText, { color }]}>{difficulty}</Text></View>;
}

function AttemptRow({ attempt }: { attempt: Attempt }) {
  const passed = attempt.grade_status === "passed";
  const scoreColor = passed ? C.green : attempt.grade_status === "not-passed" ? C.red : C.amber;
  return (
    <View style={styles.attempt}>
      <View style={[styles.attemptIcon, { backgroundColor: `${scoreColor}16` }]}><Ionicons name={passed ? "checkmark" : "analytics-outline"} size={18} color={scoreColor} /></View>
      <View style={styles.flex}>
        <Text style={styles.attemptTitle} numberOfLines={1}>{attempt.scenario_name || "Practice scenario"}</Text>
        <Text style={styles.attemptMeta}>{attempt.created_at ? new Date(attempt.created_at).toLocaleDateString() : "Recent"}{attempt.duration_seconds ? ` · ${Math.max(1, Math.round(attempt.duration_seconds / 60))} min` : ""}</Text>
      </View>
      {attempt.score != null ? <Text style={[styles.attemptScore, { color: scoreColor }]}>{Math.round(attempt.score)}%</Text> : <Text style={styles.pending}>Pending</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  scroll: { paddingBottom: 38 }, page: { gap: 14, padding: 20 }, flex: { flex: 1, minWidth: 0 },
  hero: { gap: 8, paddingTop: 4 }, heroIcon: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: C.brand },
  title: { color: C.text, fontSize: 27, fontWeight: "900", lineHeight: 33 }, subtitle: { color: C.textSec, fontSize: 14, fontWeight: "600", lineHeight: 21 },
  webNote: { marginTop: -5, color: C.textMuted, fontSize: 11, lineHeight: 16, fontWeight: "600", textAlign: "center" },
  error: { flexDirection: "row", alignItems: "center", gap: 9, padding: 12, borderRadius: 12, backgroundColor: C.redBg }, errorText: { color: C.red, fontSize: 13, fontWeight: "700" }, retry: { color: C.brand, fontSize: 13, fontWeight: "900" },
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }, historyHeading: { marginTop: 15 }, sectionTitle: { color: C.text, fontSize: 17, fontWeight: "900" }, sectionMeta: { minWidth: 20, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99, backgroundColor: C.brand + "12", color: C.brand, fontSize: 11, fontWeight: "900", textAlign: "center" },
  scenario: { flexDirection: "row", alignItems: "center", gap: 11, padding: 13, borderWidth: 1, borderColor: C.border, borderRadius: 15, backgroundColor: C.card }, pressed: { opacity: 0.72 }, scenarioIcon: { width: 39, height: 39, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: C.brand + "10" }, scenarioTop: { flexDirection: "row", alignItems: "center", gap: 8 }, scenarioTitle: { flex: 1, color: C.text, fontSize: 14, fontWeight: "900" }, scenarioDesc: { marginTop: 3, color: C.textSec, fontSize: 12, lineHeight: 17, fontWeight: "600" }, threshold: { marginTop: 5, color: C.textMuted, fontSize: 10, fontWeight: "800" }, difficulty: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 99 }, difficultyText: { fontSize: 9, fontWeight: "900", textTransform: "capitalize" },
  attempt: { flexDirection: "row", alignItems: "center", gap: 11, padding: 13, borderWidth: 1, borderColor: C.border, borderRadius: 15, backgroundColor: C.card }, attemptIcon: { width: 37, height: 37, alignItems: "center", justifyContent: "center", borderRadius: 12 }, attemptTitle: { color: C.text, fontSize: 14, fontWeight: "900" }, attemptMeta: { marginTop: 3, color: C.textMuted, fontSize: 11, fontWeight: "700" }, attemptScore: { fontSize: 17, fontWeight: "900", fontVariant: ["tabular-nums"] }, pending: { color: C.textMuted, fontSize: 11, fontWeight: "800" },
});
