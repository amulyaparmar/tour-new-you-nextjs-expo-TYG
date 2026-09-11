import { LinearGradient } from "expo-linear-gradient";
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
import { SkeletonPulse, useSkeletonPulse } from "@/components/ui/use-skeleton-pulse";
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
  const pulse = useSkeletonPulse();
  const footerPad = Math.max(insets.bottom, 16);
  return (
    <View accessibilityLabel="Preparing practice session" style={styles.sessionRoot}>
      <View style={[styles.sessionBody, { paddingTop: glassNavContentInset(insets.top) }]}>
        <View style={styles.callCard}>
          <SkeletonPulse pulse={pulse} style={styles.avatar} />
          <SkeletonPulse pulse={pulse} style={styles.prospectName} />
          <SkeletonPulse pulse={pulse} style={styles.callCopy} />
        </View>
      </View>
      <View pointerEvents="none" style={[styles.footer, { paddingBottom: footerPad }]}>
        <LinearGradient
          colors={["rgba(242, 242, 247, 0)", "rgba(242, 242, 247, 0.62)", BACKGROUND]}
          locations={[0, 0.5, 1]}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.readyControls}>
          <View style={styles.startBtn} />
          <View style={styles.goalsBtn} />
        </View>
      </View>
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
  sessionBody: { flex: 1, paddingHorizontal: 16 },
  callCard: {
    alignItems: "center",
    gap: 11,
    paddingVertical: 22,
    paddingHorizontal: 18,
    borderRadius: LARGE_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  avatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: HINT },
  prospectName: { width: 168, height: 17, borderRadius: 7, backgroundColor: BACKGROUND },
  callCopy: { width: "66%", height: 10, borderRadius: 6, backgroundColor: BACKGROUND },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    paddingHorizontal: 16,
    paddingTop: 56,
  },
  readyControls: { flexDirection: "row", alignItems: "center", gap: 8 },
  startBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: 25,
    backgroundColor: CARD,
  },
  goalsBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: CARD,
  },
});
