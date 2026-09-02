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

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

const COVERAGE: Record<ProspectInterestCoverage, { label: string; color: string }> = {
  addressed: { label: "Addressed", color: "#067647" },
  partially_addressed: { label: "Partly addressed", color: "#b54708" },
  missed: { label: "Needs follow-up", color: "#b42318" },
  not_discussed: { label: "Not discussed", color: "#667085" },
};

const INTENT_LABELS = {
  ready: "Ready to move forward",
  considering: "Considering options",
  exploring: "Early exploration",
} as const;

function interestKey(detail: string) {
  return detail.trim().replace(/\s+/g, " ").toLowerCase();
}

export function ProspectInsightsCard({
  analysis,
  providedInterests = [],
}: {
  analysis: AnalysisResult;
  providedInterests?: SessionCustomerInterest[];
}) {
  const insights = normalizeProspectInsights(analysis.prospectInsights);
  const hasInsights = Boolean(
    insights && (
      insights.summary
      || insights.intentRationale
      || insights.interests.length
      || insights.conversionDrivers.length
      || insights.objections.length
      || insights.nextBestAction
    ),
  );

  if (!providedInterests.length && !hasInsights) {
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIcon}><Icon as={HeartHandshake} size={18} color="#006ce5" /></View>
        <View style={styles.copy}>
          <Text style={styles.emptyTitle}>No prospect readout yet</Text>
          <Text style={styles.emptyText}>Once the conversation is analyzed, their priorities and decision signals will appear here.</Text>
        </View>
      </View>
    );
  }

  const discussed = new Set(insights?.interests.map((interest) => interestKey(interest.detail)) ?? []);
  const knownBefore = providedInterests.filter((interest) => {
    const label = interest.detail || PROSPECT_INTEREST_CATEGORY_LABELS[interest.category];
    return !discussed.has(interestKey(label));
  });
  const addressedCount = insights?.interests.filter((interest) => interest.coverage === "addressed").length ?? 0;
  const unresolvedCount = insights?.interests.filter((interest) =>
    interest.coverage === "missed" || interest.coverage === "not_discussed",
  ).length ?? 0;
  const intentLabel = insights?.intentStage && insights.intentStage !== "unknown"
    ? INTENT_LABELS[insights.intentStage]
    : null;

  return (
    <View style={styles.root}>
      {(insights?.summary || intentLabel || insights?.intentRationale) ? (
        <View style={styles.readout}>
          <View style={styles.readoutTopline}>
            <Text style={styles.eyebrow}>Prospect readout</Text>
            {intentLabel ? (
              <View style={styles.intent}>
                <View style={styles.intentDot} />
                <Text style={styles.intentText}>{intentLabel}</Text>
              </View>
            ) : null}
          </View>
          {insights?.summary ? <Text style={styles.summary}>{insights.summary}</Text> : null}
          {insights?.intentRationale ? (
            <Text style={styles.rationale}>{insights.intentRationale}</Text>
          ) : null}
        </View>
      ) : null}

      {knownBefore.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Known before the tour</Text>
          <View style={styles.chips}>
            {knownBefore.map((interest) => (
              <View key={interest.id} style={styles.chip}>
                <Text style={styles.chipText} numberOfLines={1}>
                  {interest.detail || PROSPECT_INTEREST_CATEGORY_LABELS[interest.category]}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {insights?.interests.length ? (
        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Priorities</Text>
            <Text style={styles.sectionMeta}>
              {addressedCount} addressed{unresolvedCount ? ` · ${unresolvedCount} unresolved` : ""}
            </Text>
          </View>
          <View style={styles.listSurface}>
            {insights.interests.map((interest, index) => {
              const coverage = COVERAGE[interest.coverage];
              return (
                <View
                  key={`${interest.category}-${interest.detail}-${index}`}
                  style={[styles.priorityRow, index > 0 && styles.priorityRowBorder]}
                >
                  <View style={styles.priorityTopline}>
                    <View style={styles.priorityCopy}>
                      <Text style={styles.priorityTitle}>{interest.detail}</Text>
                      <Text style={styles.priorityCategory}>
                        {PROSPECT_INTEREST_CATEGORY_LABELS[interest.category]}
                        {interest.timestamp ? ` · ${interest.timestamp}` : ""}
                      </Text>
                    </View>
                    <View style={styles.coverage}>
                      <View style={[styles.coverageDot, { backgroundColor: coverage.color }]} />
                      <Text style={[styles.coverageText, { color: coverage.color }]}>{coverage.label}</Text>
                    </View>
                  </View>
                  {interest.agentResponse ? (
                    <Text style={styles.response}>{interest.agentResponse}</Text>
                  ) : interest.evidence ? (
                    <Text style={styles.evidence}>{interest.evidence}</Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {(insights?.conversionDrivers.length || insights?.objections.length || insights?.nextBestAction) ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Decision context</Text>
          <View style={styles.listSurface}>
            {insights?.conversionDrivers.length ? (
              <DecisionRow
                icon={Target}
                color="#006ce5"
                label="Could help"
                value={insights.conversionDrivers.join(" · ")}
              />
            ) : null}
            {insights?.objections.length ? (
              <DecisionRow
                icon={CircleAlert}
                color="#b54708"
                label="Needs resolving"
                value={insights.objections.join(" · ")}
                bordered={Boolean(insights?.conversionDrivers.length)}
              />
            ) : null}
            {insights?.nextBestAction ? (
              <DecisionRow
                icon={ArrowUpRight}
                color="#006ce5"
                label="Follow-through"
                value={insights.nextBestAction}
                bordered={Boolean(insights?.conversionDrivers.length || insights?.objections.length)}
              />
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function DecisionRow({
  icon,
  color,
  label,
  value,
  bordered = false,
}: {
  icon: typeof Target;
  color: string;
  label: string;
  value: string;
  bordered?: boolean;
}) {
  return (
    <View style={[styles.decisionRow, bordered && styles.decisionRowBorder]}>
      <View style={styles.decisionIcon}><Icon as={icon} size={15} color={color} /></View>
      <View style={styles.copy}>
        <Text style={styles.decisionLabel}>{label}</Text>
        <Text style={styles.decisionText}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 24, paddingTop: 8, paddingBottom: 14 },
  copy: { flex: 1, minWidth: 0 },
  emptyState: { flexDirection: "row", alignItems: "flex-start", gap: 11, paddingTop: 10 },
  emptyIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "#eff6ff" },
  emptyTitle: { color: "#101828", fontSize: 15, fontWeight: "900" },
  emptyText: { marginTop: 3, color: "#667085", fontSize: 13, lineHeight: 19, fontWeight: "600" },
  readout: { gap: 9, paddingBottom: 2 },
  readoutTopline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  eyebrow: { color: "#667085", fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  intent: { flexDirection: "row", alignItems: "center", gap: 5 },
  intentDot: { width: 6, height: 6, borderRadius: 999, backgroundColor: "#006ce5" },
  intentText: { color: "#175cd3", fontSize: 11, fontWeight: "800" },
  summary: { color: "#101828", fontSize: 17, lineHeight: 24, fontWeight: "800" },
  rationale: { color: "#667085", fontSize: 13, lineHeight: 19, fontWeight: "600" },
  section: { gap: 10 },
  sectionHeading: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  sectionLabel: { color: "#667085", fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  sectionTitle: { color: "#101828", fontSize: 15, fontWeight: "900" },
  sectionMeta: { color: "#667085", fontSize: 11, fontWeight: "700", textAlign: "right" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: { maxWidth: "100%", paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, backgroundColor: "#eef6ff" },
  chipText: { color: "#175cd3", fontSize: 12, fontWeight: "800" },
  listSurface: { overflow: "hidden", borderWidth: 1, borderColor: "#e3e8ef", borderRadius: 12, backgroundColor: "#fff" },
  priorityRow: { gap: 8, paddingHorizontal: 12, paddingVertical: 13 },
  priorityRowBorder: { borderTopWidth: 1, borderTopColor: "#edf0f4" },
  priorityTopline: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  priorityCopy: { flex: 1, minWidth: 0, gap: 3 },
  priorityTitle: { color: "#1d2939", fontSize: 14, lineHeight: 19, fontWeight: "800" },
  priorityCategory: { color: "#667085", fontSize: 11, lineHeight: 16, fontWeight: "700" },
  coverage: { maxWidth: 105, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4, paddingTop: 2 },
  coverageDot: { width: 6, height: 6, borderRadius: 999 },
  coverageText: { flexShrink: 1, fontSize: 10, lineHeight: 14, fontWeight: "900", textAlign: "right" },
  response: { color: "#475467", fontSize: 12, lineHeight: 18, fontWeight: "600" },
  evidence: { color: "#667085", fontSize: 12, lineHeight: 18, fontStyle: "italic" },
  decisionRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingHorizontal: 12, paddingVertical: 13 },
  decisionRowBorder: { borderTopWidth: 1, borderTopColor: "#edf0f4" },
  decisionIcon: { width: 22, paddingTop: 1, alignItems: "center" },
  decisionLabel: { color: "#667085", fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  decisionText: { marginTop: 3, color: "#344054", fontSize: 13, lineHeight: 19, fontWeight: "700" },
});
