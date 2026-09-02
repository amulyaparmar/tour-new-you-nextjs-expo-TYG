import { UIColors } from "@/lib/ui-colors";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { StyleSheet, View, type ViewProps } from "react-native";
import Reanimated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const styles = StyleSheet.create({
  skeleton: {
    overflow: "hidden",
    backgroundColor: UIColors.muted,
    borderRadius: 8,
  },
  shimmer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: -180,
    width: 180,
  },
  shimmerGradient: { flex: 1 },
});

function Skeleton({ style, ...props }: ViewProps) {
  const sweep = useSharedValue(0);

  useEffect(() => {
    sweep.value = withRepeat(withTiming(1, { duration: 1_240, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(sweep);
  }, [sweep]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sweep.value * 540 }],
  }));

  return (
    <View style={[styles.skeleton, style]} {...props}>
      <Reanimated.View pointerEvents="none" style={[styles.shimmer, shimmerStyle]}>
        <LinearGradient
          colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.62)", "rgba(255,255,255,0)"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.shimmerGradient}
        />
      </Reanimated.View>
    </View>
  );
}

export { Skeleton };
