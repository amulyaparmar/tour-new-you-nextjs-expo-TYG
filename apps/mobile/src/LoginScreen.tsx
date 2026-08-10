import { Ionicons } from "@expo/vector-icons";
import type { VideoPlayer } from "expo-video";
import { VideoView } from "expo-video";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  AppState,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Reanimated, {
  Easing,
  LinearTransition,
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CommunityPickerModal } from "@/components/community-picker-modal";
import { LoadingDots } from "@/components/loading-dots";

import {
  type MobileAuthSession,
  requestSignInCode,
  switchCommunity,
  verifySignInCode,
} from "./auth";
import { TourLogo } from "./components/TourLogo";

const TOUR_BLUE = "#1674ff";
const RESEND_COOLDOWN_SECONDS = 30;

type LoginStep = "welcome" | "email" | "code" | "property";
type TransitionDirection = "forward" | "back";

const CARD_LAYOUT_TRANSITION = LinearTransition.springify()
  .damping(24)
  .stiffness(220)
  .mass(0.8);
const FORWARD_ENTERING = SlideInRight.duration(360).easing(Easing.out(Easing.cubic));
const FORWARD_EXITING = SlideOutLeft.duration(260).easing(Easing.inOut(Easing.cubic));
const BACK_ENTERING = SlideInLeft.duration(340).easing(Easing.out(Easing.cubic));
const BACK_EXITING = SlideOutRight.duration(240).easing(Easing.inOut(Easing.cubic));

export function LoginScreen({
  player,
  onAuthenticated,
}: {
  player: VideoPlayer;
  onAuthenticated: (session: MobileAuthSession) => void;
}) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<LoginStep>("welcome");
  const [transitionDirection, setTransitionDirection] = useState<TransitionDirection>("forward");
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

  const transitionTo = useCallback((nextStep: LoginStep, direction: TransitionDirection) => {
    setTransitionDirection(direction);
    setStep(nextStep);
  }, []);

  useEffect(() => {
    player.loop = true;
    player.muted = true;
    player.play();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
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
      if (step === "email") transitionTo("welcome", "back");
      if (step === "code") transitionTo("email", "back");
      return true;
    });
    return () => subscription.remove();
  }, [step, transitionTo]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

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
      transitionTo("code", "forward");
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
              paddingBottom: Math.max(24, insets.bottom + 12),
            },
          ]}
        >
          <View style={styles.cardShadow}>
            <Reanimated.View layout={CARD_LAYOUT_TRANSITION} style={styles.card}>
              <Reanimated.View
                key={step}
                entering={transitionDirection === "forward" ? FORWARD_ENTERING : BACK_ENTERING}
                exiting={transitionDirection === "forward" ? FORWARD_EXITING : BACK_EXITING}
                style={styles.stepContent}
              >
              {step === "welcome" ? (
              <>
                <View style={styles.brandBlock}>
                  <TourLogo width={97} />
                  <Text style={styles.tagline}>
                    Every great business deserves a great tour. Build yours today.
                  </Text>
                </View>
                <PrimaryButton label="Login with Email" onPress={() => transitionTo("email", "forward")} />
              </>
            ) : step === "email" ? (
              <>
                <LoginHeader
                  icon="mail-outline"
                  title="Enter your work email"
                  subtitle="We’ll send a one-time verification code."
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
                  <BackLink label="Back" onPress={() => { setError(null); transitionTo("welcome", "back"); }} />
                </View>
              </>
            ) : step === "code" ? (
              <>
                <LoginHeader
                  icon="key-outline"
                  title="Check your email"
                  subtitle={
                    emailSent
                      ? `We sent a sign-in code to ${email}.`
                      : `We could not deliver a sign-in code to ${email}.`
                  }
                />
                <View style={styles.formBlock}>
                  <View style={styles.deliveryCard}>
                    <View style={styles.deliveryDotWrap}>
                      <View style={[styles.deliveryDot, !emailSent && styles.deliveryDotWarn]} />
                    </View>
                    <View style={styles.deliveryCopy}>
                      <Text style={styles.deliveryTitle}>
                        {emailSent ? "Waiting for your 6-digit code" : "Code delivery failed"}
                      </Text>
                      <Text style={styles.deliveryText}>
                        {emailSent
                          ? "Look for an email from Tour. Delivery can take up to a minute."
                          : "Check the address, then use Resend code to try again."}
                      </Text>
                    </View>
                  </View>
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
                    returnKeyType="go"
                    onSubmitEditing={() => void verifyCode()}
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
                  <Pressable
                    accessibilityRole="button"
                    disabled={submitting || resendCooldown > 0}
                    onPress={() => void sendCode()}
                    style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
                  >
                    <Text style={[styles.linkText, resendCooldown > 0 && styles.linkTextDisabled]}>
                      {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
                    </Text>
                  </Pressable>
                  <BackLink label="Use a different email" onPress={() => { setError(null); transitionTo("email", "back"); }} />
                </View>
              </>
            ) : (
              <LoginHeader
                icon="business-outline"
                title="Choose your property"
                subtitle="Select the property you’re working from today."
              />
              )}
              </Reanimated.View>
            </Reanimated.View>
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
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.headerBlock}>
      <View style={styles.headerIcon}>
        <Ionicons name={icon} size={22} color={TOUR_BLUE} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

function Field(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      {...props}
      placeholderTextColor="#98a2b3"
      selectionColor={TOUR_BLUE}
      style={[styles.input, props.style]}
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
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        (disabled || loading) && styles.primaryButtonDisabled,
        pressed && styles.primaryButtonPressed,
      ]}
    >
      {loading ? (
        <LoadingDots color="#fff" />
      ) : (
        <Text style={styles.primaryButtonText}>{label}</Text>
      )}
    </Pressable>
  );
}

function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
    >
      <Ionicons name="arrow-back" size={15} color="#667085" />
      <Text style={styles.backText}>{label}</Text>
    </Pressable>
  );
}

function LoginError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.errorRow} accessibilityRole="alert">
      <Ionicons name="alert-circle-outline" size={17} color="#d92d20" />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  keyboardView: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 24,
  },
  cardShadow: {
    width: "100%",
    borderRadius: 16,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 5,
  },
  card: {
    width: "100%",
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingVertical: 32,
    borderWidth: 1,
    borderColor: "#e8e8e8",
    borderRadius: 16,
    backgroundColor: "#fff",
  },
  stepContent: { gap: 24 },
  brandBlock: { alignItems: "center", gap: 12 },
  tagline: {
    width: 265,
    color: "#666",
    fontSize: 16,
    lineHeight: 26,
    fontWeight: "500",
    textAlign: "center",
  },
  headerBlock: { alignItems: "center", gap: 8, paddingHorizontal: 8 },
  headerIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "#eaf2ff",
  },
  title: { color: "#312a2a", fontSize: 22, lineHeight: 28, fontWeight: "800", textAlign: "center" },
  subtitle: { maxWidth: 285, color: "#667085", fontSize: 14, lineHeight: 20, fontWeight: "500", textAlign: "center" },
  formBlock: { gap: 12 },
  deliveryCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#abefc6",
    borderRadius: 10,
    backgroundColor: "#ecfdf3",
  },
  deliveryDotWrap: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#d1fadf",
  },
  deliveryDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#17b26a" },
  deliveryDotWarn: { backgroundColor: "#f79009" },
  deliveryCopy: { flex: 1, gap: 2 },
  deliveryTitle: { color: "#067647", fontSize: 12, lineHeight: 17, fontWeight: "800" },
  deliveryText: { color: "#027a48", fontSize: 11, lineHeight: 16, fontWeight: "500" },
  input: {
    width: "100%",
    minHeight: 52,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#d0d5dd",
    borderRadius: 8,
    backgroundColor: "#fff",
    color: "#101828",
    fontSize: 16,
    fontWeight: "600",
  },
  codeInput: { fontSize: 24, fontWeight: "800", letterSpacing: 8, textAlign: "center" },
  primaryButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: TOUR_BLUE,
  },
  primaryButtonDisabled: { opacity: 0.45 },
  primaryButtonPressed: { opacity: 0.86, transform: [{ scale: 0.995 }] },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "500" },
  linkButton: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  linkText: { color: TOUR_BLUE, fontSize: 13, fontWeight: "700" },
  linkTextDisabled: { color: "#98a2b3" },
  backText: { color: "#667085", fontSize: 13, fontWeight: "700" },
  pressed: { opacity: 0.65 },
  errorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: "#fef3f2",
  },
  errorText: { flex: 1, color: "#b42318", fontSize: 12, lineHeight: 17, fontWeight: "600" },
});
