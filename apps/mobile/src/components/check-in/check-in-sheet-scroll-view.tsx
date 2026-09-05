import { useMemo, type ReactNode } from "react";
import type { ScrollViewProps } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
  cancelAnimation,
  runOnJS,
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";

const RETURN_SPRING = { damping: 24, stiffness: 260 };

/** Scroll first; continued pulling at the top moves the containing check-in sheet. */
export function CheckInSheetScrollView({
  children,
  visible,
  dragY,
  closing,
  onDismiss,
  style,
  contentContainerStyle,
  keyboardShouldPersistTaps,
}: {
  children: ReactNode;
  visible: boolean;
  dragY: SharedValue<number>;
  closing: SharedValue<boolean>;
  onDismiss: () => void;
  style?: ScrollViewProps["style"];
  contentContainerStyle?: ScrollViewProps["contentContainerStyle"];
  keyboardShouldPersistTaps?: ScrollViewProps["keyboardShouldPersistTaps"];
}) {
  const scrollRef = useAnimatedRef<Reanimated.ScrollView>();
  const scrollOffset = useSharedValue(0);
  const pullAnchorY = useSharedValue(0);
  const pullingSheet = useSharedValue(false);

  const onScroll = useAnimatedScrollHandler((event) => {
    if (pullingSheet.value && dragY.value > 0) {
      // Do not let the content scroll behind the sheet while reversing a pull.
      scrollOffset.value = 0;
      if (event.contentOffset.y !== 0) scrollTo(scrollRef, 0, 0, false);
      return;
    }
    scrollOffset.value = Math.max(0, event.contentOffset.y);
  });

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .enabled(visible)
      .maxPointers(1)
      .activeOffsetY([-6, 6])
      .failOffsetX([-28, 28])
      .onBegin((event) => {
        if (closing.value) return;
        cancelAnimation(dragY);
        pullingSheet.value = dragY.value > 0;
        // The scrollable distance is consumed before any sheet travel counts.
        pullAnchorY.value = event.absoluteY + scrollOffset.value - dragY.value;
      })
      .onUpdate((event) => {
        if (closing.value) return;
        if (!pullingSheet.value && scrollOffset.value > 1) {
          pullAnchorY.value = event.absoluteY + scrollOffset.value;
          return;
        }

        // Screen coordinates stay stable as the sheet translates under a finger.
        const distance = Math.max(0, event.absoluteY - pullAnchorY.value);
        dragY.value = distance;
        if (distance > 0) {
          pullingSheet.value = true;
          scrollOffset.value = 0;
          scrollTo(scrollRef, 0, 0, false);
        } else if (pullingSheet.value) {
          pullingSheet.value = false;
          pullAnchorY.value = event.absoluteY;
        }
      })
      .onEnd((event, success) => {
        if (closing.value) return;
        const distance = dragY.value;
        pullingSheet.value = false;
        if (success && (distance > 88 || (distance > 12 && event.velocityY > 900))) {
          closing.value = true;
          runOnJS(onDismiss)();
        } else {
          dragY.value = withSpring(0, RETURN_SPRING);
        }
      })
      .onFinalize((_event, success) => {
        pullingSheet.value = false;
        if (!success && !closing.value) dragY.value = withSpring(0, RETURN_SPRING);
      });

    // Both must keep observing the same drag so the handoff needs no finger lift.
    // Use a plain Reanimated ScrollView: RNGH's ScrollView wrapper defaults to
    // disallowInterruption, which would let scrolling monopolize this gesture.
    return Gesture.Simultaneous(Gesture.Native(), pan);
  }, [visible, closing, dragY, onDismiss, pullAnchorY, pullingSheet, scrollOffset, scrollRef]);

  return (
    <GestureDetector gesture={gesture}>
      <Reanimated.ScrollView
        ref={scrollRef}
        style={style}
        contentContainerStyle={contentContainerStyle}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        onScroll={onScroll}
        scrollEventThrottle={16}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        onAccessibilityEscape={onDismiss}
      >
        {children}
      </Reanimated.ScrollView>
    </GestureDetector>
  );
}
