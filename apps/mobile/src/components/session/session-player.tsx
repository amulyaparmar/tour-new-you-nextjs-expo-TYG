import { LocateFixed, Pause, Play } from "lucide-react-native";
import React, { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { LoadingDots } from "@/components/loading-dots";

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
  showReturnToPlaying = false,
  onReturnToPlaying,
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
  showReturnToPlaying?: boolean;
  onReturnToPlaying?: () => void;
}) {
  const trackWidth = useRef(0);

  function seekAt(x: number) {
    const width = trackWidth.current;
    if (width <= 0) return;
    onSeek(Math.max(0, Math.min(1, x / width)));
  }

  return (
    <View style={styles.dock}>
      {showReturnToPlaying && onReturnToPlaying ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Return to currently playing transcript"
          onPress={onReturnToPlaying}
          style={styles.returnButton}
        >
          <Icon as={LocateFixed} size={14} color="#006ce5" />
          <Text style={styles.returnText}>Return to playing</Text>
        </Pressable>
      ) : null}

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
          <Text style={styles.speedText}>{speed}x</Text>
        </Pressable>

        <Text style={styles.time}>
          {fmt(position)} / {fmt(duration)}
        </Text>

        <MotionPressable
          disabled={!ready}
          onPress={onToggle}
          haptic="medium"
          style={[styles.playBtn, !ready && styles.playBtnDisabled]}
        >
          {!ready ? (
            <LoadingDots color="#fff" size="small" />
          ) : (
            <Icon as={playing ? Pause : Play} size={22} color="#fff" />
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
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: "#fff",
    shadowColor: "#101828",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },
  trackHit: {
    minHeight: 34,
    justifyContent: "center",
  },
  returnButton: {
    alignSelf: "center",
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
  },
  returnText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#006ce5",
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
    backgroundColor: "#006ce5",
  },
  thumb: {
    position: "absolute",
    top: -7,
    width: 20,
    height: 20,
    marginLeft: -10,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: "#fff",
    backgroundColor: "#006ce5",
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
    fontSize: 13,
    fontWeight: "900",
    color: "#101828",
    fontVariant: ["tabular-nums"],
  },
  time: {
    flex: 1,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "800",
    color: "#667085",
    fontVariant: ["tabular-nums"],
  },
  playBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#006ce5",
  },
  playBtnDisabled: {
    opacity: 0.55,
  },
});
