import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

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
          <Ionicons name="camera" size={34} color="#006CE5" />
          <Text style={styles.title}>Take a photo in the mobile app</Text>
          <Text style={styles.copy}>The in-app camera is available on iOS and Android.</Text>
          <Pressable onPress={onClose} style={styles.button}><Text style={styles.buttonText}>Close</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

export type { RecordedPhotoAsset };

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(15,23,42,0.45)" },
  card: { width: "100%", maxWidth: 420, alignItems: "center", gap: 12, padding: 28, borderRadius: 24, backgroundColor: "#fff" },
  title: { color: "#101828", fontSize: 20, fontWeight: "900", textAlign: "center" },
  copy: { color: "#667085", fontSize: 14, lineHeight: 20, fontWeight: "600", textAlign: "center" },
  button: { minWidth: 140, minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 8, borderRadius: 24, backgroundColor: "#006CE5" },
  buttonText: { color: "#fff", fontSize: 14, fontWeight: "900" },
});
