import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { CustomText } from "@/components/custom-text";
import { selectionHaptic } from "@/lib/haptics";
import { CARD, TEXT } from "@/theme/tokens";
import { tourColors as C } from "@/theme/tour-brand";

import { SESSION_PAGE_PADDING } from "./session-layout";

export type SessionReviewMode =
  | "rubric"
  | "prospect"
  | "transcript"
  | "search"
  | "coaching"
  | "comments"
  | "ai";

const MODES: Array<{
  id: SessionReviewMode;
  label: string;
}> = [
  { id: "transcript", label: "Transcript" },
  { id: "ai", label: "AI Chat" },
  { id: "rubric", label: "Rubric" },
  { id: "prospect", label: "Prospect" },
  { id: "search", label: "Search" },
  { id: "coaching", label: "Coaching" },
  { id: "comments", label: "Comments" },
];

export function SessionModeTabs({
  value,
  onChange,
  modes,
  commentCount = 0,
}: {
  value: SessionReviewMode;
  onChange: (mode: SessionReviewMode) => void;
  modes?: SessionReviewMode[];
  commentCount?: number;
}) {
  const visibleModes = modes
    ? MODES.filter((mode) => modes.includes(mode.id))
    : MODES;
  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        nestedScrollEnabled
        directionalLockEnabled
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.track}
      >
        {visibleModes.map((mode) => {
          const active = value === mode.id;
          const showCommentBadge = mode.id === "comments" && commentCount > 0;
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
              {showCommentBadge ? (
                <View style={[styles.badge, active && styles.badgeActive]}>
                  <CustomText textStyle="micro" style={styles.badgeText}>
                    {commentCount > 99 ? "99+" : String(commentCount)}
                  </CustomText>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
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
    gap: 0,
  },
  segment: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
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
  badge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(60, 60, 67, 0.18)",
  },
  badgeActive: {
    backgroundColor: "rgba(60, 60, 67, 0.12)",
  },
  badgeText: {
    color: TEXT,
    fontVariant: ["tabular-nums"],
  },
});
