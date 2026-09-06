import { useEffect, useRef } from "react";
import { Animated, type StyleProp, type ViewStyle } from "react-native";

/** Same pulse as the Start New Tour check-in skeleton. */
export function useSkeletonPulse() {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.58,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return pulse;
}

export function SkeletonPulse({
  pulse,
  style,
}: {
  pulse: Animated.Value;
  style?: StyleProp<ViewStyle>;
}) {
  return <Animated.View style={[style, { opacity: pulse }]} />;
}
