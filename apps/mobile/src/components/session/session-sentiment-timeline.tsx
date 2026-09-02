import { Ionicons } from "@expo/vector-icons";
import type {
  AudioConversationStats,
  AudioEmotion,
  AudioEnergy,
  AudioInsightSegment,
  AudioSentiment,
} from "@tour/shared";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { SESSION_PAGE_PADDING } from "./session-layout";

type TranscriptSegmentLike = {
  id: string;
  startTime: number;
  endTime: number;
};

function formatDuration(seconds: number) {
  const wholeSeconds = Math.max(0, Math.round(seconds));
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, "0")}`;
}

function prospectTalkTime(stats: AudioConversationStats) {
  const repRatio = Math.max(0, Math.min(100, stats.talkRatioPercent)) / 100;
  if (repRatio <= 0 || repRatio >= 1) return null;
  return (stats.repTalkTimeSeconds * (1 - repRatio)) / repRatio;
}

const TONE_PRESENTATION: Record<AudioSentiment, {
  label: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = {
  positive: { label: "Positive", color: "#16a34a", icon: "happy-outline" },
  neutral: { label: "Neutral", color: "#667085", icon: "ellipse-outline" },
  negative: { label: "Negative", color: "#dc2626", icon: "sad-outline" },
  mixed: { label: "Mixed", color: "#d97706", icon: "swap-horizontal-outline" },
};

export function matchAudioInsightsToTranscript(
  transcript: TranscriptSegmentLike[],
  audioSegments: AudioInsightSegment[] | undefined,
) {
  const resolved = new Map<string, AudioInsightSegment>();
  if (!audioSegments?.length) return resolved;

  for (const transcriptSegment of transcript) {
    const center = (transcriptSegment.startTime + transcriptSegment.endTime) / 2;
    let match: AudioInsightSegment | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const audioSegment of audioSegments) {
      const overlaps =
        audioSegment.startTime <= transcriptSegment.endTime
        && audioSegment.endTime >= transcriptSegment.startTime;
      const nearby = Math.abs(audioSegment.startTime - transcriptSegment.startTime) <= 4;
      if (!overlaps && !nearby) continue;

      const distance = Math.abs(((audioSegment.startTime + audioSegment.endTime) / 2) - center);
      if (distance < bestDistance) {
        bestDistance = distance;
        match = audioSegment;
      }
    }

    if (match) resolved.set(transcriptSegment.id, match);
  }

  return resolved;
}

export function emotionColor(emotion: AudioEmotion) {
  return {
    happy: "#16a34a",
    excited: "#2563eb",
    concerned: "#d97706",
    sad: "#64748b",
    angry: "#dc2626",
    neutral: "#98a2b3",
  }[emotion];
}

const EMOTION_ICONS: Record<AudioEmotion, keyof typeof Ionicons.glyphMap> = {
  happy: "happy-outline",
  excited: "sparkles-outline",
  concerned: "help-circle-outline",
  sad: "sad-outline",
  angry: "flame-outline",
  neutral: "ellipse-outline",
};

export function emotionIcon(emotion: AudioEmotion) {
  return EMOTION_ICONS[emotion];
}

export function emotionAccessibilityLabel(emotion: AudioEmotion, energy: AudioEnergy) {
  const title = `${emotion[0]!.toUpperCase()}${emotion.slice(1)}`;
  return energy === "high" ? `${title}, high energy` : title;
}

export function SessionSentimentTimeline({
  segments,
  overallSentiment = null,
  conversationStats = null,
  duration,
  currentTime,
  onPress,
}: {
  segments: AudioInsightSegment[];
  overallSentiment?: AudioSentiment | null;
  conversationStats?: AudioConversationStats | null;
  duration: number;
  currentTime: number;
  onPress: () => void;
}) {
  const timelineDuration = useMemo(
    () => Math.max(duration, ...segments.map((segment) => segment.endTime), 0),
    [duration, segments],
  );

  if (!segments.length || timelineDuration <= 0) return null;

  const progress = Math.min(100, Math.max(0, (currentTime / timelineDuration) * 100));
  const tone = overallSentiment ? TONE_PRESENTATION[overallSentiment] : null;
  const prospectSeconds = conversationStats ? prospectTalkTime(conversationStats) : null;
  const engagementMetrics = conversationStats
    ? [
        {
          label: "Interactivity",
          value: `${conversationStats.interactivityScore}/${conversationStats.interactivityTotal}`,
        },
        ...(prospectSeconds !== null ? [{ label: "Prospect talk", value: formatDuration(prospectSeconds) }] : []),
      ]
    : [];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open emotion and sentiment timeline"
      onPress={onPress}
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.label}>Conversation tone</Text>
          {tone ? (
            <View style={styles.toneSummary}>
              <View style={[styles.toneDot, { backgroundColor: tone.color }]} />
              <Ionicons name={tone.icon} size={13} color={tone.color} />
              <Text style={[styles.toneText, { color: tone.color }]}>{tone.label}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.details}>
          <Text style={styles.detailsText}>Audio details</Text>
          <Ionicons name="chevron-forward" size={13} color="#667085" />
        </View>
      </View>
      <View style={styles.track} accessibilityLabel="Line-by-line tone across the recording">
        <SentimentSegments segments={segments} duration={timelineDuration} />
        {duration > 0 ? <View style={[styles.playhead, { left: `${progress}%` }]} /> : null}
      </View>
      {engagementMetrics.length > 0 ? (
        <View style={styles.metrics} accessibilityLabel="Conversation engagement metrics">
          {engagementMetrics.map((metric) => (
            <View key={metric.label} style={styles.metric}>
              <Text style={styles.metricLabel}>{metric.label}</Text>
              <Text style={styles.metricValue}>{metric.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

function SentimentSegments({ segments, duration }: { segments: AudioInsightSegment[]; duration: number }) {
  return segments.map((segment, index) => {
    const left = (segment.startTime / duration) * 100;
    const width = Math.max(((segment.endTime - segment.startTime) / duration) * 100, 0.9);
    return (
      <View
        key={`${segment.startTime}-${segment.endTime}-${index}`}
        style={[
          styles.segment,
          {
            left: `${Math.min(100, Math.max(0, left))}%`,
            width: `${Math.min(100 - left, width)}%`,
            backgroundColor: emotionColor(segment.emotion),
          },
        ]}
      />
    );
  });
}

const styles = StyleSheet.create({
  root: { gap: 6, marginHorizontal: SESSION_PAGE_PADDING, marginBottom: 10 },
  pressed: { opacity: 0.72 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  label: { color: "#667085", fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  toneSummary: { flexDirection: "row", alignItems: "center", gap: 3 },
  toneDot: { width: 5, height: 5, borderRadius: 999 },
  toneText: { fontSize: 10, fontWeight: "900" },
  details: { flexDirection: "row", alignItems: "center", gap: 1 },
  detailsText: { color: "#667085", fontSize: 10, fontWeight: "800" },
  track: { position: "relative", height: 6, overflow: "hidden", borderRadius: 999, backgroundColor: "#e9eef5" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingTop: 1 },
  metric: { flexDirection: "row", alignItems: "center", gap: 4 },
  metricLabel: { color: "#8a94a6", fontSize: 9, fontWeight: "800" },
  metricValue: { color: "#475467", fontSize: 10, fontWeight: "900", fontVariant: ["tabular-nums"] },
  segment: { position: "absolute", top: 0, bottom: 0, minWidth: 2 },
  playhead: { position: "absolute", top: -2, bottom: -2, width: 2, marginLeft: -1, borderRadius: 999, backgroundColor: "#101828" },
});
