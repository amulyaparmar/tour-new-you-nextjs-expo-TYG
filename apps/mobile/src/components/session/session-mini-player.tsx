import { Pause, Play } from "lucide-react-native";
import { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { LoadingDots } from "@/components/loading-dots";
import { Icon } from "@/components/ui/icon";

const WAVEFORM_LEVELS = [0.26, 0.48, 0.34, 0.72, 0.42, 0.58, 0.3, 0.82, 0.5, 0.36, 0.68, 0.42, 0.58, 0.3, 0.76, 0.46, 0.34, 0.62, 0.38, 0.7, 0.48, 0.28, 0.56, 0.42, 0.66, 0.36, 0.52, 0.3, 0.62, 0.46, 0.74, 0.4] as const;

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
        <View style={styles.metaRow}>
          <Text style={styles.recordingLabel}>Recording</Text>
          <Text style={styles.time}>{fmt(position)} / {fmt(duration)}</Text>
        </View>
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
            {WAVEFORM_LEVELS.map((level, index) => {
              const completed = ((index + 1) / WAVEFORM_LEVELS.length) * 100 <= progressPercent;
              return (
                <View
                  key={index}
                  style={[
                    styles.waveBar,
                    { height: `${Math.max(25, Math.round(level * 100))}%` },
                    completed && styles.waveBarCompleted,
                  ]}
                />
              );
            })}
            <View pointerEvents="none" style={[styles.playhead, { left: `${progressPercent}%` }]} />
          </View>
        </View>
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
    minHeight: 62,
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
  details: { flex: 1, minWidth: 0, gap: 3 },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  recordingLabel: { color: "#344054", fontSize: 10, fontWeight: "900" },
  trackHit: { minHeight: 22, justifyContent: "center" },
  track: { position: "relative", height: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 1, overflow: "visible" },
  waveBar: { width: 2, borderRadius: 999, backgroundColor: "#bed5ee" },
  waveBarCompleted: { backgroundColor: "#006ce5" },
  playhead: { position: "absolute", top: -2, bottom: -2, width: 2, marginLeft: -1, borderRadius: 999, backgroundColor: "#006ce5" },
  time: { color: "#667085", fontSize: 10, fontWeight: "800", fontVariant: ["tabular-nums"] },
});
