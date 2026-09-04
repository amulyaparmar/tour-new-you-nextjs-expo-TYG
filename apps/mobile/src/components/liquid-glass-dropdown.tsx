import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { CustomText } from "@/components/custom-text";
import { getLiquidGlassView } from "@/components/liquid-glass";
import { CARD, TEXT } from "@/theme/tokens";
import { tourColors } from "@/theme/tour-brand";

const BAR_HEIGHT = 42;
const BAR_RADIUS = BAR_HEIGHT / 2;

export function LiquidGlassDropdown({
  label,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const GlassView = useMemo(() => getLiquidGlassView(), []);

  const contents = (
    <>
      <CustomText textStyle="title" numberOfLines={1} style={styles.label}>
        {label}
      </CustomText>
      <Ionicons name="chevron-down" size={15} color={tourColors.textSec} />
    </>
  );

  if (GlassView) {
    return (
      <View pointerEvents="box-none" style={styles.slot}>
        <GlassView isInteractive borderRadius={BAR_RADIUS} style={styles.glass}>
          <Pressable
            accessibilityLabel={accessibilityLabel ?? label}
            accessibilityRole="button"
            onPress={onPress}
            style={styles.hit}
          >
            {contents}
          </Pressable>
        </GlassView>
      </View>
    );
  }

  return (
    <View style={styles.fallback}>
      <Pressable
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.hit, pressed && styles.pressed]}
      >
        {contents}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    maxWidth: "100%",
    overflow: "visible",
  },
  glass: {
    maxWidth: "100%",
    overflow: "visible",
  },
  fallback: {
    maxWidth: "100%",
    borderRadius: BAR_RADIUS,
    overflow: "hidden",
    backgroundColor: CARD,
  },
  hit: {
    maxWidth: "100%",
    minHeight: BAR_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 16,
  },
  label: {
    flexShrink: 1,
    color: TEXT,
    lineHeight: 19,
    textAlign: "center",
  },
  pressed: { opacity: 0.76 },
});
