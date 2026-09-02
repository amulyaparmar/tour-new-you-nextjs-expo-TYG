import { Ionicons } from "@expo/vector-icons";
import type { AnalysisResult, AnalysisRunSummary, SessionDetail } from "@tour/shared";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Reanimated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { LoadingDots } from "@/components/loading-dots";
import { SessionReportSkeleton } from "@/components/ui/screen-skeletons";
import { fetchAnalysis, fetchAnalysisRuns, fetchSession } from "../api";
import { TourLogo } from "../components/TourLogo";
import { tourColors as C, scoreColor, scoreLabel } from "../theme/tour-brand";
import { prepareSessionReport, type CachedSessionReport } from "./report-cache";

export function SessionReportScreen({
  sessionId,
  onBack,
  onNotify,
}: {
  sessionId: string;
  onBack: () => void;
  onNotify?: (message: string, kind?: "success" | "error" | "info") => void;
}) {
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [runs, setRuns] = useState<AnalysisRunSummary[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [report, setReport] = useState<CachedSessionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sessionResult, analysisResult, runsResult] = await Promise.all([
        fetchSession(sessionId),
        fetchAnalysis(sessionId),
        fetchAnalysisRuns(sessionId).catch(() => ({ runs: [] })),
      ]);
      setSession(sessionResult.session);
      setAnalysis(analysisResult.analysis ?? sessionResult.analysis ?? null);
      setRuns(runsResult.runs);
      const current = runsResult.runs.find((run) => run.isCurrent) ?? runsResult.runs[0];
      setSelectedVersion(current?.version ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load this report.");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const prepare = useCallback(async (refresh = false) => {
    if (!session) return null;
    setPreparing(true);
    setError(null);
    try {
      const next = await prepareSessionReport({
        sessionId,
        sessionTitle: session.title,
        version: selectedVersion,
        refresh,
      });
      setReport(next);
      return next;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not prepare the PDF.");
      return null;
    } finally {
      setPreparing(false);
    }
  }, [selectedVersion, session, sessionId]);

  useEffect(() => {
    if (!session || loading) return;
    setReport(null);
    void prepare(false);
  }, [loading, prepare, selectedVersion, session]);

  const selectedRun = useMemo(
    () => runs.find((run) => run.version === selectedVersion) ?? runs.find((run) => run.isCurrent) ?? null,
    [runs, selectedVersion],
  );
  const score = selectedRun?.overallScore ?? analysis?.overallScore ?? session?.overallScore ?? null;

  async function openNativeReport() {
    if (!session || sharing) return;
    setSharing(true);
    const readyReport = report ?? await prepare(false);
    if (!readyReport) {
      setSharing(false);
      return;
    }
    try {
      await Share.share({
        title: readyReport.filename,
        message: `${session.title} PDF report`,
        url: readyReport.uri,
      });
      onNotify?.("PDF ready to preview, share, or save", "success");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not open the PDF.");
    } finally {
      setSharing(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.root}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.nav}>
            <Pressable accessibilityLabel="Back to session" onPress={onBack} style={styles.iconButton}>
              <Ionicons name="chevron-back" size={22} color={C.text} />
            </Pressable>
            <View style={styles.navBrand}><TourLogo width={62} /></View>
            <View style={styles.navSpacer} />
          </View>
          <SessionReportSkeleton />
        </ScrollView>
      </View>
    );
  }

  if (!session || !analysis) {
    return (
      <View style={styles.loading}>
        <Ionicons name="document-text-outline" size={46} color={C.textMuted} />
        <Text style={styles.loadingTitle}>Report unavailable</Text>
        <Text style={styles.loadingCopy}>{error ?? "This session does not have a completed analysis yet."}</Text>
        <Pressable onPress={onBack} style={styles.compactButton}><Text style={styles.compactButtonText}>Go back</Text></Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.nav}>
          <Pressable accessibilityLabel="Back to session" onPress={onBack} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <Ionicons name="chevron-back" size={22} color={C.text} />
          </Pressable>
          <View style={styles.navBrand}><TourLogo width={62} /></View>
          <Pressable accessibilityLabel="Refresh report" disabled={preparing} onPress={() => void prepare(true)} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed, preparing && styles.disabled]}>
            {preparing ? <LoadingDots size="small" color={C.brand} /> : <Ionicons name="refresh" size={19} color={C.textSec} />}
          </Pressable>
        </View>

        <Reanimated.View entering={FadeInDown.duration(280).springify()}>
          <Text style={styles.eyebrow}>SESSION REPORT</Text>
          <Text style={styles.pageTitle}>A polished report, ready wherever work happens.</Text>
          <Text style={styles.pageCopy}>Preview the report details here, then open the PDF to review, share, AirDrop, print, or save it to your device.</Text>
        </Reanimated.View>

        {runs.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.versionRow}>
            {[...runs]
              .sort((left, right) => right.version - left.version)
              .map((run) => (
                <Pressable
                  key={run.id}
                  onPress={() => {
                    setSelectedVersion(run.version);
                    void HapticsCompat.selection();
                  }}
                  style={({ pressed }) => [
                    styles.versionPill,
                    selectedVersion === run.version && styles.versionPillActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.versionText, selectedVersion === run.version && styles.versionTextActive]}>
                    Version {run.version}{run.isCurrent ? " · Current" : ""}
                  </Text>
                </Pressable>
              ))}
          </ScrollView>
        ) : null}

        {error ? (
          <Reanimated.View entering={FadeIn.duration(180)} style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color={C.red} />
            <Text style={styles.errorText}>{error}</Text>
          </Reanimated.View>
        ) : null}

        <ReportPreview
          session={session}
          analysis={analysis}
          selectedRun={selectedRun}
          score={score}
        />

        <Pressable
          disabled={preparing || sharing}
          onPress={() => void openNativeReport()}
          style={({ pressed }) => [styles.primaryAction, pressed && styles.primaryActionPressed, (preparing || sharing) && styles.disabled]}
        >
          {preparing || sharing ? <LoadingDots size="small" color="#fff" /> : <Ionicons name="eye-outline" size={20} color="#fff" />}
          <Text style={styles.primaryActionText}>
            {preparing ? "Preparing PDF…" : sharing ? "Opening…" : "Preview & share PDF"}
          </Text>
        </Pressable>
        <View style={styles.actionHint}>
          <Ionicons name={report ? "checkmark-circle" : "cloud-download-outline"} size={17} color={report ? C.green : C.textMuted} />
          <Text style={styles.actionHintText}>
            {report
              ? `Cached on this device · ${new Date(report.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
              : "The PDF will be cached securely on this device."}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const HapticsCompat = {
  async selection() {
    const Haptics = await import("expo-haptics");
    await Haptics.selectionAsync();
  },
};

function ReportPreview({
  session,
  analysis,
  selectedRun,
  score,
}: {
  session: SessionDetail;
  analysis: AnalysisResult;
  selectedRun: AnalysisRunSummary | null;
  score: number | null;
}) {
  const showingCurrentAnalysis = !selectedRun || selectedRun.isCurrent;
  const focus = analysis.sectionScores.length
    ? analysis.sectionScores.reduce((lowest, section) => section.score < lowest.score ? section : lowest)
    : null;
  return (
    <View style={styles.previewShell}>
      <LinearGradient colors={["#ffffff", "#f7fbff"]} style={styles.paper}>
        <View style={styles.paperHeader}>
          <TourLogo width={72} />
          <View style={styles.confidentialPill}><Text style={styles.confidentialText}>PRIVATE REPORT</Text></View>
        </View>
        <View style={styles.paperRule} />
        <Text style={styles.paperKicker}>TOUR EVALUATION</Text>
        <Text style={styles.paperTitle}>{session.title}</Text>
        <Text style={styles.paperMeta}>
          {[session.prospectName, session.location, session.scheduledAt ? new Date(session.scheduledAt).toLocaleDateString() : null]
            .filter(Boolean)
            .join(" · ")}
        </Text>
        <View style={styles.scorePanel}>
          <View style={[styles.scoreOrb, { borderColor: score == null ? C.textMuted : scoreColor(score) }]}>
            <Text style={[styles.scoreValue, { color: score == null ? C.textMuted : scoreColor(score) }]}>{score == null ? "—" : score}</Text>
            <Text style={styles.scoreSuffix}>/ 100</Text>
          </View>
          <View style={styles.scoreCopy}>
            <Text style={styles.scoreLabel}>{score == null ? "Evaluation" : scoreLabel(score)}</Text>
            <Text style={styles.scoreSummary} numberOfLines={4}>
              {showingCurrentAnalysis
                ? analysis.summary
                : `Historical analysis version ${selectedRun.version}. Open the PDF for the complete versioned evaluation.`}
            </Text>
          </View>
        </View>
        <View style={styles.previewColumns}>
          <PreviewFact
            icon="ribbon-outline"
            label="Top strengths"
            value={showingCurrentAnalysis ? `${analysis.strengths.length} documented` : "See versioned PDF"}
          />
          <PreviewFact
            icon="trending-up-outline"
            label="Coaching focus"
            value={showingCurrentAnalysis ? focus?.section ?? "Included in report" : "See versioned PDF"}
          />
        </View>
        <View style={styles.paperFooter}>
          <Text style={styles.paperFooterText}>
            {selectedRun ? `Analysis version ${selectedRun.version}` : "Current analysis"}
          </Text>
          <Text style={styles.paperFooterText}>PDF · Ready to share</Text>
        </View>
      </LinearGradient>
      <View style={styles.paperStackOne} />
      <View style={styles.paperStackTwo} />
    </View>
  );
}

function PreviewFact({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.previewFact}>
      <View style={styles.previewFactIcon}><Ionicons name={icon} size={16} color={C.brand} /></View>
      <Text style={styles.previewFactLabel}>{label}</Text>
      <Text style={styles.previewFactValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scrollContent: { padding: 18, paddingBottom: 52, gap: 16 },
  loading: { flex: 1, padding: 28, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: C.bg },
  loadingTitle: { marginTop: 6, color: C.text, fontSize: 19, fontWeight: "900", textAlign: "center" },
  loadingCopy: { maxWidth: 300, color: C.textSec, fontSize: 13, lineHeight: 19, fontWeight: "600", textAlign: "center" },
  compactButton: { minHeight: 44, marginTop: 8, paddingHorizontal: 18, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: C.brand },
  compactButtonText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  nav: { minHeight: 44, flexDirection: "row", alignItems: "center" },
  navBrand: { flex: 1, alignItems: "center", justifyContent: "center" },
  navSpacer: { width: 40, height: 40 },
  iconButton: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  eyebrow: { color: C.brand, fontSize: 10, lineHeight: 14, fontWeight: "900", letterSpacing: 1.1 },
  pageTitle: { marginTop: 5, color: C.text, fontSize: 27, lineHeight: 33, fontWeight: "900", letterSpacing: -0.6 },
  pageCopy: { marginTop: 7, color: C.textSec, fontSize: 13, lineHeight: 20, fontWeight: "600" },
  versionRow: { gap: 8, paddingRight: 12 },
  versionPill: { minHeight: 38, paddingHorizontal: 13, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  versionPillActive: { borderColor: C.brand, backgroundColor: "#eaf4ff" },
  versionText: { color: C.textSec, fontSize: 11, fontWeight: "800" },
  versionTextActive: { color: C.brand },
  errorBanner: { padding: 13, borderRadius: 15, flexDirection: "row", alignItems: "flex-start", gap: 9, borderWidth: 1, borderColor: "rgba(185,28,28,0.12)", backgroundColor: C.redBg },
  errorText: { flex: 1, color: C.red, fontSize: 12, lineHeight: 17, fontWeight: "700" },
  previewShell: { paddingBottom: 14 },
  paper: { zIndex: 3, minHeight: 430, padding: 22, borderRadius: 22, borderWidth: 1, borderColor: "rgba(16,24,40,0.08)", shadowColor: "#101828", shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.10, shadowRadius: 24, elevation: 6 },
  paperStackOne: { position: "absolute", zIndex: 2, left: 10, right: 10, bottom: 6, height: 28, borderRadius: 19, borderWidth: 1, borderColor: C.border, backgroundColor: "#f8fafc" },
  paperStackTwo: { position: "absolute", zIndex: 1, left: 20, right: 20, bottom: 0, height: 24, borderRadius: 18, backgroundColor: "#eef2f7" },
  paperHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  confidentialPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: "#eef2ff" },
  confidentialText: { color: "#4338ca", fontSize: 8, fontWeight: "900", letterSpacing: 0.6 },
  paperRule: { height: 1, marginVertical: 18, backgroundColor: "#e2e8f0" },
  paperKicker: { color: C.brand, fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  paperTitle: { marginTop: 7, color: C.text, fontSize: 24, lineHeight: 29, fontWeight: "900", letterSpacing: -0.5 },
  paperMeta: { marginTop: 5, color: C.textMuted, fontSize: 10, lineHeight: 15, fontWeight: "700" },
  scorePanel: { marginTop: 22, padding: 15, borderRadius: 18, flexDirection: "row", alignItems: "center", gap: 15, backgroundColor: "#f8fafc" },
  scoreOrb: { width: 78, height: 78, borderRadius: 39, alignItems: "center", justifyContent: "center", borderWidth: 5, backgroundColor: "#fff" },
  scoreValue: { fontSize: 22, lineHeight: 25, fontWeight: "900" },
  scoreSuffix: { color: C.textMuted, fontSize: 8, fontWeight: "800" },
  scoreCopy: { flex: 1, minWidth: 0 },
  scoreLabel: { color: C.text, fontSize: 16, fontWeight: "900" },
  scoreSummary: { marginTop: 4, color: C.textSec, fontSize: 10, lineHeight: 15, fontWeight: "600" },
  previewColumns: { marginTop: 14, flexDirection: "row", gap: 9 },
  previewFact: { flex: 1, minHeight: 98, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: "#e2e8f0" },
  previewFactIcon: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#eaf4ff" },
  previewFactLabel: { marginTop: 9, color: C.textMuted, fontSize: 8, fontWeight: "800", textTransform: "uppercase" },
  previewFactValue: { marginTop: 2, color: C.text, fontSize: 11, lineHeight: 15, fontWeight: "900" },
  paperFooter: { marginTop: "auto", paddingTop: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  paperFooterText: { color: C.textMuted, fontSize: 8, fontWeight: "700" },
  primaryAction: { minHeight: 56, paddingHorizontal: 18, borderRadius: 17, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, backgroundColor: C.brand, shadowColor: C.brand, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 16, elevation: 5 },
  primaryActionPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  primaryActionText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  actionHint: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  actionHintText: { color: C.textMuted, fontSize: 10, fontWeight: "700" },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.55 },
});
