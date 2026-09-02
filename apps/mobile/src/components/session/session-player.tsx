import { LocateFixed, Pause, Play, RotateCcw, RotateCw } from "lucide-react-native";
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

  function skipBy(seconds: number) {
    if (duration <= 0) return;
    onSeek(Math.max(0, Math.min(1, (position + seconds) / duration)));
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

      <View style={styles.timeRow}>
        <Text style={styles.time}>{fmt(position)}</Text>
        <Text style={styles.time}>{duration > 0 ? `-${fmt(Math.max(0, duration - position))}` : "--:--"}</Text>
      </View>

      <View style={styles.controls}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Playback speed ${speed}x`} onPress={onSpeed} hitSlop={10} style={styles.speedBtn}>
          <Text numberOfLines={1} style={styles.speedText}>{speed}x</Text>
        </Pressable>
        <View style={styles.transportControls}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back 15 seconds"
            disabled={!ready}
            onPress={() => skipBy(-15)}
            style={[styles.skipBtn, !ready && styles.controlDisabled]}
          >
            <Icon as={RotateCcw} size={21} color="#344054" />
            <Text style={styles.skipLabel}>15</Text>
          </Pressable>
          <MotionPressable
            disabled={!ready}
            onPress={onToggle}
            haptic="medium"
            style={[styles.playBtn, !ready && styles.playBtnDisabled]}
          >
            {!ready ? (
              <LoadingDots color="#fff" size="small" />
            ) : (
              <Icon as={playing ? Pause : Play} size={23} color="#fff" />
            )}
          </MotionPressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Forward 15 seconds"
            disabled={!ready}
            onPress={() => skipBy(15)}
            style={[styles.skipBtn, !ready && styles.controlDisabled]}
          >
            <Icon as={RotateCw} size={21} color="#344054" />
            <Text style={styles.skipLabel}>15</Text>
          </Pressable>
        </View>
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
    gap: 3,
    paddingHorizontal: SESSION_PAGE_PADDING,
    paddingTop: 8,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    backgroundColor: "#fff",
    shadowColor: "#101828",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },
  trackHit: {
    minHeight: 20,
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
    height: 4,
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
    top: -5,
    width: 14,
    height: 14,
    marginLeft: -7,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#fff",
    backgroundColor: "#006ce5",
    shadowColor: "#101828",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    elevation: 4,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: -1,
  },
  controls: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  transportControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 22,
  },
  speedBtn: {
    position: "absolute",
    left: 0,
    width: 48,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  speedText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#101828",
    fontVariant: ["tabular-nums"],
  },
  time: {
    fontSize: 11,
    fontWeight: "800",
    color: "#667085",
    fontVariant: ["tabular-nums"],
  },
  skipBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  skipLabel: {
    position: "absolute",
    top: 14,
    fontSize: 8,
    fontWeight: "900",
    color: "#344054",
    fontVariant: ["tabular-nums"],
  },
  playBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#006ce5",
  },
  playBtnDisabled: {
    opacity: 0.55,
  },
  controlDisabled: {
    opacity: 0.4,
  },
});
