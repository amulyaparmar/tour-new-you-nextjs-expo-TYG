import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { CustomText } from "@/components/custom-text";
import { selectionHaptic } from "@/lib/haptics";
import { CARD, TEXT } from "@/theme/tokens";
import { tourColors as C } from "@/theme/tour-brand";

import { SESSION_PAGE_PADDING } from "./session-layout";

export type SessionReviewMode = "transcript" | "ai";

const MODES: Array<{
  id: SessionReviewMode;
  label: string;
}> = [
  { id: "transcript", label: "Transcript" },
  { id: "ai", label: "AI Chat" },
];

export function SessionModeTabs({
  value,
  onChange,
  modes,
}: {
  value: SessionReviewMode;
  onChange: (mode: SessionReviewMode) => void;
  modes?: SessionReviewMode[];
}) {
  const visibleModes = modes
    ? MODES.filter((mode) => modes.includes(mode.id))
    : MODES;
  return (
    <View style={styles.wrap}>
      <View style={styles.track}>
        {visibleModes.map((mode) => {
          const active = value === mode.id;
          return (
            <Pressable
              key={mode.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => {
                selectionHaptic();
                onChange(mode.id);
              }}
              style={[styles.segment, active && styles.segmentActive]}
            >
              <CustomText
                textStyle="label"
                numberOfLines={1}
                style={[styles.label, active && styles.labelActive]}
              >
                {mode.label}
              </CustomText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: SESSION_PAGE_PADDING,
    marginBottom: 4,
    borderRadius: 10,
    backgroundColor: "rgba(118, 118, 128, 0.12)",
  },
  track: {
    flexDirection: "row",
    alignItems: "center",
    padding: 2,
  },
  segment: {
    flex: 1,
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  segmentActive: {
    backgroundColor: CARD,
    shadowColor: TEXT,
    shadowOffset: { width: 0, height: 0.5 },
    shadowOpacity: 0.12,
    shadowRadius: 1,
    elevation: 1,
  },
  label: {
    color: C.textSec,
    fontWeight: "600",
  },
  labelActive: {
    color: TEXT,
  },
});
