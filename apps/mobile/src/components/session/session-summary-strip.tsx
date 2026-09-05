import { CheckCheck, ChevronRight } from "lucide-react-native";
import React from "react";
import { StyleSheet, View } from "react-native";
import Reanimated, { FadeInDown } from "react-native-reanimated";

import { CustomText } from "@/components/custom-text";
import { Icon } from "@/components/ui/icon";
import { ACCENT, CARD, SMALL_CORNER } from "@/theme/tokens";
import { scoreColor } from "@/theme/tour-brand";
import { tourColors as C } from "@/theme/tour-brand";

import { MotionPressable } from "../ui/motion";
import { SESSION_PAGE_PADDING } from "./session-layout";

export function SessionSummaryStrip({
  score,
  pointsEarned,
  pointsPossible,
  openActionCount,
  focusSection,
  onCoachingPress,
}: {
  score: number;
  pointsEarned?: number;
  pointsPossible?: number;
  openActionCount: number;
  focusSection?: string | null;
  onCoachingPress: () => void;
}) {
  const color = scoreColor(score);
  const ptsLabel =
    pointsEarned != null && pointsPossible != null
      ? `${pointsEarned}/${pointsPossible} pts`
      : null;

  return (
    <Reanimated.View
      entering={FadeInDown.delay(60).duration(360).springify()}
      style={styles.row}
    >
      <View style={[styles.scoreCard, { backgroundColor: `${color}14` }]}>
        <CustomText selectable textStyle="hero" style={[styles.scoreValue, { color }]}>
          {score}%
        </CustomText>
        <CustomText textStyle="micro" style={styles.scoreLabel}>
          Tour score
        </CustomText>
        {ptsLabel ? (
          <CustomText textStyle="caption" style={styles.scorePts}>
            {ptsLabel}
          </CustomText>
        ) : null}
      </View>

      <MotionPressable
        onPress={onCoachingPress}
        haptic="selection"
        style={styles.actionsPress}
      >
        <View style={styles.actionsCard}>
          <View style={styles.actionsIcon}>
            <Icon as={CheckCheck} size={18} color={ACCENT} />
          </View>
          <View style={styles.actionsCopy}>
            <CustomText textStyle="title">
              {openActionCount} coaching{" "}
              {openActionCount === 1 ? "action" : "actions"}
            </CustomText>
            <CustomText textStyle="caption" style={styles.actionsLink} numberOfLines={1}>
              {focusSection ? `Focus: ${focusSection}` : "View next steps"}
            </CustomText>
          </View>
          <Icon as={ChevronRight} size={17} color={C.textMuted} />
        </View>
      </MotionPressable>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
    paddingHorizontal: SESSION_PAGE_PADDING,
    paddingBottom: 12,
  },
  scoreCard: {
    width: 112,
    minHeight: 76,
    justifyContent: "center",
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  scoreValue: {
    lineHeight: 32,
    fontVariant: ["tabular-nums"],
  },
  scoreLabel: {
    marginTop: 2,
    textTransform: "uppercase",
    color: C.textSec,
  },
  scorePts: {
    marginTop: 4,
    color: C.textSec,
    fontVariant: ["tabular-nums"],
  },
  actionsPress: {
    flex: 1,
  },
  actionsCard: {
    flex: 1,
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  actionsIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#eff6ff",
  },
  actionsCopy: {
    flex: 1,
    gap: 2,
  },
  actionsLink: {
    color: ACCENT,
  },
});
