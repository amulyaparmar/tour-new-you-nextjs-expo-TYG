import type { AnalysisResult, AudioInsights, AudioInsightsStatus } from "@tour/shared";
import { AUDIO_INSIGHTS_STATUS_LABELS } from "@tour/shared";
import { Activity, ChevronRight, MessageSquare } from "lucide-react-native";
import React from "react";
import { StyleSheet, View } from "react-native";
import Reanimated, { FadeInDown } from "react-native-reanimated";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

import { MotionPressable } from "../ui/motion";
import { SESSION_PAGE_PADDING, SESSION_SECTION_GAP } from "./session-layout";

const SENTIMENT_LABELS = {
  positive: "Positive tone",
  neutral: "Neutral tone",
  negative: "Negative tone",
  mixed: "Mixed tone",
} as const;

export function SessionInsightCards({
  analysis,
  audioInsightsStatus,
  audioInsights,
  onOpenAiChat,
  onOpenAudioInsights,
}: {
  analysis: AnalysisResult;
  audioInsightsStatus: AudioInsightsStatus;
  audioInsights: AudioInsights | null;
  onOpenAiChat: () => void;
  onOpenAudioInsights: () => void;
}) {
  const aiPreview =
    analysis.opportunities[0] ??
    analysis.strengths[0] ??
    analysis.summary;

  const audioPreview =
    audioInsights?.summary ??
    (audioInsightsStatus === "ready"
      ? "Audio analysis is ready."
      : AUDIO_INSIGHTS_STATUS_LABELS[audioInsightsStatus]);

  const audioBadge =
    audioInsights?.overallSentiment != null
      ? SENTIMENT_LABELS[audioInsights.overallSentiment]
      : AUDIO_INSIGHTS_STATUS_LABELS[audioInsightsStatus];

  return (
    <Reanimated.View entering={FadeInDown.delay(40).duration(320).springify()} style={styles.stack}>
      <InsightCard
        title="Tour AI"
        subtitle="Ask about this tour"
        preview={aiPreview}
        badge="Coaching chat"
        icon={MessageSquare}
        iconColor="#006ce5"
        iconBg="#eff6ff"
        borderColor="#bfdbfe"
        onPress={onOpenAiChat}
      />
      <InsightCard
        title="Audio insights"
        subtitle="Sentiment & speaker dynamics"
        preview={audioPreview}
        badge={audioBadge}
        icon={Activity}
        iconColor="#006ce5"
        iconBg="#eff6ff"
        borderColor="#bfdbfe"
        onPress={onOpenAudioInsights}
        processing={audioInsightsStatus === "pending" || audioInsightsStatus === "processing"}
      />
    </Reanimated.View>
  );
}

function InsightCard({
  title,
  subtitle,
  preview,
  badge,
  icon,
  iconColor,
  iconBg,
  borderColor,
  onPress,
  processing = false,
}: {
  title: string;
  subtitle: string;
  preview: string;
  badge: string;
  icon: typeof MessageSquare;
  iconColor: string;
  iconBg: string;
  borderColor: string;
  onPress: () => void;
  processing?: boolean;
}) {
  return (
    <MotionPressable onPress={onPress} haptic="selection" style={styles.cardPress}>
      <View style={[styles.card, { borderColor }]}>
        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
          <Icon as={icon} size={18} color={iconColor} />
        </View>
        <View style={styles.copy}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{title}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{processing ? "Analyzing…" : badge}</Text>
            </View>
          </View>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <Text style={styles.preview} numberOfLines={2}>
            {preview}
          </Text>
        </View>
        <Icon as={ChevronRight} size={18} color="#8a94a6" />
      </View>
    </MotionPressable>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: SESSION_SECTION_GAP,
    paddingHorizontal: SESSION_PAGE_PADDING,
    paddingBottom: 12,
  },
  cardPress: {
    alignSelf: "stretch",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: "#fff",
  },
  iconWrap: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: "900",
    color: "#101828",
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "#f4f7fb",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#667085",
  },
  subtitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#667085",
  },
  preview: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: "#344054",
    marginTop: 2,
  },
});
