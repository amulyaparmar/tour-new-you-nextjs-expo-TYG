import React from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GlassNavHeader, glassNavContentInset } from "@/components/glass-nav-header";
import { SkeletonPulse, useSkeletonPulse } from "@/components/ui/use-skeleton-pulse";
import { BACKGROUND, CARD, HINT, LARGE_CORNER } from "@/theme/tokens";

import { SESSION_PAGE_PADDING, SESSION_SECTION_GAP } from "./session-layout";

const TURNS = [
  { speaker: 68, line: "88%" as const, line2: "52%" as const },
  { speaker: 92, line: "74%" as const, line2: "61%" as const },
  { speaker: 64, line: "91%" as const, line2: "38%" as const },
  { speaker: 80, line: "69%" as const, line2: "47%" as const },
];

export function SessionReviewSkeleton({ onBack }: { onBack?: () => void }) {
  const insets = useSafeAreaInsets();
  const pulse = useSkeletonPulse();

  return (
    <View accessibilityLabel="Loading tour" style={styles.root}>
      <View
        style={[
          styles.body,
          { paddingTop: glassNavContentInset(insets.top) },
        ]}
      >
        <View style={styles.tabTrack}>
          <View style={styles.tabActive} />
          <View style={styles.tabIdle} />
        </View>

        <View style={styles.turns}>
          {TURNS.map((turn, index) => (
            <View key={index} style={styles.turn}>
              <View style={styles.turnMeta}>
                <SkeletonPulse
                  pulse={pulse}
                  style={[styles.speaker, { width: turn.speaker }]}
                />
                <SkeletonPulse pulse={pulse} style={styles.time} />
              </View>
              <SkeletonPulse
                pulse={pulse}
                style={[styles.line, { width: turn.line }]}
              />
              <SkeletonPulse
                pulse={pulse}
                style={[styles.line, { width: turn.line2 }]}
              />
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.playerDock, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <SkeletonPulse pulse={pulse} style={styles.playerTrack} />
        <View style={styles.playerTimes}>
          <SkeletonPulse pulse={pulse} style={styles.playerTime} />
          <SkeletonPulse pulse={pulse} style={styles.playerTime} />
        </View>
        <View style={styles.playerControls}>
          <View style={styles.playerSide} />
          <SkeletonPulse pulse={pulse} style={styles.playBtn} />
          <View style={styles.playerSide} />
        </View>
      </View>
      <GlassNavHeader title="Tour" onBack={onBack} />
    </View>
  );
}

/** @deprecated Use SessionReviewSkeleton */
export function SessionLoading({ label: _label = "Loading session…" }: { label?: string }) {
  return <SessionReviewSkeleton />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  body: {
    flex: 1,
    gap: SESSION_SECTION_GAP,
    paddingHorizontal: SESSION_PAGE_PADDING,
  },
  tabTrack: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 36,
    padding: 2,
    borderRadius: 10,
    backgroundColor: "rgba(118, 118, 128, 0.12)",
  },
  tabActive: {
    flex: 1,
    minHeight: 32,
    borderRadius: 8,
    backgroundColor: CARD,
  },
  tabIdle: {
    flex: 1,
    minHeight: 32,
  },
  turns: {
    gap: 18,
  },
  turn: {
    gap: 8,
    paddingHorizontal: 8,
  },
  turnMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  speaker: {
    height: 12,
    borderRadius: 6,
    backgroundColor: HINT,
  },
  time: {
    width: 36,
    height: 10,
    borderRadius: 5,
    backgroundColor: CARD,
  },
  line: {
    height: 12,
    borderRadius: 6,
    backgroundColor: CARD,
  },
  playerDock: {
    paddingHorizontal: SESSION_PAGE_PADDING + 8,
    paddingTop: 10,
    backgroundColor: CARD,
    borderTopLeftRadius: LARGE_CORNER,
    borderTopRightRadius: LARGE_CORNER,
    borderCurve: "continuous",
  },
  playerTrack: {
    height: 4,
    marginHorizontal: 8,
    borderRadius: 999,
    backgroundColor: HINT,
  },
  playerTimes: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 8,
    marginTop: 10,
    marginBottom: 8,
  },
  playerTime: {
    width: 40,
    height: 10,
    borderRadius: 5,
    backgroundColor: BACKGROUND,
  },
  playerControls: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 8,
  },
  playerSide: {
    flex: 1,
  },
  playBtn: {
    width: 96,
    height: 48,
    borderRadius: 24,
    backgroundColor: HINT,
  },
});
