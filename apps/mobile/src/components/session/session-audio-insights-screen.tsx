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
import React, { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { fetchAudioInsights, fetchTranscript, startAudioInsights } from "@/api";
import { CustomText } from "@/components/custom-text";
import { Icon } from "@/components/ui/icon";
import { LoadingDots } from "@/components/loading-dots";
import { glassNavContentInset } from "@/components/glass-nav-header";
import { ACCENT, BACKGROUND, CARD } from "@/theme/tokens";
import { tourColors as C } from "@/theme/tour-brand";
import { useSessionPlayback } from "@/hooks/use-session-playback";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ConversationStatsSection,
  SessionAudioInsightsPanel,
} from "./session-audio-insights-panel";
import { SessionPlayer } from "./session-player";
import { TourScreenHeader } from "./tour-screen-header";

const POLLING = new Set<AudioInsightsStatus>(["pending", "processing"]);

export function SessionAudioInsightsScreen({
  sessionId,
  sessionTitle,
  initialStatus = "pending",
  initialInsights = null,
  onBack,
}: {
  sessionId: string;
  sessionTitle?: string;
  initialStatus?: AudioInsightsStatus;
  initialInsights?: AudioInsights | null;
  onBack: () => void;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [insights, setInsights] = useState(initialInsights);
  const [transcriptConversationStats, setTranscriptConversationStats] =
    useState<TranscriptConversationStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const playback = useSessionPlayback(sessionId);
  const insets = useSafeAreaInsets();

  const refresh = useCallback(async () => {
    try {
      const body = await fetchAudioInsights(sessionId);
      setStatus(body.status);
      setInsights(body.insights);
      setError(body.error ?? null);
    } catch {
      // Ignore transient errors while polling.
    }
  }, [sessionId]);

  useEffect(() => {
    void refresh();
    if (!POLLING.has(status)) return;
    const interval = setInterval(() => void refresh(), 3000);
    return () => clearInterval(interval);
  }, [refresh, status]);

  useEffect(() => {
    let cancelled = false;
    void fetchTranscript(sessionId)
      .then(({ transcript }) => {
        if (!cancelled) {
          setTranscriptConversationStats(
            calculateTranscriptConversationStats(transcript),
          );
        }
      })
      .catch(() => {
        // The Gemini status and retry controls remain usable without a transcript.
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const conversationStats =
    insights?.conversationStats ?? transcriptConversationStats;
  const conversationStatsSource = insights?.conversationStats
    ? "gemini"
    : transcriptConversationStats
      ? "transcript"
      : null;

  async function handleStart() {
    setStarting(true);
    setError(null);
    try {
      const body = await startAudioInsights(sessionId);
      setInsights(null);
      setStatus(body.status ?? "processing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start audio insights.");
      setStatus("failed");
    } finally {
      setStarting(false);
    }
  }

  return (
    <View style={styles.root}>
      {status === "ready" && insights ? (
        <>
          <SessionAudioInsightsPanel
            insights={insights}
            fallbackConversationStats={transcriptConversationStats}
            fallbackConversationStatsSource={transcriptConversationStats ? "transcript" : null}
            onSeek={(seconds) => void playback.seekToSeconds(seconds, true)}
            contentInsetTop={glassNavContentInset(insets.top)}
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
              <CustomText textStyle="caption" style={styles.retryAudioText}>{playback.error} · Tap to retry</CustomText>
            </Pressable>
          ) : null}
        </>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.enrichmentBody,
            { paddingTop: glassNavContentInset(insets.top) },
          ]}
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
                <LoadingDots size="large" color={ACCENT} />
                <CustomText textStyle="title" style={styles.emptyTitle}>{AUDIO_INSIGHTS_STATUS_LABELS[status]}</CustomText>
                <CustomText textStyle="body" style={styles.emptyHint}>
                  Gemini is adding sentiment, speaker dynamics, ambience, and semantic interactivity.
                </CustomText>
              </>
            ) : (
              <>
                <Icon as={Activity} size={28} color={C.textSec} />
                <CustomText textStyle="title" style={styles.emptyTitle}>
                  {status === "failed"
                    ? "Gemini enrichment could not be generated"
                    : status === "unavailable"
                      ? "Gemini enrichment is not configured"
                      : "No Gemini enrichment yet"}
                </CustomText>
                <CustomText textStyle="body" style={styles.emptyHint}>
                  {error ??
                    (status === "unavailable"
                      ? "Transcript measurements remain available. Configure GEMINI_API_KEY to add audio understanding."
                      : "Run audio insights to add sentiment and speaker dynamics.")}
                </CustomText>
              </>
            )}
            <Pressable disabled={starting} onPress={() => void handleStart()} style={styles.actionBtn}>
              {starting ? (
                <LoadingDots color={CARD} size="small" />
              ) : (
                <>
                  <Icon as={RefreshCw} size={14} color={CARD} />
                  <CustomText textStyle="title" style={styles.actionText}>Run audio insights</CustomText>
                </>
              )}
            </Pressable>
          </View>
        </ScrollView>
      )}
      <TourScreenHeader onBack={onBack} title={sessionTitle ?? "Audio insights"} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BACKGROUND,
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
    paddingBottom: 40,
  },
  emptyCompact: {
    justifyContent: "flex-start",
    paddingTop: 20,
  },
  emptyTitle: {
    textAlign: "center",
  },
  emptyHint: {
    lineHeight: 19,
    color: C.textSec,
    textAlign: "center",
  },
  retryAudio: {
    marginHorizontal: 20,
    marginBottom: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  retryAudioText: {
    color: ACCENT,
    textAlign: "center",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    backgroundColor: ACCENT,
  },
  actionText: {
    color: CARD,
  },
});
