import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";

import { CustomText } from "@/components/custom-text";
import { ACCENT, BACKGROUND, CARD, HINT, LARGE_CORNER, SMALL_CORNER } from "@/theme/tokens";

type RecordedPhotoAsset = {
  uri: string;
  fileName: string;
  mimeType: "image/jpeg";
  name: string;
  description: string;
};

type PhotoAssetRecorderProps = {
  visible: boolean;
  onClose: () => void;
  onUpload: (asset: RecordedPhotoAsset) => Promise<void>;
};

export function PhotoAssetRecorder({ visible, onClose }: PhotoAssetRecorderProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.icon}>
            <Ionicons name="camera" size={28} color={ACCENT} />
          </View>
          <CustomText textStyle="hero" style={styles.centered}>
            Take a photo in the mobile app
          </CustomText>
          <CustomText textStyle="body" style={styles.copy}>
            The in-app camera is available on iOS and Android.
          </CustomText>
          <Pressable onPress={onClose} style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}>
            <CustomText textStyle="title" style={styles.primaryBtnText}>
              Close
            </CustomText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export type { RecordedPhotoAsset };

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
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    borderRadius: 25,
    backgroundColor: ACCENT,
    boxShadow: "0 6px 14px rgba(0, 108, 229, 0.28)",
  },
  primaryBtnText: { color: CARD },
  pressed: { opacity: 0.72 },
});
