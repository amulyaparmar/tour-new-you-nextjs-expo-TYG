import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
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
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CustomText, customTextVariants } from "@/components/custom-text";
import { GlassNavHeader, glassNavContentInset } from "@/components/glass-nav-header";
import { LiquidGlassIconButton } from "@/components/liquid-glass-icon-button";
import { LoadingDots } from "@/components/loading-dots";
import { ACCENT, BACKGROUND, CARD, HINT, LARGE_CORNER, SMALL_CORNER } from "@/theme/tokens";
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
  const footerPad = Math.max(insets.bottom, 16);

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
        <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView
            contentContainerStyle={[
              styles.reviewContent,
              {
                paddingTop: glassNavContentInset(insets.top),
                paddingBottom: 58 + 10 + footerPad + 24,
              },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.photoFrame}>
              <Image source={{ uri: photoUri }} resizeMode="cover" style={StyleSheet.absoluteFill} />
            </View>
            <View style={styles.form}>
              <View style={styles.field}>
                <CustomText textStyle="caption" style={styles.fieldLabel}>
                  Asset name
                </CustomText>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  editable={!uploading}
                  placeholder="Name this photo"
                  placeholderTextColor="rgba(0, 0, 0, 0.45)"
                  style={[customTextVariants.title, styles.input]}
                />
              </View>
              <View style={styles.separator} />
              <View style={styles.field}>
                <CustomText textStyle="caption" style={styles.fieldLabel}>
                  Description
                </CustomText>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  editable={!uploading}
                  multiline
                  placeholder="Add a room, amenity, or community description"
                  placeholderTextColor="rgba(0, 0, 0, 0.45)"
                  style={[customTextVariants.body, styles.input, styles.descriptionInput]}
                />
              </View>
            </View>
            {error ? (
              <CustomText textStyle="caption" style={styles.errorText}>
                {error}
              </CustomText>
            ) : null}
          </ScrollView>
          <View pointerEvents="box-none" style={[styles.pageFooter, { paddingBottom: footerPad }]}>
            <LinearGradient
              colors={["rgba(242, 242, 247, 0)", "rgba(242, 242, 247, 0.62)", BACKGROUND]}
              locations={[0, 0.5, 1]}
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add photo asset"
              disabled={uploading}
              onPress={() => void uploadPhoto()}
              style={({ pressed }) => [
                styles.primaryBtn,
                uploading && styles.disabled,
                pressed && !uploading && styles.pressed,
              ]}
            >
              {uploading ? (
                <LoadingDots size="small" color={CARD} />
              ) : (
                <CustomText textStyle="title" style={styles.primaryBtnText}>
                  Add photo
                </CustomText>
              )}
            </Pressable>
          </View>
          <GlassNavHeader
            title="Review photo"
            backButton={
              <LiquidGlassIconButton
                icon="close"
                accessibilityLabel="Close photo review"
                disabled={uploading}
                onPress={requestClose}
              />
            }
            right={
              <LiquidGlassIconButton
                icon="refresh"
                accessibilityLabel="Take photo again"
                disabled={uploading}
                onPress={() => setPhotoUri(null)}
              />
            }
          />
        </KeyboardAvoidingView>
      ) : !hasPermission ? (
        <View style={styles.page}>
          <View style={[styles.permissionBody, { paddingTop: glassNavContentInset(insets.top), paddingBottom: 58 + footerPad }]}>
            <View style={styles.permissionIcon}>
              <Ionicons name="camera" size={28} color={ACCENT} />
            </View>
            <CustomText textStyle="hero" style={styles.centered}>
              Camera access
            </CustomText>
            <CustomText textStyle="body" style={styles.permissionCopy}>
              Tour uses your camera only while you take a photo asset.
            </CustomText>
            {error ? (
              <CustomText textStyle="caption" style={styles.errorText}>
                {error}
              </CustomText>
            ) : null}
          </View>
          <View pointerEvents="box-none" style={[styles.pageFooter, { paddingBottom: footerPad }]}>
            <LinearGradient
              colors={["rgba(242, 242, 247, 0)", "rgba(242, 242, 247, 0.62)", BACKGROUND]}
              locations={[0, 0.5, 1]}
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
            />
            <Pressable
              accessibilityRole="button"
              disabled={requestingPermission}
              onPress={canRequestPermission ? () => void requestPermission() : () => void Linking.openSettings()}
              style={({ pressed }) => [
                styles.primaryBtn,
                requestingPermission && styles.disabled,
                pressed && !requestingPermission && styles.pressed,
              ]}
            >
              {requestingPermission ? (
                <LoadingDots size="small" color={CARD} />
              ) : (
                <CustomText textStyle="title" style={styles.primaryBtnText}>
                  {canRequestPermission ? "Allow camera" : "Open Settings"}
                </CustomText>
              )}
            </Pressable>
          </View>
          <GlassNavHeader
            title="Camera"
            backButton={
              <LiquidGlassIconButton
                icon="close"
                accessibilityLabel="Close photo camera"
                onPress={onClose}
              />
            }
          />
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

          <View pointerEvents="box-none" style={[styles.cameraHeader, { paddingTop: insets.top }]}>
            <View style={styles.cameraBar}>
              <LiquidGlassIconButton
                icon="close"
                accessibilityLabel="Close photo camera"
                onPress={requestClose}
              />
              <CustomText textStyle="title" numberOfLines={1} style={styles.cameraTitle}>
                Photo
              </CustomText>
              <LiquidGlassIconButton
                icon={torchEnabled ? "flash" : "flash-off"}
                accessibilityLabel={torchEnabled ? "Turn flash off" : "Turn flash on"}
                onPress={() => setTorchEnabled((current) => !current)}
              />
            </View>
          </View>

          <View pointerEvents="none" style={styles.captureGuide}>
            <CustomText textStyle="hero" style={styles.captureGuideTitle}>
              {takingPhoto ? "Capturing…" : "Frame your photo"}
            </CustomText>
            <CustomText textStyle="caption" style={styles.captureGuideBody}>
              Capture a room, amenity, or community highlight.
            </CustomText>
          </View>

          <View style={[styles.cameraFooter, { paddingBottom: Math.max(insets.bottom, 18) }]}>
            <View style={styles.footerSide} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Take photo"
              disabled={!cameraReady || takingPhoto}
              onPress={() => void capturePhoto()}
              style={({ pressed }) => [
                styles.captureButton,
                pressed && styles.captureButtonPressed,
                (!cameraReady || takingPhoto) && styles.disabled,
              ]}
            >
              {takingPhoto ? <LoadingDots size="small" color={ACCENT} /> : <View style={styles.captureButtonInner} />}
            </Pressable>
            <View style={styles.footerSide}>
              <LiquidGlassIconButton
                icon="camera-reverse-outline"
                accessibilityLabel="Switch camera"
                disabled={takingPhoto}
                onPress={() => setPosition((current) => (current === "back" ? "front" : "back"))}
              />
            </View>
          </View>
          {error ? (
            <View style={[styles.cameraError, { bottom: Math.max(insets.bottom, 18) + 112 }]}>
              <CustomText textStyle="caption" style={styles.cameraErrorText}>
                {error}
              </CustomText>
            </View>
          ) : null}
        </View>
      )}
    </Modal>
  );
}

export type { RecordedPhotoAsset };

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: BACKGROUND },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.45 },
  reviewContent: { gap: 16, paddingHorizontal: 16 },
  photoFrame: {
    height: 360,
    overflow: "hidden",
    borderRadius: LARGE_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  form: {
    overflow: "hidden",
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  field: { paddingHorizontal: 16, paddingVertical: 12, gap: 6 },
  fieldLabel: { color: "rgba(0, 0, 0, 0.45)", textTransform: "uppercase", letterSpacing: 0.4 },
  input: { paddingVertical: 4 },
  descriptionInput: { minHeight: 72, textAlignVertical: "top" },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
    backgroundColor: "rgba(60, 60, 67, 0.18)",
  },
  errorText: { color: C.red, textAlign: "center" },
  pageFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    paddingHorizontal: 16,
    paddingTop: 56,
  },
  primaryBtn: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 29,
    backgroundColor: ACCENT,
    boxShadow: "0 6px 14px rgba(0, 108, 229, 0.28)",
  },
  primaryBtnText: { color: CARD },
  permissionBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 28,
  },
  permissionIcon: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: SMALL_CORNER,
    backgroundColor: HINT,
  },
  permissionCopy: {
    maxWidth: 330,
    color: "rgba(0, 0, 0, 0.45)",
    textAlign: "center",
    lineHeight: 20,
  },
  centered: { textAlign: "center" },
  cameraPage: { flex: 1, overflow: "hidden", backgroundColor: "#000" },
  cameraHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  cameraBar: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  cameraTitle: { flex: 1, color: CARD, textAlign: "center" },
  captureGuide: {
    position: "absolute",
    top: "19%",
    left: 24,
    right: 24,
    alignItems: "center",
  },
  captureGuideTitle: {
    color: CARD,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowRadius: 8,
  },
  captureGuideBody: {
    maxWidth: 310,
    marginTop: 6,
    color: "rgba(255,255,255,0.84)",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowRadius: 7,
  },
  cameraFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 148,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 28,
    paddingTop: 18,
  },
  footerSide: { width: 56, alignItems: "center", justifyContent: "center" },
  captureButton: {
    width: 82,
    height: 82,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 5,
    borderColor: CARD,
    borderRadius: 41,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  captureButtonInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: CARD },
  captureButtonPressed: { transform: [{ scale: 0.95 }] },
  cameraError: {
    position: "absolute",
    left: 24,
    right: 24,
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: SMALL_CORNER,
    backgroundColor: "rgba(153,27,27,0.9)",
  },
  cameraErrorText: { color: CARD, textAlign: "center" },
});
