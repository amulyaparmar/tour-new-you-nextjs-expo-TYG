import { Ionicons } from "@expo/vector-icons";
import type { AnalysisResult } from "@tour/shared";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Reanimated, { FadeInDown } from "react-native-reanimated";

import { CustomText } from "@/components/custom-text";
import { selectionHaptic } from "@/lib/haptics";
import { tourEnter } from "@/theme/animations";
import { ACCENT, BACKGROUND, CARD, SMALL_CORNER } from "@/theme/tokens";
import { scoreColor, tourColors } from "@/theme/tour-brand";
import { tourColors as C } from "@/theme/tour-brand";

function weakestSectionName(sections: AnalysisResult["sectionScores"]) {
  if (!sections.length) return null;
  return sections.reduce((min, sec) => (sec.score < min.score ? sec : min)).section;
}

export function RubricTab({ analysis }: { analysis: AnalysisResult }) {
  const focusSection = useMemo(
    () => weakestSectionName(analysis.sectionScores),
    [analysis.sectionScores],
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    analysis.sectionScores.forEach((s) => {
      init[s.section] = s.section === focusSection;
    });
    return init;
  });

  const expandedCount = Object.values(expanded).filter(Boolean).length;

  return (
    <View style={st.root}>
      <Reanimated.View entering={tourEnter.fadeDown} style={st.header}>
        <Ionicons name="clipboard-outline" size={18} color={ACCENT} />
        <CustomText textStyle="title" style={st.headerTitle}>
          Question breakdown
        </CustomText>
        <Pressable
          onPress={() => {
            selectionHaptic();
            const next = expandedCount < analysis.sectionScores.length;
            const update: Record<string, boolean> = {};
            analysis.sectionScores.forEach((s) => {
              update[s.section] = next;
            });
            setExpanded(update);
          }}
          style={st.expandBtn}
        >
          <CustomText textStyle="caption" style={st.expandBtnText}>
            {expandedCount < analysis.sectionScores.length
              ? "Expand all"
              : "Collapse all"}
          </CustomText>
        </Pressable>
      </Reanimated.View>

      {analysis.sectionScores.map((sec, sectionIndex) => {
        const c = scoreColor(sec.score);
        const hasQ = sec.questions?.length > 0;
        const exp = expanded[sec.section] ?? false;
        const passCount = hasQ ? sec.questions.filter((q) => q.passed).length : 0;
        const isFocus = sec.section === focusSection;

        return (
          <Reanimated.View
            key={sec.section}
            entering={tourEnter.stagger(sectionIndex, 60)}
          >
            <View style={st.sectionCard}>
              <Pressable
                onPress={() => {
                  selectionHaptic();
                  setExpanded((p) => ({ ...p, [sec.section]: !p[sec.section] }));
                }}
                style={({ pressed }) => [st.sectionHeader, pressed && st.pressed]}
              >
                <View style={[st.accent, { backgroundColor: c }]} />
                <View style={st.sectionCopy}>
                  <View style={st.sectionTitleRow}>
                    <CustomText selectable textStyle="title" style={st.sectionTitle}>
                      {sec.section}
                    </CustomText>
                    {isFocus ? (
                      <View style={st.focusBadge}>
                        <CustomText textStyle="micro" style={st.focusBadgeText}>
                          Focus
                        </CustomText>
                      </View>
                    ) : null}
                  </View>
                  {hasQ ? (
                    <CustomText textStyle="caption" style={st.passMeta}>
                      {passCount}/{sec.questions.length} passed
                    </CustomText>
                  ) : null}
                </View>
                <View style={st.sectionRight}>
                  {sec.pointsPossible > 0 ? (
                    <CustomText
                      selectable
                      textStyle="caption"
                      style={st.sectionPtsMeta}
                    >
                      {sec.pointsEarned}/{sec.pointsPossible}
                    </CustomText>
                  ) : null}
                  <View style={[st.scoreBadge, { backgroundColor: `${c}18` }]}>
                    <CustomText
                      selectable
                      textStyle="label"
                      style={[st.scoreBadgeText, { color: c }]}
                    >
                      {sec.score}%
                    </CustomText>
                  </View>
                  <Ionicons
                    name={exp ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={tourColors.textMuted}
                  />
                </View>
              </Pressable>

              {exp && hasQ ? (
                <Reanimated.View entering={FadeInDown.duration(220)}>
                  {sec.questions.map((q, qi) => (
                    <Reanimated.View
                      key={q.id}
                      entering={tourEnter.stagger(qi, 35)}
                      style={st.questionRow}
                    >
                      <View style={st.questionMain}>
                        <View
                          style={[
                            st.questionIcon,
                            {
                              backgroundColor: q.passed
                                ? tourColors.greenBg
                                : tourColors.redBg,
                            },
                          ]}
                        >
                          <Ionicons
                            name={q.passed ? "checkmark" : "close"}
                            size={14}
                            color={q.passed ? tourColors.green : tourColors.red}
                          />
                        </View>
                        <View style={st.questionBody}>
                          <View style={st.questionTop}>
                            <CustomText
                              selectable
                              textStyle="label"
                              style={st.questionText}
                            >
                              <CustomText textStyle="caption" style={st.questionId}>
                                {q.id}{" "}
                              </CustomText>
                              {q.question}
                            </CustomText>
                            <View
                              style={[
                                st.questionPtsBadge,
                                {
                                  backgroundColor: q.passed
                                    ? tourColors.greenBg
                                    : tourColors.redBg,
                                },
                              ]}
                            >
                              <CustomText
                                selectable
                                textStyle="caption"
                                style={[
                                  st.questionPtsText,
                                  {
                                    color: q.passed
                                      ? tourColors.green
                                      : tourColors.red,
                                  },
                                ]}
                              >
                                {q.earnedPoints}/{q.maxPoints}
                              </CustomText>
                            </View>
                          </View>
                          {q.evidence ? (
                            <View style={st.evidenceBox}>
                              <CustomText
                                selectable
                                textStyle="caption"
                                style={st.evidenceText}
                              >
                                "{q.evidence}"
                              </CustomText>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    </Reanimated.View>
                  ))}
                </Reanimated.View>
              ) : null}

              {exp && !hasQ ? (
                <View style={st.emptySection}>
                  <CustomText textStyle="body" style={st.emptySectionText}>
                    Section scored at {sec.score}%
                    {sec.pointsPossible > 0
                      ? ` (${sec.pointsEarned}/${sec.pointsPossible} pts)`
                      : ""}
                    .
                  </CustomText>
                </View>
              ) : null}
            </View>
          </Reanimated.View>
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  root: { gap: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { flex: 1 },
  expandBtn: { minHeight: 32, paddingHorizontal: 8, justifyContent: "center" },
  expandBtnText: { color: ACCENT },
  sectionCard: {
    overflow: "hidden",
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  accent: {
    width: 4,
    alignSelf: "stretch",
    borderRadius: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingRight: 14,
    paddingVertical: 14,
  },
  pressed: { opacity: 0.8 },
  sectionCopy: { flex: 1, minWidth: 0, gap: 4 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { flex: 1 },
  focusBadge: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: BACKGROUND,
  },
  focusBadgeText: { textTransform: "uppercase", color: C.textSec },
  passMeta: { color: C.textMuted },
  sectionRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionPtsMeta: { fontVariant: ["tabular-nums"], color: C.textMuted },
  scoreBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  scoreBadgeText: { fontVariant: ["tabular-nums"] },
  questionRow: {
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  questionMain: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  questionIcon: {
    marginTop: 2,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  questionBody: { flex: 1, minWidth: 0, gap: 4 },
  questionTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  questionText: { flex: 1, lineHeight: 18 },
  questionId: { color: C.textMuted },
  questionPtsBadge: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  questionPtsText: { fontVariant: ["tabular-nums"] },
  evidenceBox: {
    borderRadius: 8,
    backgroundColor: BACKGROUND,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  evidenceText: { fontStyle: "italic", lineHeight: 17, color: C.textMuted },
  emptySection: { paddingHorizontal: 14, paddingVertical: 12 },
  emptySectionText: { color: C.textMuted },
});
