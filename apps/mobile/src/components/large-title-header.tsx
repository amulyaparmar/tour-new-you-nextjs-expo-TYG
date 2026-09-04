import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, View } from "react-native";
import Reanimated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CustomText } from "@/components/custom-text";
import { BACKGROUND, TEXT } from "@/theme/tokens";
import { tourColors } from "@/theme/tour-brand";

const BAR_HEIGHT = 52;
const FADE_HEIGHT = 56;
const COLLAPSE_START = 64;
const COLLAPSE_END = 108;
const LARGE_FADE_END = COLLAPSE_START + 20;
const FADE_COLORS = [
  BACKGROUND,
  "rgba(242, 242, 247, 0.62)",
  "rgba(242, 242, 247, 0)",
] as const;
const FADE_LOCATIONS = [0, 0.5, 1] as const;

export const LARGE_TITLE_BAR_HEIGHT = BAR_HEIGHT;
export const LARGE_TITLE_TOP_GAP = 22;

export function largeTitleContentInset(topInset: number) {
  return topInset + BAR_HEIGHT + LARGE_TITLE_TOP_GAP;
}

export function LargeTitleCopy({
  title,
  subtitle,
  scrollY,
}: {
  title: string;
  subtitle: string;
  scrollY: SharedValue<number>;
}) {
  const fadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [COLLAPSE_START, LARGE_FADE_END], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <Reanimated.View style={fadeStyle}>
      <CustomText textStyle="hero" style={copyStyles.title}>{title}</CustomText>
      <CustomText textStyle="caption" style={copyStyles.subtitle}>{subtitle}</CustomText>
    </Reanimated.View>
  );
}

export function LargeTitleHeader({
  title,
  scrollY,
  trailing,
  hideCompactTitle = false,
}: {
  title: string;
  scrollY: SharedValue<number>;
  trailing?: React.ReactNode;
  hideCompactTitle?: boolean;
}) {
  const insets = useSafeAreaInsets();

  const chromeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [COLLAPSE_START, COLLAPSE_END], [0, 1], Extrapolation.CLAMP),
  }));

  const compactTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [COLLAPSE_START, COLLAPSE_END], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { height: insets.top + BAR_HEIGHT + FADE_HEIGHT }]}
    >
      <Reanimated.View pointerEvents="none" style={[StyleSheet.absoluteFill, chromeStyle]}>
        <LinearGradient
          colors={[...FADE_COLORS]}
          locations={[...FADE_LOCATIONS]}
          style={StyleSheet.absoluteFill}
        />
      </Reanimated.View>
      <View pointerEvents="box-none" style={[styles.bar, { marginTop: insets.top }]}>
        {hideCompactTitle ? null : <View pointerEvents="none" style={styles.sideCluster} />}
        {hideCompactTitle ? null : (
          <Reanimated.View pointerEvents="none" style={[styles.titleWrap, compactTitleStyle]}>
            <CustomText textStyle="title" numberOfLines={1} style={styles.title}>
              {title}
            </CustomText>
          </Reanimated.View>
        )}
        <View style={[styles.trailing, hideCompactTitle && styles.trailingFill]}>{trailing}</View>
      </View>
    </View>
  );
}

const copyStyles = StyleSheet.create({
  title: { fontSize: 34, letterSpacing: -0.6, lineHeight: 40 },
  subtitle: { color: tourColors.textSec, marginTop: 5 },
});

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    overflow: "visible",
    backgroundColor: "transparent",
  },
  bar: {
    height: BAR_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: TEXT,
    textAlign: "center",
  },
  sideCluster: {
    width: 92,
    height: 42,
  },
  trailing: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  trailingFill: {
    flex: 1,
    minWidth: 0,
  },
});
