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
import { BACKGROUND, CARD, SMALL_CORNER } from "@/theme/tokens";
import { scoreColor } from "@/theme/tour-brand";
import { tourColors as C } from "@/theme/tour-brand";

const st = StyleSheet.create({
  barTrack: {
    height: 6,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: BACKGROUND,
  },
  card: {
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  scoreBlock: { alignItems: "center", gap: 6 },
  scoreRing: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 60,
    borderWidth: 8,
  },
  scoreValue: { fontVariant: ["tabular-nums"] },
  ptsLabel: { color: C.textSec },
  sections: { gap: 10 },
  sectionRow: { gap: 4 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  sectionName: { flex: 1 },
  sectionPts: { fontVariant: ["tabular-nums"] },
  compact: {
    width: 108,
    alignSelf: "stretch",
    justifyContent: "center",
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  compactValue: { lineHeight: 32, fontVariant: ["tabular-nums"] },
  compactLabel: {
    marginTop: 2,
    textTransform: "uppercase",
    color: C.textSec,
  },
});

function AnimatedBar({ percent, color }: { percent: number; color: string }) {
  const [trackWidth, setTrackWidth] = useState(0);
  const width = useSharedValue(0);

  useEffect(() => {
    if (trackWidth <= 0) return;
    width.value = withTiming(
      (Math.max(0, Math.min(100, percent)) / 100) * trackWidth,
      {
        duration: 520,
        easing: Easing.out(Easing.cubic),
      },
    );
  }, [percent, trackWidth, width]);

  const style = useAnimatedStyle(() => ({ width: width.value }));

  return (
    <View
      style={st.barTrack}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
    >
      <Reanimated.View
        style={[
          { height: "100%", borderRadius: 999, backgroundColor: color },
          style,
        ]}
      />
    </View>
  );
}

export function ScoreHero({ analysis }: { analysis: AnalysisResult }) {
  const color = scoreColor(analysis.overallScore);
  const pts =
    analysis.totalPointsEarned ??
    Math.round(
      (analysis.overallScore / 100) * (analysis.totalPointsPossible ?? 200),
    );
  const max = analysis.totalPointsPossible ?? 200;

  return (
    <Reanimated.View entering={tourEnter.fadeDown}>
      <View style={st.card}>
        <Reanimated.View
          entering={FadeInDown.delay(40).duration(360).springify()}
          style={st.scoreBlock}
        >
          <View style={[st.scoreRing, { borderColor: `${color}22` }]}>
            <CustomText
              selectable
              textStyle="hero"
              style={[st.scoreValue, { color, fontSize: 36 }]}
            >
              {analysis.overallScore}
              <CustomText textStyle="title" style={{ color }}>
                %
              </CustomText>
            </CustomText>
          </View>
          <CustomText selectable textStyle="caption" style={st.ptsLabel}>
            {pts}/{max} pts
          </CustomText>
        </Reanimated.View>

        <View style={st.sections}>
          {analysis.sectionScores.map((sec, index) => {
            const c = scoreColor(sec.score);
            return (
              <Reanimated.View
                key={sec.section}
                entering={tourEnter.stagger(index, 55)}
                style={st.sectionRow}
              >
                <View style={st.sectionHeader}>
                  <CustomText
                    selectable
                    textStyle="label"
                    style={st.sectionName}
                    numberOfLines={1}
                  >
                    {sec.section}
                  </CustomText>
                  <CustomText
                    selectable
                    textStyle="label"
                    style={[st.sectionPts, { color: c }]}
                  >
                    {sec.pointsPossible > 0
                      ? `${sec.pointsEarned}/${sec.pointsPossible}`
                      : `${sec.score}%`}
                  </CustomText>
                </View>
                <AnimatedBar percent={sec.score} color={c} />
              </Reanimated.View>
            );
          })}
        </View>
      </View>
    </Reanimated.View>
  );
}

export function ScoreCompact({ score }: { score: number }) {
  const color = scoreColor(score);
  return (
    <Reanimated.View
      entering={FadeInDown.duration(300).springify()}
      style={[st.compact, { backgroundColor: `${color}14` }]}
    >
      <CustomText
        selectable
        textStyle="hero"
        style={[st.compactValue, { color }]}
      >
        {score}%
      </CustomText>
      <CustomText textStyle="micro" style={st.compactLabel}>
        Tour score
      </CustomText>
    </Reanimated.View>
  );
}
