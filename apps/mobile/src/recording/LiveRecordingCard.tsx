import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { CustomText } from "../components/custom-text";
import { ACCENT, CARD, SMALL_CORNER } from "../theme/tokens";
import { formatElapsed } from "./formatElapsed";
import { liveSessionHeadline } from "./liveSessionLabel";
import { useRecording } from "./RecordingProvider";

const C = {
  textSec: "#667085",
  text: "#102C48",
  brandSoft: "#F3F8FF",
  border: "#DCEBFC",
} as const;

type LiveRecordingCardProps = {
  onPress?: () => void;
};

/** Compact entry back into the ongoing tour, including when its floating player is hidden. */
export function LiveRecordingCard({ onPress }: LiveRecordingCardProps) {
  const {
    isRecording,
    isPaused,
    elapsed,
    experienceVisible,
    liveMeta,
    draft,
    expandExperience,
  } = useRecording();
  const pulse = useRef(new Animated.Value(1)).current;
  const cardVisible = isRecording && !experienceVisible && Boolean(liveMeta);

  useEffect(() => {
    pulse.stopAnimation();
    pulse.setValue(1);
    if (!cardVisible || isPaused) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.6, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      pulse.stopAnimation();
    };
  }, [cardVisible, isPaused, pulse]);

  if (!cardVisible || !liveMeta) return null;

  const headline = draft?.participants.map((guest) => guest.name.trim()).filter(Boolean).join(", ")
    || draft?.prospect.trim()
    || liveMeta.prospectName?.trim()
    || liveSessionHeadline(liveMeta);
  const elapsedLabel = formatElapsed(elapsed);
  const statusLabel = isPaused ? "Paused" : "Recording";
  const initials = headline
    .split(/\s+/)
    .filter((part) => part && part !== "×" && part !== "x")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open tour with ${headline}. ${statusLabel}. ${elapsedLabel} elapsed.`}
      accessibilityHint="Expand the ongoing tour and recording controls"
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
          <Ionicons name="mic-outline" size={19} color={ACCENT} />
        )}
      </View>
      <View style={st.body}>
        <CustomText textStyle="title" numberOfLines={1} style={st.headline}>
          {headline}
        </CustomText>
        <View style={st.statusRow}>
          <Animated.View style={[st.liveDot, isPaused && st.pausedDot, { opacity: isPaused ? 1 : pulse }]} />
          <CustomText textStyle="caption" style={st.statusText}>{statusLabel}</CustomText>
          <CustomText textStyle="caption" style={st.separator}>·</CustomText>
          <CustomText textStyle="label" style={st.elapsed}>{elapsedLabel}</CustomText>
        </View>
      </View>
      <View style={st.expandAffordance}>
        <Ionicons name="expand-outline" size={18} color={ACCENT} />
      </View>
    </Pressable>
  );
}

const st = StyleSheet.create({
  card: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: C.brandSoft,
  },
  pressed: { opacity: 0.92 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: CARD,
  },
  avatarText: { color: ACCENT, fontSize: 14, letterSpacing: 0.2 },
  body: { flex: 1, minWidth: 0, gap: 4 },
  headline: { color: C.text, lineHeight: 22 },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ACCENT },
  pausedDot: { backgroundColor: C.textSec },
  statusText: { color: C.textSec },
  separator: { color: C.textSec, marginHorizontal: 1 },
  elapsed: { color: C.text, fontVariant: ["tabular-nums"] },
  expandAffordance: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: CARD,
  },
});
