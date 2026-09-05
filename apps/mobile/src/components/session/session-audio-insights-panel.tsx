import type {
  AudioConversationStats,
  AudioInsights,
  TranscriptConversationStats,
} from "@tour/shared";
import { formatSpeakerAnnotation } from "@tour/shared";
import { Activity, BarChart3, Mic2, Sparkles } from "lucide-react-native";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { CustomText } from "@/components/custom-text";
import { Icon } from "@/components/ui/icon";
import { ACCENT, BACKGROUND, CARD, SMALL_CORNER } from "@/theme/tokens";
import { tourColors as C } from "@/theme/tour-brand";

import { SESSION_PAGE_PADDING } from "./session-layout";

const SENTIMENT_LABELS = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
  mixed: "Mixed",
} as const;

const SENTIMENT_COLORS = {
  positive: "#16a34a",
  neutral: "#667085",
  negative: "#dc2626",
  mixed: "#d97706",
} as const;

function fmtSec(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function SessionAudioInsightsPanel({
  insights,
  fallbackConversationStats = null,
  fallbackConversationStatsSource = null,
  onSeek,
  contentInsetTop = 8,
}: {
  insights: AudioInsights;
  fallbackConversationStats?: TranscriptConversationStats | null;
  fallbackConversationStatsSource?: "transcript" | null;
  onSeek: (seconds: number) => void;
  contentInsetTop?: number;
}) {
  const participants = insights.participants;
  const conversationStats =
    insights.conversationStats ?? fallbackConversationStats;
  const conversationStatsSource = insights.conversationStats
    ? "gemini"
    : fallbackConversationStatsSource;
  const labelFor = (speaker: string) =>
    participants ? formatSpeakerAnnotation(speaker, participants) : speaker;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.content, { paddingTop: contentInsetTop }]}
    >
      <View style={styles.section}>
        <View style={styles.headerRow}>
          <CustomText textStyle="title">Overview</CustomText>
          <View
            style={[
              styles.sentimentBadge,
              { backgroundColor: `${SENTIMENT_COLORS[insights.overallSentiment]}18` },
            ]}
          >
            <CustomText
              textStyle="micro"
              style={{ color: SENTIMENT_COLORS[insights.overallSentiment] }}
            >
              {SENTIMENT_LABELS[insights.overallSentiment]}
            </CustomText>
          </View>
        </View>

        <CustomText textStyle="body" style={styles.summary}>{insights.summary}</CustomText>

        <View style={styles.metaRow}>
          <MetaPill icon={Sparkles} label={insights.model.replace("gemini-", "Gemini ")} />
          <MetaPill icon={Mic2} label={`${insights.segments.length} segments`} />
        </View>
      </View>

      {conversationStats ? (
        <ConversationStatsSection
          stats={conversationStats}
          source={conversationStatsSource}
        />
      ) : null}

      {insights.speakerDynamics.length > 0 ? (
        <Section title="Speaker dynamics" icon={Activity}>
          <View style={styles.speakerList}>
            {insights.speakerDynamics.map((speaker) => {
              const total = insights.speakerDynamics.reduce((sum, item) => sum + item.talkTimeSeconds, 0);
              const share = total > 0 ? Math.round((speaker.talkTimeSeconds / total) * 100) : 0;
              return (
                <View key={speaker.speaker} style={styles.speakerCard}>
                  <View style={styles.speakerHead}>
                    <CustomText textStyle="label" style={styles.speakerName}>{labelFor(speaker.speaker)}</CustomText>
                    <CustomText textStyle="caption" style={styles.speakerTime}>{fmtSec(speaker.talkTimeSeconds)}</CustomText>
                  </View>
                  <View style={styles.talkTrack}>
                    <View style={[styles.talkFill, { width: `${share}%` }]} />
                  </View>
                  <CustomText textStyle="caption" style={styles.speakerNotes}>{speaker.notes}</CustomText>
                </View>
              );
            })}
          </View>
        </Section>
      ) : null}

      {insights.highlights.length > 0 ? (
        <Section title="Highlights" icon={Sparkles}>
          <View style={styles.highlightList}>
            {insights.highlights.map((highlight) => (
              <Pressable
                key={`${highlight.timestamp}-${highlight.label}`}
                onPress={() => onSeek(highlight.timestamp)}
                style={styles.highlightCard}
              >
                <View style={styles.highlightHead}>
                  <CustomText textStyle="label" style={styles.highlightLabel}>{highlight.label}</CustomText>
                  <CustomText textStyle="caption" style={styles.highlightTime}>{fmtSec(highlight.timestamp)}</CustomText>
                </View>
                <CustomText textStyle="caption" style={styles.highlightBody}>{highlight.explanation}</CustomText>
              </Pressable>
            ))}
          </View>
        </Section>
      ) : null}
    </ScrollView>
  );
}

export function ConversationStatsSection({
  stats,
  source,
}: {
  stats: AudioConversationStats | TranscriptConversationStats;
  source: "gemini" | "transcript" | null;
}) {
  const items = [
    {
      label: "Talk ratio",
      value: stats.talkRatioPercent == null
        ? null
        : `${Math.round(stats.talkRatioPercent)}%`,
    },
    {
      label: "Rep talk time",
      value: stats.repTalkTimeSeconds == null
        ? null
        : fmtSec(stats.repTalkTimeSeconds),
    },
    {
      label: "Longest prospect",
      value: stats.longestProspectTalkSeconds == null
        ? null
        : fmtSec(stats.longestProspectTalkSeconds),
    },
    {
      label: "Longest talk",
      value: stats.longestTalkSeconds == null
        ? null
        : fmtSec(stats.longestTalkSeconds),
    },
    {
      label: "Patience",
      value: stats.patienceSeconds == null
        ? null
        : `${stats.patienceSeconds.toFixed(1)}s`,
    },
    {
      label: "Talk speed",
      value: stats.talkSpeedWordsPerMinute == null
        ? null
        : `${Math.round(stats.talkSpeedWordsPerMinute)} wpm`,
    },
    {
      label: "Interactivity",
      value: isGeminiConversationStats(stats)
        ? `${stats.interactivityScore}/${stats.interactivityTotal}`
        : null,
    },
  ].filter((item): item is { label: string; value: string } =>
    item.value !== null
  );

  return (
    <Section title="Conversation stats" icon={BarChart3}>
      <View style={styles.statsGrid}>
        {items.map((item) => (
          <Stat key={item.label} label={item.label} value={item.value} />
        ))}
      </View>
      <CustomText textStyle="caption" style={styles.statsSource}>
        {source === "transcript"
          ? "Transcript estimate · Gemini may replace these measurements after listening to the recording."
          : "Measured by Gemini from the recording."}
      </CustomText>
    </Section>
  );
}

function isGeminiConversationStats(
  stats: AudioConversationStats | TranscriptConversationStats,
): stats is AudioConversationStats {
  return "interactivityScore" in stats;
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: typeof Activity;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <View style={styles.section}>
      <Pressable onPress={() => setOpen((value) => !value)} style={styles.sectionHead}>
        <Icon as={icon} size={15} color={C.textSec} />
        <CustomText textStyle="title" style={styles.sectionTitle}>{title}</CustomText>
        <CustomText textStyle="caption" style={styles.sectionToggle}>{open ? "Hide" : "Show"}</CustomText>
      </Pressable>
      {open ? children : null}
    </View>
  );
}

function MetaPill({ icon, label }: { icon: typeof Sparkles; label: string }) {
  return (
    <View style={styles.metaPill}>
      <Icon as={icon} size={12} color={C.textSec} />
      <CustomText textStyle="caption" style={styles.metaPillText}>{label}</CustomText>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <CustomText textStyle="micro" style={styles.statLabel}>{label}</CustomText>
      <CustomText textStyle="title" style={styles.statValue}>{value}</CustomText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
    paddingHorizontal: SESSION_PAGE_PADDING,
    paddingTop: 8,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  sentimentBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  summary: {
    lineHeight: 21,
    color: C.textSec,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: BACKGROUND,
  },
  metaPillText: {
    color: C.textSec,
  },
  section: {
    gap: 10,
    padding: 14,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    flex: 1,
  },
  sectionToggle: {
    color: C.textSec,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statCard: {
    width: "48%",
    gap: 2,
    padding: 10,
    borderRadius: 12,
    backgroundColor: BACKGROUND,
  },
  statLabel: {
    textTransform: "uppercase",
    color: C.textSec,
  },
  statValue: {
    fontVariant: ["tabular-nums"],
  },
  statsSource: {
    lineHeight: 16,
    color: C.textSec,
  },
  speakerList: {
    gap: 10,
  },
  speakerCard: {
    gap: 6,
    padding: 10,
    borderRadius: 12,
    backgroundColor: BACKGROUND,
  },
  speakerHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  speakerName: {
    flex: 1,
  },
  speakerTime: {
    color: C.textSec,
    fontVariant: ["tabular-nums"],
  },
  talkTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: "#e8edf5",
    overflow: "hidden",
  },
  talkFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: ACCENT,
  },
  speakerNotes: {
    lineHeight: 17,
    color: C.textSec,
  },
  highlightList: {
    gap: 8,
  },
  highlightCard: {
    gap: 4,
    padding: 10,
    borderRadius: 12,
    backgroundColor: BACKGROUND,
  },
  highlightHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  highlightLabel: {
    flex: 1,
  },
  highlightTime: {
    color: ACCENT,
    fontVariant: ["tabular-nums"],
  },
  highlightBody: {
    lineHeight: 17,
    color: C.textSec,
  },
});
