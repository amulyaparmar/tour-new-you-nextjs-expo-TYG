import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { getLiquidGlassView } from "@/components/liquid-glass";
import { LiquidGlassIconButton } from "@/components/liquid-glass-icon-button";
import { CARD, TEXT } from "@/theme/tokens";
import { tourColors } from "@/theme/tour-brand";

const BAR_HEIGHT = 42;
const BAR_RADIUS = 21;

export function LiquidGlassSearch({
  expanded,
  value,
  onChangeText,
  onExpand,
  onCollapse,
  placeholder = "Search assets",
  accessibilityLabel = "Search assets",
}: {
  expanded: boolean;
  value: string;
  onChangeText: (value: string) => void;
  onExpand: () => void;
  onCollapse: () => void;
  placeholder?: string;
  accessibilityLabel?: string;
}) {
  const GlassView = useMemo(() => getLiquidGlassView(), []);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!expanded) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 40);
    return () => clearTimeout(timer);
  }, [expanded]);

  if (!expanded) {
    return (
      <LiquidGlassIconButton
        icon="search"
        accessibilityLabel={accessibilityLabel}
        onPress={onExpand}
      />
    );
  }

  const field = (
    <View style={styles.row}>
      <Ionicons name="search" size={18} color={TEXT} />
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tourColors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        style={styles.input}
      />
      <Pressable
        accessibilityLabel="Close search"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onCollapse}
        style={styles.close}
      >
        <Ionicons name="close" size={24} color={TEXT} />
      </Pressable>
    </View>
  );

  if (GlassView) {
    return (
      <View pointerEvents="box-none" style={styles.expanded}>
        <GlassView isInteractive borderRadius={BAR_RADIUS} style={styles.glass}>
          {field}
        </GlassView>
      </View>
    );
  }

  return (
    <View style={[styles.expanded, styles.fallback]}>
      {field}
    </View>
  );
}

const styles = StyleSheet.create({
  expanded: {
    flex: 1,
    minWidth: 0,
    height: BAR_HEIGHT,
    overflow: "visible",
  },
  glass: {
    height: BAR_HEIGHT,
    overflow: "visible",
  },
  fallback: {
    borderRadius: BAR_RADIUS,
    overflow: "hidden",
    backgroundColor: CARD,
  },
  row: {
    flex: 1,
    minWidth: 0,
    height: BAR_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    color: TEXT,
    fontSize: 15,
    fontWeight: "600",
  },
  close: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});
