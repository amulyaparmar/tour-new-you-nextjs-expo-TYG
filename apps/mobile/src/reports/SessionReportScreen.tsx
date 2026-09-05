import { Ionicons } from "@expo/vector-icons";
import type { AnalysisResult, AnalysisRunSummary, SessionDetail } from "@tour/shared";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import Reanimated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { CustomText } from "@/components/custom-text";
import { LoadingDots } from "@/components/loading-dots";
import { PAGE_SHEET_HEADER_INSET } from "@/components/page-sheet-modal";
import { MotionPressable } from "@/components/ui/motion";
import { TourLogo } from "@/components/TourLogo";
import {
  ACCENT,
  BACKGROUND,
  CARD,
  HINT,
  LARGE_CORNER,
  SMALL_CORNER,
} from "@/theme/tokens";
import { tourColors as C, scoreColor, scoreLabel } from "@/theme/tour-brand";

import { fetchAnalysis, fetchAnalysisRuns, fetchSession } from "../api";
import { prepareSessionReport, type CachedSessionReport } from "./report-cache";

export function SessionReportScreen({
  sessionId,
  onBack,
  onNotify,
  presentation = "page",
}: {
  sessionId: string;
  onBack: () => void;
  onNotify?: (message: string, kind?: "success" | "error" | "info") => void;
  presentation?: "page" | "sheet";
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

  const sheet = presentation === "sheet";
  const busy = preparing || sharing;

  if (loading) {
    return (
      <View style={[styles.centered, sheet && { paddingTop: PAGE_SHEET_HEADER_INSET }]}>
        <LoadingDots size="large" color={ACCENT} />
        <CustomText textStyle="title" style={styles.centeredTitle}>
          Preparing report
        </CustomText>
        <CustomText textStyle="caption" style={styles.centeredCopy}>
          Loading the latest analysis and available versions.
        </CustomText>
      </View>
    );
  }

  if (!session || !analysis) {
    return (
      <View style={[styles.centered, sheet && { paddingTop: PAGE_SHEET_HEADER_INSET }]}>
        <View style={styles.emptyIcon}>
          <Ionicons name="document-text-outline" size={22} color={ACCENT} />
        </View>
        <CustomText textStyle="title">Report unavailable</CustomText>
        <CustomText textStyle="caption" style={styles.centeredCopy}>
          {error ?? "This session does not have a completed analysis yet."}
        </CustomText>
        {sheet ? null : (
          <MotionPressable onPress={onBack} style={styles.primaryBtn}>
            <CustomText textStyle="title" style={styles.primaryBtnText}>
              Go back
            </CustomText>
          </MotionPressable>
        )}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentInsetAdjustmentBehavior={sheet ? "never" : "automatic"}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          sheet && { paddingTop: PAGE_SHEET_HEADER_INSET },
        ]}
      >
        {sheet ? (
          <Pressable
            accessibilityLabel="Refresh report"
            disabled={preparing}
            onPress={() => void prepare(true)}
            style={styles.refreshLink}
          >
            {preparing ? (
              <LoadingDots size="small" color={ACCENT} />
            ) : (
              <>
                <Ionicons name="refresh" size={16} color={ACCENT} />
                <CustomText textStyle="caption" style={styles.refreshLinkText}>
                  Refresh
                </CustomText>
              </>
            )}
          </Pressable>
        ) : (
          <View style={styles.nav}>
            <Pressable
              accessibilityLabel="Back to session"
              onPress={onBack}
              style={styles.navIcon}
            >
              <Ionicons name="chevron-back" size={22} color={C.text} />
            </Pressable>
            <View style={styles.navBrand}>
              <TourLogo width={62} />
            </View>
            <Pressable
              accessibilityLabel="Refresh report"
              disabled={preparing}
              onPress={() => void prepare(true)}
              style={styles.navIcon}
            >
              {preparing ? (
                <LoadingDots size="small" color={ACCENT} />
              ) : (
                <Ionicons name="refresh" size={19} color={C.textSec} />
              )}
            </Pressable>
          </View>
        )}

        <Reanimated.View entering={FadeInDown.duration(280).springify()} style={styles.intro}>
          <CustomText textStyle="caption" style={styles.introKicker}>
            {session.title}
          </CustomText>
          <CustomText textStyle="body" style={styles.introCopy}>
            Preview this evaluation, then open the PDF to share, AirDrop, or save it.
          </CustomText>
        </Reanimated.View>

        {runs.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.versionRow}
          >
            {[...runs]
              .sort((left, right) => right.version - left.version)
              .map((run) => {
                const active = selectedVersion === run.version;
                return (
                  <Pressable
                    key={run.id}
                    onPress={() => {
                      setSelectedVersion(run.version);
                      void HapticsCompat.selection();
                    }}
                    style={[styles.versionPill, active && styles.versionPillActive]}
                  >
                    <CustomText
                      textStyle="micro"
                      style={[styles.versionText, active && styles.versionTextActive]}
                    >
                      Version {run.version}
                      {run.isCurrent ? " · Current" : ""}
                    </CustomText>
                  </Pressable>
                );
              })}
          </ScrollView>
        ) : null}

        {error ? (
          <Reanimated.View entering={FadeIn.duration(180)} style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color={C.red} />
            <CustomText textStyle="caption" style={styles.errorText}>
              {error}
            </CustomText>
          </Reanimated.View>
        ) : null}

        <ReportPreview
          session={session}
          analysis={analysis}
          selectedRun={selectedRun}
          score={score}
        />

        <MotionPressable
          disabled={busy}
          haptic="medium"
          onPress={() => void openNativeReport()}
          style={styles.primaryBtn}
        >
          {busy ? (
            <LoadingDots size="small" color={CARD} />
          ) : (
            <Ionicons name="eye-outline" size={21} color={CARD} />
          )}
          <CustomText textStyle="title" style={styles.primaryBtnText}>
            {preparing ? "Preparing PDF…" : sharing ? "Opening…" : "Preview & share PDF"}
          </CustomText>
        </MotionPressable>

        <View style={styles.hintRow}>
          <Ionicons
            name={report ? "checkmark-circle" : "cloud-download-outline"}
            size={16}
            color={report ? C.green : C.textMuted}
          />
          <CustomText textStyle="caption" style={styles.hintText}>
            {report
              ? `Cached on this device · ${new Date(report.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
              : "The PDF will be cached securely on this device."}
          </CustomText>
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
    ? analysis.sectionScores.reduce((lowest, section) =>
        section.score < lowest.score ? section : lowest,
      )
    : null;
  const tone = score == null ? C.textMuted : scoreColor(score);

  return (
    <View style={styles.preview}>
      <View style={styles.previewHeader}>
        <TourLogo width={72} />
        <View style={styles.privatePill}>
          <CustomText textStyle="micro" style={styles.privatePillText}>
            Private
          </CustomText>
        </View>
      </View>
      <CustomText textStyle="hero" style={styles.previewTitle}>
        {session.title}
      </CustomText>
      <CustomText textStyle="caption" style={styles.previewMeta}>
        {[
          session.prospectName,
          session.location,
          session.scheduledAt
            ? new Date(session.scheduledAt).toLocaleDateString()
            : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </CustomText>

      <View style={styles.scoreRow}>
        <View style={[styles.scoreOrb, { backgroundColor: `${tone}18` }]}>
          <CustomText textStyle="hero" style={[styles.scoreValue, { color: tone }]}>
            {score == null ? "—" : score}
          </CustomText>
          <CustomText textStyle="micro" style={styles.scoreSuffix}>
            / 100
          </CustomText>
        </View>
        <View style={styles.scoreCopy}>
          <CustomText textStyle="title">
            {score == null ? "Evaluation" : scoreLabel(score)}
          </CustomText>
          <CustomText textStyle="caption" numberOfLines={4} style={styles.scoreSummary}>
            {showingCurrentAnalysis
              ? analysis.summary
              : `Historical analysis version ${selectedRun.version}. Open the PDF for the complete versioned evaluation.`}
          </CustomText>
        </View>
      </View>

      <View style={styles.factRow}>
        <PreviewFact
          icon="ribbon-outline"
          label="Top strengths"
          value={
            showingCurrentAnalysis
              ? `${analysis.strengths.length} documented`
              : "See versioned PDF"
          }
        />
        <PreviewFact
          icon="trending-up-outline"
          label="Coaching focus"
          value={
            showingCurrentAnalysis
              ? focus?.section ?? "Included in report"
              : "See versioned PDF"
          }
        />
      </View>

      <CustomText textStyle="micro" style={styles.previewFooter}>
        {selectedRun ? `Analysis version ${selectedRun.version}` : "Current analysis"}
        {" · "}
        PDF ready to share
      </CustomText>
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
    <View style={styles.fact}>
      <View style={styles.factIcon}>
        <Ionicons name={icon} size={16} color={ACCENT} />
      </View>
      <CustomText textStyle="micro" style={styles.factLabel}>
        {label}
      </CustomText>
      <CustomText textStyle="label" numberOfLines={2}>
        {value}
      </CustomText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BACKGROUND },
  scroll: {
    gap: 16,
    paddingHorizontal: 16,
    paddingBottom: 52,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 28,
    backgroundColor: BACKGROUND,
  },
  centeredTitle: { textAlign: "center" },
  centeredCopy: {
    maxWidth: 300,
    color: C.textSec,
    textAlign: "center",
    lineHeight: 18,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "rgba(0, 108, 229, 0.08)",
  },
  nav: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
  },
  navBrand: { flex: 1, alignItems: "center", justifyContent: "center" },
  navIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: CARD,
  },
  refreshLink: {
    alignSelf: "flex-end",
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  refreshLinkText: { color: ACCENT },
  intro: { gap: 6 },
  introKicker: {
    color: C.textMuted,
  },
  introCopy: {
    color: C.textSec,
    lineHeight: 20,
  },
  versionRow: { gap: 8, paddingRight: 12 },
  versionPill: {
    minHeight: 36,
    paddingHorizontal: 13,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: CARD,
  },
  versionPillActive: { backgroundColor: HINT },
  versionText: { color: C.textSec },
  versionTextActive: { color: ACCENT },
  errorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    padding: 14,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: C.redBg,
  },
  errorText: { flex: 1, color: C.red, lineHeight: 17 },
  preview: {
    gap: 12,
    padding: 18,
    borderRadius: LARGE_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  privatePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(0, 108, 229, 0.08)",
  },
  privatePillText: {
    color: ACCENT,
    textTransform: "uppercase",
  },
  previewTitle: { letterSpacing: -0.4 },
  previewMeta: { color: C.textMuted },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: BACKGROUND,
  },
  scoreOrb: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 36,
  },
  scoreValue: { fontVariant: ["tabular-nums"], lineHeight: 26 },
  scoreSuffix: { color: C.textMuted },
  scoreCopy: { flex: 1, minWidth: 0, gap: 4 },
  scoreSummary: { color: C.textSec, lineHeight: 16 },
  factRow: { flexDirection: "row", gap: 8 },
  fact: {
    flex: 1,
    gap: 6,
    minHeight: 98,
    padding: 12,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: BACKGROUND,
  },
  factIcon: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: CARD,
  },
  factLabel: {
    textTransform: "uppercase",
    color: C.textMuted,
  },
  previewFooter: { color: C.textMuted },
  primaryBtn: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 14,
    borderRadius: 29,
    backgroundColor: ACCENT,
    boxShadow: "0 6px 14px rgba(0, 108, 229, 0.28)",
  },
  primaryBtnText: { color: CARD },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  hintText: { color: C.textMuted },
});
