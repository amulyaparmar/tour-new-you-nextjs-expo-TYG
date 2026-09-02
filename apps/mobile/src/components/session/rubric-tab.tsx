import { Ionicons } from "@expo/vector-icons";
import type { AnalysisResult } from "@tour/shared";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Reanimated, { FadeInDown } from "react-native-reanimated";

import { Text } from "@/components/ui/text";
import { selectionHaptic } from "@/lib/haptics";
import { UIColors } from "@/lib/ui-colors";
import { scoreColor, tourColors } from "@/theme/tour-brand";

type RubricSection = AnalysisResult["sectionScores"][number];

function formatPoints(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

function sectionPoints(section: RubricSection) {
  if (section.pointsPossible > 0) {
    return { earned: section.pointsEarned, possible: section.pointsPossible };
  }

  const questions = section.questions ?? [];
  const possible = questions.reduce((total, question) => total + question.maxPoints, 0);
  if (possible <= 0) return null;

  return {
    earned: questions.reduce((total, question) => total + question.earnedPoints, 0),
    possible,
  };
}

function sectionProgress(section: RubricSection) {
  const points = sectionPoints(section);
  return points ? (points.earned / points.possible) * 100 : section.score;
}

export function RubricTab({ analysis }: { analysis: AnalysisResult }) {
  const [expandedSectionName, setExpandedSectionName] = useState<string | null>(null);
  const [readoutExpanded, setReadoutExpanded] = useState(false);
  const totals = useMemo(() => {
    const questions = analysis.sectionScores.flatMap((section) => section.questions ?? []);
    const pointTotals = analysis.sectionScores.reduce(
      (total, section) => {
        const points = sectionPoints(section);
        return points
          ? { earned: total.earned + points.earned, possible: total.possible + points.possible }
          : total;
      },
      { earned: 0, possible: 0 },
    );

    return {
      count: questions.length,
      passed: questions.filter((question) => question.passed).length,
      earned: analysis.totalPointsPossible > 0 ? analysis.totalPointsEarned : pointTotals.earned,
      possible: analysis.totalPointsPossible > 0 ? analysis.totalPointsPossible : pointTotals.possible,
    };
  }, [analysis.sectionScores, analysis.totalPointsEarned, analysis.totalPointsPossible]);

  return (
    <View style={st.root}>
      <View style={st.header}>
        <Text style={st.headerTitle}>Scored areas</Text>
        <Text style={st.headerSubtitle}>
          {totals.possible > 0
            ? `${formatPoints(totals.earned)}/${formatPoints(totals.possible)} points earned`
            : totals.count > 0
              ? `${totals.passed}/${totals.count} criteria demonstrated`
              : "Review each area in detail"}
        </Text>
      </View>

      <View style={st.sectionList}>
        {analysis.sectionScores.map((section, index) => (
          <RubricSectionRow
            key={section.section}
            section={section}
            index={index}
            expanded={expandedSectionName === section.section}
            onToggle={() => {
              selectionHaptic();
              setExpandedSectionName((current) => current === section.section ? null : section.section);
            }}
          />
        ))}
      </View>

      {(analysis.summary || analysis.strengths.length > 0) ? (
        <RubricReadout
          summary={analysis.summary}
          strengths={analysis.strengths}
          expanded={readoutExpanded}
          onToggle={() => {
            selectionHaptic();
            setReadoutExpanded((current) => !current);
          }}
        />
      ) : null}
    </View>
  );
}

function RubricSectionRow({
  section,
  index,
  expanded,
  onToggle,
}: {
  section: RubricSection;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const points = sectionPoints(section);
  const progress = sectionProgress(section);

  return (
    <View style={[st.sectionItem, index > 0 && st.sectionItemBorder]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${expanded ? "Hide" : "Show"} details for ${section.section}. ${points ? `${formatPoints(points.earned)} of ${formatPoints(points.possible)} points.` : "Point total unavailable."}`}
        onPress={onToggle}
        style={({ pressed }) => [st.sectionRow, pressed && st.pressed]}
      >
        <View style={st.sectionTop}>
          <View style={st.sectionCopy}>
            <Text numberOfLines={2} style={st.sectionTitle}>{section.section}</Text>
            <Text style={st.sectionMeta}>{sectionMeta(section)}</Text>
          </View>
          <View style={st.sectionScoreWrap}>
            <Text style={[st.sectionScore, { color: scoreColor(progress) }]}>
              {points ? `${formatPoints(points.earned)}/${formatPoints(points.possible)} pts` : "--"}
            </Text>
            <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={tourColors.textMuted} />
          </View>
        </View>
        <View style={st.progressTrack}>
          <View style={[st.progressFill, { width: `${Math.max(0, Math.min(100, progress))}%`, backgroundColor: scoreColor(progress) }]} />
        </View>
      </Pressable>

      {expanded ? (
        <Reanimated.View entering={FadeInDown.duration(180)} style={st.sectionDetails}>
          <RubricCriteriaList section={section} />
        </Reanimated.View>
      ) : null}
    </View>
  );
}

function RubricCriteriaList({ section }: { section: RubricSection }) {
  const questions = section.questions ?? [];

  if (questions.length === 0) {
    return (
      <View style={st.emptyState}>
        <Ionicons name="clipboard-outline" size={20} color={tourColors.textMuted} />
        <Text style={st.emptyStateText}>No individual criteria were returned for this area.</Text>
      </View>
    );
  }

  return (
    <View style={st.detailList}>
      <Text style={st.detailEyebrow}>Criteria</Text>
      {questions.map((question, index) => (
        <View key={question.id} style={[st.detailQuestion, index > 0 && st.detailQuestionBorder]}>
          <View style={st.detailQuestionHead}>
            <View style={[st.detailStatus, question.passed && st.detailStatusPassed]}>
              <Ionicons
                name={question.passed ? "checkmark" : "remove"}
                size={14}
                color={question.passed ? tourColors.brand : tourColors.textMuted}
              />
            </View>
            <Text selectable style={st.detailQuestionText}>{question.question}</Text>
            <Text selectable style={st.detailPoints}>{question.earnedPoints}/{question.maxPoints}</Text>
          </View>
          {question.evidence ? (
            <View style={st.evidence}>
              <Text selectable style={st.evidenceText}>{question.evidence}</Text>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function RubricReadout({
  summary,
  strengths,
  expanded,
  onToggle,
}: {
  summary: string;
  strengths: string[];
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={st.readoutGroup}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${expanded ? "Hide" : "Show"} tour readout`}
        onPress={onToggle}
        style={({ pressed }) => [st.readoutHeader, pressed && st.pressed]}
      >
        <View style={st.readoutIcon}>
          <Ionicons name="document-text-outline" size={17} color={tourColors.brand} />
        </View>
        <View style={st.readoutCopy}>
          <Text style={st.readoutTitle}>Tour readout</Text>
          <Text style={st.readoutMeta}>
            {strengths.length > 0
              ? `Summary and ${strengths.length} ${strengths.length === 1 ? "strength" : "strengths"}`
              : "Summary"}
          </Text>
        </View>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={17} color={tourColors.textMuted} />
      </Pressable>

      {expanded ? (
        <Reanimated.View entering={FadeInDown.duration(180)} style={st.readoutBody}>
          {summary ? (
            <View style={st.readoutSection}>
              <Text style={st.detailEyebrow}>Summary</Text>
              <Text selectable style={st.readoutSummary}>{summary}</Text>
            </View>
          ) : null}
          {strengths.length > 0 ? (
            <View style={st.readoutSection}>
              <Text style={st.detailEyebrow}>What landed</Text>
              <View style={st.strengthList}>
                {strengths.map((strength, index) => (
                  <View key={`${strength}-${index}`} style={[st.strengthRow, index > 0 && st.detailQuestionBorder]}>
                    <View style={st.readoutStrengthIcon}>
                      <Ionicons name="checkmark" size={13} color={tourColors.brand} />
                    </View>
                    <Text selectable style={st.strengthText}>{strength}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </Reanimated.View>
      ) : null}
    </View>
  );
}

function sectionMeta(section: RubricSection) {
  if (section.questions?.length) {
    return `${section.questions.filter((question) => question.passed).length}/${section.questions.length} criteria demonstrated`;
  }
  return "Open score details";
}

const st = StyleSheet.create({
  root: { gap: 14 },
  header: { gap: 2 },
  headerTitle: { color: UIColors.foreground, fontSize: 16, fontWeight: "900" },
  headerSubtitle: { color: UIColors.mutedForeground, fontSize: 12, lineHeight: 17, fontWeight: "600" },
  sectionList: { overflow: "hidden", borderWidth: 1, borderColor: UIColors.border, borderRadius: 16, backgroundColor: UIColors.card },
  sectionItem: { overflow: "hidden" },
  sectionItemBorder: { borderTopWidth: 1, borderTopColor: UIColors.border },
  sectionRow: { gap: 10, paddingHorizontal: 14, paddingVertical: 15 },
  pressed: { opacity: 0.72 },
  sectionTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  sectionCopy: { flex: 1, minWidth: 0, gap: 3 },
  sectionTitle: { color: UIColors.foreground, fontSize: 14, lineHeight: 18, fontWeight: "900" },
  sectionMeta: { color: UIColors.mutedForeground, fontSize: 11, fontWeight: "700" },
  sectionScoreWrap: { flexDirection: "row", alignItems: "center", gap: 5 },
  sectionScore: { fontSize: 14, fontWeight: "900", fontVariant: ["tabular-nums"] },
  progressTrack: { height: 3, borderRadius: 999, overflow: "hidden", backgroundColor: "#e9eef5" },
  progressFill: { height: "100%", borderRadius: 999 },
  sectionDetails: { borderTopWidth: 1, borderTopColor: "#e7ecf2", paddingHorizontal: 14, paddingVertical: 14, backgroundColor: "#fafcff" },
  detailList: { gap: 0 },
  detailEyebrow: { marginBottom: 4, color: UIColors.mutedForeground, fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  detailQuestion: { gap: 9, paddingVertical: 14 },
  detailQuestionBorder: { borderTopWidth: 1, borderTopColor: "#e6edf5" },
  detailQuestionHead: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  detailStatus: { width: 22, height: 22, alignItems: "center", justifyContent: "center", marginTop: 1, borderRadius: 11, backgroundColor: "#f2f4f7" },
  detailStatusPassed: { backgroundColor: "#eaf3ff" },
  detailQuestionText: { flex: 1, color: UIColors.foreground, fontSize: 14, lineHeight: 20, fontWeight: "700" },
  detailPoints: { color: UIColors.mutedForeground, fontSize: 11, fontWeight: "800", fontVariant: ["tabular-nums"] },
  evidence: { marginLeft: 32, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: "#dce5ef" },
  evidenceText: { color: UIColors.mutedForeground, fontSize: 12, lineHeight: 18, fontWeight: "600" },
  emptyState: { alignItems: "center", gap: 8, paddingVertical: 26 },
  emptyStateText: { color: UIColors.mutedForeground, fontSize: 13, fontWeight: "600", textAlign: "center" },
  readoutGroup: { overflow: "hidden", borderWidth: 1, borderColor: UIColors.border, borderRadius: 16, backgroundColor: UIColors.card },
  readoutHeader: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 58, paddingHorizontal: 14, paddingVertical: 12 },
  readoutIcon: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "#eff6ff" },
  readoutCopy: { flex: 1, minWidth: 0, gap: 2 },
  readoutTitle: { color: UIColors.foreground, fontSize: 15, fontWeight: "900" },
  readoutMeta: { color: UIColors.mutedForeground, fontSize: 11, fontWeight: "700" },
  readoutBody: { gap: 18, borderTopWidth: 1, borderTopColor: "#e7ecf2", padding: 14, backgroundColor: "#fafcff" },
  readoutSection: { gap: 8 },
  readoutSummary: { color: UIColors.foreground, fontSize: 14, lineHeight: 21, fontWeight: "600" },
  strengthList: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#e6edf5" },
  strengthRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 14 },
  readoutStrengthIcon: { width: 22, height: 22, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: "#eaf3ff" },
  strengthText: { flex: 1, color: UIColors.foreground, fontSize: 14, lineHeight: 20, fontWeight: "700" },
});
