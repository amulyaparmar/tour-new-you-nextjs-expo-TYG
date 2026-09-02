import type { AnalysisResult } from "@tour/shared";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Reanimated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Card, CardContent } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { UIColors } from "@/lib/ui-colors";
import { tourEnter } from "@/theme/animations";
import { scoreColor } from "@/theme/tour-brand";

const st = StyleSheet.create({
  barTrack: { height: 6, overflow: "hidden", borderRadius: 999, backgroundColor: UIColors.muted },
  card: { gap: 0, borderColor: UIColors.border, paddingVertical: 0 },
  cardBody: { gap: 16, paddingHorizontal: 16, paddingVertical: 16 },
  scoreBlock: { alignItems: "center", gap: 6 },
  scoreRing: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 60,
    borderWidth: 8,
  },
  scoreValue: { fontSize: 36, fontWeight: "900", fontVariant: ["tabular-nums"] },
  scoreSuffix: { fontSize: 18, fontWeight: "700" },
  ptsLabel: { fontSize: 13, fontWeight: "800", color: UIColors.mutedForeground },
  sections: { gap: 10 },
  sectionRow: { gap: 4 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  sectionName: { flex: 1, fontSize: 13, fontWeight: "700", color: UIColors.foreground },
  sectionPts: { fontSize: 13, fontWeight: "800", fontVariant: ["tabular-nums"] },
  compact: {
    width: 108,
    alignSelf: "stretch",
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  compactValue: { fontSize: 26, fontWeight: "900", lineHeight: 32, fontVariant: ["tabular-nums"] },
  compactLabel: { marginTop: 2, fontSize: 10, fontWeight: "900", textTransform: "uppercase", color: UIColors.mutedForeground },
});

function AnimatedBar({ percent, color }: { percent: number; color: string }) {
  const [trackWidth, setTrackWidth] = useState(0);
  const width = useSharedValue(0);

  useEffect(() => {
    if (trackWidth <= 0) return;
    width.value = withTiming((Math.max(0, Math.min(100, percent)) / 100) * trackWidth, {
      duration: 520,
      easing: Easing.out(Easing.cubic),
    });
  }, [percent, trackWidth, width]);

  const style = useAnimatedStyle(() => ({ width: width.value }));

  return (
    <View style={st.barTrack} onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
      <Reanimated.View style={[{ height: "100%", borderRadius: 999, backgroundColor: color }, style]} />
    </View>
  );
}

function formatPoints(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

function sectionPoints(section: AnalysisResult["sectionScores"][number]) {
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

export function ScoreHero({ analysis }: { analysis: AnalysisResult }) {
  const color = scoreColor(analysis.overallScore);
  const pts =
    analysis.totalPointsEarned ??
    Math.round((analysis.overallScore / 100) * (analysis.totalPointsPossible ?? 200));
  const max = analysis.totalPointsPossible ?? 200;

  return (
    <Reanimated.View entering={tourEnter.fadeDown}>
      <Card style={st.card}>
        <CardContent style={st.cardBody}>
          <Reanimated.View entering={FadeInDown.delay(40).duration(360).springify()} style={st.scoreBlock}>
            <View style={[st.scoreRing, { borderColor: `${color}22` }]}>
              <Text selectable style={[st.scoreValue, { color }]}>
                {analysis.overallScore}
                <Text style={st.scoreSuffix}>%</Text>
              </Text>
            </View>
            <Text selectable style={st.ptsLabel}>{pts}/{max} pts</Text>
          </Reanimated.View>

          <View style={st.sections}>
            {analysis.sectionScores.map((sec, index) => {
              const points = sectionPoints(sec);
              const progress = points ? (points.earned / points.possible) * 100 : sec.score;
              const c = scoreColor(progress);
              return (
                <Reanimated.View key={sec.section} entering={tourEnter.stagger(index, 55)} style={st.sectionRow}>
                  <View style={st.sectionHeader}>
                    <Text selectable style={st.sectionName} numberOfLines={1}>{sec.section}</Text>
                    <Text selectable style={[st.sectionPts, { color: c }]}>
                      {points ? `${formatPoints(points.earned)}/${formatPoints(points.possible)} pts` : "--"}
                    </Text>
                  </View>
                  <AnimatedBar percent={progress} color={c} />
                </Reanimated.View>
              );
            })}
          </View>
        </CardContent>
      </Card>
    </Reanimated.View>
  );
}

export function ScoreCompact({ score }: { score: number }) {
  const color = scoreColor(score);
  return (
    <Reanimated.View
      entering={FadeInDown.duration(300).springify()}
      style={[st.compact, { borderColor: `${color}33`, backgroundColor: `${color}10` }]}
    >
      <Text selectable style={[st.compactValue, { color }]}>{score}%</Text>
      <Text style={st.compactLabel}>Tour score</Text>
    </Reanimated.View>
  );
}
