import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { CustomText } from "@/components/custom-text";
import { getLiquidGlassView } from "@/components/liquid-glass";
import { LoadingDots } from "@/components/loading-dots";
import { ACCENT, CARD, TEXT } from "@/theme/tokens";

const CHIP_RADIUS = 20;

export function LiquidGlassTextButton({
  label,
  onPress,
  variant = "default",
  disabled = false,
  loading = false,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: "default" | "accent";
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
}) {
  const GlassView = useMemo(() => getLiquidGlassView(), []);
  const accented = variant === "accent";
  const textColor = accented ? CARD : TEXT;
  const inactive = disabled || loading;

  const hit = (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      disabled={inactive}
      onPress={onPress}
      style={styles.hit}
    >
      {loading ? (
        <LoadingDots color={textColor} />
      ) : (
        <CustomText
          textStyle="body"
          style={{ color: disabled ? `${textColor}73` : textColor }}
        >
          {label}
        </CustomText>
      )}
    </Pressable>
  );

  if (GlassView) {
    return (
      <View pointerEvents="box-none" style={styles.slot}>
        <GlassView
          isInteractive
          tintColor={accented ? ACCENT : undefined}
          borderRadius={CHIP_RADIUS}
          style={styles.glass}
        >
          {hit}
        </GlassView>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        { backgroundColor: accented ? ACCENT : CARD },
      ]}
    >
      {hit}
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    overflow: "visible",
  },
  glass: {
    overflow: "visible",
  },
  fallback: {
    borderRadius: CHIP_RADIUS,
    overflow: "hidden",
  },
  hit: {
    minHeight: 42,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
