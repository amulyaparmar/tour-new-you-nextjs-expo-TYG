import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
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

function asFileUri(path: string) {
  return path.startsWith("file://") ? path : `file://${path}`;
}

function defaultPhotoName() {
  return `Tour photo ${new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date())}`;
}

export function PhotoAssetRecorder({ visible, onClose, onUpload }: PhotoAssetRecorderProps) {
  const insets = useSafeAreaInsets();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [position, setPosition] = useState<"back" | "front">("back");
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [takingPhoto, setTakingPhoto] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [name, setName] = useState(defaultPhotoName);
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<CameraView | null>(null);

  const reset = useCallback(() => {
    setCameraReady(false);
    setTakingPhoto(false);
    setPhotoUri(null);
    setName(defaultPhotoName());
    setDescription("");
    setUploading(false);
    setTorchEnabled(false);
    setError(null);
  }, []);

  useEffect(() => {
    if (!visible) reset();
  }, [reset, visible]);

  useEffect(() => {
    setCameraReady(false);
    setTorchEnabled(false);
  }, [position]);

  const requestPermission = useCallback(async () => {
    setRequestingPermission(true);
    setError(null);
    try {
      const permission = await requestCameraPermission();
      if (!permission.granted) {
        setError("Camera access is required to take a photo asset.");
      }
    } finally {
      setRequestingPermission(false);
    }
  }, [requestCameraPermission]);

  const capturePhoto = useCallback(async () => {
    if (!cameraReady || takingPhoto || !cameraRef.current) return;
    setTakingPhoto(true);
    setError(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.92,
        exif: false,
        skipProcessing: false,
      });
      if (!photo?.uri) throw new Error("The camera did not return a photo.");
      setPhotoUri(asFileUri(photo.uri));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not take this photo.");
    } finally {
      setTakingPhoto(false);
    }
  }, [cameraReady, takingPhoto]);

  const requestClose = useCallback(() => {
    if (!photoUri || uploading) {
      if (!uploading) onClose();
      return;
    }
    Alert.alert("Discard this photo?", "The photo has not been added to the community yet.", [
      { text: "Keep photo", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => {
          reset();
          onClose();
        },
      },
    ]);
  }, [onClose, photoUri, reset, uploading]);

  const uploadPhoto = useCallback(async () => {
    if (!photoUri || uploading) return;
    setUploading(true);
    setError(null);
    try {
      await onUpload({
        uri: photoUri,
        fileName: `tour-photo-${Date.now()}.jpg`,
        mimeType: "image/jpeg",
        name: name.trim() || defaultPhotoName(),
        description: description.trim(),
      });
      reset();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not upload this photo asset.");
      setUploading(false);
    }
  }, [description, name, onClose, onUpload, photoUri, reset, uploading]);

  const hasPermission = Boolean(cameraPermission?.granted);
  const canRequestPermission = cameraPermission?.canAskAgain !== false;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={requestClose}
    >
      {photoUri ? (
        <KeyboardAvoidingView style={styles.reviewPage} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[styles.reviewHeader, { paddingTop: insets.top + 10 }]}>
            <Pressable accessibilityLabel="Close photo review" disabled={uploading} onPress={requestClose} style={styles.lightButton}>
              <Ionicons name="close" size={22} color={C.text} />
            </Pressable>
            <View style={styles.reviewHeading}>
              <Text style={styles.eyebrow}>NEW ASSET</Text>
              <Text style={styles.reviewTitle}>Review your photo</Text>
            </View>
            <Pressable accessibilityLabel="Take photo again" disabled={uploading} onPress={() => setPhotoUri(null)} style={styles.lightButton}>
              <Ionicons name="refresh" size={20} color={C.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.reviewContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.photoFrame}>
              <Image source={{ uri: photoUri }} resizeMode="cover" style={StyleSheet.absoluteFill} />
            </View>
            <View style={styles.form}>
              <Text style={styles.inputLabel}>Asset name</Text>
              <TextInput value={name} onChangeText={setName} editable={!uploading} placeholder="Name this photo" placeholderTextColor={C.textMuted} style={styles.input} />
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                editable={!uploading}
                multiline
                placeholder="Add a room, amenity, or community description"
                placeholderTextColor={C.textMuted}
                style={[styles.input, styles.descriptionInput]}
              />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </View>
            <Pressable disabled={uploading} onPress={() => void uploadPhoto()} style={({ pressed }) => [styles.uploadButton, pressed && styles.pressed, uploading && styles.disabled]}>
              {uploading ? <LoadingDots size="small" color="#fff" /> : <Ionicons name="cloud-upload-outline" size={20} color="#fff" />}
              <Text style={styles.uploadButtonText}>{uploading ? "Adding photo…" : "Add photo asset"}</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : !hasPermission ? (
        <View style={styles.permissionPage}>
          <Pressable accessibilityLabel="Close photo camera" onPress={onClose} style={[styles.permissionClose, { top: insets.top + 10 }]}>
            <Ionicons name="close" size={23} color={C.text} />
          </Pressable>
          <View style={styles.permissionIcon}><Ionicons name="camera" size={34} color={C.brand} /></View>
          <Text style={styles.permissionTitle}>Camera access</Text>
          <Text style={styles.permissionBody}>Tour uses your camera only while you take a photo asset.</Text>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Pressable
            disabled={requestingPermission}
            onPress={canRequestPermission ? () => void requestPermission() : () => void Linking.openSettings()}
            style={({ pressed }) => [styles.permissionButton, pressed && styles.pressed, requestingPermission && styles.disabled]}
          >
            {requestingPermission ? <LoadingDots size="small" color="#fff" /> : null}
            <Text style={styles.permissionButtonText}>{canRequestPermission ? "Allow camera" : "Open Settings"}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.cameraPage}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            active={visible}
            facing={position}
            mode="picture"
            enableTorch={torchEnabled}
            onCameraReady={() => setCameraReady(true)}
            onMountError={(caught) => {
              setCameraReady(false);
              setError(caught.message);
            }}
          />

          <View style={[styles.cameraHeader, { paddingTop: insets.top + 8 }]}>
            <Pressable accessibilityLabel="Close photo camera" onPress={requestClose} style={styles.cameraButton}>
              <Ionicons name="close" size={23} color="#fff" />
            </Pressable>
            <View style={styles.modePill}>
              <Ionicons name="camera" size={13} color="#fff" />
              <Text style={styles.modeText}>PHOTO ASSET</Text>
            </View>
            <Pressable accessibilityLabel={torchEnabled ? "Turn flash off" : "Turn flash on"} onPress={() => setTorchEnabled((current) => !current)} style={styles.cameraButton}>
              <Ionicons name={torchEnabled ? "flash" : "flash-off"} size={20} color="#fff" />
            </Pressable>
          </View>

          <View pointerEvents="none" style={styles.captureGuide}>
            <Text style={styles.captureGuideTitle}>{takingPhoto ? "Capturing…" : "Frame your photo"}</Text>
            <Text style={styles.captureGuideBody}>Capture a room, amenity, or community highlight.</Text>
          </View>

          <View style={[styles.cameraFooter, { paddingBottom: Math.max(insets.bottom, Platform.OS === "ios" ? 18 : 24) }]}>
            <View style={styles.footerSide} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Take photo"
              disabled={!cameraReady || takingPhoto}
              onPress={() => void capturePhoto()}
              style={({ pressed }) => [styles.captureButton, pressed && styles.captureButtonPressed, (!cameraReady || takingPhoto) && styles.disabled]}
            >
              {takingPhoto ? <LoadingDots size="small" color={C.brand} /> : <View style={styles.captureButtonInner} />}
            </Pressable>
            <View style={styles.footerSide}>
              <Pressable accessibilityLabel="Switch camera" disabled={takingPhoto} onPress={() => setPosition((current) => current === "back" ? "front" : "back")} style={styles.cameraButton}>
                <Ionicons name="camera-reverse-outline" size={24} color="#fff" />
              </Pressable>
            </View>
          </View>
          {error ? <View style={[styles.cameraError, { bottom: Math.max(insets.bottom, 18) + 112 }]}><Text style={styles.cameraErrorText}>{error}</Text></View> : null}
        </View>
      )}
    </Modal>
  );
}

export type { RecordedPhotoAsset };

const styles = StyleSheet.create({
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.5 },
  cameraPage: { flex: 1, overflow: "hidden", backgroundColor: "#020617" },
  cameraHeader: { position: "absolute", top: 0, left: 0, right: 0, minHeight: 104, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, backgroundColor: "rgba(2,6,23,0.36)" },
  cameraButton: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: 23, backgroundColor: "rgba(15,23,42,0.56)" },
  modePill: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 13, borderRadius: 17, backgroundColor: "rgba(15,23,42,0.62)" },
  modeText: { color: "#fff", fontSize: 11, fontWeight: "900", letterSpacing: 0.7 },
  captureGuide: { position: "absolute", top: "19%", left: 24, right: 24, alignItems: "center" },
  captureGuideTitle: { color: "#fff", fontSize: 22, fontWeight: "900", textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 8 },
  captureGuideBody: { maxWidth: 310, marginTop: 5, color: "rgba(255,255,255,0.84)", fontSize: 12, lineHeight: 17, fontWeight: "700", textAlign: "center", textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 7 },
  cameraFooter: { position: "absolute", left: 0, right: 0, bottom: 0, minHeight: 148, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 28, paddingTop: 18, backgroundColor: "rgba(2,6,23,0.48)" },
  footerSide: { width: 56, alignItems: "center", justifyContent: "center" },
  captureButton: { width: 82, height: 82, alignItems: "center", justifyContent: "center", borderWidth: 5, borderColor: "#fff", borderRadius: 41, backgroundColor: "rgba(255,255,255,0.2)" },
  captureButtonInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: "#fff" },
  captureButtonPressed: { transform: [{ scale: 0.95 }] },
  cameraError: { position: "absolute", left: 24, right: 24, alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: "rgba(153,27,27,0.9)" },
  cameraErrorText: { color: "#fff", fontSize: 12, fontWeight: "800", textAlign: "center" },
  permissionPage: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 30, backgroundColor: "#f8fafc" },
  permissionClose: { position: "absolute", right: 20, width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: "#fff" },
  permissionIcon: { width: 72, height: 72, alignItems: "center", justifyContent: "center", marginBottom: 18, borderRadius: 24, backgroundColor: "#eaf4ff" },
  permissionTitle: { color: C.text, fontSize: 24, fontWeight: "900", textAlign: "center" },
  permissionBody: { maxWidth: 330, marginTop: 8, color: C.textSec, fontSize: 14, lineHeight: 20, fontWeight: "600", textAlign: "center" },
  permissionButton: { minWidth: 190, minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 22, paddingHorizontal: 20, borderRadius: 26, backgroundColor: C.brand },
  permissionButtonText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  reviewPage: { flex: 1, backgroundColor: "#f8fafc" },
  reviewHeader: { minHeight: 108, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#dbe3ec", backgroundColor: "#fff" },
  lightButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: "#f1f5f9" },
  reviewHeading: { flex: 1, alignItems: "center" },
  eyebrow: { color: C.brand, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  reviewTitle: { color: C.text, fontSize: 18, fontWeight: "900", marginTop: 2 },
  reviewContent: { gap: 16, padding: 18, paddingBottom: 42 },
  photoFrame: { height: 360, overflow: "hidden", borderRadius: 22, backgroundColor: "#e2e8f0" },
  form: { gap: 8, padding: 16, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 20, backgroundColor: "#fff" },
  inputLabel: { color: C.textSec, fontSize: 11, fontWeight: "900" },
  input: { minHeight: 48, paddingHorizontal: 13, borderWidth: 1, borderColor: "#dbe3ec", borderRadius: 13, backgroundColor: "#f8fafc", color: C.text, fontSize: 14, fontWeight: "600" },
  descriptionInput: { minHeight: 92, paddingTop: 13, textAlignVertical: "top" },
  errorText: { marginTop: 10, color: "#b42318", fontSize: 12, lineHeight: 17, fontWeight: "800", textAlign: "center" },
  uploadButton: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, borderRadius: 28, backgroundColor: C.brand },
  uploadButtonText: { color: "#fff", fontSize: 15, fontWeight: "900" },
});
