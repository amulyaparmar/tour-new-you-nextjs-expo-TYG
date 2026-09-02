import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, type StyleProp, type ViewStyle } from "react-native";
import Reanimated, {
  Easing,
  FadeIn,
  FadeInDown,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { impactHaptic, selectionHaptic } from "../../lib/haptics";

const AnimatedPressable = Reanimated.createAnimatedComponent(Pressable);

export function MotionPressable({
  children,
  style,
  onPress,
  haptic = "selection",
  entering,
  layout: _layout,
  disabled,
  ...props
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  haptic?: "none" | "selection" | "light" | "medium";
  entering?: unknown;
  layout?: unknown;
  disabled?: boolean;
  [key: string]: unknown;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      entering={entering as never}
      onPressIn={() => {
        scale.value = withSpring(0.975, { damping: 18, stiffness: 380 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 16, stiffness: 320 });
      }}
      onPress={() => {
        if (disabled) return;
        if (haptic === "selection") selectionHaptic();
        if (haptic === "light") impactHaptic();
        if (haptic === "medium") impactHaptic(Haptics.ImpactFeedbackStyle.Medium);
        onPress?.();
      }}
      style={[style, animatedStyle, disabled && { opacity: 0.55 }]}
    >
      {children}
    </AnimatedPressable>
  );
}

export function MotionBlock({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Reanimated.View entering={FadeInDown.delay(delay).duration(420).springify()} style={style}>
      {children}
    </Reanimated.View>
  );
}

export function AnimatedTabContent({
  tabKey,
  direction = "forward",
  children,
  style,
}: {
  tabKey: string;
  direction?: "forward" | "back";
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const translateX = useSharedValue(direction === "forward" ? 24 : -24);

  React.useEffect(() => {
    translateX.value = direction === "forward" ? 24 : -24;
    translateX.value = withTiming(0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
  }, [direction, tabKey, translateX]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Reanimated.View key={tabKey} style={[style, animatedStyle]}>
      {children}
    </Reanimated.View>
  );
}
