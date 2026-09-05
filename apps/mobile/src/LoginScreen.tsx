import { Ionicons } from "@expo/vector-icons";
import type { VideoPlayer } from "expo-video";
import { VideoView } from "expo-video";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  AppState,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Reanimated, {
  Easing,
  withTiming,
  type EntryAnimationsValues,
  type ExitAnimationsValues,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CommunityPickerModal } from "@/components/community-picker-modal";
import { CustomText, customTextVariants } from "@/components/custom-text";
import { LiquidGlassIconButton } from "@/components/liquid-glass-icon-button";
import { LiquidGlassTextButton } from "@/components/liquid-glass-text-button";
import { LoadingDots } from "@/components/loading-dots";
import { MotionPressable } from "@/components/ui/motion";
import { ACCENT, BACKGROUND, CARD, LARGE_CORNER, SMALL_CORNER, TEXT } from "@/theme/tokens";
import { tourColors as C } from "@/theme/tour-brand";

import {
  type MobileAuthSession,
  requestSignInCode,
  switchCommunity,
  verifySignInCode,
} from "./auth";
import { TourLogo } from "./components/TourLogo";

const RESEND_COOLDOWN_SECONDS = 30;

type LoginStep = "welcome" | "email" | "code" | "property";
type TransitionDirection = "forward" | "back";

const STEP_SLIDE_DURATION = 280;
const CARD_HEIGHT = 300;
const STEP_SLIDE_TIMING = {
  duration: STEP_SLIDE_DURATION,
  easing: Easing.out(Easing.cubic),
} as const;

function forwardEntering(values: EntryAnimationsValues) {
  "worklet";
  return {
    initialValues: { transform: [{ translateX: values.targetWidth }] },
    animations: {
      transform: [{ translateX: withTiming(0, STEP_SLIDE_TIMING) }],
    },
  };
}

function forwardExiting(values: ExitAnimationsValues) {
  "worklet";
  return {
    initialValues: { transform: [{ translateX: 0 }] },
    animations: {
      transform: [{ translateX: withTiming(-values.currentWidth, STEP_SLIDE_TIMING) }],
    },
  };
}

function backEntering(values: EntryAnimationsValues) {
  "worklet";
  return {
    initialValues: { transform: [{ translateX: -values.targetWidth }] },
    animations: {
      transform: [{ translateX: withTiming(0, STEP_SLIDE_TIMING) }],
    },
  };
}

function backExiting(values: ExitAnimationsValues) {
  "worklet";
  return {
    initialValues: { transform: [{ translateX: 0 }] },
    animations: {
      transform: [{ translateX: withTiming(values.currentWidth, STEP_SLIDE_TIMING) }],
    },
  };
}

export function LoginScreen({
  player,
  onAuthenticated,
}: {
  player: VideoPlayer;
  onAuthenticated: (session: MobileAuthSession) => void;
}) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<LoginStep>("welcome");
  const [transitionDirection, setTransitionDirection] =
    useState<TransitionDirection>("forward");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [emailSent, setEmailSent] = useState(true);
  const [pendingSession, setPendingSession] = useState<MobileAuthSession | null>(null);
  const [propertyQuery, setPropertyQuery] = useState("");
  const [switchingPropertyId, setSwitchingPropertyId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const transitionTo = useCallback(
    (nextStep: LoginStep, direction: TransitionDirection) => {
      setTransitionDirection(direction);
      requestAnimationFrame(() => {
        setStep(nextStep);
      });
    },
    [],
  );

  const goBack = useCallback(() => {
    setError(null);
    if (step === "code") transitionTo("email", "back");
    else if (step === "email") transitionTo("welcome", "back");
  }, [step, transitionTo]);

  useEffect(() => {
    player.audioMixingMode = "mixWithOthers";
    player.loop = true;
    player.muted = true;
    player.play();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        player.audioMixingMode = "mixWithOthers";
        player.muted = true;
        player.play();
      }
    });
    return () => {
      subscription.remove();
      player.pause();
    };
  }, [player]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (step === "welcome") return false;
      goBack();
      return true;
    });
    return () => subscription.remove();
  }, [goBack, step]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  async function sendCode() {
    if (!email.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    setChallengeId("");
    try {
      const challenge = await requestSignInCode(email);
      setEmail(challenge.email);
      setChallengeId(challenge.challengeId);
      setEmailSent(challenge.emailSent);
      setCode("");
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      if (step !== "code") transitionTo("code", "forward");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send a sign-in code.");
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyCode() {
    if (code.length !== 6 || !challengeId || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const session = await verifySignInCode(email, challengeId, code);
      if (session.workspace.communities.length > 1) {
        setPendingSession(session);
        transitionTo("property", "forward");
        return;
      }
      onAuthenticated(session);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The verification code is invalid.");
    } finally {
      setSubmitting(false);
    }
  }

  async function chooseProperty(communityId: string) {
    if (!pendingSession || switchingPropertyId) return;
    if (communityId === pendingSession.workspace.community.id) {
      onAuthenticated(pendingSession);
      return;
    }

    setSwitchingPropertyId(communityId);
    try {
      onAuthenticated(await switchCommunity(communityId));
    } catch (caught) {
      Alert.alert(
        "Could not switch property",
        caught instanceof Error ? caught.message : "Please try again."
      );
    } finally {
      setSwitchingPropertyId(null);
    }
  }

  return (
    <View style={styles.root}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <View
          style={[
            styles.content,
            {
              paddingTop: insets.top + 16,
              paddingBottom: keyboardVisible ? 8 : Math.max(insets.bottom, 10),
            },
          ]}
        >
          <View style={styles.cardShadow}>
            <View style={styles.card}>
              <Reanimated.View
                key={step}
                entering={
                  transitionDirection === "forward"
                    ? forwardEntering
                    : backEntering
                }
                exiting={
                  transitionDirection === "forward"
                    ? forwardExiting
                    : backExiting
                }
                style={styles.stepContent}
              >
              {step === "welcome" ? (
              <>
                <View style={styles.brandBlock}>
                  <TourLogo width={97} color={TEXT} />
                  <CustomText textStyle="body" style={styles.tagline}>
                    Every great business deserves a great tour. Build yours today.
                  </CustomText>
                </View>
                <PrimaryButton label="Login with Email" onPress={() => transitionTo("email", "forward")} />
              </>
            ) : step === "email" ? (
              <>
                <LoginHeader
                  title="Enter your work email"
                  subtitle="We’ll send a one-time verification code."
                  onBack={goBack}
                />
                <View style={styles.formBlock}>
                  <Field
                    value={email}
                    onChangeText={(value) => {
                      setEmail(value);
                      setChallengeId("");
                      setError(null);
                    }}
                    placeholder="you@company.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    returnKeyType="go"
                    onSubmitEditing={() => void sendCode()}
                    editable={!submitting}
                  />
                  <LoginError message={error} />
                  <PrimaryButton
                    label="Send verification code"
                    onPress={() => void sendCode()}
                    loading={submitting}
                    disabled={!email.trim()}
                  />
                </View>
              </>
            ) : step === "code" ? (
              <>
                <LoginHeader
                  title="Check your email"
                  subtitle={
                    emailSent
                      ? `We sent a sign-in code to ${email}.`
                      : `We could not deliver a sign-in code to ${email}.`
                  }
                  onBack={goBack}
                  right={
                    <LiquidGlassTextButton
                      label={resendCooldown > 0 ? `${resendCooldown}s` : "Resend"}
                      disabled={submitting || resendCooldown > 0}
                      accessibilityLabel="Resend code"
                      onPress={() => void sendCode()}
                    />
                  }
                />
                <View style={styles.formBlock}>
                  <Field
                    value={code}
                    onChangeText={(value) => {
                      setCode(value.replace(/\D/g, "").slice(0, 6));
                      setError(null);
                    }}
                    placeholder="000000"
                    keyboardType="number-pad"
                    autoComplete="one-time-code"
                    textContentType="oneTimeCode"
                    editable={!submitting}
                    autoFocus
                    style={styles.codeInput}
                  />
                  <LoginError message={error} />
                  <PrimaryButton
                    label="Verify and continue"
                    onPress={() => void verifyCode()}
                    loading={submitting}
                    disabled={code.length !== 6}
                  />
                </View>
              </>
            ) : (
              <LoginHeader
                title="Choose your property"
                subtitle="Select the property you’re working from today."
              />
              )}
              </Reanimated.View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {pendingSession ? (
        <CommunityPickerModal
          visible={step === "property"}
          session={pendingSession}
          query={propertyQuery}
          switchingId={switchingPropertyId}
          title="Choose a property"
          subtitle="Your sessions, assets, and integrations will match this property."
          closeButtonVisible={false}
          dismissDisabled
          onPropertyAdded={onAuthenticated}
          onQueryChange={setPropertyQuery}
          onClose={() => undefined}
          onSelect={(communityId) => void chooseProperty(communityId)}
        />
      ) : null}
    </View>
  );
}

function LoginHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.headerBlock}>
      <View style={styles.titleRow}>
        {onBack ? (
          <LiquidGlassIconButton
            icon="chevron-back"
            accessibilityLabel="Back"
            onPress={onBack}
          />
        ) : null}
        <View style={styles.headerCopy}>
          <CustomText textStyle="hero" numberOfLines={2}>
            {title}
          </CustomText>
        </View>
        {right}
      </View>
      <CustomText textStyle="body" style={styles.subtitle}>
        {subtitle}
      </CustomText>
    </View>
  );
}

function Field(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      {...props}
      placeholderTextColor="rgba(0, 0, 0, 0.45)"
      selectionColor={ACCENT}
      style={[customTextVariants.title, styles.input, props.style]}
    />
  );
}

function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      haptic="selection"
      disabled={disabled || loading}
      onPress={onPress}
      style={styles.primaryButton}
    >
      {loading ? (
        <LoadingDots size="small" color={CARD} />
      ) : (
        <CustomText textStyle="title" style={styles.primaryButtonText}>
          {label}
        </CustomText>
      )}
    </MotionPressable>
  );
}

function LoginError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.errorRow} accessibilityRole="alert">
      <Ionicons name="alert-circle-outline" size={17} color={C.red} />
      <CustomText textStyle="caption" style={styles.errorText}>
        {message}
      </CustomText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TEXT },
  keyboardView: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 12,
  },
  cardShadow: {
    width: "100%",
    borderRadius: LARGE_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
    boxShadow: "0 10px 28px rgba(0, 0, 0, 0.18)",
  },
  card: {
    width: "100%",
    height: CARD_HEIGHT,
    overflow: "hidden",
    borderRadius: LARGE_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  stepContent: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: "space-between",
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  brandBlock: {
    alignItems: "center",
    gap: 12,
    paddingTop: 28,
  },
  tagline: {
    width: 265,
    color: "rgba(0, 0, 0, 0.45)",
    lineHeight: 22,
    textAlign: "center",
  },
  headerBlock: { gap: 10 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    overflow: "visible",
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  subtitle: {
    color: "rgba(0, 0, 0, 0.45)",
  },
  formBlock: { gap: 12 },
  input: {
    width: "100%",
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: BACKGROUND,
    color: TEXT,
  },
  codeInput: {
    fontSize: 24,
    letterSpacing: 8,
    textAlign: "center",
  },
  primaryButton: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 29,
    backgroundColor: ACCENT,
    boxShadow: "0 6px 14px rgba(0, 108, 229, 0.28)",
  },
  primaryButtonText: { color: CARD },
  errorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: C.redBg,
  },
  errorText: { flex: 1, color: C.red },
});
