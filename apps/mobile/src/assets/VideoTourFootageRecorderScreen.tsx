import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Asset } from "expo-asset";
import { BlurView } from "expo-blur";
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Accelerometer } from "expo-sensors";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CustomText } from "@/components/custom-text";
import {
  GlassNavHeader,
  glassNavContentInset,
} from "@/components/glass-nav-header";
import { LiquidGlassDropdown } from "@/components/liquid-glass-dropdown";
import { LiquidGlassIconButton } from "@/components/liquid-glass-icon-button";
import { getLiquidGlassView } from "@/components/liquid-glass";
import { LoadingDots } from "@/components/loading-dots";
import { BottomSheetModal } from "@/components/bottom-sheet-modal";
import {
  listSelectedShots,
  type SelectedShot,
} from "@/assets/VideoTourShotListScreen";
import type { VideoTourFootageDraft } from "@/assets/VideoTourFootageScreen";
import { formatElapsed } from "@/recording";
import { isSimulator } from "@/runtime";
import {
  ACCENT,
  BACKGROUND,
  CARD,
  HINT,
  LARGE_CORNER,
  SMALL_CORNER,
  TEXT,
} from "@/theme/tokens";

const MAX_RECORDING_SECONDS = 10 * 60;
const MAX_RECORDING_BYTES = 500 * 1024 * 1024;
const MOCK_CAMERA_VIDEO = require("../../assets/videos/login-bg.mp4");
const USE_SIMULATOR_CAMERA = __DEV__ && isSimulator();
/** Test flag: every shot in a tour must use the same orientation. */
const FILM_ORIENTATION: "horizontal" | "vertical" = "vertical";
const MUTED = "rgba(0, 0, 0, 0.45)";
const DESC_CARD_RADIUS = LARGE_CORNER;

function asFileUri(path: string) {
  return path.startsWith("file://") ? path : `file://${path}`;
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

function useIsLandscape() {
  const [ready, setReady] = useState(USE_SIMULATOR_CAMERA);
  const [isLandscape, setIsLandscape] = useState(USE_SIMULATOR_CAMERA);

  useEffect(() => {
    if (USE_SIMULATOR_CAMERA) return;
    let sub: { remove: () => void } | undefined;
    let cancelled = false;
    void (async () => {
      const available = await Accelerometer.isAvailableAsync();
      if (!available || cancelled) {
        setReady(true);
        return;
      }
      await Accelerometer.requestPermissionsAsync();
      if (cancelled) return;
      Accelerometer.setUpdateInterval(250);
      sub = Accelerometer.addListener(({ x, y }) => {
        setIsLandscape((was) => {
          const dx = Math.abs(x);
          const dy = Math.abs(y);
          if (dx > dy + 0.2) return true;
          if (dy > dx + 0.2) return false;
          return was;
        });
        setReady(true);
      });
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, []);

  return { ready, isLandscape };
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
  const canRequest =
    ["undetermined", "not-determined"].includes(cameraStatus) ||
    ["undetermined", "not-determined"].includes(microphoneStatus);
  return (
    <View style={styles.page}>
      <View
        style={[
          styles.permissionBody,
          {
            paddingTop: glassNavContentInset(insets.top),
            paddingBottom: 58 + footerPad,
          },
        ]}
      >
        <View style={styles.permissionIcon}>
          <Ionicons name="videocam" size={28} color={ACCENT} />
        </View>
        <CustomText textStyle="hero" style={styles.centered}>
          Camera and microphone
        </CustomText>
        <CustomText textStyle="body" style={styles.permissionCopy}>
          Tour uses your camera and microphone only while you record tour
          footage.
        </CustomText>
      </View>
      <View
        pointerEvents="box-none"
        style={[styles.pageFooter, { paddingBottom: footerPad }]}
      >
        <LinearGradient
          colors={[
            "rgba(242, 242, 247, 0)",
            "rgba(242, 242, 247, 0.62)",
            BACKGROUND,
          ]}
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
        title="Footage Recorder"
        backButton={
          <LiquidGlassIconButton
            icon="close"
            accessibilityLabel="Close footage recorder"
            onPress={onClose}
          />
        }
      />
    </View>
  );
}

function RecordedFootageReview({
  uri,
  durationSec,
  onRetake,
  onUseTake,
  onClose,
}: {
  uri: string;
  durationSec: number;
  onRetake: () => void;
  onUseTake: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const footerPad = Math.max(insets.bottom, 16);
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
  });

  return (
    <View style={styles.page}>
      <View
        style={[
          styles.reviewBody,
          {
            paddingTop: glassNavContentInset(insets.top),
            paddingBottom: 58 + footerPad + 24,
          },
        ]}
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
      </View>
      <View
        pointerEvents="box-none"
        style={[styles.pageFooter, { paddingBottom: footerPad }]}
      >
        <LinearGradient
          colors={[
            "rgba(242, 242, 247, 0)",
            "rgba(242, 242, 247, 0.62)",
            BACKGROUND,
          ]}
          locations={[0, 0.5, 1]}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Use this take"
          onPress={onUseTake}
          style={({ pressed }) => [
            styles.primaryBtn,
            pressed && styles.pressed,
          ]}
        >
          <CustomText textStyle="title" style={styles.primaryBtnText}>
            Use this take
          </CustomText>
        </Pressable>
      </View>
      <GlassNavHeader
        title="Footage Recorder"
        backButton={
          <LiquidGlassIconButton
            icon="close"
            accessibilityLabel="Close footage review"
            onPress={onClose}
          />
        }
        right={
          <LiquidGlassIconButton
            icon="refresh"
            accessibilityLabel="Record this shot again"
            onPress={onRetake}
          />
        }
      />
    </View>
  );
}

function ShotDescriptionCard({ shot }: { shot: SelectedShot }) {
  const GlassView = useMemo(() => getLiquidGlassView(), []);
  return (
    <View style={styles.descCard}>
      {GlassView ? (
        <GlassView
          glassEffectStyle="regular"
          colorScheme="light"
          tintColor="rgba(255, 255, 255, 0.82)"
          borderRadius={DESC_CARD_RADIUS}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.descFallback]} />
      )}
      <View style={styles.descInner}>
        <CustomText textStyle="micro" style={styles.descSection}>
          {shot.sectionTitle}
        </CustomText>
        <CustomText textStyle="caption" style={styles.descBody}>
          {shot.detail}
        </CustomText>
      </View>
    </View>
  );
}

export function VideoTourFootageRecorderScreen({
  draft,
  shotId: initialShotId,
  onBack,
}: {
  draft: VideoTourFootageDraft;
  shotId: string;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { ready: orientationReady, isLandscape } = useIsLandscape();
  const shots = useMemo(
    () => listSelectedShots(draft, draft.selectedIds),
    [draft],
  );
  const groupedShots = useMemo(() => {
    const groups: { title: string; shots: SelectedShot[] }[] = [];
    for (const shot of shots) {
      const last = groups[groups.length - 1];
      if (last?.title === shot.sectionTitle) last.shots.push(shot);
      else groups.push({ title: shot.sectionTitle, shots: [shot] });
    }
    return groups;
  }, [shots]);
  const [currentShotId, setCurrentShotId] = useState(
    shots.some((shot) => shot.id === initialShotId)
      ? initialShotId
      : (shots[0]?.id ?? initialShotId),
  );
  const currentShot =
    shots.find((shot) => shot.id === currentShotId) ?? shots[0] ?? null;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] =
    useMicrophonePermissions();
  const [position, setPosition] = useState<"back" | "front">("back");
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [recordedDurationSec, setRecordedDurationSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<CameraView | null>(null);
  const recordingActiveRef = useRef(false);
  const recordingGenerationRef = useRef(0);
  const recordingStartedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const isCorrectOrientation =
    FILM_ORIENTATION === "horizontal" ? isLandscape : !isLandscape;
  const showRotatePrompt =
    !USE_SIMULATOR_CAMERA && orientationReady && !isCorrectOrientation;
  const rotatePrompt =
    FILM_ORIENTATION === "horizontal"
      ? {
          icon: "phone-landscape-outline" as const,
          title: "Turn your phone sideways",
          body: "Film this shot horizontally.",
        }
      : {
          icon: "phone-portrait-outline" as const,
          title: "Turn your phone upright",
          body: "Film this shot vertically.",
        };
  const sheetHeight = Math.round(windowHeight * 0.66);

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
    setError(null);
  }, [clearTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  useEffect(() => {
    setCameraReady(USE_SIMULATOR_CAMERA);
    setTorchEnabled(false);
  }, [position]);

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !isRecording });
  }, [isRecording, navigation]);

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
        setError("Camera and microphone access are required to record footage.");
      }
    } finally {
      setRequestingPermission(false);
    }
  }, [
    cameraPermission,
    microphonePermission,
    requestCameraPermission,
    requestMicrophonePermission,
  ]);

  const finishRecording = useCallback(
    (path: string) => {
      clearTimer();
      const elapsed = Math.max(
        1,
        Math.round((Date.now() - recordingStartedAtRef.current) / 1000),
      );
      recordingActiveRef.current = false;
      setIsRecording(false);
      setRecordedDurationSec(elapsed);
      setRecordedUri(asFileUri(path));
      setError(null);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [clearTimer],
  );

  const startRecording = useCallback(async () => {
    if (
      !cameraReady ||
      isRecording ||
      recordingActiveRef.current ||
      showRotatePrompt
    ) {
      return;
    }
    setError(null);
    if (USE_SIMULATOR_CAMERA) {
      recordingStartedAtRef.current = Date.now();
      setIsRecording(true);
      setDurationSec(0);
      timerRef.current = setInterval(() => {
        setDurationSec(
          Math.max(
            0,
            Math.floor((Date.now() - recordingStartedAtRef.current) / 1000),
          ),
        );
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
      void recording
        .then((result) => {
          if (recordingGenerationRef.current !== generation) return;
          if (!result?.uri) {
            clearTimer();
            recordingActiveRef.current = false;
            setIsRecording(false);
            setError("Video recording ended without creating a file.");
            return;
          }
          finishRecording(result.uri);
        })
        .catch((caught: unknown) => {
          if (recordingGenerationRef.current !== generation) return;
          clearTimer();
          recordingActiveRef.current = false;
          setIsRecording(false);
          setError(
            caught instanceof Error ? caught.message : "Video recording failed.",
          );
        });
      timerRef.current = setInterval(() => {
        setDurationSec(
          Math.max(
            0,
            Math.floor((Date.now() - recordingStartedAtRef.current) / 1000),
          ),
        );
      }, 500);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (caught) {
      recordingActiveRef.current = false;
      setIsRecording(false);
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not start video recording.",
      );
    }
  }, [cameraReady, clearTimer, finishRecording, isRecording, showRotatePrompt]);

  const stopRecording = useCallback(async () => {
    if (USE_SIMULATOR_CAMERA && isRecording) {
      try {
        const uri = await resolveMockCameraVideo();
        finishRecording(uri);
      } catch (caught) {
        clearTimer();
        setIsRecording(false);
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not prepare the simulator recording.",
        );
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
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not stop video recording.",
      );
    }
  }, [clearTimer, finishRecording, isRecording]);

  const requestClose = useCallback(() => {
    if (!isRecording && !recordedUri) {
      onBack();
      return;
    }
    Alert.alert(
      "Discard this recording?",
      "The current take has not been saved.",
      [
        { text: isRecording ? "Keep recording" : "Keep take", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            resetCapture();
            onBack();
          },
        },
      ],
    );
  }, [isRecording, onBack, recordedUri, resetCapture]);

  const selectShot = useCallback(
    (nextId: string) => {
      if (nextId === currentShotId) {
        setPickerOpen(false);
        return;
      }
      setCurrentShotId(nextId);
      resetCapture();
      setPickerOpen(false);
    },
    [currentShotId, resetCapture],
  );

  const hasPermissions =
    USE_SIMULATOR_CAMERA ||
    Boolean(cameraPermission?.granted && microphonePermission?.granted);

  if (recordedUri) {
    return (
      <RecordedFootageReview
        uri={recordedUri}
        durationSec={recordedDurationSec}
        onRetake={resetCapture}
        onUseTake={onBack}
        onClose={requestClose}
      />
    );
  }

  if (!hasPermissions) {
    return (
      <PermissionGate
        cameraStatus={cameraPermission?.status ?? "undetermined"}
        microphoneStatus={microphonePermission?.status ?? "undetermined"}
        requesting={requestingPermission}
        onRequest={() => void requestPermissions()}
        onClose={onBack}
      />
    );
  }

  return (
    <View style={styles.cameraPage}>
      {USE_SIMULATOR_CAMERA ? (
        <SimulatorCameraPreview position={position} />
      ) : (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={position}
          mode="video"
          mute={!currentShot?.recordsAudio}
          enableTorch={torchEnabled}
          videoQuality="1080p"
          videoBitrate={8_000_000}
          videoStabilizationMode="auto"
          responsiveOrientationWhenOrientationLocked
          onCameraReady={() => setCameraReady(true)}
          onMountError={(caught) => {
            setCameraReady(false);
            setError(caught.message);
          }}
        />
      )}

      {showRotatePrompt ? (
        <View
          pointerEvents="none"
          style={[
            styles.rotateOverlay,
            { width: windowWidth, height: windowHeight },
          ]}
        >
          <BlurView
            tint="dark"
            intensity={70}
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, styles.rotateScrim]} />
          <View style={styles.rotateMessage}>
            <Ionicons name={rotatePrompt.icon} size={48} color={CARD} />
            <CustomText textStyle="title" style={styles.rotateTitle}>
              {rotatePrompt.title}
            </CustomText>
            <CustomText textStyle="caption" style={styles.rotateBody}>
              {rotatePrompt.body}
            </CustomText>
          </View>
        </View>
      ) : null}

      <View
        pointerEvents="box-none"
        style={[
          styles.cameraHeader,
          { paddingTop: insets.top },
          showRotatePrompt && styles.cameraHeaderOnOverlay,
        ]}
      >
        <View style={styles.cameraBar}>
          <View style={styles.cameraBarSide}>
            <LiquidGlassIconButton
              icon="close"
              accessibilityLabel="Close footage recorder"
              onPress={requestClose}
            />
          </View>
          <View style={styles.cameraBarCenter}>
            {showRotatePrompt ? null : (
              <LiquidGlassDropdown
                label={currentShot?.label ?? "Choose a shot"}
                accessibilityLabel="Choose a different shot"
                onPress={() => {
                  if (!isRecording) setPickerOpen(true);
                }}
              />
            )}
          </View>
          <View style={[styles.cameraBarSide, styles.cameraBarSideEnd]}>
            {showRotatePrompt ? null : (
              <LiquidGlassIconButton
                icon={torchEnabled ? "flash" : "flash-off"}
                accessibilityLabel={
                  torchEnabled ? "Turn flash off" : "Turn flash on"
                }
                disabled={USE_SIMULATOR_CAMERA || isRecording}
                onPress={() => setTorchEnabled((current) => !current)}
              />
            )}
          </View>
        </View>
        {currentShot && !showRotatePrompt ? (
          <ShotDescriptionCard shot={currentShot} />
        ) : null}
      </View>

      {!showRotatePrompt || isRecording ? (
        <View
          style={[
            styles.cameraFooter,
            {
              paddingBottom: Math.max(
                insets.bottom,
                Platform.OS === "ios" ? 18 : 24,
              ),
            },
          ]}
        >
          <View style={styles.footerSide} />
          <View style={styles.captureWrap}>
            {isRecording ? (
              <View style={styles.recordingPill}>
                <View style={styles.recordingDot} />
                <CustomText textStyle="micro" style={styles.recordingTime}>
                  {formatElapsed(durationSec)}
                </CustomText>
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                isRecording ? "Stop video recording" : "Start video recording"
              }
              disabled={!cameraReady || (!isRecording && showRotatePrompt)}
              onPress={
                isRecording
                  ? () => void stopRecording()
                  : () => void startRecording()
              }
              style={({ pressed }) => [
                styles.captureButton,
                isRecording && styles.captureButtonRecording,
                pressed && styles.captureButtonPressed,
                (!cameraReady || (!isRecording && showRotatePrompt)) &&
                  styles.disabled,
              ]}
            >
              <View
                style={[
                  styles.captureButtonInner,
                  isRecording && styles.captureButtonStop,
                ]}
              />
            </Pressable>
          </View>
          <View style={styles.footerSide}>
            <LiquidGlassIconButton
              icon="camera-reverse-outline"
              accessibilityLabel="Switch camera"
              disabled={isRecording}
              onPress={() =>
                setPosition((current) =>
                  current === "back" ? "front" : "back",
                )
              }
            />
          </View>
        </View>
      ) : null}

      {error ? (
        <View
          style={[
            styles.cameraError,
            { bottom: Math.max(insets.bottom, 18) + 112 },
          ]}
        >
          <CustomText textStyle="caption" style={styles.cameraErrorText}>
            {error}
          </CustomText>
        </View>
      ) : null}

      <BottomSheetModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        sheetHeight={sheetHeight}
        sheetStyle={styles.sheet}
        contentStyle={styles.sheetContent}
      >
        <View style={styles.sheetInner}>
          <View pointerEvents="box-none" style={styles.sheetHeaderWrap}>
            <LinearGradient
              colors={[
                BACKGROUND,
                "rgba(242, 242, 247, 0.62)",
                "rgba(242, 242, 247, 0)",
              ]}
              locations={[0, 0.5, 1]}
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
            />
            <View pointerEvents="box-none" style={styles.sheetTitleRow}>
              <View style={styles.sheetTitleCopy}>
                <CustomText textStyle="hero">Choose a shot</CustomText>
              </View>
              <LiquidGlassIconButton
                icon="close"
                accessibilityLabel="Close shot picker"
                onPress={() => setPickerOpen(false)}
              />
            </View>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetBody}
          >
            {groupedShots.map((group) => (
              <View key={group.title} style={styles.sheetSection}>
                <CustomText textStyle="title" style={styles.sheetSectionTitle}>
                  {group.title}
                </CustomText>
                <View style={styles.sheetList}>
                  {group.shots.map((shot) => {
                    const active = shot.id === currentShotId;
                    return (
                      <Pressable
                        key={shot.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={shot.label}
                        onPress={() => selectShot(shot.id)}
                        style={({ pressed }) => [
                          styles.sheetRow,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Ionicons
                          name={shot.icon}
                          size={20}
                          color={active ? ACCENT : MUTED}
                        />
                        <CustomText
                          textStyle="body"
                          numberOfLines={1}
                          style={[
                            styles.sheetRowLabel,
                            active && styles.sheetRowLabelActive,
                          ]}
                        >
                          {shot.label}
                        </CustomText>
                        {active ? (
                          <Ionicons
                            name="checkmark"
                            size={18}
                            color={ACCENT}
                          />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </BottomSheetModal>
    </View>
  );
}

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
    color: MUTED,
    textAlign: "center",
    lineHeight: 20,
  },
  centered: { textAlign: "center" },
  reviewBody: { flex: 1, paddingHorizontal: 16 },
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
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 25,
    backgroundColor: ACCENT,
    boxShadow: "0 6px 14px rgba(0, 108, 229, 0.28)",
  },
  primaryBtnText: { color: CARD },
  cameraPage: { flex: 1, overflow: "hidden", backgroundColor: "#000" },
  simulatorPreviewFront: { transform: [{ scaleX: -1 }] },
  simulatorPreviewTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  cameraHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  cameraBar: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cameraBarSide: {
    width: 42,
    flexShrink: 0,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  cameraBarSideEnd: { alignItems: "flex-end" },
  cameraBarCenter: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraHeaderOnOverlay: { zIndex: 50 },
  descCard: {
    overflow: "visible",
    borderRadius: DESC_CARD_RADIUS,
  },
  descFallback: {
    borderRadius: DESC_CARD_RADIUS,
    backgroundColor: "rgba(255, 255, 255, 0.88)",
  },
  descInner: {
    gap: 4,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  descSection: { color: MUTED },
  descBody: { color: TEXT, lineHeight: 17 },
  rotateOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 40,
  },
  rotateScrim: {
    backgroundColor: "rgba(0, 0, 0, 0.32)",
  },
  rotateMessage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 28,
  },
  rotateTitle: {
    color: CARD,
    textAlign: "center",
  },
  rotateBody: {
    color: "rgba(255,255,255,0.84)",
    textAlign: "center",
  },
  cameraFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    minHeight: 130,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingTop: 18,
    paddingHorizontal: 24,
  },
  footerSide: { width: 56, alignItems: "center" },
  captureWrap: { alignItems: "center", gap: 10 },
  recordingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: "rgba(185,28,28,0.86)",
  },
  recordingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: CARD },
  recordingTime: { color: CARD },
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
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#ef4444",
  },
  captureButtonStop: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#ef4444",
  },
  cameraError: {
    position: "absolute",
    left: 20,
    right: 20,
    zIndex: 21,
    padding: 12,
    borderRadius: SMALL_CORNER,
    backgroundColor: "rgba(127,29,29,0.92)",
  },
  cameraErrorText: { color: CARD, textAlign: "center" },
  playerFrame: {
    flex: 1,
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
  sheet: {
    overflow: "hidden",
    paddingTop: 2,
    paddingHorizontal: 0,
    borderTopLeftRadius: LARGE_CORNER,
    borderTopRightRadius: LARGE_CORNER,
    borderCurve: "continuous",
    backgroundColor: BACKGROUND,
  },
  sheetContent: { overflow: "visible" },
  sheetInner: { flex: 1 },
  sheetHeaderWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 44 + 56,
    zIndex: 20,
    overflow: "visible",
    backgroundColor: "transparent",
  },
  sheetTitleRow: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    overflow: "visible",
  },
  sheetTitleCopy: { flex: 1 },
  sheetBody: { gap: 22, paddingTop: 52, paddingHorizontal: 18, paddingBottom: 28 },
  sheetSection: { gap: 10 },
  sheetSectionTitle: { marginBottom: 2 },
  sheetList: { gap: 8 },
  sheetRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: SMALL_CORNER,
    backgroundColor: CARD,
  },
  sheetRowLabel: { flex: 1, minWidth: 0 },
  sheetRowLabelActive: { color: ACCENT },
});
