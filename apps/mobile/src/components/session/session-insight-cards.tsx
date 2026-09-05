import type {
  AnalysisResult,
  AudioInsights,
  AudioInsightsStatus,
} from "@tour/shared";
import { AUDIO_INSIGHTS_STATUS_LABELS } from "@tour/shared";
import { Activity, ChevronRight, Sparkles } from "lucide-react-native";
import React from "react";
import { StyleSheet, View } from "react-native";
import Reanimated, { FadeInDown } from "react-native-reanimated";

import { CustomText } from "@/components/custom-text";
import { Icon } from "@/components/ui/icon";
import { BACKGROUND, CARD, SMALL_CORNER } from "@/theme/tokens";
import { tourColors as C } from "@/theme/tour-brand";

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
    analysis.opportunities[0] ?? analysis.strengths[0] ?? analysis.summary;

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
    <Reanimated.View
      entering={FadeInDown.delay(40).duration(320).springify()}
      style={styles.stack}
    >
      <InsightCard
        title="Tour AI"
        subtitle="Ask about this tour"
        preview={aiPreview}
        badge="Coaching chat"
        icon={Sparkles}
        iconColor={C.purple}
        iconBg={C.purpleBg}
        onPress={onOpenAiChat}
      />
      <InsightCard
        title="Audio insights"
        subtitle="Sentiment & speaker dynamics"
        preview={audioPreview}
        badge={audioBadge}
        icon={Activity}
        iconColor={C.brand}
        iconBg="#eff6ff"
        onPress={onOpenAudioInsights}
        processing={
          audioInsightsStatus === "pending" ||
          audioInsightsStatus === "processing"
        }
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
  onPress,
  processing = false,
}: {
  title: string;
  subtitle: string;
  preview: string;
  badge: string;
  icon: typeof Sparkles;
  iconColor: string;
  iconBg: string;
  onPress: () => void;
  processing?: boolean;
}) {
  return (
    <MotionPressable onPress={onPress} haptic="selection" style={styles.cardPress}>
      <View style={styles.card}>
        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
          <Icon as={icon} size={18} color={iconColor} />
        </View>
        <View style={styles.copy}>
          <View style={styles.titleRow}>
            <CustomText textStyle="title">{title}</CustomText>
            <View style={styles.badge}>
              <CustomText textStyle="micro" style={styles.badgeText}>
                {processing ? "Analyzing…" : badge}
              </CustomText>
            </View>
          </View>
          <CustomText textStyle="caption" style={styles.subtitle}>
            {subtitle}
          </CustomText>
          <CustomText textStyle="body" style={styles.preview} numberOfLines={2}>
            {preview}
          </CustomText>
        </View>
        <Icon as={ChevronRight} size={18} color={C.textMuted} />
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
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
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
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: BACKGROUND,
  },
  badgeText: {
    color: C.textSec,
  },
  subtitle: {
    color: C.textSec,
  },
  preview: {
    lineHeight: 18,
    color: C.textSec,
    marginTop: 2,
  },
});
