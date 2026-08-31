import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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

import type { PanoramaUploadAsset, PanoramaUploadShot } from "../api";
import { LoadingDots } from "@/components/loading-dots";
import { tourColors as C } from "../theme/tour-brand";

export type RecordedPanoramaAsset = PanoramaUploadAsset;

type PanoramaAssetRecorderProps = {
  visible: boolean;
  onClose: () => void;
  onUpload: (asset: RecordedPanoramaAsset) => Promise<void>;
};

function defaultAssetName() {
  return `360° tour photo ${new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date())}`;
}

function targetHeading(index: number, shotCount: number) {
  return Math.round((index * (360 / shotCount)) * 10) / 10;
}

export function PanoramaAssetRecorder({ visible, onClose, onUpload }: PanoramaAssetRecorderProps) {
  const insets = useSafeAreaInsets();
  const [shotCount, setShotCount] = useState<6 | 8>(6);
  const [shots, setShots] = useState<PanoramaUploadShot[]>([]);
  const [name, setName] = useState(defaultAssetName);
  const [description, setDescription] = useState("");
  const [openingCamera, setOpeningCamera] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const complete = shots.length === shotCount;
  const nextHeading = useMemo(() => targetHeading(shots.length, shotCount), [shotCount, shots.length]);

  const reset = useCallback(() => {
    setShotCount(6);
    setShots([]);
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
    if (openingCamera || uploading || complete) return;
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
        quality: 0.88,
      });
      const asset = result.assets?.[0];
      if (result.canceled || !asset) return;

      const index = shots.length;
      const headingDegrees = targetHeading(index, shotCount);
      const extension = asset.mimeType?.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
      setShots((current) => [
        ...current,
        {
          uri: asset.uri,
          fileName: asset.fileName ?? `tour-panorama-${Date.now()}-${index + 1}.${extension}`,
          mimeType: "image/jpeg",
          index,
          headingDegrees,
          targetHeadingDegrees: headingDegrees,
          rollDegrees: 0,
          pitchDegrees: 0,
        },
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not capture this panorama photo.");
    } finally {
      setOpeningCamera(false);
    }
  }, [complete, openingCamera, shotCount, shots.length, uploading]);

  const removeLastShot = useCallback(() => {
    if (openingCamera || uploading) return;
    setShots((current) => current.slice(0, -1));
    setError(null);
  }, [openingCamera, uploading]);

  const submit = useCallback(async () => {
    if (!complete || uploading || !name.trim()) return;
    setUploading(true);
    setError(null);
    try {
      await onUpload({ name: name.trim(), description: description.trim(), shots });
      reset();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not upload this panorama.");
    } finally {
      setUploading(false);
    }
  }, [complete, description, name, onClose, onUpload, reset, shots, uploading]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.page, { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 18) }]}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Close panorama capture" onPress={onClose} disabled={uploading} style={styles.headerButton}>
            <Ionicons name="close" size={22} color={C.text} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>360° ASSET</Text>
            <Text style={styles.title}>Build your panorama</Text>
          </View>
          <Pressable accessibilityLabel="Start panorama over" onPress={reset} disabled={uploading || shots.length === 0} style={styles.headerButton}>
            <Ionicons name="refresh" size={20} color={C.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>Capture the room one direction at a time. Keep your position steady and overlap each frame slightly.</Text>

          <View style={styles.modeRow}>
            {([6, 8] as const).map((count) => (
              <Pressable key={count} disabled={shots.length > 0 || uploading} onPress={() => setShotCount(count)} style={({ pressed }) => [styles.modeButton, shotCount === count && styles.modeButtonActive, pressed && styles.pressed, (shots.length > 0 || uploading) && styles.modeButtonDisabled]}>
                <Text style={[styles.modeTitle, shotCount === count && styles.modeTitleActive]}>{count} photos</Text>
                <Text style={[styles.modeMeta, shotCount === count && styles.modeMetaActive]}>{count === 6 ? "Fast capture" : "More detail"}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.progressHeader}>
            <View>
              <Text style={styles.progressLabel}>PHOTO {Math.min(shots.length + 1, shotCount)} OF {shotCount}</Text>
              <Text style={styles.progressTitle}>{complete ? "Ready to upload" : `Turn to ${Math.round(nextHeading)}°`}</Text>
            </View>
            <Text style={styles.progressValue}>{shots.length}/{shotCount}</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(shots.length / shotCount) * 100}%` }]} />
          </View>

          <View style={styles.shotGrid}>
            {Array.from({ length: shotCount }, (_, index) => {
              const shot = shots[index];
              return (
                <View key={index} style={[styles.shotTile, shot && styles.shotTileDone]}>
                  {shot ? <Image source={{ uri: shot.uri }} style={styles.shotImage} /> : <Ionicons name="add" size={19} color={C.textMuted} />}
                  <Text style={styles.shotLabel}>{Math.round(targetHeading(index, shotCount))}°</Text>
                </View>
              );
            })}
          </View>

          {!complete ? (
            <View style={styles.captureArea}>
              <Pressable onPress={() => void capture()} disabled={openingCamera || uploading} style={({ pressed }) => [styles.captureButton, pressed && styles.pressed, (openingCamera || uploading) && styles.disabled]}>
                {openingCamera ? <LoadingDots size="small" color="#fff" /> : <Ionicons name="camera-outline" size={20} color="#fff" />}
                <Text style={styles.captureText}>{openingCamera ? "Opening camera…" : `Capture ${Math.round(nextHeading)}°`}</Text>
              </Pressable>
              {shots.length > 0 ? (
                <Pressable onPress={removeLastShot} disabled={openingCamera || uploading} style={({ pressed }) => [styles.undoButton, pressed && styles.pressed]}>
                  <Ionicons name="arrow-undo-outline" size={17} color={C.brand} />
                  <Text style={styles.undoText}>Retake last photo</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.label}>Panorama name</Text>
              <TextInput value={name} onChangeText={setName} editable={!uploading} placeholder="Name this panorama" placeholderTextColor={C.textMuted} style={styles.input} />
              <Text style={styles.label}>Description or notes</Text>
              <TextInput value={description} onChangeText={setDescription} editable={!uploading} multiline placeholder="Add room details or context" placeholderTextColor={C.textMuted} style={[styles.input, styles.descriptionInput]} />
              <Pressable onPress={() => void submit()} disabled={uploading || !name.trim()} style={({ pressed }) => [styles.uploadButton, pressed && styles.pressed, (uploading || !name.trim()) && styles.disabled]}>
                {uploading ? <LoadingDots size="small" color="#fff" /> : <Ionicons name="cloud-upload-outline" size={19} color="#fff" />}
                <Text style={styles.captureText}>{uploading ? "Uploading panorama…" : "Stitch and upload"}</Text>
              </Pressable>
            </View>
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f7f8fb", paddingHorizontal: 20 },
  header: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12 },
  headerButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#e1e7ef", borderRadius: 14, backgroundColor: "#fff" },
  headerCopy: { flex: 1 },
  eyebrow: { color: "#059669", fontSize: 10, fontWeight: "900", letterSpacing: 1.1 },
  title: { marginTop: 2, color: C.text, fontSize: 18, fontWeight: "900" },
  content: { paddingTop: 20, paddingBottom: 10 },
  intro: { color: C.textSec, fontSize: 14, fontWeight: "600", lineHeight: 21 },
  modeRow: { flexDirection: "row", gap: 10, marginTop: 18 },
  modeButton: { flex: 1, padding: 14, borderWidth: 1, borderColor: "#dbe3ed", borderRadius: 16, backgroundColor: "#fff" },
  modeButtonActive: { borderColor: "#a7f3d0", backgroundColor: "#ecfdf5" },
  modeButtonDisabled: { opacity: 0.7 },
  modeTitle: { color: C.text, fontSize: 14, fontWeight: "900" },
  modeTitleActive: { color: "#047857" },
  modeMeta: { marginTop: 3, color: C.textMuted, fontSize: 11, fontWeight: "700" },
  modeMetaActive: { color: "#059669" },
  progressHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 26 },
  progressLabel: { color: C.textMuted, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  progressTitle: { marginTop: 4, color: C.text, fontSize: 18, fontWeight: "900" },
  progressValue: { color: "#059669", fontSize: 16, fontWeight: "900" },
  progressTrack: { height: 7, overflow: "hidden", marginTop: 12, borderRadius: 99, backgroundColor: "#dff7ed" },
  progressFill: { height: "100%", borderRadius: 99, backgroundColor: "#10b981" },
  shotGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 20 },
  shotTile: { width: "30.8%", aspectRatio: 1, alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 1, borderStyle: "dashed", borderColor: "#cbd5e1", borderRadius: 14, backgroundColor: "#fff" },
  shotTileDone: { borderStyle: "solid", borderColor: "#86efac" },
  shotImage: { ...StyleSheet.absoluteFillObject, width: undefined, height: undefined },
  shotLabel: { position: "absolute", right: 6, bottom: 6, overflow: "hidden", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, backgroundColor: "rgba(15,23,42,0.72)", color: "#fff", fontSize: 10, fontWeight: "900" },
  captureArea: { gap: 12, marginTop: 22 },
  captureButton: { minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, borderRadius: 16, backgroundColor: "#059669" },
  captureText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  undoButton: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, padding: 10 },
  undoText: { color: C.brand, fontSize: 13, fontWeight: "800" },
  form: { gap: 10, marginTop: 22 },
  label: { marginTop: 6, color: C.text, fontSize: 12, fontWeight: "900" },
  input: { minHeight: 50, paddingHorizontal: 14, borderWidth: 1, borderColor: "#dbe3ed", borderRadius: 14, backgroundColor: "#fff", color: C.text, fontSize: 14, fontWeight: "600" },
  descriptionInput: { minHeight: 102, paddingTop: 13, textAlignVertical: "top" },
  uploadButton: { minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, marginTop: 10, borderRadius: 16, backgroundColor: "#059669" },
  error: { marginTop: 14, color: "#c2410c", fontSize: 13, fontWeight: "700", textAlign: "center" },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.55 },
});
