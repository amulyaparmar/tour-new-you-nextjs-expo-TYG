import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { getLiquidGlassView } from "@/components/liquid-glass";
import { CARD, TEXT } from "@/theme/tokens";

const BUTTON_SIZE = 42;
const ICON_SIZE = 26;

export function LiquidGlassIconButton({
  icon,
  onPress,
  size = BUTTON_SIZE,
  iconSize = ICON_SIZE,
  disabled = false,
  accessibilityLabel,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  size?: number;
  iconSize?: number;
  disabled?: boolean;
  accessibilityLabel: string;
}) {
  const GlassView = useMemo(() => getLiquidGlassView(), []);
  const radius = size / 2;

  const hit = (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name={icon} size={iconSize} color={disabled ? `${TEXT}73` : TEXT} />
    </Pressable>
  );

  if (GlassView) {
    return (
      <View pointerEvents="box-none" style={styles.slot}>
        <GlassView isInteractive borderRadius={radius} style={{ width: size, height: size }}>
          {hit}
        </GlassView>
      </View>
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        overflow: "hidden",
        backgroundColor: CARD,
      }}
    >
      {hit}
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    overflow: "visible",
  },
});
