import { View } from "react-native";

import { SessionAiChat } from "@/components/SessionAiChat";
import { SessionAiChatSkeleton } from "@/components/ui/screen-skeletons";
import { useSessionPlayback } from "@/hooks/use-session-playback";
import { useAnalysisQuery } from "@/queries";

import { SessionMiniPlayer } from "./session-mini-player";
import { TourScreenHeader } from "./tour-screen-header";

export function SessionAiChatScreen({
  sessionId,
  sessionTitle,
  prospectName,
  onBack,
}: {
  sessionId: string;
  sessionTitle?: string;
  prospectName?: string;
  onBack: () => void;
}) {
  const analysisQuery = useAnalysisQuery(sessionId);
  const analysis = analysisQuery.data?.analysis ?? null;
  const loading = analysisQuery.isLoading;
  const playback = useSessionPlayback(sessionId);

  return (
    <View style={{ flex: 1, backgroundColor: "#f4f7fb", paddingTop: 50 }}>
      <TourScreenHeader
        onBack={onBack}
        title="AI chat"
        subtitle={prospectName ? `About ${prospectName}` : undefined}
      />
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
        <SessionAiChatSkeleton />
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
  );
}
