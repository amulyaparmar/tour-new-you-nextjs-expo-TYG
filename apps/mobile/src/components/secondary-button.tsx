import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";

import { CustomText } from "@/components/custom-text";
import { MotionPressable } from "@/components/ui/motion";
import { CARD, TEXT } from "@/theme/tokens";
import { tourColors as C } from "@/theme/tour-brand";

export function SecondaryButton({
  label,
  icon,
  onPress,
  disabled,
  destructive = false,
  accessibilityLabel,
  style,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const color = destructive ? C.red : TEXT;
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      haptic="selection"
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, style]}
    >
      {icon ? <Ionicons name={icon} size={18} color={color} /> : null}
      <CustomText textStyle="title" style={{ color }}>
        {label}
      </CustomText>
    </MotionPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 25,
    backgroundColor: CARD,
  },
});
