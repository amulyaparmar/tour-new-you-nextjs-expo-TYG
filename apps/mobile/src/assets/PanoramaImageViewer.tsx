import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  PanResponder,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type PanoramaImageViewerProps = {
  uri: string;
  onReady?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** A lightweight drag viewer for stitched panorama assets. */
export function PanoramaImageViewer({ uri, onReady, style }: PanoramaImageViewerProps) {
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const offset = useRef(new Animated.Value(0)).current;
  const offsetValue = useRef(0);
  const gestureStart = useRef(0);
  const imageWidth = Math.max(frame.width * 2.4, frame.height * 2);
  const maximumOffset = Math.max(0, (imageWidth - frame.width) / 2);

  useEffect(() => {
    offsetValue.current = 0;
    offset.setValue(0);
  }, [offset, uri]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 4,
    onPanResponderGrant: () => {
      gestureStart.current = offsetValue.current;
    },
    onPanResponderMove: (_, gesture) => {
      const next = Math.max(-maximumOffset, Math.min(maximumOffset, gestureStart.current + gesture.dx));
      offsetValue.current = next;
      offset.setValue(next);
    },
  }), [maximumOffset, offset]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setFrame({ width, height });
  };

  return (
    <View onLayout={onLayout} style={[styles.frame, style]} {...panResponder.panHandlers}>
      {frame.width > 0 ? (
        <Animated.Image
          source={{ uri }}
          onLoadEnd={onReady}
          resizeMode="cover"
          style={[
            styles.image,
            {
              width: imageWidth,
              left: (frame.width - imageWidth) / 2,
              transform: [{ translateX: offset }],
            },
          ]}
        />
      ) : <Image source={{ uri }} onLoadEnd={onReady} style={StyleSheet.absoluteFill} />}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: "hidden", backgroundColor: "#0f172a" },
  image: { position: "absolute", top: 0, height: "100%" },
});
