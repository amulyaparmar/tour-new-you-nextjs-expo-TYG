import { ClipboardList, GraduationCap, HeartHandshake, MessageCircle, MessageSquare, Sparkles } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { selectionHaptic } from "@/lib/haptics";

import { SESSION_PAGE_PADDING } from "./session-layout";

export type SessionReviewMode = "rubric" | "prospect" | "transcript" | "coaching" | "comments" | "ai";

const MODES: Array<{
  id: SessionReviewMode;
  label: string;
  icon: LucideIcon;
}> = [
  { id: "rubric", label: "Rubric", icon: ClipboardList },
  { id: "prospect", label: "Prospect", icon: HeartHandshake },
  { id: "transcript", label: "Transcript", icon: MessageSquare },
  { id: "coaching", label: "Coaching", icon: GraduationCap },
  { id: "comments", label: "Comments", icon: MessageCircle },
  { id: "ai", label: "AI Chat", icon: Sparkles },
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
  /** Indicator count for the Comments tab (not every mode). */
  commentCount?: number;
}) {
  const visibleModes = modes
    ? modes.flatMap((id) => {
        const mode = MODES.find((candidate) => candidate.id === id);
        return mode ? [mode] : [];
      })
    : MODES;
  const usesFullWidthTabs = visibleModes.length <= 3;
  const tabItems = visibleModes.map((mode) => {
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
        style={[styles.tab, usesFullWidthTabs && styles.tabFullWidth, active && styles.tabActive]}
      >
        <Icon as={mode.icon} size={16} color={active ? "#006ce5" : "#667085"} />
        <Text numberOfLines={1} style={[styles.label, active && styles.labelActive]}>
          {mode.label}
        </Text>
        {showCommentBadge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{commentCount > 99 ? "99+" : String(commentCount)}</Text>
          </View>
        ) : null}
      </Pressable>
    );
  });

  return (
    <View style={styles.wrap}>
      {usesFullWidthTabs ? (
        <View style={[styles.bar, styles.barFullWidth]}>{tabItems}</View>
      ) : (
        <ScrollView
          horizontal
          nestedScrollEnabled
          directionalLockEnabled
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.bar}
        >
          {tabItems}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: SESSION_PAGE_PADDING,
    paddingTop: 4,
    paddingBottom: 0,
    backgroundColor: "#f4f7fb",
  },
  bar: {
    flexDirection: "row",
    paddingRight: SESSION_PAGE_PADDING,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  barFullWidth: { paddingRight: 0 },
  tab: {
    minWidth: 92,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 9,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    marginBottom: -1,
  },
  tabFullWidth: { flex: 1, minWidth: 0, gap: 5, paddingHorizontal: 4 },
  tabActive: {
    borderBottomColor: "#006ce5",
  },
  label: {
    fontSize: 12,
    fontWeight: "800",
    color: "#667085",
  },
  labelActive: {
    color: "#006ce5",
  },
  badge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#006ce5",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#fff",
    fontVariant: ["tabular-nums"],
  },
});
