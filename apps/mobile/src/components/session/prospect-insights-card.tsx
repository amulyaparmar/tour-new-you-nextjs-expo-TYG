import {
  normalizeProspectInsights,
  PROSPECT_INTEREST_CATEGORY_LABELS,
  type AnalysisResult,
  type ProspectInterestCoverage,
  type SessionCustomerInterest,
} from "@tour/shared";
import { ArrowUpRight, CircleAlert, HeartHandshake, Target } from "lucide-react-native";
import React from "react";
import { StyleSheet, View } from "react-native";

import { CustomText } from "@/components/custom-text";
import { Icon } from "@/components/ui/icon";
import { ACCENT, BACKGROUND, CARD, SMALL_CORNER } from "@/theme/tokens";
import { tourColors as C } from "@/theme/tour-brand";

const COVERAGE: Record<ProspectInterestCoverage, { label: string; color: string; background: string }> = {
  addressed: { label: "Addressed", color: "#067647", background: "#ecfdf3" },
  partially_addressed: { label: "Partly addressed", color: "#b54708", background: "#fffaeb" },
  missed: { label: "Missed", color: "#b42318", background: "#fef3f2" },
  not_discussed: { label: "Not discussed", color: "#667085", background: "#f2f4f7" },
};

export function ProspectInsightsCard({
  analysis,
  providedInterests = [],
}: {
  analysis: AnalysisResult;
  providedInterests?: SessionCustomerInterest[];
}) {
  const insights = normalizeProspectInsights(analysis.prospectInsights);
  const hasProvidedInterests = providedInterests.length > 0;
  const hasInsights = Boolean(
    insights && (insights.summary || insights.interests.length || insights.conversionDrivers.length || insights.nextBestAction),
  );

  if (!hasProvidedInterests && !hasInsights) {
    return (
      <View style={styles.emptyCard}>
          <View style={styles.iconWrap}><Icon as={HeartHandshake} size={18} color={ACCENT} /></View>
        <View style={styles.copy}>
          <CustomText textStyle="title">Prospect understanding</CustomText>
          <CustomText textStyle="body" style={styles.emptyText}>Prospect needs will appear here once they are captured or inferred from the conversation.</CustomText>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconWrap}><Icon as={HeartHandshake} size={18} color={ACCENT} /></View>
        <View style={styles.copy}>
          <CustomText textStyle="title">Prospect understanding</CustomText>
          <CustomText textStyle="caption" style={styles.subtitle}>What matters to them, and how the tour responded</CustomText>
        </View>
        {insights?.intentStage && insights.intentStage !== "unknown" ? (
          <View style={styles.intentBadge}>
            <CustomText textStyle="micro" style={styles.intentText}>{insights.intentStage}</CustomText>
          </View>
        ) : null}
      </View>

      {insights?.summary ? <CustomText textStyle="body" style={styles.summary}>{insights.summary}</CustomText> : null}

      {providedInterests.length > 0 ? (
        <View style={styles.section}>
          <CustomText textStyle="caption" style={styles.sectionLabel}>Provided before the session</CustomText>
          <View style={styles.chips}>
            {providedInterests.map((interest) => (
              <View key={interest.id} style={styles.providedChip}>
                <CustomText textStyle="caption" style={styles.providedChipText} numberOfLines={1}>
                  {interest.detail || PROSPECT_INTEREST_CATEGORY_LABELS[interest.category]}
                </CustomText>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {insights?.interests.length ? (
        <View style={styles.section}>
          <CustomText textStyle="caption" style={styles.sectionLabel}>Needs and response</CustomText>
          <View style={styles.interestList}>
            {insights.interests.map((interest, index) => {
              const coverage = COVERAGE[interest.coverage];
              return (
                <View key={`${interest.category}-${interest.detail}-${index}`} style={styles.interestRow}>
                  <View style={styles.interestHeader}>
                    <CustomText textStyle="label" style={styles.interestTitle} numberOfLines={2}>{interest.detail}</CustomText>
                    <View style={[styles.coverageBadge, { backgroundColor: coverage.background }]}>
                      <CustomText textStyle="micro" style={[styles.coverageText, { color: coverage.color }]}>{coverage.label}</CustomText>
                    </View>
                  </View>
                  <CustomText textStyle="caption" style={styles.category}>{PROSPECT_INTEREST_CATEGORY_LABELS[interest.category]}</CustomText>
                  {interest.agentResponse ? (
                    <CustomText textStyle="caption" style={styles.response} numberOfLines={3}>{interest.agentResponse}</CustomText>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {insights?.conversionDrivers.length ? (
        <View style={styles.driverRow}>
          <Icon as={Target} size={16} color={ACCENT} />
          <View style={styles.copy}>
            <CustomText textStyle="caption" style={styles.driverLabel}>Likely to convert with</CustomText>
            <CustomText textStyle="label" style={styles.driverText}>{insights.conversionDrivers.join(" · ")}</CustomText>
          </View>
        </View>
      ) : null}

      {insights?.objections.length ? (
        <View style={styles.objectionRow}>
          <Icon as={CircleAlert} size={16} color="#b54708" />
          <View style={styles.copy}>
            <CustomText textStyle="caption" style={styles.driverLabel}>Open concerns</CustomText>
            <CustomText textStyle="label" style={styles.driverText}>{insights.objections.join(" · ")}</CustomText>
          </View>
        </View>
      ) : null}

      {insights?.nextBestAction ? (
        <View style={styles.nextAction}>
          <Icon as={ArrowUpRight} size={16} color={CARD} />
          <View style={styles.copy}>
            <CustomText textStyle="caption" style={styles.nextLabel}>Next best action</CustomText>
            <CustomText textStyle="label" style={styles.nextText}>{insights.nextBestAction}</CustomText>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 16,
    padding: 16,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  emptyCard: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 11 },
  iconWrap: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: BACKGROUND,
  },
  copy: { flex: 1, minWidth: 0 },
  subtitle: { marginTop: 2, color: C.textSec, lineHeight: 17 },
  emptyText: { marginTop: 4, color: C.textSec, lineHeight: 19 },
  intentBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: "#eaf2ff" },
  intentText: { color: ACCENT, textTransform: "capitalize" },
  summary: { color: C.textSec, lineHeight: 21 },
  section: { gap: 8 },
  sectionLabel: { color: C.textSec, textTransform: "uppercase", letterSpacing: 0.4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  providedChip: { maxWidth: "100%", paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, backgroundColor: BACKGROUND },
  providedChipText: { color: ACCENT },
  interestList: { gap: 8 },
  interestRow: { gap: 3, padding: 11, borderRadius: 12, backgroundColor: BACKGROUND },
  interestHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  interestTitle: { flex: 1, lineHeight: 18 },
  coverageBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
  coverageText: {},
  category: { color: C.textSec },
  response: { marginTop: 3, color: C.textSec, lineHeight: 18 },
  driverRow: { flexDirection: "row", alignItems: "flex-start", gap: 9, padding: 11, borderRadius: 12, backgroundColor: BACKGROUND },
  objectionRow: { flexDirection: "row", alignItems: "flex-start", gap: 9, padding: 11, borderRadius: 12, backgroundColor: C.amberBg },
  driverLabel: { color: C.textSec, textTransform: "uppercase", letterSpacing: 0.4 },
  driverText: { marginTop: 3, color: C.textSec, lineHeight: 18 },
  nextAction: { flexDirection: "row", alignItems: "flex-start", gap: 9, padding: 12, borderRadius: 13, backgroundColor: ACCENT },
  nextLabel: { color: "rgba(255,255,255,0.78)", textTransform: "uppercase", letterSpacing: 0.4 },
  nextText: { marginTop: 2, color: CARD, lineHeight: 19 },
});
