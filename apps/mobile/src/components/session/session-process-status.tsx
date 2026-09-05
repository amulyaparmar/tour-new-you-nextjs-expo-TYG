import { Ionicons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Reanimated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { CustomText } from "@/components/custom-text";
import { LoadingDots } from "@/components/loading-dots";
import { MotionPressable } from "@/components/ui/motion";
import {
  ACCENT,
  BACKGROUND,
  CARD,
  HINT,
  LARGE_CORNER,
} from "@/theme/tokens";
import { tourColors as C } from "@/theme/tour-brand";

const SESSION_PROCESS_STEPS = [
  { id: "uploaded", label: "Uploaded", icon: "cloud-done-outline" },
  { id: "transcribing", label: "Transcript", icon: "mic-outline" },
  { id: "segmenting", label: "Segments", icon: "git-branch-outline" },
  { id: "analyzing", label: "Analysis", icon: "sparkles-outline" },
] as const;

export type SessionStatusTone = "preparing" | "failed" | "synced";

const TONE = {
  preparing: {
    iconBg: HINT,
    iconColor: ACCENT,
  },
  failed: {
    iconBg: C.redBg,
    iconColor: C.red,
  },
  synced: {
    iconBg: C.greenBg,
    iconColor: C.green,
  },
} as const;

export function SessionStatusCard({
  tone,
  icon,
  showSpinner = false,
  title,
  body,
  children,
}: {
  tone: SessionStatusTone;
  icon?: keyof typeof Ionicons.glyphMap;
  showSpinner?: boolean;
  title: string;
  body?: string | null;
  children?: React.ReactNode;
}) {
  const palette = TONE[tone];

  return (
    <Reanimated.View
      entering={FadeInDown.duration(280).springify()}
      style={styles.card}
    >
      {showSpinner ? (
        <LoadingDots
          size="large"
          color={ACCENT}
          accessibilityLabel={title}
        />
      ) : icon ? (
        <View style={[styles.iconWell, { backgroundColor: palette.iconBg }]}>
          <Ionicons name={icon} size={22} color={palette.iconColor} />
        </View>
      ) : null}
      <CustomText textStyle="title" style={styles.title}>
        {title}
      </CustomText>
      {body ? (
        <CustomText textStyle="caption" style={styles.body}>
          {body}
        </CustomText>
      ) : null}
      {children}
    </Reanimated.View>
  );
}

export function SessionStatusPrimaryButton({
  label,
  icon,
  onPress,
  disabled,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      haptic="selection"
      disabled={disabled}
      onPress={onPress}
      style={styles.primaryBtn}
    >
      {icon ? <Ionicons name={icon} size={18} color={CARD} /> : null}
      <CustomText textStyle="title" style={styles.primaryBtnText}>
        {label}
      </CustomText>
    </MotionPressable>
  );
}

export function SessionStatusSecondaryButton({
  label,
  icon,
  onPress,
  disabled,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      haptic="selection"
      disabled={disabled}
      onPress={onPress}
      style={styles.secondaryBtn}
    >
      {icon ? <Ionicons name={icon} size={18} color={C.text} /> : null}
      <CustomText textStyle="title">{label}</CustomText>
    </MotionPressable>
  );
}

export function SessionStatusActions({ children }: { children: React.ReactNode }) {
  return <View style={styles.actions}>{children}</View>;
}

function TimelinePulse() {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.45, { duration: 850, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 850, easing: Easing.in(Easing.quad) }),
      ),
      -1,
      false,
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.45, { duration: 850 }),
        withTiming(1, { duration: 850 }),
      ),
      -1,
      false,
    );
  }, [opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return <Reanimated.View style={[styles.pulse, animatedStyle]} />;
}

export function ProcessingTimeline({ status }: { status: string }) {
  const activeIndex = Math.max(
    0,
    SESSION_PROCESS_STEPS.findIndex((step) => step.id === status),
  );
  const isComplete = status === "analysis_ready" || status === "reviewed";

  return (
    <View style={styles.timeline} accessibilityRole="progressbar">
      {SESSION_PROCESS_STEPS.map((step, index) => {
        const done = isComplete || index < activeIndex;
        const active = !isComplete && index === activeIndex;
        return (
          <View key={step.id} style={styles.step}>
            <View style={styles.stepRail}>
              <View
                style={[
                  styles.stepLine,
                  index === 0 && styles.stepLineHidden,
                  (done || active) && index > 0 && styles.stepLineDone,
                ]}
              />
              <View
                style={[
                  styles.stepIcon,
                  active && styles.stepIconActive,
                  done && styles.stepIconDone,
                ]}
              >
                {active ? (
                  <TimelinePulse />
                ) : (
                  <Ionicons
                    name={done ? "checkmark" : step.icon}
                    size={15}
                    color={done ? C.green : C.textMuted}
                  />
                )}
              </View>
              <View
                style={[
                  styles.stepLine,
                  index === SESSION_PROCESS_STEPS.length - 1 && styles.stepLineHidden,
                  done && styles.stepLineDone,
                ]}
              />
            </View>
            <CustomText
              textStyle="micro"
              style={[
                styles.stepLabel,
                active && styles.stepLabelActive,
                done && styles.stepLabelDone,
              ]}
            >
              {step.label}
            </CustomText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 22,
    paddingVertical: 28,
    borderRadius: LARGE_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  iconWell: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  title: {
    textAlign: "center",
  },
  body: {
    color: C.textSec,
    textAlign: "center",
    lineHeight: 18,
  },
  actions: {
    alignSelf: "stretch",
    gap: 10,
    marginTop: 8,
  },
  primaryBtn: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: 25,
    backgroundColor: ACCENT,
    boxShadow: "0 6px 14px rgba(0, 108, 229, 0.28)",
  },
  primaryBtnText: {
    color: CARD,
  },
  secondaryBtn: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: 25,
    backgroundColor: BACKGROUND,
  },
  timeline: {
    alignSelf: "stretch",
    flexDirection: "row",
    marginTop: 8,
  },
  step: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  stepRail: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
  },
  stepLine: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: BACKGROUND,
  },
  stepLineHidden: {
    backgroundColor: "transparent",
  },
  stepLineDone: {
    backgroundColor: "#bbf7d0",
  },
  stepIcon: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: BACKGROUND,
  },
  stepIconActive: {
    backgroundColor: HINT,
  },
  stepIconDone: {
    backgroundColor: C.greenBg,
  },
  stepLabel: {
    color: C.textMuted,
    textAlign: "center",
  },
  stepLabelActive: {
    color: ACCENT,
  },
  stepLabelDone: {
    color: C.green,
  },
  pulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ACCENT,
  },
});
