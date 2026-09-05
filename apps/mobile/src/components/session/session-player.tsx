import { Pause, Play, RotateCcw, RotateCw } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CustomText } from "@/components/custom-text";
import { LoadingDots } from "@/components/loading-dots";
import { Icon } from "@/components/ui/icon";
import { MotionPressable } from "@/components/ui/motion";
import { ACCENT, CARD, TEXT } from "@/theme/tokens";
import { tourColors as C } from "@/theme/tour-brand";

import { SESSION_PAGE_PADDING } from "./session-layout";

export function SessionPlayer({
  position, duration, playing, speed, ready, progressPercent, error,
  onToggle, onSpeed, onSeek, onRetry, onHeightChange, onScrubbingChange,
}: {
  position: number;
  duration: number;
  playing: boolean;
  speed: number;
  ready: boolean;
  progressPercent: number;
  error?: string | null;
  onToggle: () => void;
  onSpeed: () => void;
  onSeek: (ratio: number) => void;
  onRetry?: () => void;
  onHeightChange?: (height: number) => void;
  onScrubbingChange?: (scrubbing: boolean) => void;
}) {
  const insets = useSafeAreaInsets();
  const trackWidth = useRef(0);
  const scrubbing = useRef(false);
  const scrubbingChangeRef = useRef(onScrubbingChange);
  scrubbingChangeRef.current = onScrubbingChange;
  const progress = Number.isFinite(progressPercent)
    ? Math.max(0, Math.min(100, progressPercent))
    : 0;
  const canSeek = ready && duration > 0;

  function setScrubbing(next: boolean) {
    if (scrubbing.current === next) return;
    scrubbing.current = next;
    scrubbingChangeRef.current?.(next);
  }

  useEffect(() => {
    if (!canSeek && scrubbing.current) {
      scrubbing.current = false;
      scrubbingChangeRef.current?.(false);
    }
  }, [canSeek]);

  useEffect(() => () => {
    if (scrubbing.current) scrubbingChangeRef.current?.(false);
  }, []);

  function seekAt(x: number) {
    if (!canSeek || trackWidth.current <= 0) return;
    onSeek(Math.max(0, Math.min(1, x / trackWidth.current)));
  }

  function skip(seconds: number) {
    if (!canSeek) return;
    onSeek(Math.max(0, Math.min(1, (position + seconds) / duration)));
  }

  return (
    <View
      style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 12) }]}
      onLayout={(event) => onHeightChange?.(event.nativeEvent.layout.height)}
    >
      {error ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${error} Retry loading recording`}
          disabled={!onRetry}
          onPress={onRetry}
          style={styles.retry}
        >
          <CustomText textStyle="caption" style={styles.retryText}>
            {ready ? "Playback issue" : "Audio unavailable"} · Tap to retry
          </CustomText>
        </Pressable>
      ) : null}
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Recording playhead"
        accessibilityState={{ disabled: !canSeek }}
        accessibilityValue={{
          min: 0,
          max: Math.max(0, Math.round(duration)),
          now: Math.max(0, Math.min(Math.round(position), Math.round(duration))),
          text: `${fmt(position)} of ${fmt(duration)}`,
        }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === "increment") skip(5);
          if (event.nativeEvent.actionName === "decrement") skip(-5);
        }}
        onStartShouldSetResponder={() => canSeek}
        onMoveShouldSetResponder={() => canSeek}
        onTouchStart={() => { if (canSeek) setScrubbing(true); }}
        onTouchEnd={() => setScrubbing(false)}
        onTouchCancel={() => setScrubbing(false)}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(event) => {
          setScrubbing(true);
          seekAt(event.nativeEvent.locationX);
        }}
        onResponderMove={(event) => seekAt(event.nativeEvent.locationX)}
        onResponderRelease={(event) => {
          seekAt(event.nativeEvent.locationX);
          setScrubbing(false);
        }}
        onResponderTerminate={() => setScrubbing(false)}
        onLayout={(event) => {
          trackWidth.current = event.nativeEvent.layout.width;
        }}
        style={styles.trackHit}
      >
        <View pointerEvents="none" style={styles.track}>
          <View style={[styles.fill, { width: `${progress}%` }]} />
          <View style={[styles.thumb, { left: `${progress}%` }]} />
        </View>
      </View>
      <View style={styles.times}>
        <CustomText textStyle="caption" style={styles.elapsed}>{fmt(position)}</CustomText>
        <CustomText textStyle="caption" style={styles.duration}>{fmt(duration)}</CustomText>
      </View>
      <View style={styles.controls}>
        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel={!ready ? error ? "Recording unavailable" : "Loading recording" : playing ? "Pause recording" : "Play recording"}
          accessibilityState={{ disabled: !ready, busy: !ready && !error }}
          disabled={!ready}
          onPress={onToggle}
          haptic="light"
          style={styles.playBtn}
        >
          {!ready && !error ? (
            <LoadingDots color={CARD} size="small" />
          ) : (
            <Icon
              as={playing ? Pause : Play}
              size={21}
              color={CARD}
              fill={CARD}
              style={!playing ? styles.playIcon : undefined}
            />
          )}
          <CustomText textStyle="label" style={styles.playLabel}>
            {playing ? "Pause" : "Play"}
          </CustomText>
        </MotionPressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Rewind 5 seconds"
          accessibilityState={{ disabled: !canSeek }}
          disabled={!canSeek}
          onPress={() => skip(-5)}
          style={({ pressed }) => [styles.skipBtn, !canSeek && styles.disabled, pressed && styles.pressed]}
        >
          <Icon as={RotateCcw} size={28} color={C.textSec} />
          <CustomText textStyle="micro" style={styles.skipNumber}>5</CustomText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Forward 5 seconds"
          accessibilityState={{ disabled: !canSeek }}
          disabled={!canSeek}
          onPress={() => skip(5)}
          style={({ pressed }) => [styles.skipBtn, !canSeek && styles.disabled, pressed && styles.pressed]}
        >
          <Icon as={RotateCw} size={28} color={C.textSec} />
          <CustomText textStyle="micro" style={styles.skipNumber}>5</CustomText>
        </Pressable>
        <View style={styles.spacer} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Playback speed ${speed} times`}
          accessibilityHint="Cycles through playback speeds"
          accessibilityState={{ disabled: !ready }}
          disabled={!ready}
          onPress={onSpeed}
          style={({ pressed }) => [styles.speedBtn, !ready && styles.disabled, pressed && styles.pressed]}
        >
          <CustomText textStyle="caption" style={styles.speedText}>{speed}×</CustomText>
        </Pressable>
      </View>
    </View>
  );
}

function fmt(seconds: number) {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  dock: {
    flexShrink: 0,
    paddingHorizontal: SESSION_PAGE_PADDING + 8,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E4E7EC",
    backgroundColor: CARD,
  },
  // Keep the hit target outside iOS's edge-back strip; no edge-extending hitSlop.
  trackHit: { minHeight: 28, marginHorizontal: 8, justifyContent: "center" },
  track: { height: 3, borderRadius: 999, backgroundColor: "#E4EAF3" },
  fill: { height: "100%", borderRadius: 999, backgroundColor: ACCENT },
  thumb: {
    position: "absolute", top: -4, width: 11, height: 11,
    marginLeft: -5.5, borderRadius: 6, backgroundColor: ACCENT,
  },
  times: { flexDirection: "row", justifyContent: "space-between", marginHorizontal: 8, paddingBottom: 8 },
  elapsed: { color: TEXT, fontVariant: ["tabular-nums"] },
  duration: { color: C.textSec, fontVariant: ["tabular-nums"] },
  controls: { flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 8 },
  spacer: { flex: 1 },
  skipBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22 },
  skipNumber: { position: "absolute", top: 17, fontSize: 10, lineHeight: 12, color: C.textSec },
  playBtn: { minWidth: 96, minHeight: 48, paddingHorizontal: 14, gap: 8, flexDirection: "row", borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: ACCENT },
  playLabel: { color: CARD },
  playIcon: { marginLeft: 2 },
  speedBtn: { minWidth: 44, minHeight: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  speedText: { color: C.textSec, fontVariant: ["tabular-nums"] },
  pressed: { backgroundColor: "#F2F4F7" },
  disabled: { opacity: 0.4 },
  retry: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  retryText: { color: C.textSec },
});
