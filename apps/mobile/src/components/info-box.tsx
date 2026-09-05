import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { CustomText } from "@/components/custom-text";
import { ACCENT, HINT, SMALL_CORNER } from "@/theme/tokens";

export function InfoBox({
  children,
  icon = "information-circle-outline",
  style,
}: {
  children: React.ReactNode;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.box, style]}>
      <Ionicons name={icon} size={16} color={ACCENT} />
      <CustomText textStyle="caption" style={styles.text}>
        {children}
      </CustomText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: SMALL_CORNER,
    backgroundColor: HINT,
  },
  text: {
    flex: 1,
    color: ACCENT,
    lineHeight: 17,
  },
});
