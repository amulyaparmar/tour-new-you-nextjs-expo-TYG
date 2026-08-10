import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type LoadingDotsProps = {
  color?: string;
  size?: "small" | "large" | number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function LoadingDots({
  color = "#006CE5",
  size = "small",
  style,
  accessibilityLabel = "Loading",
}: LoadingDotsProps) {
  const values = useRef([
    new Animated.Value(0.35),
    new Animated.Value(0.35),
    new Animated.Value(0.35),
  ]).current;
  const dotSize = typeof size === "number" ? size : size === "large" ? 9 : 6;
  const animations = useMemo(
    () => values.map((value) => Animated.sequence([
      Animated.timing(value, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(value, {
        toValue: 0.35,
        duration: 340,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ])),
    [values]
  );

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.stagger(130, animations),
        Animated.delay(180),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [animations]);

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="progressbar"
      style={[styles.row, { minHeight: dotSize + 4 }, style]}
    >
      {values.map((value, index) => (
        <Animated.View
          key={index}
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: color,
            opacity: value,
            transform: [{
              scale: value.interpolate({ inputRange: [0.35, 1], outputRange: [0.82, 1] }),
            }],
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
});
