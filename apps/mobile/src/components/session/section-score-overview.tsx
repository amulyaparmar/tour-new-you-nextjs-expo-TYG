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

import { CustomText } from "@/components/custom-text";
import { tourEnter } from "@/theme/animations";
import { CARD, SMALL_CORNER } from "@/theme/tokens";
import { scoreColor } from "@/theme/tour-brand";

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
        <CustomText textStyle="title">Section scores</CustomText>
        <View style={styles.sections}>
          {analysis.sectionScores.map((sec, index) => {
            const c = scoreColor(sec.score);
            return (
              <Reanimated.View key={sec.section} entering={tourEnter.stagger(index, 45)} style={styles.sectionRow}>
                <View style={styles.sectionHead}>
                  <CustomText selectable textStyle="label" style={styles.sectionName} numberOfLines={1}>
                    {sec.section}
                  </CustomText>
                  <CustomText selectable textStyle="caption" style={[styles.sectionVal, { color: c }]}>
                    {sec.pointsPossible > 0
                      ? `${sec.pointsEarned}/${sec.pointsPossible}`
                      : `${sec.score}%`}
                  </CustomText>
                </View>
                <SectionBar percent={sec.score} color={c} />
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
    backgroundColor: CARD,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    padding: 16,
    gap: 12,
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
  },
  sectionVal: {
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
