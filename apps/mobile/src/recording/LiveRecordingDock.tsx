import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getLiquidGlassView } from "../components/liquid-glass";
import { formatElapsed } from "./formatElapsed";
import { liveSessionHeadline } from "./liveSessionLabel";
import { useRecording } from "./RecordingProvider";

const C = {
  panel: "#E7E9ED",
  artwork: "rgba(255,255,255,0.48)",
  text: "#17212B",
  muted: "#4B5665",
  blue: "#175CD3",
  paused: "#667085",
} as const;

/** A minimized recorder, not an audio playback player. Hiding it never stops audio. */
export function LiveRecordingDock({ resetKey, bottomInset }: { resetKey: string; bottomInset: number }) {
  const insets = useSafeAreaInsets();
  const GlassView = useMemo(() => getLiquidGlassView(), []);
  const [reduceTransparency, setReduceTransparency] = useState(true);
  const {
    isRecording, isPaused, elapsed, experienceVisible, liveMeta, localId,
    draft, expandExperience, togglePause,
  } = useRecording();
  const [dismissed, setDismissed] = useState(false);
  const [pausePending, setPausePending] = useState(false);
  const requestedPaused = useRef<boolean | null>(null);

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

  // A new tab or a freshly minimized tour brings the mini-player back.
  useEffect(() => {
    setDismissed(false);
  }, [resetKey, localId, experienceVisible]);

  useEffect(() => {
    if (!isRecording || requestedPaused.current === isPaused) {
      requestedPaused.current = null;
      setPausePending(false);
    }
  }, [isPaused, isRecording]);

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

  if (!isRecording || experienceVisible || !liveMeta || dismissed) return null;

  const guestName = draft?.participants.map((guest) => guest.name.trim()).filter(Boolean).join(", ")
    || draft?.prospect.trim()
    || liveMeta.prospectName?.trim();
  const headline = guestName || liveSessionHeadline(liveMeta);
  const status = isPaused ? "Recording paused" : "Recording live";

  return (
    <View pointerEvents="box-none" style={[st.wrap, { bottom: bottomInset > 0 ? bottomInset : insets.bottom }]}>
      <View style={st.dock}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {!reduceTransparency && GlassView ? (
            <GlassView
              glassEffectStyle="regular"
              colorScheme="light"
              tintColor="rgba(180,184,192,0.2)"
              borderRadius={0}
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
            <Ionicons name="mic" size={22} color={C.blue} />
          </View>
          <View style={st.copy}>
            <Text style={st.title} numberOfLines={1}>{headline}</Text>
            <View style={st.metaRow}>
              <View style={[st.statusDot, isPaused && st.statusDotPaused]} />
              <Text style={st.meta} numberOfLines={1}>{status}</Text>
              <Text style={st.elapsed}>{formatElapsed(elapsed)}</Text>
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
            <ActivityIndicator size="small" color="#175CD3" />
          ) : (
            <Ionicons name={isPaused ? "play" : "pause"} size={23} color="#175CD3" style={isPaused ? st.playIcon : undefined} />
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Hide live session bar"
          accessibilityHint="Recording continues. Switch tabs or open the live tour card to bring it back."
          onPress={() => setDismissed(true)}
          style={({ pressed }) => [st.dismiss, pressed && st.pressed]}
        >
          <Ionicons name="close" size={18} color={C.muted} />
        </Pressable>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, zIndex: 40 },
  dock: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 10,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    overflow: "hidden",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.8)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(23,33,43,0.12)",
  },
  opaqueSurface: { backgroundColor: C.panel },
  glassWash: { backgroundColor: "rgba(230,232,236,0.24)" },
  openArea: { flex: 1, minWidth: 0, minHeight: 64, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingRight: 8 },
  pressed: { opacity: 0.75 },
  artwork: { width: 44, height: 44, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: C.artwork },
  copy: { flex: 1, minWidth: 0, gap: 5 },
  title: { color: C.text, fontSize: 14, lineHeight: 19, fontWeight: "800" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  meta: { flexShrink: 1, color: C.muted, fontSize: 10, lineHeight: 15, fontWeight: "600" },
  elapsed: { color: C.text, fontSize: 11, lineHeight: 15, fontWeight: "700", fontVariant: ["tabular-nums"], marginLeft: 2 },
  statusDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.blue },
  statusDotPaused: { backgroundColor: C.paused },
  control: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.7)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.85)" },
  controlPressed: { transform: [{ scale: 0.94 }], opacity: 0.88 },
  pending: { opacity: 0.65 },
  playIcon: { marginLeft: 3 },
  dismiss: { width: 44, minHeight: 64, alignItems: "center", justifyContent: "center" },
});
