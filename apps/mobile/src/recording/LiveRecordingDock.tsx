import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatElapsed } from "./formatElapsed";
import { liveSessionHeadline } from "./liveSessionLabel";
import { useRecording } from "./RecordingProvider";

const C = {
  panel: "#EAF4FF",
  panelStrong: "#D9ECFF",
  border: "rgba(0,108,229,0.18)",
  blue: "#006CE5",
  blueDark: "#0B4F91",
  text: "#0B2740",
  muted: "#52708E",
  white: "#FFFFFF",
} as const;

/** Compact dock shown while a live recording continues and the full experience is minimized. */
export function LiveRecordingDock() {
  const insets = useSafeAreaInsets();
  const { isRecording, isPaused, elapsed, experienceVisible, liveMeta, expandExperience, togglePause } = useRecording();
  const pulse = useRef(new Animated.Value(1)).current;
  const dockVisible = isRecording && !experienceVisible && Boolean(liveMeta);

  useEffect(() => {
    // Restart from a clearly visible state every time the live experience is
    // minimized. This prevents a prior full-screen transition from leaving the
    // native animation stopped or parked at the faint end of the pulse.
    pulse.stopAnimation();
    pulse.setValue(1);
    if (!dockVisible || isPaused) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
      { resetBeforeIteration: true },
    );
    loop.start();
    return () => {
      loop.stop();
      pulse.stopAnimation();
    };
  }, [dockVisible, isPaused, pulse]);

  if (!dockVisible || !liveMeta) return null;

  const pulseRingOpacity = pulse.interpolate({
    inputRange: [0.35, 1],
    outputRange: [0.16, 0.52],
  });
  const pulseRingScale = pulse.interpolate({
    inputRange: [0.35, 1],
    outputRange: [1.45, 0.92],
  });
  const dockPulseOpacity = pulse.interpolate({
    inputRange: [0.35, 1],
    outputRange: [0.14, 0.44],
  });
  const playPulseScale = pulse.interpolate({
    inputRange: [0.35, 1],
    outputRange: [0.96, 1.03],
  });

  return (
    <View pointerEvents="box-none" style={[st.wrap, { bottom: Math.max(insets.bottom, 10) + 62 }]}>
      <Pressable accessibilityLabel="Return to live session" onPress={expandExperience} style={({ pressed }) => [st.dock, pressed && st.dockPressed]}>
        <Animated.View
          pointerEvents="none"
          style={[st.dockPulseSurface, { opacity: isPaused ? 0.06 : dockPulseOpacity }]}
        />
        <View style={st.openControlWrap}>
          <Animated.View style={[st.openControl, { transform: [{ scale: isPaused ? 1 : playPulseScale }] }]}>
            <Ionicons name="play" size={18} color={C.white} />
          </Animated.View>
          {!isPaused ? (
            <Animated.View
              style={[
                st.statusPulseRing,
                { opacity: pulseRingOpacity, transform: [{ scale: pulseRingScale }] },
              ]}
            />
          ) : null}
          <View style={[st.statusDot, isPaused && st.statusDotPaused]} />
        </View>
        <View style={st.copy}>
          <Text style={st.title} numberOfLines={1}>Live session</Text>
          <Text style={st.meta} numberOfLines={1}>
            {isPaused ? "Paused · " : ""}{liveSessionHeadline(liveMeta)} · {formatElapsed(elapsed)}
          </Text>
        </View>
        <Pressable
          accessibilityLabel={isPaused ? "Resume recording" : "Pause recording"}
          hitSlop={8}
          onPress={(event) => {
            event.stopPropagation?.();
            void togglePause();
          }}
          style={st.control}
        >
          <Ionicons name={isPaused ? "play" : "pause"} size={17} color={C.blue} />
        </Pressable>
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 40,
  },
  dock: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
    backgroundColor: C.panel,
    shadowColor: C.blueDark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.13,
    shadowRadius: 18,
    elevation: 8,
  },
  dockPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  dockPulseSurface: { ...StyleSheet.absoluteFillObject, borderWidth: 1, borderColor: "rgba(0,108,229,0.24)", borderRadius: 20, backgroundColor: "#A9D6FF" },
  openControlWrap: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  openControl: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: C.blue },
  statusPulseRing: { position: "absolute", top: -3, right: -3, width: 17, height: 17, borderRadius: 9, backgroundColor: C.blue },
  statusDot: { position: "absolute", top: 0, right: 0, width: 11, height: 11, borderWidth: 2, borderColor: C.white, borderRadius: 6, backgroundColor: C.blue },
  statusDotPaused: { backgroundColor: C.muted },
  copy: { flex: 1, minWidth: 0, gap: 1 },
  title: { color: C.text, fontSize: 14, fontWeight: "900" },
  meta: { color: C.muted, fontSize: 11, fontWeight: "700" },
  control: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "rgba(255,255,255,0.72)",
  },
});
