import React, { useCallback, useEffect, useRef } from "react";
import {
  Image,
  PanResponder,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type PanoramaImageViewerProps = {
  uri: string;
  style?: StyleProp<ViewStyle>;
  onReady?: () => void;
};

function normalizeDegrees(value: number) {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

export function PanoramaImageViewer({ uri, style, onReady }: PanoramaImageViewerProps) {
  const [viewport, setViewport] = React.useState({ width: 0, height: 0 });
  const [renderedView, setRenderedView] = React.useState({ yaw: 0, pitch: 0 });
  const animationFrameRef = useRef<number | null>(null);
  const readyUriRef = useRef("");
  const onReadyRef = useRef(onReady);
  const viewRef = useRef({
    yaw: 0,
    pitch: 0,
    startYaw: 0,
    startPitch: 0,
  });

  onReadyRef.current = onReady;

  const updateView = useCallback((yaw: number, pitch: number) => {
    viewRef.current.yaw = yaw;
    viewRef.current.pitch = pitch;
    setRenderedView({ yaw, pitch });
  }, []);

  useEffect(() => {
    readyUriRef.current = "";
  }, [uri]);

  useEffect(() => () => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
  }, []);

  const startMomentum = useCallback((velocityX: number, velocityY: number) => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    let yawVelocity = -velocityX * 135;
    let pitchVelocity = velocityY * 70;
    let previousTime = Date.now();

    const coast = () => {
      const now = Date.now();
      const elapsed = Math.min((now - previousTime) / 1000, 0.034);
      previousTime = now;
      const view = viewRef.current;
      const nextYaw = view.yaw + yawVelocity * elapsed;
      const unboundedPitch = view.pitch + pitchVelocity * elapsed;
      const nextPitch = Math.max(-72, Math.min(72, unboundedPitch));
      if (nextPitch !== unboundedPitch) pitchVelocity = 0;
      updateView(normalizeDegrees(nextYaw), nextPitch);
      const friction = 0.055 ** elapsed;
      yawVelocity *= friction;
      pitchVelocity *= friction;
      if (Math.abs(yawVelocity) > 0.25 || Math.abs(pitchVelocity) > 0.25) {
        animationFrameRef.current = requestAnimationFrame(coast);
      } else {
        animationFrameRef.current = null;
        updateView(normalizeDegrees(nextYaw), nextPitch);
      }
    };

    animationFrameRef.current = requestAnimationFrame(coast);
  }, [updateView]);

  const panResponder = React.useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      const view = viewRef.current;
      view.startYaw = view.yaw;
      view.startPitch = view.pitch;
    },
    onPanResponderMove: (_event, gesture) => {
      const view = viewRef.current;
      updateView(
        normalizeDegrees(view.startYaw - (gesture.dx / Math.max(viewport.width, 1)) * 90),
        Math.max(
          -72,
          Math.min(72, view.startPitch + (gesture.dy / Math.max(viewport.height, 1)) * 60),
        ),
      );
    },
    onPanResponderRelease: (_event, gesture) => {
      if (Math.sqrt(gesture.vx ** 2 + gesture.vy ** 2) > 0.04) {
        startMomentum(gesture.vx, gesture.vy);
      } else {
        const view = viewRef.current;
        updateView(normalizeDegrees(view.yaw), view.pitch);
      }
    },
  }), [startMomentum, updateView, viewport.height, viewport.width]);

  // A 90-degree viewport means one equirectangular image spans four screens.
  // Three wrapped copies keep the first and last longitude visually continuous.
  const panoramaWidth = viewport.width * 4;
  const panoramaHeight = panoramaWidth / 2;
  const horizontalOffset = -(renderedView.yaw / 360) * panoramaWidth;
  const verticalTravel = Math.max((panoramaHeight - viewport.height) / 2, 0);
  const imageTop = (viewport.height - panoramaHeight) / 2
    + (renderedView.pitch / 72) * verticalTravel;
  const centeredLeft = (viewport.width - panoramaWidth) / 2 + horizontalOffset;

  return (
    <View
      {...panResponder.panHandlers}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width > 0 && height > 0) setViewport({ width, height });
      }}
      style={[styles.container, style]}
    >
      {viewport.width > 1 && viewport.height > 1 ? [-1, 0, 1].map((copy) => (
        <Image
          key={`${uri}-${copy}-${Math.round(viewport.width)}`}
          source={{ uri }}
          fadeDuration={0}
          onLoad={copy === 0 ? () => {
            if (readyUriRef.current === uri) return;
            readyUriRef.current = uri;
            onReadyRef.current?.();
          } : undefined}
          resizeMode="stretch"
          style={{
            position: "absolute",
            left: centeredLeft + copy * panoramaWidth,
            top: imageTop,
            width: panoramaWidth,
            height: panoramaHeight,
          }}
        />
      )) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    backgroundColor: "#000",
  },
});
