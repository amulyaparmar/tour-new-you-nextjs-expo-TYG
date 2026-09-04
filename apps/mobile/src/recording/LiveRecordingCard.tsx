import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { CustomText } from "../components/custom-text";
import { ACCENT, CARD, SMALL_CORNER } from "../theme/tokens";
import { formatElapsed } from "./formatElapsed";
import { liveSessionHeadline, liveSessionSubline } from "./liveSessionLabel";
import { useRecording } from "./RecordingProvider";

const C = {
  textSec: "#667085",
  textMuted: "#98A2B3",
  brandSoft: "#EAF4FF",
  red: "#D92D20",
  redSoft: "#FEF3F2",
} as const;

type LiveRecordingCardProps = {
  onPress?: () => void;
};

/** Tour-themed live session card for Home / Sessions while recording continues in the background. */
export function LiveRecordingCard({ onPress }: LiveRecordingCardProps) {
  const {
    isRecording,
    isPaused,
    elapsed,
    experienceVisible,
    liveMeta,
    transcriptPreview,
    expandExperience,
  } = useRecording();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isRecording || isPaused) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isPaused, isRecording, pulse]);

  if (!isRecording || experienceVisible || !liveMeta) return null;

  const headline = liveSessionHeadline(liveMeta);
  const subline = liveSessionSubline(liveMeta, formatElapsed(elapsed));
  const preview =
    transcriptPreview.trim() ||
    (isPaused
      ? "Recording paused. Tap to return to the live tour."
      : "When someone starts speaking, live updates will appear here.");
  const initials = headline
    .split(/\s*[×x]\s*|\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <Pressable
      accessibilityLabel="Open live recording"
      onPress={() => {
        onPress?.();
        expandExperience();
      }}
      style={({ pressed }) => [st.card, pressed && st.pressed]}
    >
      <View style={st.avatar}>
        {initials ? (
          <CustomText textStyle="title" style={st.avatarText}>{initials}</CustomText>
        ) : (
          <Ionicons name="mic" size={22} color={ACCENT} />
        )}
      </View>
      <View style={st.body}>
        <CustomText textStyle="title" numberOfLines={1}>
          {headline}
        </CustomText>
        <CustomText textStyle="label" numberOfLines={1} style={st.meta}>
          {subline}
        </CustomText>
        <CustomText textStyle="caption" numberOfLines={2} style={st.preview}>
          {preview}
        </CustomText>
        <View style={st.liveBadge}>
          <Animated.View style={[st.liveDot, { opacity: isPaused ? 1 : pulse }]} />
          <CustomText textStyle="micro" style={st.liveText}>{isPaused ? "PAUSED" : "LIVE"}</CustomText>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
    </Pressable>
  );
}

const st = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
    shadowColor: "#101828",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  pressed: { opacity: 0.92 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.brandSoft,
  },
  avatarText: { color: ACCENT, letterSpacing: 0.2 },
  body: { flex: 1, minWidth: 0, gap: 4 },
  meta: { color: C.textSec },
  preview: { color: C.textMuted, lineHeight: 18, marginTop: 2 },
  liveBadge: {
    alignSelf: "flex-start",
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: C.redSoft,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.red },
  liveText: { color: C.red, letterSpacing: 0.4 },
});
