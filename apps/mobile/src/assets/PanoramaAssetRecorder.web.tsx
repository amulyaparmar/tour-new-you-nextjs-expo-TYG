import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { tourColors as C } from "../theme/tour-brand";

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
      <View style={styles.scrim}>
        <View style={styles.card}>
          <View style={styles.icon}>
            <Ionicons name="scan-outline" size={31} color={C.brand} />
          </View>
          <Text style={styles.title}>Capture 360° in the mobile app</Text>
          <Text style={styles.body}>
            The six-photo panorama uses the phone camera and motion sensors, so it is available on a physical iOS or Android device.
          </Text>
          <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.button, pressed && { opacity: 0.82 }]}>
            <Text style={styles.buttonText}>Got it</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export type { PanoramaShot, RecordedPanoramaAsset };

const styles = StyleSheet.create({
  scrim: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(15,23,42,0.52)" },
  card: { width: "100%", maxWidth: 420, alignItems: "center", padding: 28, borderRadius: 24, backgroundColor: "#fff" },
  icon: { width: 62, height: 62, alignItems: "center", justifyContent: "center", marginBottom: 18, borderRadius: 20, backgroundColor: "#eef4ff" },
  title: { color: C.text, fontSize: 20, fontWeight: "900", textAlign: "center" },
  body: { marginTop: 10, color: C.textSec, fontSize: 14, fontWeight: "600", lineHeight: 21, textAlign: "center" },
  button: { minWidth: 132, minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 24, paddingHorizontal: 22, borderRadius: 999, backgroundColor: C.brand },
  buttonText: { color: "#fff", fontSize: 14, fontWeight: "900" },
});
