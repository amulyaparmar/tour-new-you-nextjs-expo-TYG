import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, type StyleProp, type ViewStyle } from "react-native";
import Reanimated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  Easing,
  useAnimatedStyle,
  useSharedValue,
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
        scale.value = withTiming(0.975, { duration: 80, easing: Easing.out(Easing.quad) });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 120, easing: Easing.out(Easing.cubic) });
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
  children,
  style,
}: {
  tabKey: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Reanimated.View key={tabKey} entering={FadeInDown.duration(280).springify()} exiting={FadeOut.duration(180)} style={style}>
      {children}
    </Reanimated.View>
  );
}
