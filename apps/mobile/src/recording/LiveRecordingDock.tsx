import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Alert, Animated, Platform, Pressable, StyleSheet, View } from "react-native";
import { CustomText } from "../components/custom-text";
import { getLiquidGlassView } from "../components/liquid-glass";
import { ACCENT, CARD, HINT, LARGE_CORNER } from "../theme/tokens";
import { tourColors as C } from "../theme/tour-brand";
import { formatElapsed } from "./formatElapsed";
import { liveSessionHeadline } from "./liveSessionLabel";
import { useRecording } from "./RecordingProvider";

/** Lives in the tab-bar stack so covering screens hide it with the nav bar. */
export function LiveRecordingDock() {
  const GlassView = useMemo(() => getLiquidGlassView(), []);
  const [reduceTransparency, setReduceTransparency] = useState(false);
  const {
    isRecording, isPaused, elapsed, experienceVisible, liveMeta,
    draft, expandExperience, togglePause,
  } = useRecording();
  const [pausePending, setPausePending] = useState(false);
  const requestedPaused = useRef<boolean | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;
  const cardVisible = isRecording && Boolean(liveMeta);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let active = true;
    let preferenceChanged = false;
    void AccessibilityInfo.isReduceTransparencyEnabled()
      .then((enabled) => {
        if (active && !preferenceChanged) setReduceTransparency(enabled);
      })
      .catch(() => { /* Keep the opaque, accessible fallback. */ });
    const subscription = AccessibilityInfo.addEventListener("reduceTransparencyChanged", (enabled) => {
      preferenceChanged = true;
      setReduceTransparency(enabled);
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!isRecording || requestedPaused.current === isPaused) {
      requestedPaused.current = null;
      setPausePending(false);
    }
  }, [isPaused, isRecording]);

  useEffect(() => {
    pulse.stopAnimation();
    pulse.setValue(1);
    if (!cardVisible || isPaused) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.28, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      pulse.stopAnimation();
    };
  }, [cardVisible, isPaused, pulse]);

  async function handlePause() {
    if (requestedPaused.current !== null || !isRecording) return;
    requestedPaused.current = !isPaused;
    setPausePending(true);
    try {
      // Keep the guard until the provider confirms its new state on render.
      // This prevents repeated resume taps from creating duplicate timers.
      await togglePause();
    } catch {
      requestedPaused.current = null;
      setPausePending(false);
      Alert.alert("Recording control unavailable", "Open the live tour to check the recording and try again.");
    }
  }

  if (!isRecording || !liveMeta) return null;

  const guestName = draft?.participants.map((guest) => guest.name.trim()).filter(Boolean).join(", ")
    || draft?.prospect.trim()
    || liveMeta.prospectName?.trim();
  const headline = guestName || liveSessionHeadline(liveMeta);
  const status = isPaused ? "Recording paused" : "Recording live";

  return (
    <View
      pointerEvents={experienceVisible ? "none" : "box-none"}
      accessibilityElementsHidden={experienceVisible}
      importantForAccessibility={experienceVisible ? "no-hide-descendants" : "auto"}
      style={st.dock}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          st.accentBar,
          isPaused && st.accentBarPaused,
          { opacity: isPaused ? 1 : pulse },
        ]}
      />
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {!reduceTransparency && GlassView ? (
          <GlassView
            glassEffectStyle="regular"
            colorScheme="light"
            tintColor="rgba(180,184,192,0.22)"
            borderRadius={LARGE_CORNER}
            style={StyleSheet.absoluteFill}
          />
        ) : !reduceTransparency && Platform.OS === "ios" ? (
          <BlurView tint="systemThinMaterialLight" intensity={80} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, st.opaqueSurface]} />
        )}
        {!reduceTransparency ? <View style={[StyleSheet.absoluteFill, st.glassWash]} /> : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open live tour with ${headline}`}
        accessibilityHint="Return to the full recording screen"
        onPress={expandExperience}
        style={({ pressed }) => [st.openArea, pressed && st.pressed]}
      >
        <View style={st.artwork}>
          <Ionicons name="mic" size={22} color={ACCENT} />
        </View>
        <View style={st.copy}>
          <CustomText textStyle="title" style={st.title} numberOfLines={1}>{headline}</CustomText>
          <View style={st.metaRow}>
            <View style={[st.statusDot, isPaused && st.statusDotPaused]} />
            <CustomText textStyle="caption" style={st.meta} numberOfLines={1}>{status}</CustomText>
            <CustomText textStyle="micro" style={st.elapsed}>{formatElapsed(elapsed)}</CustomText>
          </View>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isPaused ? "Resume recording" : "Pause recording"}
        accessibilityState={{ disabled: pausePending, busy: pausePending }}
        disabled={pausePending}
        onPress={() => void handlePause()}
        style={({ pressed }) => [st.control, pressed && st.controlPressed, pausePending && st.pending]}
      >
        {pausePending ? (
          <ActivityIndicator size="small" color={CARD} />
        ) : (
          <Ionicons name={isPaused ? "play" : "pause"} size={20} color={CARD} style={isPaused ? st.playIcon : undefined} />
        )}
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  dock: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
    marginBottom: 12,
    paddingLeft: 12,
    paddingRight: 12,
    borderRadius: LARGE_CORNER,
    borderCurve: "continuous",
    overflow: "hidden",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  accentBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    height: 3,
    backgroundColor: ACCENT,
  },
  accentBarPaused: {
    backgroundColor: C.textMuted,
  },
  opaqueSurface: { backgroundColor: "rgba(231,233,237,0.92)" },
  glassWash: { backgroundColor: "rgba(230,232,236,0.24)" },
  openArea: { flex: 1, minWidth: 0, minHeight: 76, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingRight: 8 },
  pressed: { opacity: 0.75 },
  artwork: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: HINT,
  },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  title: { lineHeight: 22 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  meta: { flexShrink: 1, color: C.textSec },
  elapsed: { color: C.text, fontVariant: ["tabular-nums"], marginLeft: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ACCENT },
  statusDotPaused: { backgroundColor: C.textSec },
  control: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ACCENT,
  },
  controlPressed: { transform: [{ scale: 0.94 }], opacity: 0.88 },
  pending: { opacity: 0.65 },
  playIcon: { marginLeft: 2 },
});
