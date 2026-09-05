import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SessionAiChat } from "@/components/SessionAiChat";
import { glassNavContentInset } from "@/components/glass-nav-header";
import { LoadingDots } from "@/components/loading-dots";
import { ACCENT, BACKGROUND } from "@/theme/tokens";
import { useSessionPlayback } from "@/hooks/use-session-playback";
import { useAnalysisQuery } from "@/queries";

import { SessionMiniPlayer } from "./session-mini-player";
import { TourScreenHeader } from "./tour-screen-header";

export function SessionAiChatScreen({
  sessionId,
  sessionTitle,
  prospectName: _prospectName,
  onBack,
}: {
  sessionId: string;
  sessionTitle?: string;
  prospectName?: string;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const analysisQuery = useAnalysisQuery(sessionId);
  const analysis = analysisQuery.data?.analysis ?? null;
  const loading = analysisQuery.isLoading;
  const playback = useSessionPlayback(sessionId);

  return (
    <View style={{ flex: 1, backgroundColor: BACKGROUND }}>
      <View style={{ paddingTop: glassNavContentInset(insets.top), flex: 1 }}>
        {playback.ready ? (
          <SessionMiniPlayer
            position={playback.position}
            duration={playback.duration}
            playing={playback.playing}
            ready={playback.ready}
            progressPercent={playback.progressPercent}
            onToggle={() => void playback.togglePlayback()}
            onSeek={(ratio) => void playback.seekToSeconds(ratio * playback.duration)}
          />
        ) : null}
        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <LoadingDots color={ACCENT} />
          </View>
        ) : analysis ? (
          <View style={{ flex: 1, paddingHorizontal: 12 }}>
            <SessionAiChat
              sessionId={sessionId}
              analysis={analysis}
              showHeader={false}
              onSeek={(seconds) => void playback.seekToSeconds(seconds, true)}
            />
          </View>
        ) : null}
      </View>
      <TourScreenHeader onBack={onBack} title={sessionTitle ?? "Tour AI"} />
    </View>
  );
}
