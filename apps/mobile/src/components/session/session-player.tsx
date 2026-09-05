import { Pause, Play } from "lucide-react-native";
import React, { useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { CustomText } from "@/components/custom-text";
import { Icon } from "@/components/ui/icon";
import { LoadingDots } from "@/components/loading-dots";
import { ACCENT, CARD, LARGE_CORNER, TEXT } from "@/theme/tokens";
import { tourColors as C } from "@/theme/tour-brand";

import { SESSION_PAGE_PADDING } from "./session-layout";

import { MotionPressable } from "../ui/motion";

export function SessionPlayer({
  position,
  duration,
  playing,
  speed,
  ready,
  progressPercent,
  onToggle,
  onSpeed,
  onSeek,
}: {
  position: number;
  duration: number;
  playing: boolean;
  speed: number;
  ready: boolean;
  progressPercent: number;
  onToggle: () => void;
  onSpeed: () => void;
  onSeek: (ratio: number) => void;
}) {
  const trackWidth = useRef(0);

  function seekAt(x: number) {
    const width = trackWidth.current;
    if (width <= 0) return;
    onSeek(Math.max(0, Math.min(1, x / width)));
  }

  return (
    <View style={styles.dock}>
      <View
        accessibilityRole="adjustable"
        accessibilityLabel="Recording playhead"
        accessibilityValue={{ min: 0, max: Math.max(0, Math.round(duration)), now: Math.round(position) }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(event) => {
          if (duration <= 0) return;
          const delta = event.nativeEvent.actionName === "increment" ? 5 : -5;
          onSeek(Math.max(0, Math.min(1, (position + delta) / duration)));
        }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(event) => seekAt(event.nativeEvent.locationX)}
        onResponderMove={(event) => seekAt(event.nativeEvent.locationX)}
        onResponderRelease={(event) => seekAt(event.nativeEvent.locationX)}
        style={styles.trackHit}
      >
        <View
          style={styles.track}
          onLayout={(event) => {
            trackWidth.current = event.nativeEvent.layout.width;
          }}
        >
          <View style={[styles.fill, { width: `${progressPercent}%` }]} />
          <View pointerEvents="none" style={[styles.thumb, { left: `${progressPercent}%` }]} />
        </View>
      </View>

      <View style={styles.row}>
        <Pressable onPress={onSpeed} hitSlop={10} style={styles.speedBtn}>
          <CustomText textStyle="label" style={styles.speedText}>{speed}x</CustomText>
        </Pressable>

        <CustomText textStyle="label" style={styles.time}>
          {fmt(position)} / {fmt(duration)}
        </CustomText>

        <MotionPressable
          disabled={!ready}
          onPress={onToggle}
          haptic="medium"
          style={[styles.playBtn, !ready && styles.playBtnDisabled]}
        >
          {!ready ? (
            <LoadingDots color={CARD} size="small" />
          ) : (
            <Icon as={playing ? Pause : Play} size={22} color={CARD} />
          )}
        </MotionPressable>
      </View>
    </View>
  );
}

function fmt(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  dock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    gap: 12,
    paddingHorizontal: SESSION_PAGE_PADDING,
    paddingTop: 14,
    paddingBottom: 28,
    borderTopLeftRadius: LARGE_CORNER,
    borderTopRightRadius: LARGE_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
    shadowColor: TEXT,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },
  trackHit: {
    minHeight: 34,
    justifyContent: "center",
  },
  track: {
    height: 6,
    borderRadius: 999,
    backgroundColor: "#e8edf5",
    overflow: "visible",
  },
  fill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: ACCENT,
  },
  thumb: {
    position: "absolute",
    top: -7,
    width: 20,
    height: 20,
    marginLeft: -10,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: CARD,
    backgroundColor: ACCENT,
    shadowColor: "#101828",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    elevation: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  speedBtn: {
    minWidth: 36,
    paddingVertical: 4,
  },
  speedText: {
    color: TEXT,
    fontVariant: ["tabular-nums"],
  },
  time: {
    flex: 1,
    textAlign: "center",
    color: C.textSec,
    fontVariant: ["tabular-nums"],
  },
  playBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ACCENT,
  },
  playBtnDisabled: {
    opacity: 0.55,
  },
});
