import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CustomText } from "@/components/custom-text";
import { BACKGROUND, CARD, TEXT } from "@/theme/tokens";

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
}: {
  title: string;
  onBack?: () => void;
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
          <Pressable
            accessibilityLabel="Back"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          >
            <Ionicons name="arrow-back" size={20} color={TEXT} />
          </Pressable>
        ) : (
          <View style={styles.side} />
        )}
        <CustomText textStyle="title" numberOfLines={1} style={styles.title}>
          {title}
        </CustomText>
        <View style={styles.side} />
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
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: CARD,
  },
  pressed: { opacity: 0.72 },
});

export function glassNavContentInset(topInset: number) {
  return topInset + BAR_HEIGHT + 16;
}
