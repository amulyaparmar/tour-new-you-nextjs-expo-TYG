import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LoadingDots } from "@/components/loading-dots";
import { tourColors as C } from "../theme/tour-brand";

export type RecordedPhotoAsset = {
  uri: string;
  fileName: string;
  mimeType: string;
  name: string;
  description: string;
};

type PhotoAssetRecorderProps = {
  visible: boolean;
  onClose: () => void;
  onUpload: (asset: RecordedPhotoAsset) => Promise<void>;
};

function defaultAssetName() {
  return `Tour photo ${new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date())}`;
}

function fileNameFor(asset: ImagePicker.ImagePickerAsset, mimeType: string) {
  if (asset.fileName) return asset.fileName;
  const extension = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
  return `tour-photo-${Date.now()}.${extension}`;
}

export function PhotoAssetRecorder({ visible, onClose, onUpload }: PhotoAssetRecorderProps) {
  const insets = useSafeAreaInsets();
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [name, setName] = useState(defaultAssetName);
  const [description, setDescription] = useState("");
  const [openingCamera, setOpeningCamera] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setPhoto(null);
    setName(defaultAssetName());
    setDescription("");
    setOpeningCamera(false);
    setUploading(false);
    setError(null);
  }, []);

  useEffect(() => {
    if (!visible) reset();
  }, [reset, visible]);

  const capture = useCallback(async () => {
    if (openingCamera || uploading) return;
    setOpeningCamera(true);
    setError(null);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Camera access is off",
          "Allow Tour to use your camera, then try again.",
          [
            { text: "Not now", style: "cancel" },
            { text: "Open Settings", onPress: () => void Linking.openSettings() },
          ],
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.92,
      });
      const asset = result.assets?.[0];
      if (!result.canceled && asset) setPhoto(asset);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not open the camera.");
    } finally {
      setOpeningCamera(false);
    }
  }, [openingCamera, uploading]);

  const upload = useCallback(async () => {
    if (!photo || uploading || !name.trim()) return;
    setUploading(true);
    setError(null);
    try {
      const mimeType = photo.mimeType?.startsWith("image/") ? photo.mimeType : "image/jpeg";
      await onUpload({
        uri: photo.uri,
        fileName: fileNameFor(photo, mimeType),
        mimeType,
        name: name.trim(),
        description: description.trim(),
      });
      reset();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not upload this photo.");
    } finally {
      setUploading(false);
    }
  }, [description, name, onClose, onUpload, photo, reset, uploading]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.page, { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 18) }]}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Close photo capture" onPress={onClose} disabled={uploading} style={styles.headerButton}>
            <Ionicons name="close" size={22} color={C.text} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>NEW ASSET</Text>
            <Text style={styles.title}>{photo ? "Review your photo" : "Capture a photo"}</Text>
          </View>
          <Pressable accessibilityLabel="Take another photo" onPress={() => void capture()} disabled={openingCamera || uploading} style={styles.headerButton}>
            <Ionicons name="camera-outline" size={21} color={C.text} />
          </Pressable>
        </View>

        {photo ? (
          <ScrollView contentContainerStyle={styles.reviewContent} keyboardShouldPersistTaps="handled">
            <Image source={{ uri: photo.uri }} style={styles.preview} resizeMode="cover" />
            <Text style={styles.label}>Asset name</Text>
            <TextInput value={name} onChangeText={setName} editable={!uploading} placeholder="Name this photo" placeholderTextColor={C.textMuted} style={styles.input} />
            <Text style={styles.label}>Description or notes</Text>
            <TextInput value={description} onChangeText={setDescription} editable={!uploading} multiline placeholder="Add context for your team" placeholderTextColor={C.textMuted} style={[styles.input, styles.descriptionInput]} />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.actions}>
              <Pressable onPress={() => void capture()} disabled={uploading} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed, uploading && styles.disabled]}>
                <Ionicons name="refresh" size={18} color={C.brand} />
                <Text style={styles.secondaryButtonText}>Retake</Text>
              </Pressable>
              <Pressable onPress={() => void upload()} disabled={uploading || !name.trim()} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, (uploading || !name.trim()) && styles.disabled]}>
                {uploading ? <LoadingDots size="small" color="#fff" /> : <Ionicons name="cloud-upload-outline" size={19} color="#fff" />}
                <Text style={styles.primaryButtonText}>{uploading ? "Uploading…" : "Upload asset"}</Text>
              </Pressable>
            </View>
          </ScrollView>
        ) : (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}><Ionicons name="camera" size={34} color={C.brand} /></View>
            <Text style={styles.emptyTitle}>Add a fresh visual</Text>
            <Text style={styles.emptyBody}>Take a photo now, add a little context, and make it available to your community.</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable onPress={() => void capture()} disabled={openingCamera} style={({ pressed }) => [styles.captureButton, pressed && styles.pressed, openingCamera && styles.disabled]}>
              {openingCamera ? <LoadingDots size="small" color="#fff" /> : <Ionicons name="camera-outline" size={20} color="#fff" />}
              <Text style={styles.primaryButtonText}>{openingCamera ? "Opening camera…" : "Take photo"}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f7f8fb", paddingHorizontal: 20 },
  header: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12 },
  headerButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#e1e7ef", borderRadius: 14, backgroundColor: "#fff" },
  headerCopy: { flex: 1 },
  eyebrow: { color: C.brand, fontSize: 10, fontWeight: "900", letterSpacing: 1.1 },
  title: { marginTop: 2, color: C.text, fontSize: 18, fontWeight: "900" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 40 },
  emptyIcon: { width: 72, height: 72, alignItems: "center", justifyContent: "center", borderRadius: 24, backgroundColor: "#eaf4ff" },
  emptyTitle: { marginTop: 22, color: C.text, fontSize: 23, fontWeight: "900" },
  emptyBody: { maxWidth: 300, marginTop: 10, color: C.textSec, fontSize: 14, fontWeight: "600", lineHeight: 21, textAlign: "center" },
  captureButton: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, marginTop: 26, paddingHorizontal: 22, borderRadius: 16, backgroundColor: C.brand },
  reviewContent: { gap: 10, paddingTop: 22, paddingBottom: 8 },
  preview: { width: "100%", aspectRatio: 1.25, borderRadius: 20, backgroundColor: "#e5e7eb" },
  label: { marginTop: 8, color: C.text, fontSize: 12, fontWeight: "900" },
  input: { minHeight: 50, paddingHorizontal: 14, borderWidth: 1, borderColor: "#dbe3ed", borderRadius: 14, backgroundColor: "#fff", color: C.text, fontSize: 14, fontWeight: "600" },
  descriptionInput: { minHeight: 102, paddingTop: 13, textAlignVertical: "top" },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
  secondaryButton: { flex: 0.8, minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1, borderColor: "#cfe0f5", borderRadius: 16, backgroundColor: "#fff" },
  primaryButton: { flex: 1.2, minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 16, backgroundColor: C.brand },
  secondaryButtonText: { color: C.brand, fontSize: 14, fontWeight: "900" },
  primaryButtonText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  error: { marginTop: 12, color: "#c2410c", fontSize: 13, fontWeight: "700", textAlign: "center" },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.55 },
});
