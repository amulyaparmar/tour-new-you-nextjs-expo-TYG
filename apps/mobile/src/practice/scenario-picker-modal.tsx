import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import {
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Reanimated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

import { BottomSheetModal } from "@/components/bottom-sheet-modal";
import { CustomText } from "@/components/custom-text";
import { LiquidGlassIconButton } from "@/components/liquid-glass-icon-button";
import { selectionHaptic } from "@/lib/haptics";
import { ACCENT, BACKGROUND, CARD, LARGE_CORNER, SMALL_CORNER } from "@/theme/tokens";
import { tourColors } from "@/theme/tour-brand";

const SHEET_HEIGHT_RATIO = 0.72;
const SHEET_MAX_HEIGHT = 650;
const SHEET_GUTTER = 18;
const HEADER_BAR = 44;
const FADE_HEIGHT = 56;
const HEADER_INSET = HEADER_BAR + 8;
const FADE_COLORS = [
  BACKGROUND,
  "rgba(242, 242, 247, 0.62)",
  "rgba(242, 242, 247, 0)",
] as const;
const FADE_LOCATIONS = [0, 0.5, 1] as const;

export type PracticeScenario = {
  id: string;
  name: string;
  description?: string;
  difficulty?: "easy" | "medium" | "hard";
  firstMessage?: string;
  passThreshold?: number;
};

export function ScenarioPickerModal({
  visible,
  scenarios,
  loading,
  onClose,
  onSelect,
}: {
  visible: boolean;
  scenarios: PracticeScenario[];
  loading?: boolean;
  onClose: () => void;
  onSelect: (scenario: PracticeScenario) => void;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const sheetHeight = Math.round(Math.min(windowHeight * SHEET_HEIGHT_RATIO, SHEET_MAX_HEIGHT));
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });
  const fadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 28], [0, 1], Extrapolation.CLAMP),
  }));

  useEffect(() => {
    if (!visible) scrollY.value = 0;
  }, [scrollY, visible]);

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      sheetHeight={sheetHeight}
      sheetStyle={styles.sheet}
      contentStyle={styles.listContent}
    >
      <View style={styles.body}>
        <View pointerEvents="box-none" style={styles.headerWrap}>
          <Reanimated.View pointerEvents="none" style={[StyleSheet.absoluteFill, fadeStyle]}>
            <LinearGradient
              colors={[...FADE_COLORS]}
              locations={[...FADE_LOCATIONS]}
              style={StyleSheet.absoluteFill}
            />
          </Reanimated.View>
          <View pointerEvents="box-none" style={styles.titleRow}>
            <View style={styles.headerCopy}>
              <CustomText textStyle="hero" style={styles.title}>
                Start Live Practice
              </CustomText>
            </View>
            <LiquidGlassIconButton
              icon="close"
              accessibilityLabel="Close scenario picker"
              onPress={onClose}
            />
          </View>
        </View>
        {loading ? (
          <View style={styles.stack}>
            {Array.from({ length: 4 }).map((_, index) => (
              <View key={index} style={styles.skeletonRow}>
                <View style={styles.skeletonIcon} />
                <View style={styles.skeletonBody}>
                  <View style={styles.skeletonLine} />
                  <View style={styles.skeletonLineShort} />
                </View>
              </View>
            ))}
          </View>
        ) : scenarios.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="sparkles-outline" size={28} color={tourColors.textMuted} />
            <CustomText textStyle="title">No scenarios yet</CustomText>
            <CustomText textStyle="caption" style={styles.emptySub}>
              Create a practice scenario on Tour.you, then pull to refresh.
            </CustomText>
          </View>
        ) : (
          <Reanimated.FlatList
            data={scenarios}
            keyExtractor={(item) => item.id}
            style={styles.list}
            contentContainerStyle={styles.listPad}
            showsVerticalScrollIndicator
            onScroll={onScroll}
            scrollEventThrottle={16}
            renderItem={({ item }) => (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Start ${item.name} practice`}
                activeOpacity={0.72}
                onPress={() => {
                  selectionHaptic();
                  onSelect(item);
                }}
                style={styles.row}
              >
                <View style={styles.rowIcon}>
                  <Ionicons name="chatbubbles-outline" size={18} color={ACCENT} />
                </View>
                <View style={styles.rowBody}>
                  <View style={styles.rowTitleLine}>
                    <CustomText textStyle="title" numberOfLines={1} style={styles.rowName}>
                      {item.name}
                    </CustomText>
                    {item.difficulty ? <DifficultyBadge difficulty={item.difficulty} /> : null}
                  </View>
                  {item.description ? (
                    <CustomText textStyle="caption" numberOfLines={2} style={styles.rowMeta}>
                      {item.description}
                    </CustomText>
                  ) : null}
                  {item.passThreshold != null ? (
                    <CustomText textStyle="micro" style={styles.rowThreshold}>
                      Pass at {item.passThreshold}%
                    </CustomText>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={18} color={tourColors.textMuted} />
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </BottomSheetModal>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: NonNullable<PracticeScenario["difficulty"]> }) {
  const color = difficulty === "hard" ? tourColors.red : difficulty === "easy" ? tourColors.green : tourColors.amber;
  return (
    <View style={[styles.difficulty, { backgroundColor: `${color}18` }]}>
      <CustomText textStyle="micro" style={[styles.difficultyText, { color }]}>
        {difficulty}
      </CustomText>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    overflow: "hidden",
    paddingTop: 2,
    paddingHorizontal: 0,
    borderTopLeftRadius: LARGE_CORNER,
    borderTopRightRadius: LARGE_CORNER,
    borderCurve: "continuous",
    backgroundColor: BACKGROUND,
  },
  headerWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_BAR + FADE_HEIGHT,
    zIndex: 20,
    overflow: "visible",
    backgroundColor: "transparent",
  },
  titleRow: {
    height: HEADER_BAR,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: SHEET_GUTTER,
    overflow: "visible",
  },
  headerCopy: { flex: 1 },
  title: { color: tourColors.text },
  listContent: { overflow: "visible" },
  body: {
    flex: 1,
    paddingHorizontal: SHEET_GUTTER,
    paddingBottom: 8,
  },
  list: { flex: 1 },
  listPad: { gap: 8, paddingTop: HEADER_INSET, paddingBottom: 12 },
  stack: { gap: 8, paddingTop: HEADER_INSET },
  row: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 11,
    paddingVertical: 12,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  rowIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: BACKGROUND,
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowName: { flex: 1, color: tourColors.text },
  rowMeta: { marginTop: 2, color: tourColors.textMuted, lineHeight: 14 },
  rowThreshold: { marginTop: 4, color: tourColors.textMuted },
  difficulty: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 99,
  },
  difficultyText: { textTransform: "capitalize" },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  emptySub: {
    color: tourColors.textSec,
    textAlign: "center",
    lineHeight: 17,
  },
  skeletonRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 11,
    paddingVertical: 12,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  skeletonIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: BACKGROUND,
  },
  skeletonBody: { flex: 1, gap: 7 },
  skeletonLine: {
    width: "62%",
    height: 12,
    borderRadius: 6,
    backgroundColor: BACKGROUND,
  },
  skeletonLineShort: {
    width: "40%",
    height: 10,
    borderRadius: 5,
    backgroundColor: BACKGROUND,
  },
});
