import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  KeyboardAvoidingView,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Reanimated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const DEFAULT_SHEET_HEIGHT = Math.round(Dimensions.get("window").height * 0.72);
const DISMISS_DISTANCE = 88;
const DISMISS_VELOCITY = 900;
const SHEET_EASING = Easing.out(Easing.cubic);
const AnimatedView = Reanimated.View;

type BottomSheetModalProps = {
  visible: boolean;
  onClose: () => void;
  /** iOS: fires after the native modal has finished dismissing. */
  onDismiss?: () => void;
  children: React.ReactNode;
  dragHeader?: React.ReactNode;
  header?: React.ReactNode;
  sheetHeight?: number;
  dismissDisabled?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  sheetStyle?: StyleProp<ViewStyle>;
  keyboardAvoiding?: boolean;
  /** Enables a right-swipe back action inside a nested sheet state. */
  swipeBackEnabled?: boolean;
  onSwipeBack?: () => void;
  /**
   * `overlay` renders in-place instead of a native Modal. Use this when
   * another native Modal (e.g. a page sheet) must be presented from a
   * menu item — iOS will drop the second presentation if a Modal is already up.
   */
  host?: "modal" | "overlay";
};

export function BottomSheetModal({
  visible,
  onClose,
  onDismiss,
  children,
  dragHeader,
  header,
  sheetHeight = DEFAULT_SHEET_HEIGHT,
  dismissDisabled = false,
  contentStyle,
  sheetStyle,
  keyboardAvoiding = false,
  swipeBackEnabled = false,
  onSwipeBack,
  host = "modal",
}: BottomSheetModalProps) {
  const insets = useSafeAreaInsets();
  const [rendered, setRendered] = useState(visible);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const isClosing = useRef(false);
  const hasPresented = useRef(false);
  const dismissDisabledRef = useRef(dismissDisabled);
  dismissDisabledRef.current = dismissDisabled;
  const dismissDisabledValue = useSharedValue(dismissDisabled ? 1 : 0);

  useEffect(() => {
    dismissDisabledValue.value = dismissDisabled ? 1 : 0;
  }, [dismissDisabled, dismissDisabledValue]);

  const translateY = useSharedValue(sheetHeight);
  const backdropOpacity = useSharedValue(0);
  const sheetHeightValue = useSharedValue(sheetHeight);

  useEffect(() => {
    sheetHeightValue.value = sheetHeight;
  }, [sheetHeight, sheetHeightValue]);

  const finishDismiss = useCallback(
    (notifyParent: boolean) => {
      isClosing.current = false;
      hasPresented.current = false;
      setRendered(false);
      if (notifyParent) onClose();
    },
    [onClose]
  );

  const animateDismiss = useCallback(
    (notifyParent: boolean) => {
      if (dismissDisabledRef.current || isClosing.current) return;
      isClosing.current = true;
      cancelAnimation(translateY);
      cancelAnimation(backdropOpacity);
      translateY.value = withTiming(sheetHeight, { duration: 220, easing: SHEET_EASING }, (finished) => {
        if (finished) runOnJS(finishDismiss)(notifyParent);
      });
      backdropOpacity.value = withTiming(0, { duration: 180 });
    },
    [backdropOpacity, finishDismiss, sheetHeight, translateY]
  );

  const animatePresent = useCallback(() => {
    isClosing.current = false;
    cancelAnimation(translateY);
    cancelAnimation(backdropOpacity);
    translateY.value = sheetHeight;
    translateY.value = withTiming(0, { duration: 260, easing: SHEET_EASING });
    backdropOpacity.value = withTiming(1, { duration: 220, easing: SHEET_EASING });
  }, [backdropOpacity, sheetHeight, translateY]);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      return;
    }
    if (!rendered || isClosing.current) return;
    animateDismiss(false);
  }, [animateDismiss, rendered, visible]);

  useEffect(() => {
    if (!visible || !rendered || hasPresented.current) return;
    hasPresented.current = true;
    animatePresent();
  }, [animatePresent, rendered, visible]);

  useEffect(() => {
    if (!keyboardAvoiding || Platform.OS !== "ios") return;
    const show = Keyboard.addListener("keyboardWillShow", () => setKeyboardVisible(true));
    const hide = Keyboard.addListener("keyboardWillHide", () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [keyboardAvoiding]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!dismissDisabled)
        .activeOffsetY(6)
        .failOffsetX([-28, 28])
        .onBegin(() => {
          cancelAnimation(translateY);
          cancelAnimation(backdropOpacity);
        })
        .onUpdate((event) => {
          if (dismissDisabledValue.value || event.translationY <= 0) return;
          translateY.value = event.translationY;
          backdropOpacity.value = Math.max(0, 1 - event.translationY / sheetHeightValue.value);
        })
        .onEnd((event) => {
          if (dismissDisabledValue.value) return;
          if (event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY) {
            runOnJS(animateDismiss)(true);
            return;
          }
          translateY.value = withTiming(0, { duration: 200, easing: SHEET_EASING });
          backdropOpacity.value = withTiming(1, { duration: 160, easing: SHEET_EASING });
        }),
    [animateDismiss, backdropOpacity, dismissDisabled, dismissDisabledValue, sheetHeightValue, translateY]
  );

  const horizontalBackGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(swipeBackEnabled && Boolean(onSwipeBack))
        .activeOffsetX(8)
        .failOffsetY([-18, 18])
        .onEnd((event) => {
          if (event.translationX > 72 || event.velocityX > DISMISS_VELOCITY) {
            runOnJS(onSwipeBack!)();
          }
        }),
    [onSwipeBack, swipeBackEnabled]
  );

  const sheetGesture = useMemo(
    () => Gesture.Simultaneous(panGesture, horizontalBackGesture),
    [horizontalBackGesture, panGesture]
  );

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!rendered) return null;

  const body = (
    <GestureHandlerRootView style={styles.root}>
      <AnimatedView pointerEvents="none" style={[styles.backdrop, backdropStyle]} />
      <Pressable
        accessibilityLabel="Close sheet"
        disabled={dismissDisabled}
        onPress={() => animateDismiss(true)}
        style={styles.scrim}
      />

      <KeyboardAvoidingView
        behavior={keyboardAvoiding && Platform.OS === "ios" ? "padding" : undefined}
        pointerEvents="box-none"
        style={styles.keyboardAvoiding}
      >
        <GestureDetector gesture={sheetGesture}>
          <AnimatedView
            style={[
              styles.sheet,
              sheetStyle,
              sheetAnimatedStyle,
              {
                height: sheetHeight,
                paddingBottom: keyboardVisible ? 0 : Math.max(insets.bottom, 16),
              },
            ]}
          >
            <View style={styles.dragZone}>
              <View style={styles.handle} />
              {dragHeader}
            </View>
            {header}
            <View style={[styles.body, contentStyle]}>{children}</View>
          </AnimatedView>
        </GestureDetector>
      </KeyboardAvoidingView>
    </GestureHandlerRootView>
  );

  if (host === "overlay") {
    return <View style={styles.overlayHost}>{body}</View>;
  }

  return (
    <Modal
      visible={rendered}
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      onDismiss={onDismiss}
      onRequestClose={() => animateDismiss(true)}
    >
      {body}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlayHost: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    elevation: 40,
  },
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(16,24,40,0.52)",
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
  },
  keyboardAvoiding: {
    flex: 1,
    justifyContent: "flex-end",
    zIndex: 2,
  },
  sheet: {
    elevation: 8,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: "#fff",
    paddingHorizontal: 18,
  },
  dragZone: {
    alignSelf: "stretch",
  },
  handle: {
    width: 40,
    height: 4,
    alignSelf: "center",
    borderRadius: 2,
    backgroundColor: "#d0d5dd",
    marginTop: 6,
    marginBottom: 6,
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
});
