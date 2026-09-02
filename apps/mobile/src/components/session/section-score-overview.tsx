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

import { Text } from "@/components/ui/text";
import { tourEnter } from "@/theme/animations";
import { scoreColor, tourRadius } from "@/theme/tour-brand";

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

function SectionBar({ percent, color }: { percent: number; color: string }) {
  const [trackWidth, setTrackWidth] = useState(0);
  const width = useSharedValue(0);

  useEffect(() => {
    if (trackWidth <= 0) return;
    width.value = withTiming((Math.max(0, Math.min(100, percent)) / 100) * trackWidth, {
      duration: 480,
      easing: Easing.out(Easing.cubic),
    });
  }, [percent, trackWidth, width]);

  const style = useAnimatedStyle(() => ({ width: width.value }));

  return (
    <View
      style={styles.barTrack}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
    >
      <Reanimated.View style={[styles.barFill, { backgroundColor: color }, style]} />
    </View>
  );
}

export function SectionScoreOverview({ analysis }: { analysis: AnalysisResult }) {
  return (
    <Reanimated.View entering={tourEnter.fadeDown} layout={tourEnter.layout}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Section scores</Text>
        <View style={styles.sections}>
          {analysis.sectionScores.map((sec, index) => {
            const points = sectionPoints(sec);
            const progress = points ? (points.earned / points.possible) * 100 : sec.score;
            const c = scoreColor(progress);
            return (
              <Reanimated.View key={sec.section} entering={tourEnter.stagger(index, 45)} style={styles.sectionRow}>
                <View style={styles.sectionHead}>
                  <Text selectable style={styles.sectionName} numberOfLines={1}>
                    {sec.section}
                  </Text>
                  <Text selectable style={[styles.sectionVal, { color: c }]}>
                    {points ? `${formatPoints(points.earned)}/${formatPoints(points.possible)} pts` : "--"}
                  </Text>
                </View>
                <SectionBar percent={progress} color={c} />
              </Reanimated.View>
            );
          })}
        </View>
      </View>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: tourRadius.md,
    borderWidth: 1,
    borderColor: "rgba(16, 24, 40, 0.08)",
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#101828",
  },
  sections: { gap: 12 },
  sectionRow: { gap: 6 },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  sectionName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#101828",
  },
  sectionVal: {
    fontSize: 12,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  barTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#f1f5f9",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 999,
  },
});
