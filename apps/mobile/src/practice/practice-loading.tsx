import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Reanimated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GlassNavHeader, glassNavContentInset } from "@/components/glass-nav-header";
import { Skeleton } from "@/components/ui/skeleton";
import { BACKGROUND, CARD, HINT, LARGE_CORNER, SMALL_CORNER } from "@/theme/tokens";

function ShimmerGroup({ children }: { children: React.ReactNode }) {
  const opacity = useSharedValue(0.46);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.92, { duration: 720, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.46, { duration: 720, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(opacity);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Reanimated.View style={animatedStyle}>{children}</Reanimated.View>;
}

export function PracticeListSkeleton() {
  return (
    <ShimmerGroup>
      <View accessibilityLabel="Loading practice sessions" style={styles.listRoot}>
        <View style={styles.sectionHeading}>
          <Skeleton style={styles.historyTitle} />
        </View>
        {Array.from({ length: 2 }, (_, index) => (
          <View key={`attempt-${index}`} style={styles.row}>
            <View style={styles.rowBody}>
              <Skeleton style={[styles.line, index === 0 ? styles.copyLong : styles.copyMedium]} />
              <Skeleton style={[styles.line, styles.metaLine]} />
            </View>
            <Skeleton style={styles.score} />
          </View>
        ))}
      </View>
    </ShimmerGroup>
  );
}

export function PracticeSessionSkeleton({
  title = "Practice",
  onBack,
}: {
  title?: string;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View accessibilityLabel="Preparing practice session" style={styles.sessionRoot}>
      <ShimmerGroup>
        <View style={[styles.sessionBody, { paddingTop: glassNavContentInset(insets.top) }]}>
          <View style={styles.callCard}>
            <Skeleton style={styles.avatar} />
            <Skeleton style={styles.prospectName} />
            <Skeleton style={styles.callCopy} />
          </View>

          <View style={styles.transcriptCard}>
            <Skeleton style={styles.transcriptTitle} />
            <Skeleton style={styles.transcriptLineLong} />
            <Skeleton style={styles.transcriptLineShort} />
            <Skeleton style={styles.transcriptLineMedium} />
          </View>
        </View>
      </ShimmerGroup>
      <GlassNavHeader title={title} onBack={onBack} />
    </View>
  );
}

const styles = StyleSheet.create({
  listRoot: { gap: 10, paddingTop: 2 },
  sectionHeading: { minHeight: 28, flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  historyTitle: { width: 154, height: 18, borderRadius: 7 },
  row: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 15,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  rowBody: { flex: 1, minWidth: 0, gap: 7 },
  line: { height: 10, borderRadius: 6 },
  copyLong: { width: "82%" },
  copyMedium: { width: "62%" },
  metaLine: { width: 66, height: 8 },
  score: { width: 38, height: 19, borderRadius: 7 },
  sessionRoot: { flex: 1, backgroundColor: BACKGROUND },
  sessionBody: { flex: 1, gap: 14, paddingHorizontal: 16 },
  callCard: {
    alignItems: "center",
    gap: 11,
    paddingVertical: 26,
    paddingHorizontal: 20,
    borderRadius: LARGE_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  avatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: HINT },
  prospectName: { width: 168, height: 17, borderRadius: 7 },
  callCopy: { width: "66%", height: 10, borderRadius: 6 },
  transcriptCard: {
    minHeight: 188,
    gap: 12,
    padding: 16,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  transcriptTitle: { width: 86, height: 12, borderRadius: 6 },
  transcriptLineLong: { width: "92%", height: 36, borderRadius: 11 },
  transcriptLineShort: { width: "62%", height: 36, alignSelf: "flex-end", borderRadius: 11 },
  transcriptLineMedium: { width: "76%", height: 36, borderRadius: 11 },
});
