import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { File as ExpoFile, Paths } from "expo-file-system";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { DeviceMotion, DeviceMotionOrientation, type DeviceMotionMeasurement } from "expo-sensors";
import * as Sharing from "expo-sharing";
import JSZip from "jszip";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CustomText, customTextVariants } from "@/components/custom-text";
import { GlassNavHeader, glassNavContentInset } from "@/components/glass-nav-header";
import { LiquidGlassIconButton } from "@/components/liquid-glass-icon-button";
import { LoadingDots } from "@/components/loading-dots";
import { SecondaryButton } from "@/components/secondary-button";
import { ACCENT, BACKGROUND, CARD, HINT, SMALL_CORNER, TEXT } from "@/theme/tokens";
import {
  checkPanoramaOverlap,
  type PanoramaOverlapQuality,
} from "./panoramaOverlap";
import { PanoramaThreeLayer } from "./PanoramaThreeLayer";
import { tourColors as C } from "../theme/tour-brand";

type PanoramaCaptureMode = "wide-6" | "ultrawide-6";

const CAPTURE_CONFIG = {
  "wide-6": { shotCount: 6, degreesPerShot: 60, lensLabel: "1×", title: "1× Detail" },
  "ultrawide-6": { shotCount: 6, degreesPerShot: 60, lensLabel: "0.5×", title: "0.5× Fast" },
} as const;
const SENSOR_INTERVAL_MS = 50;
const FIRST_SHOT_HOLD_MS = 280;
const FOLLOWUP_SHOT_HOLD_MS = 420;
const ALIGNMENT_GRACE_MS = 140;
const POST_CAPTURE_REARM_MS = 140;
const YAW_TOLERANCE_DEGREES = 6;
const ROLL_TOLERANCE_DEGREES = 5;
const PITCH_TOLERANCE_DEGREES = 6;
const MAX_ROTATION_RATE_DEGREES = 22;

type PanoramaShot = {
  uri: string;
  fileName: string;
  mimeType: "image/jpeg";
  index: number;
  headingDegrees: number;
  targetHeadingDegrees: number;
  rollDegrees: number;
  pitchDegrees: number;
  overlapStatus: "baseline" | "checking" | PanoramaOverlapQuality;
  overlapScore?: number;
  overlapPercent?: number;
  closureStatus?: PanoramaOverlapQuality;
};

type RecordedPanoramaAsset = {
  name: string;
  description: string;
  shots: PanoramaShot[];
  captureMode: PanoramaCaptureMode;
};

type PanoramaAssetRecorderProps = {
  visible: boolean;
  onClose: () => void;
  onUpload: (asset: RecordedPanoramaAsset) => Promise<void>;
};

type MotionReading = {
  headingDegrees: number;
  rollDegrees: number;
  pitchDegrees: number;
  rotationRateDegrees: number;
  orientation: DeviceMotionOrientation;
  sensorTimestampSeconds: number | null;
};

type CapturePhase = "intro" | "capture" | "review" | "processing";

const EMPTY_MOTION: MotionReading = {
  headingDegrees: 0,
  rollDegrees: 0,
  pitchDegrees: 0,
  rotationRateDegrees: 0,
  orientation: DeviceMotionOrientation.Portrait,
  sensorTimestampSeconds: null,
};

function asFileUri(path: string) {
  return path.startsWith("file://") ? path : `file://${path}`;
}

function radiansToDegrees(value: number) {
  return value * (180 / Math.PI);
}

function normalizeHeading(value: number) {
  return ((value % 360) + 360) % 360;
}

function signedAngle(value: number) {
  return ((value + 540) % 360) - 180;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function weakerOverlapQuality(
  first: PanoramaOverlapQuality,
  second: PanoramaOverlapQuality,
): PanoramaOverlapQuality {
  const rank: Record<PanoramaOverlapQuality, number> = {
    good: 0,
    unverifiable: 1,
    weak: 2,
  };
  return rank[first] >= rank[second] ? first : second;
}

function defaultPanoramaName() {
  return `360 panorama ${new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date())}`;
}

function motionFromMeasurement(
  measurement: DeviceMotionMeasurement,
  previous: MotionReading | null,
): MotionReading {
  const measuredAcceleration = measurement.accelerationIncludingGravity;
  const linearAcceleration = measurement.acceleration;
  const gravityX = measuredAcceleration.x - (linearAcceleration?.x ?? 0);
  const gravityY = measuredAcceleration.y - (linearAcceleration?.y ?? 0);
  const gravityZ = measuredAcceleration.z - (linearAcceleration?.z ?? 0);
  const rawRoll = radiansToDegrees(Math.atan2(gravityX, -gravityY));
  const rawPitch = radiansToDegrees(
    Math.atan2(gravityZ, Math.sqrt(gravityX * gravityX + gravityY * gravityY)),
  );
  const rate = measurement.rotationRate;
  const gravityMagnitude = Math.max(
    Math.sqrt(gravityX * gravityX + gravityY * gravityY + gravityZ * gravityZ),
    0.001,
  );

  // Project the complete device rotation vector onto world-up. This isolates
  // true horizontal yaw even while the phone is pitched or rolled. Expo SDK
  // 54 maps iOS rate fields as z/y/x and Android as x/y/z; beta is Y on both.
  const rotationX = rate ? (Platform.OS === "ios" ? rate.gamma : rate.alpha) : 0;
  const rotationY = rate?.beta ?? 0;
  const rotationZ = rate ? (Platform.OS === "ios" ? rate.alpha : rate.gamma) : 0;
  const worldUpX = -gravityX / gravityMagnitude;
  const worldUpY = -gravityY / gravityMagnitude;
  const worldUpZ = -gravityZ / gravityMagnitude;
  // Match the capture guide's screen direction: rotating left moves the
  // panorama/target left, and rotating right moves them right.
  const yawRateDegrees = -(
    rotationX * worldUpX
    + rotationY * worldUpY
    + rotationZ * worldUpZ
  );
  const sensorTimestampSeconds = rate?.timestamp ?? previous?.sensorTimestampSeconds ?? null;
  const elapsedSeconds = previous?.sensorTimestampSeconds !== null
    && previous?.sensorTimestampSeconds !== undefined
    && rate
    ? clamp(rate.timestamp - previous.sensorTimestampSeconds, 0, 0.1)
    : 0;
  const yawDeltaDegrees = yawRateDegrees * elapsedSeconds;
  const headingDegrees = previous
    ? normalizeHeading(previous.headingDegrees + yawDeltaDegrees)
    : 0;
  const rotationRateDegrees = rate
    ? Math.sqrt(rate.alpha * rate.alpha + rate.beta * rate.beta + rate.gamma * rate.gamma)
    : 0;

  if (!previous) {
    return {
      headingDegrees,
      rollDegrees: rawRoll,
      pitchDegrees: rawPitch,
      rotationRateDegrees,
      orientation: measurement.orientation,
      sensorTimestampSeconds,
    };
  }

  return {
    headingDegrees,
    rollDegrees: previous.rollDegrees + (rawRoll - previous.rollDegrees) * 0.24,
    pitchDegrees: previous.pitchDegrees + (rawPitch - previous.pitchDegrees) * 0.24,
    rotationRateDegrees:
      previous.rotationRateDegrees + (rotationRateDegrees - previous.rotationRateDegrees) * 0.3,
    orientation: measurement.orientation,
    sensorTimestampSeconds,
  };
}

function IntroPage({
  onStart,
  onClose,
  captureMode,
  onCaptureModeChange,
  starting,
  error,
}: {
  onStart: () => void;
  onClose: () => void;
  captureMode: PanoramaCaptureMode;
  onCaptureModeChange: (mode: PanoramaCaptureMode) => void;
  starting: boolean;
  error: string | null;
}) {
  const insets = useSafeAreaInsets();
  const configuration = CAPTURE_CONFIG[captureMode];
  const footerPad = Math.max(insets.bottom, 16);

  return (
    <View style={styles.page}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.introContent,
          {
            paddingTop: glassNavContentInset(insets.top),
            paddingBottom: 58 + 10 + footerPad + 24,
          },
        ]}
      >
        <View style={styles.introIllustration}>
          <View style={styles.introOrbit}>
            {Array.from({ length: configuration.shotCount }).map((_, index) => {
              const angle = (index / configuration.shotCount) * Math.PI * 2 - Math.PI / 2;
              return (
                <View
                  key={index}
                  style={[
                    styles.introOrbitDot,
                    {
                      transform: [
                        { translateX: Math.cos(angle) * 74 },
                        { translateY: Math.sin(angle) * 74 },
                      ],
                    },
                  ]}
                />
              );
            })}
            <View style={styles.introPhone}>
              <Ionicons name="phone-portrait-outline" size={50} color={CARD} />
            </View>
          </View>
        </View>
        <CustomText textStyle="hero" style={styles.introTitle}>
          Choose speed or detail
        </CustomText>
        <CustomText textStyle="body" style={styles.introBody}>
          Hold your phone vertically at eye level. Follow the moving target and turn in place; Tour captures each photo automatically when the phone is level and steady.
        </CustomText>
        <View style={styles.captureModePicker}>
          {(Object.keys(CAPTURE_CONFIG) as PanoramaCaptureMode[]).map((mode) => {
            const option = CAPTURE_CONFIG[mode];
            const selected = mode === captureMode;
            return (
              <Pressable
                key={mode}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => onCaptureModeChange(mode)}
                style={[
                  styles.captureModeOption,
                  selected && styles.captureModeOptionSelected,
                ]}
              >
                <CustomText
                  textStyle="label"
                  style={[
                    styles.captureModeTitle,
                    selected && styles.captureModeTitleSelected,
                  ]}
                >
                  {option.title}
                </CustomText>
                <CustomText
                  textStyle="micro"
                  style={[
                    styles.captureModeMeta,
                    selected && styles.captureModeMetaSelected,
                  ]}
                >
                  {option.shotCount} photos · {option.degreesPerShot}° apart
                </CustomText>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.introChecklist}>
          <IntroItem icon="phone-portrait-outline" text="Keep the phone upright" />
          <IntroItem icon="sync-outline" text={`Turn slowly through ${configuration.shotCount} positions`} />
          <IntroItem icon="sparkles-outline" text="Tour stitches one 360° panorama" />
        </View>
        {error ? (
          <CustomText textStyle="caption" style={styles.introError}>
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
          accessibilityLabel="Start 360 capture"
          disabled={starting}
          onPress={onStart}
          style={({ pressed }) => [
            styles.primaryBtn,
            starting && styles.disabled,
            pressed && !starting && styles.pressed,
          ]}
        >
          {starting ? (
            <LoadingDots size="small" color={CARD} />
          ) : (
            <CustomText textStyle="title" style={styles.primaryBtnText}>
              Start 360 capture
            </CustomText>
          )}
        </Pressable>
      </View>
      <GlassNavHeader
        title="360° photo"
        backButton={
          <LiquidGlassIconButton
            icon="close"
            accessibilityLabel="Close 360 capture"
            onPress={onClose}
          />
        }
      />
    </View>
  );
}

function IntroItem({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.introItem}>
      <View style={styles.introItemIcon}>
        <Ionicons name={icon} size={18} color={ACCENT} />
      </View>
      <CustomText textStyle="body" style={styles.introItemText}>
        {text}
      </CustomText>
    </View>
  );
}

function ReviewPage({
  shots,
  shotCount,
  degreesPerShot,
  headingDegrees,
  referenceHeadingDegrees,
  onRetake,
  onUpload,
  onClose,
  uploading,
  error,
}: {
  shots: PanoramaShot[];
  shotCount: number;
  degreesPerShot: number;
  headingDegrees: number;
  referenceHeadingDegrees: number | null;
  onRetake: () => void;
  onUpload: (name: string, description: string) => void;
  onClose: () => void;
  uploading: boolean;
  error: string | null;
}) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(defaultPanoramaName);
  const [description, setDescription] = useState("");
  const [reviewTab, setReviewTab] = useState<"preview" | "flat" | "raw">("preview");
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [quickPreviewReady, setQuickPreviewReady] = useState(false);
  const [previewNavigationCommand, setPreviewNavigationCommand] = useState<{
    id: number;
    yawDeltaDegrees?: number;
    pitchDeltaDegrees?: number;
  } | null>(null);
  const [selectedShotIndex, setSelectedShotIndex] = useState<number | null>(null);
  const [sharing, setSharing] = useState(false);
  const [sharingAll, setSharingAll] = useState(false);
  const selectedShot = selectedShotIndex === null ? null : shots[selectedShotIndex];
  const seamQualities = shots
    .filter((shot) => shot.overlapStatus !== "baseline" && shot.overlapStatus !== "checking")
    .map((shot) => shot.overlapStatus as PanoramaOverlapQuality);
  const closureStatus = shots.at(-1)?.closureStatus;
  if (closureStatus) seamQualities.push(closureStatus);
  const goodSeamCount = seamQualities.filter((quality) => quality === "good").length;
  const weakSeamCount = seamQualities.filter((quality) => quality === "weak").length;
  const unverifiableSeamCount = seamQualities.filter((quality) => quality === "unverifiable").length;

  const nudgePreview = useCallback((yawDeltaDegrees = 0, pitchDeltaDegrees = 0) => {
    setPreviewNavigationCommand((current) => ({
      id: (current?.id ?? 0) + 1,
      yawDeltaDegrees,
      pitchDeltaDegrees,
    }));
  }, []);

  const shareAllShots = useCallback(async () => {
    if (sharingAll || shots.length === 0) return;

    let archiveFile: ExpoFile | null = null;
    setSharingAll(true);
    try {
      const sharingAvailable = await Sharing.isAvailableAsync();
      if (!sharingAvailable) {
        Alert.alert(
          "Sharing is unavailable",
          "This device cannot open a file-sharing sheet right now.",
        );
        return;
      }

      const archive = new JSZip();
      const orderedShots = [...shots].sort((left, right) => left.index - right.index);
      await Promise.all(orderedShots.map(async (shot) => {
        const bytes = await new ExpoFile(shot.uri).bytes();
        archive.file(`panorama-photo-${shot.index + 1}.jpg`, bytes);
      }));
      const archiveBytes = await archive.generateAsync({
        type: "uint8array",
        compression: "STORE",
      });
      const safeName = name.trim()
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase() || "panorama-360";
      archiveFile = new ExpoFile(Paths.cache, `${safeName}-${Date.now()}.zip`);
      archiveFile.create({ overwrite: true });
      archiveFile.write(archiveBytes);

      await Sharing.shareAsync(archiveFile.uri, {
        mimeType: "application/zip",
        UTI: "public.zip-archive",
        dialogTitle: `Share all ${shotCount} panorama photos`,
      });
    } catch (shareError) {
      Alert.alert(
        "Couldn’t share panorama photos",
        shareError instanceof Error ? shareError.message : "Please try sharing the photos again.",
      );
    } finally {
      if (archiveFile?.exists) {
        try {
          archiveFile.delete();
        } catch {
          // The operating system may still own the temporary share file.
        }
      }
      setSharingAll(false);
    }
  }, [name, sharingAll, shotCount, shots]);

  const shareSelectedShot = useCallback(async () => {
    if (!selectedShot || sharing) return;

    setSharing(true);
    try {
      const sharingAvailable = await Sharing.isAvailableAsync();
      if (!sharingAvailable) {
        Alert.alert(
          "Sharing is unavailable",
          "This device cannot open a file-sharing sheet right now.",
        );
        return;
      }

      await Sharing.shareAsync(selectedShot.uri, {
        mimeType: selectedShot.mimeType,
        UTI: "public.jpeg",
        dialogTitle: `Share panorama photo ${selectedShot.index + 1}`,
      });
    } catch (shareError) {
      Alert.alert(
        "Couldn’t share photo",
        shareError instanceof Error ? shareError.message : "Please try sharing the photo again.",
      );
    } finally {
      setSharing(false);
    }
  }, [selectedShot, sharing]);

  return (
    <View style={styles.page}>
      <View style={[styles.reviewBody, { paddingTop: glassNavContentInset(insets.top) }]}>
      <View style={styles.reviewTabs}>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: reviewTab === "flat" }}
          onPress={() => setReviewTab("flat")}
          style={[styles.reviewTab, reviewTab === "flat" && styles.reviewTabActive]}
        >
          <Ionicons name="scan-outline" size={16} color={reviewTab === "flat" ? ACCENT : "rgba(0, 0, 0, 0.45)"} />
          <CustomText textStyle="label" style={[styles.reviewTabText, reviewTab === "flat" && styles.reviewTabTextActive]}>Flat 2:1</CustomText>
        </Pressable>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: reviewTab === "preview" }}
          onPress={() => setReviewTab("preview")}
          style={[styles.reviewTab, reviewTab === "preview" && styles.reviewTabActive]}
        >
          <Ionicons name="globe-outline" size={17} color={reviewTab === "preview" ? ACCENT : "rgba(0, 0, 0, 0.45)"} />
          <CustomText textStyle="label" style={[styles.reviewTabText, reviewTab === "preview" && styles.reviewTabTextActive]}>360</CustomText>
        </Pressable>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: reviewTab === "raw" }}
          onPress={() => setReviewTab("raw")}
          style={[styles.reviewTab, reviewTab === "raw" && styles.reviewTabActive]}
        >
          <Ionicons name="images-outline" size={17} color={reviewTab === "raw" ? ACCENT : "rgba(0, 0, 0, 0.45)"} />
          <CustomText textStyle="label" style={[styles.reviewTabText, reviewTab === "raw" && styles.reviewTabTextActive]}>Photos ({shots.length})</CustomText>
        </Pressable>
      </View>

      <View style={[
        styles.seamSummary,
        weakSeamCount > 0 ? styles.seamSummaryWeak : styles.seamSummaryGood,
      ]}>
        <Ionicons
          name={weakSeamCount > 0 ? "warning-outline" : "checkmark-circle-outline"}
          size={18}
          color={weakSeamCount > 0 ? "#b45309" : "#15803d"}
        />
        <View style={styles.seamSummaryCopy}>
          <CustomText textStyle="label" style={styles.seamSummaryTitle}>
            {weakSeamCount > 0
              ? `${weakSeamCount} seam${weakSeamCount === 1 ? "" : "s"} may need a retake`
              : `${goodSeamCount} of ${shotCount} seams verified on device`}
          </CustomText>
          <CustomText textStyle="caption" style={styles.seamSummaryText}>
            {unverifiableSeamCount > 0
              ? `${unverifiableSeamCount} seam${unverifiableSeamCount === 1 ? "" : "s"} crossed a low-detail area and could not be verified.`
              : "Local CV found matching detail between each neighboring photo, including the 360° closure."}
          </CustomText>
        </View>
      </View>

      {reviewTab === "preview" ? (
        <View style={styles.reviewPreview}>
          {!previewExpanded ? (
            <PanoramaThreeLayer
              shots={shots}
              degreesPerShot={degreesPerShot}
              headingDegrees={headingDegrees}
              referenceHeadingDegrees={referenceHeadingDegrees}
              interactive
              onReady={() => setQuickPreviewReady(true)}
              style={styles.reviewPreviewLayer}
            />
          ) : null}
          <View pointerEvents="none" style={styles.reviewPreviewBadge}>
            <Ionicons name="hand-left-outline" size={14} color="#fff" />
            <CustomText textStyle="micro" style={styles.reviewPreviewBadgeText}>Drag to look around</CustomText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Expand 360 preview"
            onPress={() => {
              setPreviewNavigationCommand(null);
              setPreviewExpanded(true);
            }}
            style={({ pressed }) => [styles.reviewPreviewExpand, pressed && styles.pressed]}
          >
            <Ionicons name="expand-outline" size={19} color="#fff" />
          </Pressable>
          <View pointerEvents="none" style={styles.reviewPreviewStatus}>
            {quickPreviewReady ? <View style={styles.reviewPreviewStatusDot} /> : <LoadingDots size="small" color="#fff" />}
            <CustomText textStyle="micro" style={styles.reviewPreviewStatusText}>
              {quickPreviewReady ? "Curved preview · local" : "Building local preview…"}
            </CustomText>
          </View>
        </View>
      ) : reviewTab === "flat" ? (
        <View style={styles.flatPreviewWrap}>
          <View style={styles.flatPreview}>
            {[...shots].sort((left, right) => left.index - right.index).map((shot) => (
              <View key={shot.index} style={styles.flatPreviewSegment}>
                <Image source={{ uri: shot.uri }} resizeMode="stretch" style={styles.flatPreviewImage} />
              </View>
            ))}
          </View>
          <View style={styles.flatPreviewCaption}>
            <Ionicons name="information-circle-outline" size={15} color={C.textSec} />
            <CustomText textStyle="micro" style={styles.flatPreviewCaptionText}>Complete frames mapped into {shotCount} slots · final stitching corrects perspective and seams</CustomText>
          </View>
        </View>
      ) : (
        <>
          <CustomText textStyle="caption" style={styles.shotGridHint}>Tap a source photo to view or share the original JPEG.</CustomText>
          <View style={styles.shotGrid}>
            {shots.map((shot) => (
              <Pressable
                key={shot.index}
                accessibilityRole="button"
                accessibilityLabel={`View panorama photo ${shot.index + 1} of ${shots.length}`}
                disabled={uploading}
                onPress={() => setSelectedShotIndex(shot.index)}
                style={({ pressed }) => [styles.shotTile, pressed && styles.shotTilePressed]}
              >
                <Image source={{ uri: shot.uri }} style={styles.shotImage} resizeMode="cover" />
                <View style={styles.shotNumber}>
                  <CustomText textStyle="micro" style={styles.shotNumberText}>{shot.index + 1}</CustomText>
                </View>
                <View style={styles.shotViewBadge}>
                  <Ionicons name="expand-outline" size={14} color="#fff" />
                </View>
                {shot.overlapStatus !== "baseline" ? (
                  <View style={[
                    styles.shotOverlapBadge,
                    shot.overlapStatus === "weak" && styles.shotOverlapBadgeWeak,
                    shot.overlapStatus === "unverifiable" && styles.shotOverlapBadgeUnknown,
                  ]}>
                    <Ionicons
                      name={shot.overlapStatus === "good" ? "checkmark" : "alert"}
                      size={11}
                      color="#fff"
                    />
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>
        </>
      )}

      <View style={styles.form}>
        <View style={styles.field}>
          <CustomText textStyle="caption" style={styles.fieldLabel}>
            Panorama name
          </CustomText>
          <TextInput
            value={name}
            onChangeText={setName}
            editable={!uploading}
            placeholder="Name this 360° view"
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
            placeholder="Room, amenity, or location details"
            placeholderTextColor="rgba(0, 0, 0, 0.45)"
            style={[customTextVariants.body, styles.input, styles.descriptionInput]}
          />
        </View>
      </View>
        {error ? (
          <CustomText textStyle="caption" style={styles.reviewError}>
            {error}
          </CustomText>
        ) : null}
      </View>

      <View pointerEvents="box-none" style={[styles.pageFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <LinearGradient
          colors={["rgba(242, 242, 247, 0)", "rgba(242, 242, 247, 0.62)", BACKGROUND]}
          locations={[0, 0.5, 1]}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />
        <SecondaryButton
          label="Retake"
          icon="refresh"
          disabled={uploading}
          onPress={onRetake}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create 360 panorama"
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
              Create 360°
            </CustomText>
          )}
        </Pressable>
      </View>

      <GlassNavHeader
        title="Review panorama"
        backButton={
          <LiquidGlassIconButton
            icon="close"
            accessibilityLabel="Close panorama review"
            onPress={onClose}
          />
        }
        right={
          <LiquidGlassIconButton
            icon="share-outline"
            accessibilityLabel={`Share all ${shotCount} panorama photos`}
            disabled={uploading || sharingAll || shots.length === 0}
            onPress={() => void shareAllShots()}
          />
        }
      />

      {previewExpanded ? (
        <View accessibilityViewIsModal style={styles.expandedPreview}>
          <PanoramaThreeLayer
            shots={shots}
            degreesPerShot={degreesPerShot}
            headingDegrees={headingDegrees}
            referenceHeadingDegrees={referenceHeadingDegrees}
            interactive
            navigationCommand={previewNavigationCommand}
            style={styles.expandedPreviewLayer}
          />
          <View pointerEvents="none" style={[styles.expandedPreviewHint, { top: insets.top + 16 }]}>
            <Ionicons name="hand-left-outline" size={15} color="#fff" />
            <CustomText textStyle="micro" style={styles.expandedPreviewHintText}>Drag to explore the 360° view</CustomText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Minimize 360 preview"
            onPress={() => {
              setPreviewNavigationCommand(null);
              setPreviewExpanded(false);
            }}
            style={({ pressed }) => [styles.expandedPreviewClose, { top: insets.top + 12 }, pressed && styles.pressed]}
          >
            <Ionicons name="contract-outline" size={22} color="#fff" />
          </Pressable>
          <View style={[styles.expandedPreviewControls, { bottom: Math.max(insets.bottom, 18) + 48 }]}> 
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Look up"
              onPress={() => nudgePreview(0, 18)}
              style={({ pressed }) => [styles.previewDirectionButton, styles.previewDirectionUp, pressed && styles.previewDirectionButtonPressed]}
            >
              <Ionicons name="chevron-up" size={24} color="#fff" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Look left"
              onPress={() => nudgePreview(-degreesPerShot, 0)}
              style={({ pressed }) => [styles.previewDirectionButton, styles.previewDirectionLeft, pressed && styles.previewDirectionButtonPressed]}
            >
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </Pressable>
            <View pointerEvents="none" style={styles.previewDirectionCenter}>
              <Ionicons name="move-outline" size={17} color="rgba(255,255,255,0.78)" />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Look right"
              onPress={() => nudgePreview(degreesPerShot, 0)}
              style={({ pressed }) => [styles.previewDirectionButton, styles.previewDirectionRight, pressed && styles.previewDirectionButtonPressed]}
            >
              <Ionicons name="chevron-forward" size={24} color="#fff" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Look down"
              onPress={() => nudgePreview(0, -18)}
              style={({ pressed }) => [styles.previewDirectionButton, styles.previewDirectionDown, pressed && styles.previewDirectionButtonPressed]}
            >
              <Ionicons name="chevron-down" size={24} color="#fff" />
            </Pressable>
          </View>
          <View pointerEvents="none" style={[styles.expandedPreviewFooter, { paddingBottom: Math.max(insets.bottom, 18) }]}>
            <CustomText textStyle="micro" style={styles.expandedPreviewFooterText}>{shots.length}/{shotCount} panorama views loaded</CustomText>
          </View>
        </View>
      ) : null}

      {selectedShot && selectedShotIndex !== null ? (
        <View accessibilityViewIsModal style={styles.shotViewer}>
          <View style={[styles.shotViewerHeader, { paddingTop: insets.top }]}>
            <View style={styles.cameraBar}>
              <LiquidGlassIconButton
                icon="close"
                accessibilityLabel="Close photo viewer"
                onPress={() => setSelectedShotIndex(null)}
              />
              <View style={styles.shotViewerHeading}>
                <CustomText textStyle="title" style={styles.shotViewerTitle}>
                  Photo {selectedShotIndex + 1} of {shots.length}
                </CustomText>
                <CustomText textStyle="micro" style={styles.shotViewerSubtitle}>
                  Original panorama source
                </CustomText>
              </View>
              <View style={styles.headerSide} />
            </View>
          </View>

          <Image
            accessibilityLabel={`Panorama source photo ${selectedShotIndex + 1}`}
            source={{ uri: selectedShot.uri }}
            style={styles.shotViewerImage}
            resizeMode="contain"
          />

          <View style={[styles.shotViewerFooter, { paddingBottom: Math.max(insets.bottom, 18) }]}> 
            <CustomText textStyle="caption" style={styles.shotViewerHint}>
              Use AirDrop, Quick Share, or Save to Files to move this full-resolution JPEG to a computer.
            </CustomText>
            <View style={styles.shotViewerNavigation}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous panorama photo"
                disabled={selectedShotIndex === 0}
                onPress={() => setSelectedShotIndex((current) => current === null ? null : Math.max(0, current - 1))}
                style={({ pressed }) => [
                  styles.shotNavigationButton,
                  pressed && styles.pressed,
                  selectedShotIndex === 0 && styles.disabled,
                ]}
              >
                <Ionicons name="chevron-back" size={22} color="#fff" />
              </Pressable>
              <View style={styles.shotViewerDots}>
                {shots.map((shot, index) => (
                  <View
                    key={shot.index}
                    style={[styles.shotViewerDot, index === selectedShotIndex && styles.shotViewerDotActive]}
                  />
                ))}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next panorama photo"
                disabled={selectedShotIndex === shots.length - 1}
                onPress={() => setSelectedShotIndex((current) => current === null ? null : Math.min(shots.length - 1, current + 1))}
                style={({ pressed }) => [
                  styles.shotNavigationButton,
                  pressed && styles.pressed,
                  selectedShotIndex === shots.length - 1 && styles.disabled,
                ]}
              >
                <Ionicons name="chevron-forward" size={22} color="#fff" />
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Share panorama photo ${selectedShotIndex + 1}`}
              disabled={sharing}
              onPress={() => void shareSelectedShot()}
              style={({ pressed }) => [
                styles.primaryBtn,
                sharing && styles.disabled,
                pressed && !sharing && styles.pressed,
              ]}
            >
              {sharing ? (
                <LoadingDots size="small" color={CARD} />
              ) : (
                <CustomText textStyle="title" style={styles.primaryBtnText}>
                  Share original photo
                </CustomText>
              )}
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function ProcessingPage({ stage }: { stage: "processing" | "aligning" }) {
  return (
    <View style={styles.page}>
      <View style={styles.processingBody}>
        <LoadingDots color={ACCENT} />
        <CustomText textStyle="hero" style={styles.centered}>
          {stage === "processing" ? "Processing your scan" : "Aligning your scan"}
        </CustomText>
        <CustomText textStyle="body" style={styles.processingCopy}>
          Your newest 360° view will appear here shortly.
        </CustomText>
      </View>
    </View>
  );
}

export function PanoramaAssetRecorder({ visible, onClose, onUpload }: PanoramaAssetRecorderProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [captureMode, setCaptureMode] = useState<PanoramaCaptureMode>("wide-6");
  const captureConfiguration = CAPTURE_CONFIG[captureMode];
  const shotCount = captureConfiguration.shotCount;
  const degreesPerShot = captureConfiguration.degreesPerShot;
  const [phase, setPhase] = useState<CapturePhase>("intro");
  const [starting, setStarting] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [shots, setShots] = useState<PanoramaShot[]>([]);
  const [motion, setMotion] = useState<MotionReading>(EMPTY_MOTION);
  const [holdProgress, setHoldProgress] = useState(0);
  const [takingPhoto, setTakingPhoto] = useState(false);
  const [checkingOverlap, setCheckingOverlap] = useState(false);
  const [overlapMessage, setOverlapMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processingStage, setProcessingStage] = useState<"processing" | "aligning">("processing");
  const [error, setError] = useState<string | null>(null);
  const [availableLenses, setAvailableLenses] = useState<string[]>([]);

  const cameraRef = useRef<CameraView | null>(null);
  const shotsRef = useRef<PanoramaShot[]>([]);
  const motionRef = useRef<MotionReading | null>(null);
  const referenceHeadingRef = useRef<number | null>(null);
  const holdStartedAtRef = useRef<number | null>(null);
  const lastAlignedAtRef = useRef<number | null>(null);
  const captureRearmAtRef = useRef(0);
  const takingPhotoRef = useRef(false);
  const captureSessionRef = useRef(0);
  const captureShotRef = useRef<() => Promise<void>>(async () => undefined);
  const processingTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const ultraWideLens = useMemo(
    () => availableLenses.find((lens) => /ultra.?wide/i.test(lens)),
    [availableLenses],
  );
  const selectedLens = Platform.OS === "ios" && captureMode === "ultrawide-6"
    ? ultraWideLens
    : undefined;

  const reset = useCallback((nextPhase: CapturePhase = "intro") => {
    captureSessionRef.current += 1;
    shotsRef.current = [];
    motionRef.current = null;
    referenceHeadingRef.current = null;
    holdStartedAtRef.current = null;
    lastAlignedAtRef.current = null;
    captureRearmAtRef.current = 0;
    takingPhotoRef.current = false;
    setShots([]);
    setMotion(EMPTY_MOTION);
    setHoldProgress(0);
    setTakingPhoto(false);
    setCheckingOverlap(false);
    setOverlapMessage(null);
    setCameraReady(false);
    setUploading(false);
    setProcessingStage("processing");
    setError(null);
    setPhase(nextPhase);
  }, []);

  useEffect(() => {
    if (!visible) reset();
  }, [reset, visible]);

  useEffect(() => () => {
    if (processingTimerRef.current) clearTimeout(processingTimerRef.current);
  }, []);

  const beginCapture = useCallback(async () => {
    if (starting) return;
    setStarting(true);
    setError(null);
    try {
      const cameraAllowed = cameraPermission?.granted
        ? true
        : cameraPermission?.canAskAgain !== false
          ? (await requestCameraPermission()).granted
          : false;
      if (!cameraAllowed) {
        setError("Camera access is required. Enable it in Settings and try again.");
        return;
      }

      const motionAvailable = await DeviceMotion.isAvailableAsync();
      if (!motionAvailable) {
        setError("Motion sensors are unavailable on this device. Use a physical phone for 360° capture.");
        return;
      }
      if (Platform.OS === "ios") {
        const motionPermission = await DeviceMotion.requestPermissionsAsync();
        if (!motionPermission.granted) {
          setError("Motion access is required to keep the panorama level. Enable Motion & Fitness access in Settings.");
          return;
        }
      }

      reset("capture");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start 360° capture.");
    } finally {
      setStarting(false);
    }
  }, [cameraPermission, requestCameraPermission, reset, starting]);

  const targetIndex = shots.length;
  const referenceHeading = referenceHeadingRef.current;
  const targetHeading = targetIndex === 0 || referenceHeading === null
    ? motion.headingDegrees
    : normalizeHeading(referenceHeading + targetIndex * degreesPerShot);
  const yawError = signedAngle(targetHeading - motion.headingDegrees);
  const upright = motion.orientation === DeviceMotionOrientation.Portrait;
  const level = Math.abs(motion.rollDegrees) <= ROLL_TOLERANCE_DEGREES;
  const onHorizon = Math.abs(motion.pitchDegrees) <= PITCH_TOLERANCE_DEGREES;
  const onTarget = Math.abs(yawError) <= YAW_TOLERANCE_DEGREES;
  const steady = motion.rotationRateDegrees <= MAX_ROTATION_RATE_DEGREES;
  const aligned = upright && level && onHorizon && onTarget && steady && cameraReady;

  const captureShot = useCallback(async () => {
    if (takingPhotoRef.current || !cameraReady) return;
    const currentMotion = motionRef.current;
    const index = shotsRef.current.length;
    if (!currentMotion || index >= shotCount) return;
    const session = captureSessionRef.current;
    const previousShot = shotsRef.current[index - 1];

    // The first photo defines zero degrees from wherever the user is facing.
    // Every later target is measured from this frozen origin.
    if (index === 0) referenceHeadingRef.current = currentMotion.headingDegrees;
    const reference = referenceHeadingRef.current;
    if (reference === null) return;

    takingPhotoRef.current = true;
    holdStartedAtRef.current = null;
    lastAlignedAtRef.current = null;
    captureRearmAtRef.current = Number.POSITIVE_INFINITY;
    setTakingPhoto(true);
    setCheckingOverlap(false);
    setOverlapMessage(null);
    setHoldProgress(0);
    setError(null);
    try {
      const camera = cameraRef.current;
      if (!camera) throw new Error("The camera is still starting. Hold steady and try again.");
      const target = normalizeHeading(reference + index * degreesPerShot);
      const photo = await camera.takePictureAsync({
        quality: 0.85,
        exif: false,
      });
      if (!photo?.uri) throw new Error("The camera did not return a panorama photo.");
      const shot: PanoramaShot = {
        uri: asFileUri(photo.uri),
        fileName: `panorama-shot-${index + 1}-${Date.now()}.jpg`,
        mimeType: "image/jpeg",
        index,
        headingDegrees: currentMotion.headingDegrees,
        targetHeadingDegrees: target,
        rollDegrees: currentMotion.rollDegrees,
        pitchDegrees: currentMotion.pitchDegrees,
        overlapStatus: index === 0 ? "baseline" : "checking",
      };
      let nextShots = [...shotsRef.current, shot];
      shotsRef.current = nextShots;
      setShots(nextShots);
      if (previousShot) {
        setCheckingOverlap(true);
        const adjacentCheckPromise = checkPanoramaOverlap(previousShot.uri, shot.uri);
        const closureCheckPromise = index === shotCount - 1
          ? checkPanoramaOverlap(shot.uri, shotsRef.current[0]!.uri)
          : null;
        const [adjacentCheck, closureCheck] = await Promise.all([
          adjacentCheckPromise,
          closureCheckPromise,
        ]);
        if (captureSessionRef.current !== session) return;
        const status = closureCheck
          ? weakerOverlapQuality(adjacentCheck.quality, closureCheck.quality)
          : adjacentCheck.quality;
        const checkedShot: PanoramaShot = {
          ...shot,
          overlapStatus: status,
          overlapScore: adjacentCheck.score,
          overlapPercent: adjacentCheck.overlapPercent,
          closureStatus: closureCheck?.quality,
        };
        nextShots = nextShots.map((candidate) => (
          candidate.fileName === checkedShot.fileName ? checkedShot : candidate
        ));
        shotsRef.current = nextShots;
        setShots(nextShots);
        if (status === "good") {
          setOverlapMessage("Overlap verified · matching scene detail found");
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (status === "weak") {
          setOverlapMessage("Weak overlap detected · tap Undo to retake this photo");
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } else {
          setOverlapMessage("Low-detail seam · overlap could not be verified locally");
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      } else {
        setOverlapMessage("Starting view saved · turn toward the next target");
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      if (nextShots.length === shotCount) {
        setPhase("review");
      } else {
        // Explicitly arm the next target after the camera has saved
        // this photo. Sensor updates then resume auto-capture immediately.
        const latestStatus = nextShots.at(-1)?.overlapStatus;
        const feedbackPause = latestStatus === "weak"
          ? 1_000
          : latestStatus === "unverifiable"
            ? 600
            : POST_CAPTURE_REARM_MS;
        captureRearmAtRef.current = Date.now() + feedbackPause;
      }
    } catch (caught) {
      if (captureSessionRef.current === session) {
        const capturedShot = shotsRef.current.find((candidate) => candidate.index === index);
        if (capturedShot?.overlapStatus === "checking") {
          const uncheckedShots = shotsRef.current.map((candidate) => (
            candidate.fileName === capturedShot.fileName
              ? { ...candidate, overlapStatus: "unverifiable" as const }
              : candidate
          ));
          shotsRef.current = uncheckedShots;
          setShots(uncheckedShots);
          setOverlapMessage("Local overlap check unavailable · photo was still saved");
          if (uncheckedShots.length === shotCount) setPhase("review");
        } else {
          setError(caught instanceof Error ? caught.message : "Could not capture this panorama photo.");
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      }
    } finally {
      if (captureSessionRef.current === session) {
        takingPhotoRef.current = false;
        if (captureRearmAtRef.current === Number.POSITIVE_INFINITY) {
          captureRearmAtRef.current = Date.now() + POST_CAPTURE_REARM_MS;
        }
        setCheckingOverlap(false);
        setTakingPhoto(false);
      }
    }
  }, [cameraReady, degreesPerShot, shotCount]);

  captureShotRef.current = captureShot;

  useEffect(() => {
    if (!visible || phase !== "capture") return;
    DeviceMotion.setUpdateInterval(SENSOR_INTERVAL_MS);
    const subscription = DeviceMotion.addListener((measurement) => {
      const next = motionFromMeasurement(measurement, motionRef.current);
      motionRef.current = next;
      setMotion(next);

      const index = shotsRef.current.length;
      if (!cameraReady || index >= shotCount) return;

      // Before shot one, keep zero degrees attached to the live camera view.
      // The user can start from any direction and only needs to be upright.
      if (index === 0) referenceHeadingRef.current = next.headingDegrees;
      if (referenceHeadingRef.current === null) return;
      const reference = referenceHeadingRef.current;
      const nextTarget = index === 0
        ? next.headingDegrees
        : normalizeHeading(reference + index * degreesPerShot);
      const nextYawError = signedAngle(nextTarget - next.headingDegrees);
      const now = Date.now();
      const isAligned =
        next.orientation === DeviceMotionOrientation.Portrait
        && Math.abs(next.rollDegrees) <= ROLL_TOLERANCE_DEGREES
        && Math.abs(next.pitchDegrees) <= PITCH_TOLERANCE_DEGREES
        && (index === 0 || Math.abs(nextYawError) <= YAW_TOLERANCE_DEGREES)
        && next.rotationRateDegrees <= MAX_ROTATION_RATE_DEGREES
        && now >= captureRearmAtRef.current
        && !takingPhotoRef.current;

      if (!isAligned) {
        const lastAlignedAt = lastAlignedAtRef.current;
        const withinJitterGrace =
          holdStartedAtRef.current !== null
          && lastAlignedAt !== null
          && now - lastAlignedAt <= ALIGNMENT_GRACE_MS;
        if (!withinJitterGrace) {
          holdStartedAtRef.current = null;
          lastAlignedAtRef.current = null;
          setHoldProgress(0);
        }
        return;
      }
      lastAlignedAtRef.current = now;
      const holdStartedAt = holdStartedAtRef.current ?? now;
      holdStartedAtRef.current = holdStartedAt;
      const holdDuration = index === 0 ? FIRST_SHOT_HOLD_MS : FOLLOWUP_SHOT_HOLD_MS;
      const progress = clamp((now - holdStartedAt) / holdDuration, 0, 1);
      setHoldProgress(progress);
      if (progress >= 1) {
        holdStartedAtRef.current = null;
        lastAlignedAtRef.current = null;
        void captureShotRef.current();
      }
    });
    return () => subscription.remove();
  }, [cameraReady, degreesPerShot, phase, shotCount, visible]);

  const requestClose = useCallback(() => {
    if (phase === "intro" || shotsRef.current.length === 0) {
      reset();
      onClose();
      return;
    }
    Alert.alert("Discard this 360° capture?", `The ${shotCount} source photos have not been uploaded.`, [
      { text: "Keep capturing", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => {
          reset();
          onClose();
        },
      },
    ]);
  }, [onClose, phase, reset, shotCount]);

  const retake = useCallback(() => {
    reset("capture");
  }, [reset]);

  const undoLastShot = useCallback(() => {
    if (takingPhotoRef.current || shotsRef.current.length === 0) return;
    const nextShots = shotsRef.current.slice(0, -1);
    shotsRef.current = nextShots;
    holdStartedAtRef.current = null;
    lastAlignedAtRef.current = null;
    captureRearmAtRef.current = Date.now() + POST_CAPTURE_REARM_MS;
    if (nextShots.length === 0) referenceHeadingRef.current = null;
    setHoldProgress(0);
    setShots(nextShots);
    setError(null);
    setOverlapMessage(nextShots.length > 0 ? "Last photo removed · return to the target" : null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const upload = useCallback(async (name: string, description: string) => {
    if (uploading || shotsRef.current.length !== shotCount) return;
    setUploading(true);
    setProcessingStage("processing");
    setPhase("processing");
    processingTimerRef.current = setTimeout(() => setProcessingStage("aligning"), 1_800);
    setError(null);
    try {
      await onUpload({ name, description, shots: shotsRef.current, captureMode });
      reset();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create this 360° panorama.");
      setPhase("review");
    } finally {
      if (processingTimerRef.current) clearTimeout(processingTimerRef.current);
      processingTimerRef.current = undefined;
      setUploading(false);
    }
  }, [captureMode, onClose, onUpload, reset, shotCount, uploading]);

  const switchCaptureMode = useCallback(() => {
    if (takingPhotoRef.current) return;
    const nextMode: PanoramaCaptureMode = captureMode === "wide-6" ? "ultrawide-6" : "wide-6";
    const applyMode = () => {
      setCaptureMode(nextMode);
      reset("capture");
    };
    if (shotsRef.current.length === 0) {
      applyMode();
      return;
    }
    Alert.alert(
      `Switch to ${CAPTURE_CONFIG[nextMode].lensLabel}?`,
      "Changing lenses restarts this panorama so every photo uses the same spacing and field of view.",
      [
        { text: "Keep current", style: "cancel" },
        { text: "Switch and restart", style: "destructive", onPress: applyMode },
      ],
    );
  }, [captureMode, reset]);

  const usingUltraWide = captureMode === "ultrawide-6";
  const isFirstShot = targetIndex === 0;

  const instruction = useMemo(() => {
    if (!cameraReady) return "Starting camera…";
    if (checkingOverlap) return "Checking image overlap…";
    if (takingPhoto) return "Capturing…";
    if (!upright) return "Hold your phone vertically";
    if (!level) return `Tilt your device ${motion.rollDegrees > 0 ? "to the left" : "to the right"}`;
    if (!onHorizon) return `Tilt your device ${motion.pitchDegrees > 0 ? "down" : "up"}`;
    if (!isFirstShot && !onTarget) return `Move ${yawError > 0 ? "left" : "right"} to center the target`;
    if (!steady) return "Slow down and hold steady";
    return isFirstShot ? "Hold steady to set your starting view" : "Hold steady";
  }, [cameraReady, checkingOverlap, isFirstShot, level, motion.pitchDegrees, motion.rollDegrees, onHorizon, onTarget, steady, takingPhoto, upright, yawError]);

  const visualCenterY = height * 0.46;
  const cameraFrameWidth = Math.min(width * 0.82, (height * 0.68 * 9) / 16);
  const cameraFrameHeight = cameraFrameWidth * (16 / 9);
  const cameraFrameLeft = (width - cameraFrameWidth) / 2;
  const cameraFrameTop = visualCenterY - cameraFrameHeight / 2;
  // One captured frame owns exactly one angular slot. Using the frame width
  // here keeps neighboring photos edge-to-edge and fixed in world space.
  const panoramaPixelsPerDegree = cameraFrameWidth / degreesPerShot;
  const targetLeft = isFirstShot
    ? width / 2 - 17
    : width / 2 + clamp(yawError / 78, -1, 1) * (width / 2 - 42) - 17;
  // All photos share one horizontal horizon; pitch is corrected through
  // the level guidance instead of moving the target vertically.
  const targetTop = visualCenterY - 17;
  const targetCenterX = targetLeft + 17;
  const targetCenterY = targetTop + 17;
  const guideDeltaX = targetCenterX - width / 2;
  const guideDeltaY = targetCenterY - visualCenterY;
  const guideLength = Math.sqrt(guideDeltaX * guideDeltaX + guideDeltaY * guideDeltaY);
  const guideAngle = Math.atan2(guideDeltaY, guideDeltaX) * (180 / Math.PI);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={requestClose}
    >
      {phase === "intro" ? (
        <IntroPage
          onStart={() => void beginCapture()}
          onClose={onClose}
          captureMode={captureMode}
          onCaptureModeChange={setCaptureMode}
          starting={starting}
          error={error}
        />
      ) : phase === "review" ? (
        <ReviewPage
          shots={shots}
          shotCount={shotCount}
          degreesPerShot={degreesPerShot}
          headingDegrees={motion.headingDegrees}
          referenceHeadingDegrees={referenceHeadingRef.current}
          onRetake={retake}
          onUpload={(name, description) => void upload(name, description)}
          onClose={requestClose}
          uploading={uploading}
          error={error}
        />
      ) : phase === "processing" ? (
        <ProcessingPage stage={processingStage} />
      ) : (
        <View style={styles.cameraPage}>
          <View
            pointerEvents="none"
            style={[
              styles.hiddenCameraSource,
              {
                left: cameraFrameLeft,
                top: cameraFrameTop,
                width: cameraFrameWidth,
                height: cameraFrameHeight,
              },
            ]}
          >
            <CameraView
              key={captureMode}
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="back"
              mode="picture"
              active={visible && phase === "capture"}
              zoom={0}
              autofocus="off"
              selectedLens={selectedLens}
              animateShutter
              responsiveOrientationWhenOrientationLocked={false}
              onAvailableLensesChanged={({ lenses }) => setAvailableLenses(lenses)}
              onCameraReady={() => {
                setCameraReady(true);
                setError(null);
              }}
              onMountError={(caught) => {
                setCameraReady(false);
                setError(caught.message);
              }}
            />
          </View>

          <PanoramaThreeLayer
            shots={shots}
            degreesPerShot={degreesPerShot}
            headingDegrees={motion.headingDegrees}
            referenceHeadingDegrees={referenceHeadingRef.current}
            style={styles.threeLayer}
          />

          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.capturedPhotoLayer]}>
            {shots.map((shot) => {
              const relativeHeading = signedAngle(shot.targetHeadingDegrees - motion.headingDegrees);
              const horizontalOffset = relativeHeading * panoramaPixelsPerDegree;
              const distanceOpacity = clamp(1 - Math.max(Math.abs(relativeHeading) - 72, 0) / 80, 0.18, 0.92);
              return (
                <View
                  key={shot.fileName}
                  style={[
                    styles.capturedWorldFrame,
                    {
                      left: cameraFrameLeft + horizontalOffset,
                      top: cameraFrameTop,
                      width: cameraFrameWidth,
                      height: cameraFrameHeight,
                      opacity: distanceOpacity,
                    },
                  ]}
                >
                  <Image source={{ uri: shot.uri }} resizeMode="cover" style={StyleSheet.absoluteFill} />
                </View>
              );
            })}
          </View>

          <View
            pointerEvents="none"
            style={[
              styles.verticalCaptureGuide,
              upright && level && onHorizon && styles.verticalCaptureGuideUpright,
              {
                left: cameraFrameLeft,
                top: cameraFrameTop,
                width: cameraFrameWidth,
                height: cameraFrameHeight,
              },
            ]}
          />

          <View pointerEvents="box-none" style={[styles.captureHeader, { paddingTop: insets.top }]}>
            <View style={styles.cameraBar}>
              <LiquidGlassIconButton
                icon="close"
                accessibilityLabel="Close 360 capture"
                onPress={requestClose}
              />
              <View style={styles.captureCounter}>
                <Ionicons name="scan-outline" size={15} color={CARD} />
                <CustomText textStyle="micro" style={styles.captureCounterText}>
                  {Math.min(targetIndex + 1, shotCount)} / {shotCount}
                </CustomText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Switch from ${captureConfiguration.lensLabel} capture mode`}
                disabled={takingPhoto}
                onPress={switchCaptureMode}
                style={[styles.lensBadge, takingPhoto && styles.disabled]}
              >
                <CustomText textStyle="label" style={styles.lensBadgeText}>
                  {usingUltraWide ? "0.5×" : "1×"}
                </CustomText>
              </Pressable>
            </View>
          </View>

          <View pointerEvents="none" style={styles.instructionWrap}>
            <View style={[styles.orientationIcon, aligned && styles.orientationIconReady]}>
              <Ionicons name="phone-portrait-outline" size={26} color="#fff" />
            </View>
            <CustomText textStyle="hero" style={styles.instructionText}>{instruction}</CustomText>
            <CustomText textStyle="caption" style={styles.instructionSubtext}>
              {isFirstShot ? "This view becomes the 360° starting point" : `Rotate to position ${targetIndex + 1}`}
            </CustomText>
          </View>

          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.captureGuides]}>
            <View
              style={[
                styles.targetGuideLine,
                {
                  left: (width / 2 + targetCenterX) / 2 - guideLength / 2,
                  top: (visualCenterY + targetCenterY) / 2,
                  width: guideLength,
                  transform: [{ rotate: `${guideAngle}deg` }],
                },
              ]}
            />
            <View
              style={[
                styles.targetDot,
                aligned && styles.targetDotReady,
                { left: targetLeft, top: targetTop },
              ]}
            >
              <View style={styles.targetDotCore} />
            </View>
            <View style={[styles.reticle, { left: width / 2 - 43, top: visualCenterY - 43 }]}> 
              <View
                style={[
                  styles.reticleProgress,
                  {
                    opacity: aligned ? 0.3 + holdProgress * 0.7 : 0,
                    transform: [{ scale: 0.72 + holdProgress * 0.28 }],
                  },
                ]}
              />
              <View style={styles.reticleCenter} />
            </View>
            <View
              style={[
                styles.horizonLine,
                {
                  top: visualCenterY,
                  transform: [{ rotate: `${-motion.rollDegrees}deg` }],
                },
                level && styles.horizonLineReady,
              ]}
            />
          </View>

          {shots.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Undo last panorama photo"
              disabled={takingPhoto}
              onPress={undoLastShot}
              style={({ pressed }) => [styles.undoButton, pressed && styles.pressed, takingPhoto && styles.disabled]}
            >
              <Ionicons name="arrow-undo" size={14} color="#fff" />
              <CustomText textStyle="micro" style={styles.undoButtonText}>Undo</CustomText>
            </Pressable>
          ) : null}

          <View style={[styles.captureFooter, { paddingBottom: Math.max(insets.bottom, Platform.OS === "ios" ? 18 : 24) }]}> 
            <CustomText textStyle="micro" style={styles.panoramaSlotsLabel}>360° photo spaces</CustomText>
            <View style={styles.panoramaSlots}>
              {Array.from({ length: shotCount }).map((_, index) => {
                const shot = shots[index];
                return (
                  <View
                    key={index}
                    style={[
                      styles.panoramaSlot,
                      shot && styles.panoramaSlotDone,
                      shot?.overlapStatus === "checking" && styles.panoramaSlotChecking,
                      shot?.overlapStatus === "weak" && styles.panoramaSlotWeak,
                      shot?.overlapStatus === "unverifiable" && styles.panoramaSlotUnknown,
                      index === targetIndex && styles.panoramaSlotCurrent,
                    ]}
                  >
                    {shot ? (
                      <>
                        <Image source={{ uri: shot.uri }} resizeMode="cover" style={StyleSheet.absoluteFill} />
                        {shot.overlapStatus !== "baseline" ? (
                          <View style={styles.panoramaSlotStatus}>
                            {shot.overlapStatus === "checking" ? (
                              <LoadingDots size="small" color="#fff" />
                            ) : (
                              <Ionicons
                                name={shot.overlapStatus === "good" ? "checkmark" : "alert"}
                                size={10}
                                color="#fff"
                              />
                            )}
                          </View>
                        ) : null}
                      </>
                    ) : (
                      <CustomText textStyle="micro" style={styles.panoramaSlotNumber}>{index + 1}</CustomText>
                    )}
                  </View>
                );
              })}
            </View>
            <View style={styles.qualityRow}>
              <QualityPill label="Level" ready={upright && level} />
              <QualityPill label="Horizon" ready={onHorizon} />
              <QualityPill label="Steady" ready={steady} />
            </View>
            <CustomText textStyle="caption" style={styles.autoCaptureText}>
              {overlapMessage ?? (isFirstShot
                ? "The first photo captures automatically when the phone is upright."
                : "Photos capture automatically when the target is centered.")}
            </CustomText>
          </View>

          {error ? (
            <Pressable onPress={() => setError(null)} style={[styles.cameraError, { bottom: Math.max(insets.bottom, 18) + 162 }]}> 
              <CustomText textStyle="caption" style={styles.cameraErrorText}>{error}</CustomText>
            </Pressable>
          ) : null}
        </View>
      )}
    </Modal>
  );
}

function QualityPill({ label, ready }: { label: string; ready: boolean }) {
  return (
    <View style={[styles.qualityPill, ready && styles.qualityPillReady]}>
      <Ionicons name={ready ? "checkmark" : "ellipse-outline"} size={13} color="#fff" />
      <CustomText textStyle="micro" style={styles.qualityPillText}>{label}</CustomText>
    </View>
  );
}

export type { PanoramaShot, RecordedPanoramaAsset };

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: BACKGROUND },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.45 },
  centered: { textAlign: "center" },
  introContent: { alignItems: "center", gap: 12, paddingHorizontal: 16 },
  introIllustration: { height: 190, alignItems: "center", justifyContent: "center" },
  introOrbit: {
    width: 174,
    height: 174,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 87,
    backgroundColor: HINT,
  },
  introOrbitDot: {
    position: "absolute",
    width: 12,
    height: 12,
    borderWidth: 3,
    borderColor: CARD,
    borderRadius: 6,
    backgroundColor: ACCENT,
  },
  introPhone: {
    width: 76,
    height: 100,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: SMALL_CORNER,
    backgroundColor: ACCENT,
  },
  introTitle: { maxWidth: 360, textAlign: "center" },
  introBody: {
    maxWidth: 370,
    color: "rgba(0, 0, 0, 0.45)",
    textAlign: "center",
    lineHeight: 20,
  },
  captureModePicker: {
    width: "100%",
    maxWidth: 390,
    flexDirection: "row",
    gap: 7,
    marginTop: 4,
  },
  captureModeOption: {
    flex: 1,
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    borderRadius: SMALL_CORNER,
    backgroundColor: CARD,
  },
  captureModeOptionSelected: { backgroundColor: HINT },
  captureModeTitle: { color: "rgba(0, 0, 0, 0.45)", textAlign: "center" },
  captureModeTitleSelected: { color: ACCENT },
  captureModeMeta: { marginTop: 3, color: "rgba(0, 0, 0, 0.45)", textAlign: "center" },
  captureModeMetaSelected: { color: ACCENT },
  introChecklist: { width: "100%", maxWidth: 390, gap: 8, marginTop: 4 },
  introItem: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 13,
    borderRadius: SMALL_CORNER,
    backgroundColor: CARD,
  },
  introItemIcon: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: HINT,
  },
  introItemText: { flex: 1 },
  introError: { maxWidth: 380, color: C.red, textAlign: "center" },
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
  form: {
    marginHorizontal: 16,
    marginTop: 12,
    overflow: "hidden",
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  field: { paddingHorizontal: 16, paddingVertical: 12, gap: 6 },
  fieldLabel: { color: "rgba(0, 0, 0, 0.45)", textTransform: "uppercase", letterSpacing: 0.4 },
  input: { paddingVertical: 4 },
  descriptionInput: { minHeight: 70, textAlignVertical: "top" },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
    backgroundColor: "rgba(60, 60, 67, 0.18)",
  },
  reviewBody: { flex: 1, minHeight: 0, paddingBottom: 150 },
  processingBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 28,
  },
  processingCopy: { maxWidth: 330, color: "rgba(0, 0, 0, 0.45)", textAlign: "center", lineHeight: 20 },
  headerSide: { width: 42, height: 42 },
  cameraBar: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  cameraPage: { flex: 1, overflow: "hidden", backgroundColor: "#000" },
  cameraLoading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: "#020617" },
  hiddenCameraSource: { position: "absolute", zIndex: 0, overflow: "hidden", opacity: 0.001, backgroundColor: "#000" },
  threeLayer: { zIndex: 1 },
  capturedPhotoLayer: { zIndex: 3 },
  capturedWorldFrame: { position: "absolute", overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", backgroundColor: "#000" },
  verticalCaptureGuide: { position: "absolute", zIndex: 4, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", backgroundColor: "transparent" },
  verticalCaptureGuideUpright: { borderWidth: 2, borderColor: "rgba(134,239,172,0.82)" },
  cameraLoadingText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  captureHeader: { position: "absolute", zIndex: 20, elevation: 20, top: 0, left: 0, right: 0 },
  captureCounter: {
    flex: 1,
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginHorizontal: 12,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  captureCounterText: { color: CARD },
  lensBadge: {
    minWidth: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
    backgroundColor: CARD,
  },
  lensBadgeText: { color: TEXT },
  instructionWrap: { position: "absolute", zIndex: 20, elevation: 20, top: "15%", left: 24, right: 24, alignItems: "center" },
  captureGuides: { zIndex: 20, elevation: 20 },
  orientationIcon: { width: 54, height: 54, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.72)", borderRadius: 16, backgroundColor: "rgba(2,6,23,0.56)" },
  orientationIconReady: { borderColor: "#86efac", backgroundColor: "rgba(22,101,52,0.74)" },
  instructionText: { marginTop: 12, color: "#fff", fontSize: 18, fontWeight: "900", textAlign: "center", textShadowColor: "rgba(0,0,0,0.7)", textShadowRadius: 8 },
  instructionSubtext: { marginTop: 4, color: "rgba(255,255,255,0.84)", fontSize: 12, fontWeight: "700", textAlign: "center", textShadowColor: "rgba(0,0,0,0.7)", textShadowRadius: 7 },
  targetDot: { position: "absolute", width: 34, height: 34, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#fff", borderRadius: 17, backgroundColor: C.brand, shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 7 },
  targetDotReady: { borderColor: "#ec4899", backgroundColor: "#fff" },
  targetDotCore: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.brand },
  targetGuideLine: { position: "absolute", height: 1, borderTopWidth: 1, borderStyle: "dashed", borderColor: "rgba(255,255,255,0.82)" },
  reticle: { position: "absolute", width: 86, height: 86, alignItems: "center", justifyContent: "center", borderWidth: 4, borderColor: "rgba(255,255,255,0.94)", borderRadius: 43, backgroundColor: "rgba(2,6,23,0.08)" },
  reticleProgress: { position: "absolute", width: 72, height: 72, borderRadius: 36, backgroundColor: "#22c55e" },
  reticleCenter: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#fff" },
  horizonLine: { position: "absolute", left: "22%", right: "22%", height: 2, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.6)" },
  horizonLineReady: { backgroundColor: "#86efac" },
  captureFooter: { position: "absolute", zIndex: 20, elevation: 20, left: 0, right: 0, bottom: 0, alignItems: "center", paddingTop: 14, paddingHorizontal: 20, backgroundColor: "rgba(0,0,0,0.82)" },
  panoramaSlotsLabel: { marginBottom: 7, color: "rgba(255,255,255,0.62)", fontSize: 9, fontWeight: "900", letterSpacing: 1.1 },
  panoramaSlots: { flexDirection: "row", alignItems: "center", gap: 7 },
  panoramaSlot: { width: 30, height: 42, alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.4)", borderRadius: 5, backgroundColor: "rgba(30,41,59,0.76)" },
  panoramaSlotCurrent: { width: 34, height: 46, borderWidth: 2, borderColor: C.brand },
  panoramaSlotDone: { borderColor: "#86efac", backgroundColor: "#14532d" },
  panoramaSlotChecking: { borderColor: "#60a5fa", backgroundColor: "#1e3a8a" },
  panoramaSlotWeak: { borderWidth: 2, borderColor: "#f59e0b", backgroundColor: "#78350f" },
  panoramaSlotUnknown: { borderColor: "#94a3b8", backgroundColor: "#334155" },
  panoramaSlotStatus: { position: "absolute", right: 2, bottom: 2, minWidth: 15, height: 15, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: "rgba(2,6,23,0.82)" },
  panoramaSlotNumber: { color: "rgba(255,255,255,0.72)", fontSize: 10, fontWeight: "900" },
  progressDots: { flexDirection: "row", alignItems: "center", gap: 10 },
  progressDot: { width: 10, height: 10, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.66)", borderRadius: 5, backgroundColor: "transparent" },
  progressDotCurrent: { width: 13, height: 13, borderRadius: 7, borderColor: "#fff", backgroundColor: C.brand },
  progressDotDone: { borderColor: "#86efac", backgroundColor: "#22c55e" },
  qualityRow: { flexDirection: "row", gap: 7, marginTop: 15 },
  qualityPill: { minHeight: 28, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, borderRadius: 999, backgroundColor: "rgba(71,85,105,0.72)" },
  qualityPillReady: { backgroundColor: "rgba(22,101,52,0.8)" },
  qualityPillText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  autoCaptureText: { marginTop: 11, color: "rgba(255,255,255,0.76)", fontSize: 11, fontWeight: "700", textAlign: "center" },
  undoButton: { position: "absolute", zIndex: 21, elevation: 21, left: "50%", bottom: 178, minHeight: 34, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "rgba(2,6,23,0.72)", transform: [{ translateX: -42 }] },
  undoButtonText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  cameraError: { position: "absolute", zIndex: 22, elevation: 22, left: 24, right: 24, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 13, backgroundColor: "rgba(127,29,29,0.94)" },
  cameraErrorText: { color: "#fff", fontSize: 12, fontWeight: "800", lineHeight: 17, textAlign: "center" },
  reviewTabs: {
    flexDirection: "row",
    gap: 7,
    marginHorizontal: 16,
    marginTop: 4,
  },
  reviewTab: {
    flex: 1,
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 11,
    borderRadius: 18,
    backgroundColor: CARD,
  },
  reviewTabActive: { backgroundColor: HINT },
  reviewTabText: { color: "rgba(0, 0, 0, 0.45)" },
  reviewTabTextActive: { color: ACCENT },
  seamSummary: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginHorizontal: 18, marginTop: 10, paddingHorizontal: 13, paddingVertical: 11, borderWidth: 1, borderRadius: 13 },
  seamSummaryGood: { borderColor: "#bbf7d0", backgroundColor: "#f0fdf4" },
  seamSummaryWeak: { borderColor: "#fde68a", backgroundColor: "#fffbeb" },
  seamSummaryCopy: { flex: 1 },
  seamSummaryTitle: { color: C.text, fontSize: 12, fontWeight: "900" },
  seamSummaryText: { marginTop: 2, color: C.textSec, fontSize: 10, fontWeight: "600", lineHeight: 14 },
  reviewPreview: { height: 286, overflow: "hidden", marginHorizontal: 18, marginTop: 12, borderRadius: 18, backgroundColor: "#000" },
  reviewPreviewLayer: { borderRadius: 18 },
  reviewPreviewBadge: { position: "absolute", top: 12, left: 12, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: "rgba(2,6,23,0.72)" },
  reviewPreviewBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  reviewPreviewExpand: { position: "absolute", top: 10, right: 10, width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: "rgba(2,6,23,0.76)" },
  reviewPreviewStatus: { position: "absolute", left: 12, bottom: 12, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: "rgba(2,6,23,0.72)" },
  reviewPreviewStatusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#22c55e" },
  reviewPreviewStatusText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  flatPreviewWrap: { height: 286, justifyContent: "center", gap: 12, marginHorizontal: 18, marginTop: 12 },
  flatPreview: { width: "100%", aspectRatio: 2, flexDirection: "row", overflow: "hidden", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 14, backgroundColor: "#000" },
  flatPreviewSegment: { flex: 1, overflow: "hidden", borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: "rgba(255,255,255,0.2)" },
  flatPreviewImage: { width: "100%", height: "100%" },
  flatPreviewCaption: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 8 },
  flatPreviewCaptionText: { flexShrink: 1, color: C.textSec, fontSize: 10, fontWeight: "700", lineHeight: 15, textAlign: "center" },
  expandedPreview: { ...StyleSheet.absoluteFill, zIndex: 30, overflow: "hidden", backgroundColor: "#000" },
  expandedPreviewLayer: { ...StyleSheet.absoluteFill },
  expandedPreviewHint: { position: "absolute", left: 16, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 999, backgroundColor: "rgba(2,6,23,0.76)" },
  expandedPreviewHintText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  expandedPreviewClose: { position: "absolute", right: 16, width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: "rgba(2,6,23,0.8)" },
  expandedPreviewControls: { position: "absolute", right: 16, width: 136, height: 136 },
  previewDirectionButton: { position: "absolute", width: 44, height: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", borderRadius: 22, backgroundColor: "rgba(2,6,23,0.78)" },
  previewDirectionButtonPressed: { backgroundColor: "rgba(37,99,235,0.9)", transform: [{ scale: 0.94 }] },
  previewDirectionUp: { top: 0, left: 46 },
  previewDirectionLeft: { top: 46, left: 0 },
  previewDirectionRight: { top: 46, right: 0 },
  previewDirectionDown: { bottom: 0, left: 46 },
  previewDirectionCenter: { position: "absolute", top: 46, left: 46, width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: "rgba(2,6,23,0.52)" },
  expandedPreviewFooter: { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", paddingTop: 18, backgroundColor: "rgba(2,6,23,0.5)" },
  expandedPreviewFooterText: { color: "rgba(255,255,255,0.84)", fontSize: 11, fontWeight: "800" },
  shotGridHint: { paddingTop: 11, paddingHorizontal: 18, color: C.textSec, fontSize: 11, fontWeight: "700", lineHeight: 16 },
  shotGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 14, paddingTop: 9, paddingBottom: 14 },
  shotTile: { width: "31.7%", aspectRatio: 0.76, overflow: "hidden", borderRadius: 14, backgroundColor: "#dbeafe" },
  shotTilePressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  shotImage: { width: "100%", height: "100%" },
  shotNumber: { position: "absolute", top: 7, left: 7, width: 24, height: 24, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "rgba(2,6,23,0.78)" },
  shotNumberText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  shotViewBadge: { position: "absolute", right: 7, bottom: 7, width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "rgba(2,6,23,0.76)" },
  shotOverlapBadge: { position: "absolute", left: 7, bottom: 7, width: 24, height: 24, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "rgba(21,128,61,0.9)" },
  shotOverlapBadgeWeak: { backgroundColor: "rgba(180,83,9,0.94)" },
  shotOverlapBadgeUnknown: { backgroundColor: "rgba(71,85,105,0.94)" },
  reviewError: { marginHorizontal: 16, marginTop: 10, color: C.red, textAlign: "center" },
  shotViewer: { ...StyleSheet.absoluteFill, zIndex: 20, backgroundColor: "#000" },
  shotViewerHeader: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 2 },
  shotViewerHeading: { flex: 1, alignItems: "center" },
  shotViewerTitle: { color: CARD, textAlign: "center" },
  shotViewerSubtitle: { marginTop: 2, color: "rgba(255,255,255,0.7)", textAlign: "center" },
  shotViewerImage: { flex: 1, width: "100%", backgroundColor: "#000" },
  shotViewerFooter: { paddingTop: 13, paddingHorizontal: 18, backgroundColor: "rgba(2,6,23,0.98)" },
  shotViewerHint: { alignSelf: "center", maxWidth: 390, color: "#cbd5e1", fontSize: 11, fontWeight: "700", lineHeight: 16, textAlign: "center" },
  shotViewerNavigation: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  shotNavigationButton: { width: 44, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#1e293b" },
  shotViewerDots: { flexDirection: "row", alignItems: "center", gap: 7 },
  shotViewerDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#475569" },
  shotViewerDotActive: { width: 20, backgroundColor: ACCENT },
});
