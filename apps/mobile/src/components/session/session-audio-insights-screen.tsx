import type {
  AudioInsights,
  AudioInsightsStatus,
  TranscriptConversationStats,
} from "@tour/shared";
import {
  AUDIO_INSIGHTS_STATUS_LABELS,
  calculateTranscriptConversationStats,
} from "@tour/shared";
import { Activity, RefreshCw } from "lucide-react-native";
import React, { useMemo } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { Icon } from "@/components/ui/icon";
import { LoadingDots } from "@/components/loading-dots";
import { Text } from "@/components/ui/text";
import { useSessionPlayback } from "@/hooks/use-session-playback";
import {
  useAudioInsightsQuery,
  useStartAudioInsightsMutation,
  useTranscriptQuery,
} from "@/queries";

import {
  ConversationStatsSection,
  SessionAudioInsightsPanel,
} from "./session-audio-insights-panel";
import { SessionPlayer } from "./session-player";
import { TourScreenHeader } from "./tour-screen-header";

const POLLING = new Set<AudioInsightsStatus>(["processing"]);

export function SessionAudioInsightsScreen({
  sessionId,
  sessionTitle,
  initialStatus = "pending",
  initialInsights = null,
  onBack,
  onOpenAudioChat,
}: {
  sessionId: string;
  sessionTitle?: string;
  initialStatus?: AudioInsightsStatus;
  initialInsights?: AudioInsights | null;
  onBack: () => void;
  onOpenAudioChat?: () => void;
}) {
  const audioInsightsQuery = useAudioInsightsQuery(sessionId);
  const transcriptQuery = useTranscriptQuery(sessionId);
  const startMutation = useStartAudioInsightsMutation(sessionId);
  const playback = useSessionPlayback(sessionId);
  const status = audioInsightsQuery.data?.status ?? initialStatus;
  const insights = audioInsightsQuery.data?.insights ?? initialInsights;
  const error = audioInsightsQuery.data?.error
    ?? (audioInsightsQuery.error instanceof Error ? audioInsightsQuery.error.message : null)
    ?? (startMutation.error instanceof Error ? startMutation.error.message : null);
  const starting = startMutation.isPending;
  const transcriptConversationStats = useMemo<TranscriptConversationStats | null>(() => {
    const transcript = transcriptQuery.data?.transcript;
    return transcript?.length ? calculateTranscriptConversationStats(transcript) : null;
  }, [transcriptQuery.data?.transcript]);

  const conversationStats =
    insights?.conversationStats ?? transcriptConversationStats;
  const conversationStatsSource = insights?.conversationStats
    ? "gemini"
    : transcriptConversationStats
      ? "transcript"
      : null;

  async function handleStart() {
    try {
      await startMutation.mutateAsync();
    } catch {
      // The mutation error is rendered from the shared query state.
    }
  }

  return (
    <View style={styles.root}>
      <TourScreenHeader onBack={onBack} title={sessionTitle ?? "Audio details"} subtitle="Engagement, tone, and speaker dynamics" />

      {status === "ready" && insights ? (
        <>
          <SessionAudioInsightsPanel
            insights={insights}
            fallbackConversationStats={transcriptConversationStats}
            fallbackConversationStatsSource={transcriptConversationStats ? "transcript" : null}
            onSeek={(seconds) => void playback.seekToSeconds(seconds, true)}
            onAskAudio={onOpenAudioChat}
          />
          <SessionPlayer
            position={playback.position}
            duration={playback.duration}
            playing={playback.playing}
            speed={playback.speed}
            ready={playback.ready}
            progressPercent={playback.progressPercent}
            onToggle={() => void playback.togglePlayback()}
            onSpeed={() => void playback.changeSpeed()}
            onSeek={(ratio) => void playback.seekToSeconds(ratio * playback.duration)}
          />
          {playback.error ? (
            <Pressable onPress={playback.retry} style={styles.retryAudio}>
              <Text style={styles.retryAudioText}>{playback.error} · Tap to retry</Text>
            </Pressable>
          ) : null}
        </>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.enrichmentBody}
        >
          {conversationStats ? (
            <ConversationStatsSection
              stats={conversationStats}
              source={conversationStatsSource}
            />
          ) : null}
          <View style={[styles.empty, conversationStats ? styles.emptyCompact : null]}>
            {POLLING.has(status) ? (
              <>
                <LoadingDots size="large" color="#006ce5" />
                <Text style={styles.emptyTitle}>{AUDIO_INSIGHTS_STATUS_LABELS[status]}</Text>
                <Text style={styles.emptyHint}>
                  Gemini is adding sentiment, speaker dynamics, ambience, and semantic interactivity.
                </Text>
              </>
            ) : (
              <>
                <Icon as={Activity} size={28} color="#667085" />
                <Text style={styles.emptyTitle}>
                  {status === "failed"
                    ? "Gemini enrichment could not be generated"
                    : status === "unavailable"
                      ? "Gemini enrichment is not configured"
                      : "No Gemini enrichment yet"}
                </Text>
                <Text style={styles.emptyHint}>
                  {error ??
                    (status === "unavailable"
                      ? "Transcript measurements remain available. Configure GEMINI_API_KEY to add audio understanding."
                      : "Run audio insights to add sentiment and speaker dynamics.")}
                </Text>
              </>
            )}
            <Pressable disabled={starting} onPress={() => void handleStart()} style={styles.actionBtn}>
              {starting ? (
                <LoadingDots color="#fff" size="small" />
              ) : (
                <>
                  <Icon as={RefreshCw} size={14} color="#fff" />
                  <Text style={styles.actionText}>Run audio insights</Text>
                </>
              )}
            </Pressable>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#f4f7fb",
    paddingTop: 50,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 28,
    paddingBottom: 80,
  },
  enrichmentBody: {
    flexGrow: 1,
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  emptyCompact: {
    justifyContent: "flex-start",
    paddingTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#101828",
    textAlign: "center",
  },
  emptyHint: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    color: "#667085",
    textAlign: "center",
  },
  retryAudio: {
    marginHorizontal: 20,
    marginBottom: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  retryAudioText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#006ce5",
    textAlign: "center",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#006ce5",
  },
  actionText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
  },
});
