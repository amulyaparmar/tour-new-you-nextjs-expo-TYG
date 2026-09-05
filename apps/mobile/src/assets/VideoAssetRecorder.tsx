import { Ionicons } from "@expo/vector-icons";
import { Asset } from "expo-asset";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Asset as MediaLibraryAsset, requestPermissionsAsync } from "expo-media-library";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
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
import { SecondaryButton } from "@/components/secondary-button";
import { ACCENT, BACKGROUND, CARD, HINT, LARGE_CORNER, SMALL_CORNER } from "@/theme/tokens";
import { formatElapsed } from "../recording";
import { isSimulator } from "../runtime";
import { tourColors as C } from "../theme/tour-brand";

const MAX_RECORDING_SECONDS = 10 * 60;
const MAX_RECORDING_BYTES = 500 * 1024 * 1024;
const MOCK_CAMERA_VIDEO = require("../../assets/videos/login-bg.mp4");
const USE_SIMULATOR_CAMERA = __DEV__ && isSimulator();

type RecordedVideoAsset = {
  uri: string;
  fileName: string;
  mimeType: "video/mp4" | "video/quicktime";
  name: string;
  description: string;
  durationSec: number;
};

type VideoAssetRecorderProps = {
  visible: boolean;
  onClose: () => void;
  onUpload: (asset: RecordedVideoAsset) => Promise<void>;
};

function asFileUri(path: string) {
  return path.startsWith("file://") ? path : `file://${path}`;
}

function defaultAssetName() {
  return `Tour video ${new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date())}`;
}

async function resolveMockCameraVideo() {
  const asset = Asset.fromModule(MOCK_CAMERA_VIDEO);
  if (!asset.localUri) {
    await asset.downloadAsync();
  }
  const uri = asset.localUri ?? asset.uri;
  if (!uri) {
    throw new Error("The simulator camera sample could not be loaded.");
  }
  return uri;
}

function SimulatorCameraPreview({ position }: { position: "back" | "front" }) {
  const player = useVideoPlayer(MOCK_CAMERA_VIDEO, (instance) => {
    instance.loop = true;
    instance.muted = true;
    instance.play();
  });

  return (
    <View style={StyleSheet.absoluteFill}>
      <VideoView
        player={player}
        style={[
          StyleSheet.absoluteFill,
          position === "front" && styles.simulatorPreviewFront,
        ]}
        contentFit="cover"
        nativeControls={false}
      />
      <View pointerEvents="none" style={styles.simulatorPreviewTint} />
      <View pointerEvents="none" style={styles.simulatorBadge}>
        <Ionicons name="construct-outline" size={13} color={CARD} />
        <CustomText textStyle="micro" style={styles.simulatorBadgeText}>
          Simulator camera
        </CustomText>
      </View>
    </View>
  );
}

function PermissionGate({
  cameraStatus,
  microphoneStatus,
  requesting,
  onRequest,
  onClose,
}: {
  cameraStatus: string;
  microphoneStatus: string;
  requesting: boolean;
  onRequest: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const footerPad = Math.max(insets.bottom, 16);
  const canRequest = ["undetermined", "not-determined"].includes(cameraStatus)
    || ["undetermined", "not-determined"].includes(microphoneStatus);
  return (
    <View style={styles.page}>
      <View style={[styles.permissionBody, { paddingTop: glassNavContentInset(insets.top), paddingBottom: 58 + footerPad }]}>
        <View style={styles.permissionIcon}>
          <Ionicons name="videocam" size={28} color={ACCENT} />
        </View>
        <CustomText textStyle="hero" style={styles.centered}>
          Camera and microphone
        </CustomText>
        <CustomText textStyle="body" style={styles.permissionCopy}>
          Tour uses your camera and microphone only while you record a video asset.
        </CustomText>
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
          disabled={requesting}
          onPress={canRequest ? onRequest : () => void Linking.openSettings()}
          style={({ pressed }) => [
            styles.primaryBtn,
            requesting && styles.disabled,
            pressed && !requesting && styles.pressed,
          ]}
        >
          {requesting ? (
            <LoadingDots size="small" color={CARD} />
          ) : (
            <CustomText textStyle="title" style={styles.primaryBtnText}>
              {canRequest ? "Allow access" : "Open Settings"}
            </CustomText>
          )}
        </Pressable>
      </View>
      <GlassNavHeader
        title="Video"
        backButton={
          <LiquidGlassIconButton
            icon="close"
            accessibilityLabel="Close video recorder"
            onPress={onClose}
          />
        }
      />
    </View>
  );
}

function RecordedVideoReview({
  uri,
  durationSec,
  onRetake,
  onSave,
  onUpload,
  onClose,
  saving,
  saved,
  uploading,
  error,
}: {
  uri: string;
  durationSec: number;
  onRetake: () => void;
  onSave: () => void;
  onUpload: (name: string, description: string) => void;
  onClose: () => void;
  saving: boolean;
  saved: boolean;
  uploading: boolean;
  error: string | null;
}) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(defaultAssetName);
  const [description, setDescription] = useState("");
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
  });
  const footerPad = Math.max(insets.bottom, 16);
  const busy = saving || uploading;

  return (
    <View style={styles.page}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.reviewContent,
          {
            paddingTop: glassNavContentInset(insets.top),
            paddingBottom: 58 + 58 + 18 + footerPad + 24,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.playerFrame}>
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls
            fullscreenOptions={{ enable: true }}
          />
          <View pointerEvents="none" style={styles.durationBadge}>
            <Ionicons name="videocam" size={13} color={CARD} />
            <CustomText textStyle="micro" style={styles.durationBadgeText}>
              {formatElapsed(durationSec)}
            </CustomText>
          </View>
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
              placeholder="Name this video"
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
              placeholder="Add the script, shot details, or context for your team"
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
        <SecondaryButton
          label={saved ? "Saved to Photos" : "Save to Photos"}
          icon={saved ? "checkmark-circle" : "images-outline"}
          disabled={busy || saved}
          onPress={onSave}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Upload video asset"
          disabled={uploading || !name.trim()}
          onPress={() => onUpload(name.trim(), description.trim())}
          style={({ pressed }) => [
            styles.primaryBtn,
            (uploading || !name.trim()) && styles.disabled,
            pressed && !uploading && Boolean(name.trim()) && styles.pressed,
          ]}
        >
          {uploading ? (
            <LoadingDots size="small" color={CARD} />
          ) : (
            <CustomText textStyle="title" style={styles.primaryBtnText}>
              Add video
            </CustomText>
          )}
        </Pressable>
      </View>

      <GlassNavHeader
        title="Review video"
        backButton={
          <LiquidGlassIconButton
            icon="close"
            accessibilityLabel="Close video review"
            onPress={onClose}
          />
        }
        right={
          <LiquidGlassIconButton
            icon="refresh"
            accessibilityLabel="Record video again"
            disabled={uploading}
            onPress={onRetake}
          />
        }
      />
    </View>
  );
}

export function VideoAssetRecorder({ visible, onClose, onUpload }: VideoAssetRecorderProps) {
  const insets = useSafeAreaInsets();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [position, setPosition] = useState<"back" | "front">("back");
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [recordedDurationSec, setRecordedDurationSec] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<CameraView | null>(null);
  const recordingActiveRef = useRef(false);
  const recordingGenerationRef = useRef(0);
  const recordingStartedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = undefined;
  }, []);

  const resetCapture = useCallback(() => {
    clearTimer();
    recordingGenerationRef.current += 1;
    if (recordingActiveRef.current && !USE_SIMULATOR_CAMERA) {
      cameraRef.current?.stopRecording();
    }
    recordingActiveRef.current = false;
    setIsRecording(false);
    setDurationSec(0);
    setRecordedUri(null);
    setRecordedDurationSec(0);
    setSaved(false);
    setError(null);
  }, [clearTimer]);

  useEffect(() => {
    if (!visible) resetCapture();
  }, [resetCapture, visible]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  useEffect(() => {
    setCameraReady(USE_SIMULATOR_CAMERA);
    setTorchEnabled(false);
  }, [position]);

  const requestPermissions = useCallback(async () => {
    setRequestingPermission(true);
    try {
      const cameraAllowed = cameraPermission?.granted
        ? true
        : cameraPermission?.canAskAgain !== false
          ? (await requestCameraPermission()).granted
          : false;
      const microphoneAllowed = microphonePermission?.granted
        ? true
        : microphonePermission?.canAskAgain !== false
          ? (await requestMicrophonePermission()).granted
          : false;
      if (!cameraAllowed || !microphoneAllowed) {
        setError("Camera and microphone access are required to record a video.");
      }
    } finally {
      setRequestingPermission(false);
    }
  }, [cameraPermission, microphonePermission, requestCameraPermission, requestMicrophonePermission]);

  const finishRecording = useCallback((path: string) => {
    clearTimer();
    const elapsed = Math.max(1, Math.round((Date.now() - recordingStartedAtRef.current) / 1000));
    recordingActiveRef.current = false;
    setIsRecording(false);
    setRecordedDurationSec(elapsed);
    setRecordedUri(asFileUri(path));
    setError(null);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [clearTimer]);

  const startRecording = useCallback(async () => {
    if (!cameraReady || isRecording || recordingActiveRef.current) return;
    setError(null);
    setSaved(false);
    if (USE_SIMULATOR_CAMERA) {
      recordingStartedAtRef.current = Date.now();
      setIsRecording(true);
      setDurationSec(0);
      timerRef.current = setInterval(() => {
        setDurationSec(Math.max(0, Math.floor((Date.now() - recordingStartedAtRef.current) / 1000)));
      }, 500);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      return;
    }
    const camera = cameraRef.current;
    if (!camera) {
      setError("The camera is still starting. Please try again.");
      return;
    }
    try {
      const generation = recordingGenerationRef.current + 1;
      recordingGenerationRef.current = generation;
      recordingActiveRef.current = true;
      recordingStartedAtRef.current = Date.now();
      setIsRecording(true);
      setDurationSec(0);
      const recording = camera.recordAsync({
        maxDuration: MAX_RECORDING_SECONDS,
        maxFileSize: MAX_RECORDING_BYTES,
        codec: "avc1",
      });
      void recording.then((result) => {
        if (recordingGenerationRef.current !== generation) return;
        if (!result?.uri) {
          clearTimer();
          recordingActiveRef.current = false;
          setIsRecording(false);
          setError("Video recording ended without creating a file.");
          return;
        }
        finishRecording(result.uri);
      }).catch((caught: unknown) => {
        if (recordingGenerationRef.current !== generation) return;
        clearTimer();
        recordingActiveRef.current = false;
        setIsRecording(false);
        setError(caught instanceof Error ? caught.message : "Video recording failed.");
      });
      timerRef.current = setInterval(() => {
        setDurationSec(Math.max(0, Math.floor((Date.now() - recordingStartedAtRef.current) / 1000)));
      }, 500);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (caught) {
      recordingActiveRef.current = false;
      setIsRecording(false);
      setError(caught instanceof Error ? caught.message : "Could not start video recording.");
    }
  }, [cameraReady, clearTimer, finishRecording, isRecording]);

  const stopRecording = useCallback(async () => {
    if (USE_SIMULATOR_CAMERA && isRecording) {
      try {
        const uri = await resolveMockCameraVideo();
        finishRecording(uri);
      } catch (caught) {
        clearTimer();
        setIsRecording(false);
        setError(caught instanceof Error ? caught.message : "Could not prepare the simulator recording.");
      }
      return;
    }
    if (!recordingActiveRef.current || !isRecording) return;
    try {
      cameraRef.current?.stopRecording();
    } catch (caught) {
      clearTimer();
      recordingActiveRef.current = false;
      setIsRecording(false);
      setError(caught instanceof Error ? caught.message : "Could not stop video recording.");
    }
  }, [clearTimer, finishRecording, isRecording]);

  const requestClose = useCallback(() => {
    if (!isRecording && (!recordedUri || saved)) {
      onClose();
      return;
    }
    Alert.alert("Discard this recording?", "The current video has not been saved or uploaded.", [
      { text: isRecording ? "Keep recording" : "Keep video", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => {
          resetCapture();
          onClose();
        },
      },
    ]);
  }, [isRecording, onClose, recordedUri, resetCapture, saved]);

  const saveToPhotos = useCallback(async () => {
    if (!recordedUri || saving || saved) return;
    setSaving(true);
    setError(null);
    try {
      const permission = await requestPermissionsAsync(true, ["video"]);
      if (!permission.granted) {
        Alert.alert(
          "Photos access is off",
          "Allow Tour to add videos in Settings, then try again.",
          [
            { text: "Not now", style: "cancel" },
            { text: "Open Settings", onPress: () => void Linking.openSettings() },
          ],
        );
        return;
      }
      await MediaLibraryAsset.create(recordedUri);
      setSaved(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this video to Photos.");
    } finally {
      setSaving(false);
    }
  }, [recordedUri, saved, saving]);

  const uploadAsset = useCallback(async (name: string, description: string) => {
    if (!recordedUri || uploading) return;
    setUploading(true);
    setError(null);
    try {
      const quickTime = /\.mov(?:$|[?#])/i.test(recordedUri);
      await onUpload({
        uri: recordedUri,
        fileName: `tour-video-${Date.now()}.${quickTime ? "mov" : "mp4"}`,
        mimeType: quickTime ? "video/quicktime" : "video/mp4",
        name,
        description,
        durationSec: recordedDurationSec,
      });
      resetCapture();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not upload this video asset.");
    } finally {
      setUploading(false);
    }
  }, [onClose, onUpload, recordedDurationSec, recordedUri, resetCapture, uploading]);

  const hasPermissions = USE_SIMULATOR_CAMERA
    || Boolean(cameraPermission?.granted && microphonePermission?.granted);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={requestClose}
    >
      {recordedUri ? (
        <RecordedVideoReview
          uri={recordedUri}
          durationSec={recordedDurationSec}
          onRetake={resetCapture}
          onSave={() => void saveToPhotos()}
          onUpload={(name, description) => void uploadAsset(name, description)}
          onClose={requestClose}
          saving={saving}
          saved={saved}
          uploading={uploading}
          error={error}
        />
      ) : !hasPermissions ? (
        <PermissionGate
          cameraStatus={cameraPermission?.status ?? "undetermined"}
          microphoneStatus={microphonePermission?.status ?? "undetermined"}
          requesting={requestingPermission}
          onRequest={() => void requestPermissions()}
          onClose={onClose}
        />
      ) : (
        <View style={styles.cameraPage}>
          {USE_SIMULATOR_CAMERA ? (
            <SimulatorCameraPreview position={position} />
          ) : (
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              active={visible}
              facing={position}
              mode="video"
              mute={false}
              enableTorch={torchEnabled}
              videoQuality="1080p"
              videoBitrate={8_000_000}
              videoStabilizationMode="auto"
              responsiveOrientationWhenOrientationLocked={false}
              onCameraReady={() => setCameraReady(true)}
              onMountError={(caught) => {
                setCameraReady(false);
                setError(caught.message);
              }}
            />
          )}

          <View pointerEvents="box-none" style={[styles.cameraHeader, { paddingTop: insets.top }]}>
            <View style={styles.cameraBar}>
              <LiquidGlassIconButton
                icon="close"
                accessibilityLabel="Close video recorder"
                onPress={requestClose}
              />
              <View style={[styles.recordingPill, isRecording && styles.recordingPillActive]}>
                <View style={[styles.recordingDot, isRecording && styles.recordingDotActive]} />
                <CustomText textStyle="micro" style={styles.recordingTime}>
                  {isRecording ? formatElapsed(durationSec) : "Video"}
                </CustomText>
              </View>
              <LiquidGlassIconButton
                icon={torchEnabled ? "flash" : "flash-off"}
                accessibilityLabel={torchEnabled ? "Turn flash off" : "Turn flash on"}
                disabled={USE_SIMULATOR_CAMERA || isRecording}
                onPress={() => setTorchEnabled((current) => !current)}
              />
            </View>
          </View>

          <View style={styles.captureGuide} pointerEvents="none">
            <CustomText textStyle="hero" style={styles.captureGuideTitle}>
              {isRecording ? "Recording…" : "Frame your tour"}
            </CustomText>
            <CustomText textStyle="caption" style={styles.captureGuideBody}>
              {isRecording
                ? "Tap stop when the walkthrough is complete."
                : "Capture a walkthrough, amenity, or community highlight."}
            </CustomText>
          </View>

          <View style={[styles.cameraFooter, { paddingBottom: Math.max(insets.bottom, Platform.OS === "ios" ? 18 : 24) }]}>
            <View style={styles.footerSide} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isRecording ? "Stop video recording" : "Start video recording"}
              disabled={!cameraReady}
              onPress={isRecording ? () => void stopRecording() : () => void startRecording()}
              style={({ pressed }) => [
                styles.captureButton,
                isRecording && styles.captureButtonRecording,
                pressed && styles.captureButtonPressed,
                !cameraReady && styles.disabled,
              ]}
            >
              <View style={[styles.captureButtonInner, isRecording && styles.captureButtonStop]} />
            </Pressable>
            <View style={styles.footerSide}>
              <LiquidGlassIconButton
                icon="camera-reverse-outline"
                accessibilityLabel="Switch camera"
                disabled={isRecording}
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

export type { RecordedVideoAsset };

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: BACKGROUND },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.45 },
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
  reviewContent: { gap: 16, paddingHorizontal: 16 },
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
    gap: 10,
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
  cameraPage: { flex: 1, overflow: "hidden", backgroundColor: "#000" },
  simulatorPreviewFront: { transform: [{ scaleX: -1 }] },
  simulatorPreviewTint: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.1)" },
  simulatorBadge: {
    position: "absolute",
    top: Platform.OS === "ios" ? 116 : 84,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.58)",
  },
  simulatorBadgeText: { color: CARD, letterSpacing: 0.4 },
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
  recordingPill: {
    flex: 1,
    minWidth: 110,
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginHorizontal: 12,
    paddingHorizontal: 13,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  recordingPillActive: { backgroundColor: "rgba(185,28,28,0.86)" },
  recordingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.55)" },
  recordingDotActive: { backgroundColor: CARD },
  recordingTime: { color: CARD },
  captureGuide: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 152,
    alignItems: "center",
  },
  captureGuideTitle: {
    color: CARD,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowRadius: 8,
  },
  captureGuideBody: {
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
    minHeight: 130,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingTop: 18,
    paddingHorizontal: 24,
  },
  footerSide: { width: 56, alignItems: "center" },
  captureButton: {
    width: 84,
    height: 84,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 5,
    borderColor: CARD,
    borderRadius: 42,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  captureButtonRecording: { borderColor: "#fecaca" },
  captureButtonPressed: { transform: [{ scale: 0.94 }] },
  captureButtonInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#ef4444" },
  captureButtonStop: { width: 28, height: 28, borderRadius: 6, backgroundColor: "#ef4444" },
  cameraError: {
    position: "absolute",
    left: 20,
    right: 20,
    padding: 12,
    borderRadius: SMALL_CORNER,
    backgroundColor: "rgba(127,29,29,0.92)",
  },
  cameraErrorText: { color: CARD, textAlign: "center" },
  playerFrame: {
    height: 280,
    overflow: "hidden",
    borderRadius: LARGE_CORNER,
    borderCurve: "continuous",
    backgroundColor: "#000",
  },
  durationBadge: {
    position: "absolute",
    right: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  durationBadgeText: { color: CARD },
});
