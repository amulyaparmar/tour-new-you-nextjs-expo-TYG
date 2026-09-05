import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";
import Reanimated, { FadeInDown } from "react-native-reanimated";

import { CustomText } from "@/components/custom-text";
import { ACCENT, CARD, LARGE_CORNER } from "@/theme/tokens";
import { tourColors as C } from "@/theme/tour-brand";

export function EmptyStateCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <Reanimated.View entering={FadeInDown.duration(260).springify()} style={styles.card}>
      <View style={styles.icon}>
        <Ionicons name={icon} size={22} color={ACCENT} />
      </View>
      <CustomText textStyle="title">{title}</CustomText>
      <CustomText textStyle="caption" style={styles.subtitle}>
        {subtitle}
      </CustomText>
      {children ? <View style={styles.actions}>{children}</View> : null}
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 28,
    borderRadius: LARGE_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  icon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "rgba(0, 108, 229, 0.08)",
  },
  subtitle: {
    color: C.textSec,
    textAlign: "center",
  },
  actions: {
    alignSelf: "stretch",
    marginTop: 8,
  },
});
