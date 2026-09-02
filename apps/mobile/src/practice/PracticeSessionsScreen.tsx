import type { PracticeAttempt, PracticeScenario } from "@/api";
import { getCurrentSession } from "@/auth";
import { TourEmptyState as EmptyState } from "@/components/tour";
import { selectionHaptic } from "@/lib/haptics";
import { usePracticeDashboardQuery } from "@/queries";
import { tourColors as C } from "@/theme/tour-brand";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativePracticeSession } from "./NativePracticeSession";
import { PracticeListSkeleton } from "./practice-loading";

export function PracticeSessionsScreen({
  onBack,
  onOpenNewSession,
}: {
  onBack: () => void;
  onOpenNewSession?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const practiceQuery = usePracticeDashboardQuery();
  const scenarios = practiceQuery.data?.scenarios ?? [];
  const attempts = practiceQuery.data?.attempts ?? [];
  const loading = practiceQuery.isPending;
  const [refreshing, setRefreshing] = useState(false);
  const [livePractice, setLivePractice] = useState(false);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const selectedScenario = scenarios.find((scenario) => scenario.id === selectedScenarioId)
    ?? scenarios[0]
    ?? null;
  const error = practiceQuery.error instanceof Error ? practiceQuery.error.message : null;

  function openPractice(scenario?: PracticeScenario) {
    if (!getCurrentSession()) {
      Alert.alert("Sign in required", "Sign in again, then start your practice session.");
      return;
    }
    const selected = scenario ?? scenarios[0] ?? null;
    if (!selected) {
      Alert.alert("No practice scenarios", "Create a scenario on the web first, then return here to start a live practice call.");
      return;
    }
    setSelectedScenarioId(selected.id);
    setLivePractice(true);
  }

  const refresh = async () => {
    setRefreshing(true);
    try {
      await practiceQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  if (livePractice) {
    return (
      <NativePracticeSession
        scenario={selectedScenario}
        onBack={() => {
          setLivePractice(false);
          void practiceQuery.refetch();
        }}
      />
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, selectedScenario && styles.scrollWithDock]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={C.brand} />}
      >
        <View style={styles.page}>
          <View style={styles.header}>
            <Pressable accessibilityRole="button" accessibilityLabel="Back to sessions" onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <Ionicons name="arrow-back" size={20} color={C.text} />
            </Pressable>
            <Text style={styles.pageTitle}>Practice</Text>
          </View>
          {onOpenNewSession ? <PracticeModeTabs onSession={onOpenNewSession} /> : null}

          <View style={styles.intro}>
            <Text style={styles.title}>Choose a scenario</Text>
            <Text style={styles.subtitle}>Practice a realistic leasing conversation with an AI prospect.</Text>
          </View>

          {loading ? <PracticeListSkeleton /> : null}
          {error ? (
            <View style={styles.error}>
              <Ionicons name="alert-circle-outline" size={18} color={C.red} />
              <View style={styles.flex}><Text style={styles.errorText}>{error}</Text></View>
              <Pressable onPress={() => void practiceQuery.refetch()}><Text style={styles.retry}>Retry</Text></Pressable>
            </View>
          ) : null}

          {!loading && !error ? (
            <>
              <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Scenarios</Text><Text style={styles.sectionMeta}>{scenarios.length}</Text></View>
              <View style={styles.scenarioList}>
                {scenarios.length ? scenarios.map((scenario) => {
                  const selected = scenario.id === selectedScenario?.id;
                  return (
                    <Pressable
                      key={scenario.id}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`${scenario.name} practice scenario`}
                      onPress={() => {
                        selectionHaptic();
                        setSelectedScenarioId(scenario.id);
                      }}
                      style={({ pressed }) => [styles.scenario, selected && styles.scenarioSelected, pressed && styles.pressed]}
                    >
                      <View style={[styles.scenarioIcon, selected && styles.scenarioIconSelected]}>
                        <Ionicons name="chatbubble-ellipses-outline" size={19} color={selected ? "#fff" : C.brand} />
                      </View>
                      <View style={styles.flex}>
                        <View style={styles.scenarioTop}>
                          <Text style={styles.scenarioTitle} numberOfLines={2}>{scenario.name}</Text>
                          {scenario.difficulty ? <DifficultyBadge difficulty={scenario.difficulty} /> : null}
                        </View>
                        {scenario.description ? <Text style={styles.scenarioDesc} numberOfLines={2}>{scenario.description}</Text> : null}
                        {scenario.passThreshold != null ? (
                          <View style={styles.thresholdRow}>
                            <Ionicons name="flag-outline" size={12} color={C.textMuted} />
                            <Text style={styles.threshold}>{scenario.passThreshold}% target</Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={[styles.selection, selected && styles.selectionSelected]}>
                        {selected ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                      </View>
                    </Pressable>
                  );
                }) : <EmptyState icon="sparkles-outline" title="No scenarios yet" subtitle="Create a practice scenario on Tour.you, then pull to refresh." />}
              </View>

              <View style={[styles.sectionHeading, styles.historyHeading]}>
                <Text style={styles.sectionTitle}>Recent practice</Text>
                {attempts.length ? <Text style={styles.sectionMeta}>{attempts.length}</Text> : null}
              </View>
              {attempts.length ? (
                <View style={styles.historyList}>
                  {attempts.slice(0, 8).map((attempt, index, list) => (
                    <AttemptRow key={attempt.id} attempt={attempt} last={index === list.length - 1} />
                  ))}
                </View>
              ) : (
                <EmptyState icon="trophy-outline" title="No practice sessions yet" subtitle="Complete a live scenario to see a score and coaching history here." />
              )}
            </>
          ) : null}
        </View>
      </ScrollView>

      {!loading && !error && selectedScenario ? (
        <View style={[styles.bottomDock, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.selectedCopy}>
            <Text style={styles.selectedLabel}>SELECTED SCENARIO</Text>
            <Text style={styles.selectedTitle} numberOfLines={1}>{selectedScenario.name}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Start ${selectedScenario.name} practice`}
            onPress={() => openPractice(selectedScenario)}
            style={({ pressed }) => [styles.startButton, pressed && styles.startButtonPressed]}
          >
            <Ionicons name="call" size={24} color="#fff" />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function PracticeModeTabs({ onSession }: { onSession: () => void }) {
  return (
    <View style={styles.modeTabs} accessibilityRole="tablist">
      <Pressable accessibilityRole="tab" accessibilityState={{ selected: false }} onPress={onSession} style={styles.modeTab}>
        <Ionicons name="mic-outline" size={15} color={C.textMuted} />
        <Text style={styles.modeTabText}>New session</Text>
      </Pressable>
      <View accessibilityRole="tab" accessibilityState={{ selected: true }} style={[styles.modeTab, styles.modeTabActive]}>
        <Ionicons name="sparkles-outline" size={15} color={C.brand} />
        <Text style={[styles.modeTabText, styles.modeTabTextActive]}>Practice</Text>
      </View>
    </View>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: NonNullable<PracticeScenario["difficulty"]> }) {
  const color = difficulty === "hard" ? C.red : difficulty === "easy" ? C.green : C.amber;
  return <View style={[styles.difficulty, { backgroundColor: `${color}18` }]}><Text style={[styles.difficultyText, { color }]}>{difficulty}</Text></View>;
}

function AttemptRow({ attempt, last }: { attempt: PracticeAttempt; last: boolean }) {
  const passed = attempt.grade_status === "passed";
  const scoreColor = passed ? C.green : attempt.grade_status === "not-passed" ? C.red : C.amber;
  return (
    <View style={[styles.attempt, !last && styles.attemptBorder]}>
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
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 38 }, scrollWithDock: { paddingBottom: 124 }, page: { gap: 14, padding: 20 }, flex: { flex: 1, minWidth: 0 },
  header: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border, borderRadius: 12, backgroundColor: C.card },
  pageTitle: { color: C.text, fontSize: 26, lineHeight: 32, fontWeight: "900" },
  intro: { gap: 4, paddingTop: 5 },
  title: { color: C.text, fontSize: 21, fontWeight: "900", lineHeight: 27 }, subtitle: { color: C.textSec, fontSize: 13, fontWeight: "600", lineHeight: 19 },
  modeTabs: { flexDirection: "row", gap: 4, padding: 4, borderWidth: 1, borderColor: C.border, borderRadius: 13, backgroundColor: C.card },
  modeTab: { flex: 1, minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 9 },
  modeTabActive: { backgroundColor: C.brand + "10" }, modeTabText: { color: C.textMuted, fontSize: 12, fontWeight: "800" }, modeTabTextActive: { color: C.brand },
  error: { flexDirection: "row", alignItems: "center", gap: 9, padding: 12, borderRadius: 12, backgroundColor: C.redBg }, errorText: { color: C.red, fontSize: 13, fontWeight: "700" }, retry: { color: C.brand, fontSize: 13, fontWeight: "900" },
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }, historyHeading: { marginTop: 14 }, sectionTitle: { color: C.text, fontSize: 16, fontWeight: "900" }, sectionMeta: { minWidth: 20, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99, backgroundColor: C.brand + "12", color: C.brand, fontSize: 10, fontWeight: "900", textAlign: "center" },
  scenarioList: { gap: 10 },
  scenario: { minHeight: 104, flexDirection: "row", alignItems: "center", gap: 11, padding: 13, borderWidth: 1, borderColor: C.border, borderRadius: 14, backgroundColor: C.card },
  scenarioSelected: { borderColor: C.brand + "66", backgroundColor: "#f5f9ff" },
  pressed: { opacity: 0.72 },
  scenarioIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: C.brand + "10" },
  scenarioIconSelected: { backgroundColor: C.brand },
  scenarioTop: { flexDirection: "row", alignItems: "flex-start", gap: 8 }, scenarioTitle: { flex: 1, color: C.text, fontSize: 13, lineHeight: 17, fontWeight: "900" }, scenarioDesc: { marginTop: 3, color: C.textSec, fontSize: 11, lineHeight: 16, fontWeight: "600" },
  thresholdRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  threshold: { color: C.textMuted, fontSize: 10, fontWeight: "800" }, difficulty: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 99 }, difficultyText: { fontSize: 9, fontWeight: "900", textTransform: "capitalize" },
  selection: { width: 24, height: 24, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border, borderRadius: 12, backgroundColor: C.card },
  selectionSelected: { borderColor: C.brand, backgroundColor: C.brand },
  historyList: { overflow: "hidden", borderWidth: 1, borderColor: C.border, borderRadius: 14, backgroundColor: C.card },
  attempt: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 13, paddingVertical: 10 },
  attemptBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  attemptIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 11 }, attemptTitle: { color: C.text, fontSize: 13, fontWeight: "900" }, attemptMeta: { marginTop: 3, color: C.textMuted, fontSize: 10, fontWeight: "700" }, attemptScore: { fontSize: 16, fontWeight: "900", fontVariant: ["tabular-nums"] }, pending: { color: C.textMuted, fontSize: 11, fontWeight: "800" },
  bottomDock: { position: "absolute", left: 0, right: 0, bottom: 0, minHeight: 82, flexDirection: "row", alignItems: "center", gap: 14, paddingTop: 11, paddingHorizontal: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border, backgroundColor: C.card },
  selectedCopy: { flex: 1, minWidth: 0 }, selectedLabel: { color: C.textMuted, fontSize: 9, fontWeight: "900", letterSpacing: 0.4 }, selectedTitle: { marginTop: 3, color: C.text, fontSize: 13, fontWeight: "900" },
  startButton: { width: 58, height: 58, alignItems: "center", justifyContent: "center", borderRadius: 29, borderWidth: 4, borderColor: "#dbeafe", backgroundColor: C.brand, shadowColor: C.brand, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 12, elevation: 4 },
  startButtonPressed: { transform: [{ scale: 0.96 }], opacity: 0.9 },
});
