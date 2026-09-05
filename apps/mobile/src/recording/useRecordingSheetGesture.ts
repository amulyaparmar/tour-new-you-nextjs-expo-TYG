import { useEffect, useMemo, type Component } from "react";
import { Gesture } from "react-native-gesture-handler";
import {
  cancelAnimation,
  ReduceMotion,
  runOnJS,
  scrollTo,
  useAnimatedScrollHandler,
  useSharedValue,
  withSpring,
  type AnimatedRef,
  type SharedValue,
} from "react-native-reanimated";

const RETURN_SPRING = {
  damping: 28,
  stiffness: 280,
  mass: 0.85,
  overshootClamping: true,
  reduceMotion: ReduceMotion.System,
};

/** Scroll normally, then hand a continued downward pull to the live recorder. */
export function useRecordingSheetGesture<T extends Component>({
  enabled,
  sheetOffset,
  sheetHeight,
  sheetClosing,
  pullProgress,
  onMinimize,
  scrollRef,
  scrollResetKey,
}: {
  enabled: boolean;
  sheetOffset: SharedValue<number>;
  sheetHeight: SharedValue<number>;
  sheetClosing: SharedValue<boolean>;
  pullProgress: SharedValue<number>;
  onMinimize: () => void;
  scrollRef?: AnimatedRef<T>;
  /** Changes only when the native scrollable is replaced (e.g. a recording tab). */
  scrollResetKey?: string;
}) {
  const scrollOffset = useSharedValue(0);
  const pullAnchorY = useSharedValue(0);
  const pullingSheet = useSharedValue(false);
  const didPull = useSharedValue(false);

  useEffect(() => {
    // Hooks outlive conditionally rendered tabs; their native scroll views do
    // not. Don't carry an old offset into a freshly mounted surface at the top.
    scrollOffset.value = 0;
    pullingSheet.value = false;
    didPull.value = false;
  }, [scrollResetKey, scrollOffset, pullingSheet, didPull]);

  const onScroll = useAnimatedScrollHandler((event) => {
    if (pullingSheet.value && sheetOffset.value > 0) {
      scrollOffset.value = 0;
      if (scrollRef && event.contentOffset.y !== 0) scrollTo(scrollRef, 0, 0, false);
      return;
    }
    scrollOffset.value = Math.max(0, event.contentOffset.y);
  });

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .enabled(enabled)
      .maxPointers(1)
      .activeOffsetY([-6, 6])
      .failOffsetX([-28, 28])
      .onBegin((event) => {
        if (sheetClosing.value) return;
        pullingSheet.value = false;
        didPull.value = false;
        // A tap or native scroll must not cancel the dock's opening animation.
        // Only inherit an offset from a previous interactive pull returning home.
        pullAnchorY.value = event.absoluteY + scrollOffset.value
          - (pullProgress.value > 0 ? sheetOffset.value : 0);
      })
      .onUpdate((event) => {
        if (sheetClosing.value) return;
        if (!pullingSheet.value && scrollOffset.value > 1) {
          pullAnchorY.value = event.absoluteY + scrollOffset.value;
          return;
        }

        let distance = Math.min(sheetHeight.value, Math.max(0, event.absoluteY - pullAnchorY.value));
        if (distance > 0) {
          if (!didPull.value && pullProgress.value === 0) {
            // If opening is still in flight, pick up its current position only
            // now. A tap doesn't interrupt it, and a real pull cannot jump up.
            pullAnchorY.value -= sheetOffset.value;
            distance = Math.min(sheetHeight.value, Math.max(0, event.absoluteY - pullAnchorY.value));
          }
          if (!pullingSheet.value) {
            cancelAnimation(sheetOffset);
            cancelAnimation(pullProgress);
          }
          didPull.value = true;
          pullingSheet.value = true;
          sheetOffset.value = distance;
          pullProgress.value = Math.min(1, distance / 100);
          scrollOffset.value = 0;
          if (scrollRef) scrollTo(scrollRef, 0, 0, false);
        } else if (pullingSheet.value) {
          sheetOffset.value = 0;
          pullProgress.value = 0;
          pullingSheet.value = false;
          pullAnchorY.value = event.absoluteY;
        }
      })
      .onEnd((event, success) => {
        if (sheetClosing.value || !didPull.value) return;
        const distance = sheetOffset.value;
        pullingSheet.value = false;
        if (success && (distance > 92 || (distance > 12 && event.velocityY > 900))) {
          sheetClosing.value = true;
          // The host owns one exit animation and the UI-only minimize callback.
          runOnJS(onMinimize)();
        } else {
          sheetOffset.value = withSpring(0, RETURN_SPRING);
          pullProgress.value = withSpring(0, RETURN_SPRING);
        }
      })
      .onFinalize((_event, success) => {
        pullingSheet.value = false;
        if (!success && didPull.value && !sheetClosing.value) {
          sheetOffset.value = withSpring(0, RETURN_SPRING);
          pullProgress.value = withSpring(0, RETURN_SPRING);
        }
        didPull.value = false;
      });

    // Plain Reanimated scrollables allow this simultaneous handoff. RNGH's
    // ScrollView wrapper would monopolize the drag via disallowInterruption.
    return scrollRef ? Gesture.Simultaneous(Gesture.Native(), pan) : pan;
  }, [enabled, sheetOffset, sheetHeight, sheetClosing, pullProgress, onMinimize,
    scrollRef, scrollOffset, pullAnchorY, pullingSheet, didPull]);

  return { gesture, onScroll };
}
