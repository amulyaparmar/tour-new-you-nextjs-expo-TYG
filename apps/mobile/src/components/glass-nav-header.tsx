import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CustomText } from "@/components/custom-text";
import { LiquidGlassIconButton } from "@/components/liquid-glass-icon-button";
import { BACKGROUND, TEXT } from "@/theme/tokens";

const BAR_HEIGHT = 52;
const FADE_HEIGHT = 56;
const FADE_COLORS = [
  BACKGROUND,
  "rgba(242, 242, 247, 0.62)",
  "rgba(242, 242, 247, 0)",
] as const;
const FADE_LOCATIONS = [0, 0.5, 1] as const;

export const GLASS_NAV_BAR_HEIGHT = BAR_HEIGHT;

export function GlassNavHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { height: insets.top + BAR_HEIGHT + FADE_HEIGHT }]}
    >
      <LinearGradient
        colors={[...FADE_COLORS]}
        locations={[...FADE_LOCATIONS]}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.bar, { marginTop: insets.top }]}>
        {onBack ? (
          <LiquidGlassIconButton
            icon="arrow-back"
            accessibilityLabel="Back"
            onPress={onBack}
          />
        ) : (
          <View style={styles.side} />
        )}
        <CustomText textStyle="title" numberOfLines={1} style={styles.title}>
          {title}
        </CustomText>
        {right ?? <View style={styles.side} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: "transparent",
  },
  bar: {
    height: BAR_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  title: {
    flex: 1,
    color: TEXT,
    textAlign: "center",
  },
  side: {
    width: 42,
    height: 42,
  },
});

export function glassNavContentInset(topInset: number) {
  return topInset + BAR_HEIGHT + 16;
}
