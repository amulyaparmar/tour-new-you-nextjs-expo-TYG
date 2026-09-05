import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";

import { CustomText } from "@/components/custom-text";
import { ACCENT, BACKGROUND, CARD, HINT, LARGE_CORNER, SMALL_CORNER } from "@/theme/tokens";

type PanoramaShot = {
  uri: string;
  fileName: string;
  mimeType: "image/jpeg";
  index: number;
  headingDegrees: number;
  targetHeadingDegrees: number;
  rollDegrees: number;
  pitchDegrees: number;
};

type RecordedPanoramaAsset = {
  name: string;
  description: string;
  shots: PanoramaShot[];
};

type PanoramaAssetRecorderProps = {
  visible: boolean;
  onClose: () => void;
  onUpload: (asset: RecordedPanoramaAsset) => Promise<void>;
};

export function PanoramaAssetRecorder({ visible, onClose }: PanoramaAssetRecorderProps) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.icon}>
            <Ionicons name="scan-outline" size={28} color={ACCENT} />
          </View>
          <CustomText textStyle="hero" style={styles.centered}>
            Capture 360° in the mobile app
          </CustomText>
          <CustomText textStyle="body" style={styles.copy}>
            The six-photo panorama uses the phone camera and motion sensors, so it is available on a physical iOS or Android device.
          </CustomText>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          >
            <CustomText textStyle="title" style={styles.primaryBtnText}>
              Close
            </CustomText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export type { PanoramaShot, RecordedPanoramaAsset };

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(16,24,40,0.52)",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    alignItems: "center",
    gap: 12,
    padding: 28,
    borderRadius: LARGE_CORNER,
    backgroundColor: BACKGROUND,
  },
  icon: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: SMALL_CORNER,
    backgroundColor: HINT,
  },
  centered: { textAlign: "center" },
  copy: { color: "rgba(0, 0, 0, 0.45)", textAlign: "center", lineHeight: 20 },
  primaryBtn: {
    alignSelf: "stretch",
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    borderRadius: 29,
    backgroundColor: ACCENT,
    boxShadow: "0 6px 14px rgba(0, 108, 229, 0.28)",
  },
  primaryBtnText: { color: CARD },
  pressed: { opacity: 0.72 },
});
