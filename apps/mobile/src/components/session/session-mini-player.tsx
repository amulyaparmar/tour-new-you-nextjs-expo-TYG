import { Pause, Play } from "lucide-react-native";
import { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { LoadingDots } from "@/components/loading-dots";
import { Icon } from "@/components/ui/icon";

export function SessionMiniPlayer({
  position,
  duration,
  playing,
  ready,
  progressPercent,
  onToggle,
  onSeek,
}: {
  position: number;
  duration: number;
  playing: boolean;
  ready: boolean;
  progressPercent: number;
  onToggle: () => void;
  onSeek: (ratio: number) => void;
}) {
  const trackWidth = useRef(0);

  function seekAt(x: number) {
    if (trackWidth.current <= 0) return;
    onSeek(Math.max(0, Math.min(1, x / trackWidth.current)));
  }

  return (
    <View style={styles.player} accessibilityLabel="Recording player">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playing ? "Pause recording" : "Play recording"}
        disabled={!ready}
        onPress={onToggle}
        style={[styles.playButton, !ready && styles.playButtonDisabled]}
      >
        {!ready ? <LoadingDots size="small" color="#fff" /> : <Icon as={playing ? Pause : Play} size={17} color="#fff" />}
      </Pressable>

      <View style={styles.details}>
        <View
          accessibilityRole="adjustable"
          accessibilityLabel="Recording playhead"
          accessibilityValue={{ min: 0, max: Math.max(0, Math.round(duration)), now: Math.round(position) }}
          onStartShouldSetResponder={() => true}
          onResponderGrant={(event) => seekAt(event.nativeEvent.locationX)}
          onResponderMove={(event) => seekAt(event.nativeEvent.locationX)}
          onResponderRelease={(event) => seekAt(event.nativeEvent.locationX)}
          style={styles.trackHit}
        >
          <View
            style={styles.track}
            onLayout={(event) => {
              trackWidth.current = event.nativeEvent.layout.width;
            }}
          >
            <View style={[styles.fill, { width: `${progressPercent}%` }]} />
          </View>
        </View>
        <Text style={styles.time}>{fmt(position)} / {fmt(duration)}</Text>
      </View>
    </View>
  );
}

function fmt(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  player: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 52,
    marginHorizontal: 12,
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0, 108, 229, 0.12)",
    backgroundColor: "#f2f7ff",
  },
  playButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: "#006ce5",
  },
  playButtonDisabled: { opacity: 0.55 },
  details: { flex: 1, minWidth: 0, gap: 2 },
  trackHit: { minHeight: 22, justifyContent: "center" },
  track: { height: 4, borderRadius: 999, overflow: "hidden", backgroundColor: "#dfe9f7" },
  fill: { height: "100%", borderRadius: 999, backgroundColor: "#006ce5" },
  time: { color: "#667085", fontSize: 10, fontWeight: "800", fontVariant: ["tabular-nums"] },
});
