import { Ionicons } from "@expo/vector-icons";
import { Asset } from "expo-asset";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as MediaLibrary from "expo-media-library";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LoadingDots } from "@/components/loading-dots";
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
        <Ionicons name="construct-outline" size={13} color="#fff" />
        <Text style={styles.simulatorBadgeText}>SIMULATOR CAMERA</Text>
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
  const canRequest = ["undetermined", "not-determined"].includes(cameraStatus)
    || ["undetermined", "not-determined"].includes(microphoneStatus);
  return (
    <View style={styles.permissionPage}>
      <Pressable accessibilityLabel="Close video recorder" onPress={onClose} style={styles.permissionClose}>
        <Ionicons name="close" size={23} color={C.text} />
      </Pressable>
      <View style={styles.permissionIcon}>
        <Ionicons name="videocam" size={34} color={C.brand} />
      </View>
      <Text style={styles.permissionTitle}>Camera and microphone access</Text>
      <Text style={styles.permissionBody}>
        Tour uses your camera and microphone only while you record a video asset.
      </Text>
      <Pressable
        accessibilityRole="button"
        disabled={requesting}
        onPress={canRequest ? onRequest : () => void Linking.openSettings()}
        style={({ pressed }) => [styles.permissionButton, pressed && styles.pressed, requesting && styles.disabled]}
      >
        {requesting ? <LoadingDots color="#fff" /> : null}
        <Text style={styles.permissionButtonText}>{canRequest ? "Allow access" : "Open Settings"}</Text>
      </Pressable>
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

  return (
    <View style={styles.reviewPage}>
      <View style={[styles.reviewHeader, { paddingTop: insets.top + 8 }]}>
        <Pressable accessibilityLabel="Close video review" onPress={onClose} style={styles.headerButton}>
          <Ionicons name="close" size={22} color={C.text} />
        </Pressable>
        <View style={styles.reviewHeading}>
          <Text style={styles.reviewEyebrow}>NEW ASSET</Text>
          <Text style={styles.reviewTitle}>View your video</Text>
        </View>
        <Pressable accessibilityLabel="Record video again" disabled={uploading} onPress={onRetake} style={styles.headerButton}>
          <Ionicons name="refresh" size={20} color={C.text} />
        </Pressable>
      </View>

      <View style={styles.playerFrame}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls
          allowsFullscreen
        />
        <View pointerEvents="none" style={styles.durationBadge}>
          <Ionicons name="videocam" size={13} color="#fff" />
          <Text style={styles.durationBadgeText}>{formatElapsed(durationSec)}</Text>
        </View>
      </View>

      <View style={styles.reviewForm}>
        <Text style={styles.inputLabel}>Asset name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          editable={!uploading}
          placeholder="Name this video"
          placeholderTextColor={C.textMuted}
          style={styles.input}
        />
        <Text style={styles.inputLabel}>Description or script notes</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          editable={!uploading}
          multiline
          placeholder="Add the script, shot details, or context for your team"
          placeholderTextColor={C.textMuted}
          style={[styles.input, styles.descriptionInput]}
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>

      <View style={[styles.reviewActions, { paddingBottom: Math.max(insets.bottom, 18) }]}>
        <Pressable
          accessibilityRole="button"
          disabled={saving || uploading}
          onPress={onSave}
          style={({ pressed }) => [styles.saveButton, pressed && styles.pressed, (saving || uploading) && styles.disabled]}
        >
          {saving ? (
            <LoadingDots size="small" color={C.brand} />
          ) : (
            <Ionicons name={saved ? "checkmark-circle" : "images-outline"} size={19} color={C.brand} />
          )}
          <Text style={styles.saveButtonText}>{saved ? "Saved to Photos" : "Save to Photos"}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={uploading || !name.trim()}
          onPress={() => onUpload(name.trim(), description.trim())}
          style={({ pressed }) => [styles.uploadButton, pressed && styles.pressed, (uploading || !name.trim()) && styles.disabled]}
        >
          {uploading ? <LoadingDots size="small" color="#fff" /> : <Ionicons name="cloud-upload-outline" size={19} color="#fff" />}
          <Text style={styles.uploadButtonText}>{uploading ? "Uploading…" : "Upload asset"}</Text>
        </Pressable>
      </View>
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
      if (Platform.OS === "ios") {
        const permission = await MediaLibrary.requestPermissionsAsync(true);
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
      }
      await MediaLibrary.saveToLibraryAsync(recordedUri);
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

          <View style={[styles.cameraHeader, { paddingTop: insets.top + 8 }]}>
            <Pressable accessibilityLabel="Close video recorder" onPress={requestClose} style={styles.cameraButton}>
              <Ionicons name="close" size={23} color="#fff" />
            </Pressable>
            <View style={[styles.recordingPill, isRecording && styles.recordingPillActive]}>
              <View style={[styles.recordingDot, isRecording && styles.recordingDotActive]} />
              <Text style={styles.recordingTime}>{isRecording ? formatElapsed(durationSec) : "VIDEO ASSET"}</Text>
            </View>
            <Pressable
              accessibilityLabel={torchEnabled ? "Turn flash off" : "Turn flash on"}
              disabled={USE_SIMULATOR_CAMERA || isRecording}
              onPress={() => setTorchEnabled((current) => !current)}
              style={[
                styles.cameraButton,
                (USE_SIMULATOR_CAMERA || isRecording) && styles.cameraButtonDisabled,
              ]}
            >
              <Ionicons name={torchEnabled ? "flash" : "flash-off"} size={20} color="#fff" />
            </Pressable>
          </View>

          <View style={styles.captureGuide} pointerEvents="none">
            <Text style={styles.captureGuideTitle}>{isRecording ? "Recording…" : "Frame your tour"}</Text>
            <Text style={styles.captureGuideBody}>
              {isRecording ? "Tap stop when the walkthrough is complete." : "Capture a walkthrough, amenity, or community highlight."}
            </Text>
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
              <Pressable
                accessibilityLabel="Switch camera"
                disabled={isRecording}
                onPress={() => setPosition((current) => current === "back" ? "front" : "back")}
                style={[styles.cameraButton, isRecording && styles.cameraButtonDisabled]}
              >
                <Ionicons name="camera-reverse-outline" size={24} color="#fff" />
              </Pressable>
            </View>
          </View>
          {error ? (
            <View style={[styles.cameraError, { bottom: Math.max(insets.bottom, 18) + 112 }]}>
              <Text style={styles.cameraErrorText}>{error}</Text>
            </View>
          ) : null}
        </View>
      )}
    </Modal>
  );
}

export type { RecordedVideoAsset };

const styles = StyleSheet.create({
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.5 },
  permissionPage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
    backgroundColor: "#f8fafc",
  },
  permissionClose: {
    position: "absolute",
    top: Platform.OS === "ios" ? 58 : 24,
    right: 20,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "#fff",
  },
  permissionIcon: {
    width: 76,
    height: 76,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: "#eaf4ff",
  },
  permissionTitle: { marginTop: 22, color: C.text, fontSize: 24, fontWeight: "900", textAlign: "center" },
  permissionBody: { maxWidth: 330, marginTop: 10, color: C.textSec, fontSize: 15, lineHeight: 22, textAlign: "center" },
  permissionButton: {
    minWidth: 190,
    minHeight: 52,
    marginTop: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 22,
    borderRadius: 17,
    backgroundColor: C.brand,
  },
  permissionButtonText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  cameraPage: { flex: 1, overflow: "hidden", backgroundColor: "#020617" },
  simulatorPreviewFront: { transform: [{ scaleX: -1 }] },
  simulatorPreviewTint: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(2,6,23,0.1)" },
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
    backgroundColor: "rgba(2,6,23,0.58)",
  },
  simulatorBadgeText: { color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 0.7 },
  cameraLoading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: "#020617" },
  cameraLoadingText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  cameraHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 16,
    backgroundColor: "rgba(2,6,23,0.28)",
  },
  cameraButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "rgba(2,6,23,0.48)",
  },
  cameraButtonDisabled: { opacity: 0.38 },
  recordingPill: {
    minWidth: 110,
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 13,
    borderRadius: 19,
    backgroundColor: "rgba(2,6,23,0.48)",
  },
  recordingPillActive: { backgroundColor: "rgba(185,28,28,0.86)" },
  recordingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#94a3b8" },
  recordingDotActive: { backgroundColor: "#fff" },
  recordingTime: { color: "#fff", fontSize: 12, fontWeight: "900", letterSpacing: 0.6 },
  captureGuide: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 152,
    alignItems: "center",
    padding: 14,
    borderRadius: 17,
    backgroundColor: "rgba(2,6,23,0.42)",
  },
  captureGuideTitle: { color: "#fff", fontSize: 16, fontWeight: "900" },
  captureGuideBody: { marginTop: 4, color: "rgba(255,255,255,0.82)", fontSize: 12, lineHeight: 17, textAlign: "center" },
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
    backgroundColor: "rgba(2,6,23,0.42)",
  },
  footerSide: { width: 56, alignItems: "center" },
  captureButton: {
    width: 84,
    height: 84,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 5,
    borderColor: "#fff",
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
    borderRadius: 13,
    backgroundColor: "rgba(127,29,29,0.92)",
  },
  cameraErrorText: { color: "#fff", fontSize: 12, fontWeight: "700", textAlign: "center" },
  reviewPage: { flex: 1, backgroundColor: "#f8fafc" },
  reviewHeader: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 12,
    backgroundColor: "#fff",
  },
  headerButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 21,
    backgroundColor: "#fff",
  },
  reviewHeading: { flex: 1, alignItems: "center" },
  reviewEyebrow: { color: C.brand, fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  reviewTitle: { marginTop: 2, color: C.text, fontSize: 18, fontWeight: "900" },
  playerFrame: { height: "39%", overflow: "hidden", backgroundColor: "#020617" },
  durationBadge: {
    position: "absolute",
    right: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "rgba(2,6,23,0.72)",
  },
  durationBadgeText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  reviewForm: { flex: 1, padding: 18 },
  inputLabel: { marginBottom: 6, color: C.textSec, fontSize: 12, fontWeight: "800" },
  input: {
    minHeight: 48,
    marginBottom: 13,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#dbe3ef",
    borderRadius: 14,
    color: C.text,
    fontSize: 14,
    fontWeight: "700",
    backgroundColor: "#fff",
  },
  descriptionInput: { minHeight: 74, paddingTop: 13, textAlignVertical: "top", fontWeight: "600" },
  errorText: { color: "#b42318", fontSize: 12, fontWeight: "700" },
  reviewActions: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 12,
    paddingHorizontal: 18,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  saveButton: {
    flex: 1,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 16,
    backgroundColor: "#eff6ff",
  },
  saveButtonText: { color: C.brand, fontSize: 13, fontWeight: "900" },
  uploadButton: {
    flex: 1,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: C.brand,
  },
  uploadButtonText: { color: "#fff", fontSize: 13, fontWeight: "900" },
});
