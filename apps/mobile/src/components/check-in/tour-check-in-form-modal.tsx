import { Ionicons } from "@expo/vector-icons";
import type { SessionLead } from "@tour/shared";
import React, { useEffect, useRef, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import {
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from "react-native";
import Reanimated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { submitCheckInLead } from "../../api";
import { CustomText } from "@/components/custom-text";
import { LiquidGlassIconButton } from "@/components/liquid-glass-icon-button";
import { LoadingDots } from "@/components/loading-dots";
import {
  PAGE_SHEET_HEADER_INSET,
  PageSheetModal,
} from "@/components/page-sheet-modal";
import {
  ACCENT,
  BACKGROUND,
  CARD,
  FONT,
  HINT,
  SMALL_CORNER,
  TEXT,
} from "@/theme/tokens";
import { tourColors as C } from "@/theme/tour-brand";

const FOOTER_FADE = 56;
const FORM_TOP_INSET = PAGE_SHEET_HEADER_INSET + 16;
const CHECK_IN_CONFIRM_MS = 1000;

type MobileCheckInQuestion = {
  id: string;
  label: string;
  type: "select" | "text";
  options?: string[];
  placeholder?: string;
  required?: boolean;
};

const CHECK_IN_QUESTIONS: MobileCheckInQuestion[] = [
  {
    id: "hear_about",
    label: "Where did you hear about us?",
    type: "select",
    options: [
      "Google",
      "Apartments.com",
      "Drive by",
      "Referral",
      "Social media",
      "Other",
    ],
    placeholder: "Select one",
  },
  {
    id: "move_in",
    label: "When are you looking to move in?",
    type: "select",
    options: [
      "ASAP",
      "Within 1 month",
      "1-3 months",
      "3-6 months",
      "Just browsing",
    ],
    placeholder: "Select a timeframe",
  },
  {
    id: "floor_plan",
    label: "Which floor plan interests you most?",
    type: "select",
    options: [
      "1 bedroom",
      "2 bedroom",
      "3 bedroom",
      "4 bedroom",
      "Not sure yet",
    ],
    placeholder: "Select a floor plan",
  },
];

function formatCheckInPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

function validCheckInEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function TourCheckInFormModal({
  visible,
  onClose,
  property,
  propertyId,
  agentName,
  repSlug,
  sessionId,
  bindingPending = false,
  onSubmitted,
}: {
  visible: boolean;
  onClose: () => void;
  property: string;
  propertyId?: string | null;
  agentName?: string | null;
  repSlug?: string | null;
  sessionId?: string | null;
  bindingPending?: boolean;
  onSubmitted: (result: { sessionId: string; guest: SessionLead }) => void;
}) {
  const insets = useSafeAreaInsets();
  const footerPad = Math.max(insets.bottom, 16);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const keyboardOpen = keyboardHeight > 0;
  const formFooterPad = keyboardOpen ? 12 : footerPad;
  const formFooterClearance = FOOTER_FADE + 58 + formFooterPad + keyboardHeight;
  const [step, setStep] = useState<"contact" | "questions" | "done">("contact");
  const pagerWidth = useSharedValue(0);
  const pagerProgress = useSharedValue(0);
  const pagerTrackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -pagerProgress.value * pagerWidth.value }],
  }));
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState(`Tour ${property}`);
  const [wantsSummary, setWantsSummary] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submissionEpoch = useRef(0);
  const submissionInFlight = useRef(false);
  const confirmCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkInBusy = submitting || bindingPending;

  useEffect(() => {
    setReason((current) =>
      current.trim() === "" || current.startsWith("Tour ")
        ? `Tour ${property}`
        : current,
    );
  }, [property]);

  useEffect(() => {
    submissionEpoch.current += 1;
    submissionInFlight.current = false;
    setSubmitting(false);
  }, [property, sessionId]);

  useEffect(() => {
    return () => {
      if (confirmCloseTimer.current) clearTimeout(confirmCloseTimer.current);
    };
  }, []);

  useEffect(() => {
    if (step === "done") {
      pagerProgress.value = 0;
      return;
    }
    if (!visible) return;
    pagerProgress.value = withTiming(step === "questions" ? 1 : 0, {
      duration: 340,
      easing: Easing.out(Easing.cubic),
    });
  }, [pagerProgress, step, visible]);

  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      return;
    }
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [visible]);

  function resetForm() {
    const sharedHowHeard = answers.hear_about;
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setWantsSummary(false);
    setAnswers(sharedHowHeard ? { hear_about: sharedHowHeard } : {});
    setError(null);
    setStep("contact");
  }

  function close() {
    if (confirmCloseTimer.current) {
      clearTimeout(confirmCloseTimer.current);
      confirmCloseTimer.current = null;
    }
    onClose();
    if (step === "done") resetForm();
  }

  async function submitLead() {
    if (checkInBusy || submissionInFlight.current) return;
    const requestEpoch = submissionEpoch.current;
    submissionInFlight.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitCheckInLead({
        firstName: firstName.trim(),
        lastName: lastName.trim() || null,
        email: email.trim(),
        phone: phone.replace(/\D/g, "") || null,
        wantsSummary,
        reason: reason.trim() || `Tour ${property}`,
        questionAnswers: answers,
        repSlug: (repSlug ?? "").trim() || null,
        repName: agentName?.trim() || null,
        propertyName: property,
        propertyId: propertyId ?? null,
        sessionId,
      });
      if (requestEpoch !== submissionEpoch.current) return;
      const checkedInSessionId = result.sessionId;
      if (!checkedInSessionId) {
        throw new Error(
          "We couldn't confirm this tour. Please try checking in again.",
        );
      }
      const guest: SessionLead = {
        name: [firstName.trim(), lastName.trim()].filter(Boolean).join(" "),
        firstName: firstName.trim(),
        lastName: lastName.trim() || null,
        email: email.trim(),
        phone: phone.replace(/\D/g, "") || null,
        wantsSummary,
        reason: reason.trim() || `Tour ${property}`,
        questionAnswers: answers,
        createdAt: new Date().toISOString(),
      };
      onSubmitted({ sessionId: checkedInSessionId, guest });
      setStep("done");
      if (confirmCloseTimer.current) clearTimeout(confirmCloseTimer.current);
      confirmCloseTimer.current = setTimeout(() => {
        confirmCloseTimer.current = null;
        onClose();
        resetForm();
      }, CHECK_IN_CONFIRM_MS);
    } catch (caught) {
      if (requestEpoch === submissionEpoch.current) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Something went wrong. Please try again.",
        );
      }
    } finally {
      if (requestEpoch === submissionEpoch.current) {
        submissionInFlight.current = false;
        setSubmitting(false);
      }
    }
  }

  function nextFromContact() {
    if (checkInBusy) return;
    setError(null);
    if (!firstName.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }
    if (!validCheckInEmail(email)) {
      setError("Enter a valid email.");
      return;
    }
    if (CHECK_IN_QUESTIONS.length) {
      setStep("questions");
      return;
    }
    void submitLead();
  }

  return (
    <PageSheetModal
      visible={visible}
      title="Tour Check-In"
      onClose={close}
      leading={
        step === "questions" ? (
          <LiquidGlassIconButton
            icon="chevron-back"
            accessibilityLabel="Back to guest details"
            disabled={submitting}
            onPress={() => {
              setError(null);
              setStep("contact");
            }}
          />
        ) : null
      }
    >
      <View style={styles.flex1}>
        <View style={styles.formSheet}>
          {step === "done" ? (
            <Reanimated.View
              entering={FadeIn.duration(220)}
              style={[
                styles.donePanel,
                {
                  paddingTop: PAGE_SHEET_HEADER_INSET,
                  paddingBottom: footerPad,
                },
              ]}
            >
              <View style={styles.doneIcon}>
                <Ionicons name="checkmark" size={26} color={CARD} />
              </View>
              <CustomText textStyle="hero" style={styles.centerTitle}>
                {firstName.trim() || "Your guest"} is checked in!
              </CustomText>
            </Reanimated.View>
          ) : (
            <>
              <View
                style={styles.formPager}
                onLayout={(event) => {
                  pagerWidth.value = event.nativeEvent.layout.width;
                }}
              >
                <Reanimated.View
                  style={[styles.formPagerTrack, pagerTrackStyle]}
                >
                  <View
                    style={styles.formPagerPane}
                    pointerEvents={step === "questions" ? "none" : "auto"}
                  >
                    <ScrollView
                      key="contact"
                      style={styles.flex1}
                      keyboardShouldPersistTaps="handled"
                      contentContainerStyle={[
                        styles.checkInForm,
                        {
                          paddingTop: FORM_TOP_INSET,
                          paddingBottom: formFooterClearance,
                        },
                      ]}
                      showsVerticalScrollIndicator={false}
                    >
                      <View style={styles.formRow2}>
                        <CheckInField
                          label="First name"
                          value={firstName}
                          onChangeText={setFirstName}
                          autoComplete="given-name"
                        />
                        <CheckInField
                          label="Last name"
                          value={lastName}
                          onChangeText={setLastName}
                          autoComplete="family-name"
                        />
                      </View>
                      <CheckInField
                        label="Email"
                        value={email}
                        onChangeText={(value) => {
                          setEmail(value);
                          if (error) setError(null);
                        }}
                        keyboardType="email-address"
                        autoComplete="email"
                      />
                      <View style={styles.fieldGroup}>
                        <CustomText
                          textStyle="caption"
                          style={styles.fieldLabel}
                        >
                          Phone number
                        </CustomText>
                        <View style={styles.phoneRow}>
                          <View style={styles.phoneCc}>
                            <CustomText textStyle="body">🇺🇸</CustomText>
                            <CustomText textStyle="label">+1</CustomText>
                          </View>
                          <View style={styles.flex1}>
                            <View style={styles.floatingField}>
                              <TextInput
                                value={phone}
                                onChangeText={(value) =>
                                  setPhone(formatCheckInPhone(value))
                                }
                                placeholder="Phone number"
                                placeholderTextColor={C.textMuted}
                                keyboardType="phone-pad"
                                autoComplete="tel"
                                style={styles.floatingInput}
                              />
                            </View>
                          </View>
                        </View>
                      </View>
                      <CheckInField
                        label="Reason for visit"
                        value={reason}
                        onChangeText={setReason}
                      />
                      {error && step !== "questions" ? (
                        <CustomText
                          accessibilityRole="alert"
                          textStyle="caption"
                          style={styles.fieldError}
                        >
                          {error}
                        </CustomText>
                      ) : null}
                    </ScrollView>
                  </View>
                  <View
                    style={styles.formPagerPane}
                    pointerEvents={step === "questions" ? "auto" : "none"}
                  >
                    <ScrollView
                      key="questions"
                      style={styles.flex1}
                      keyboardShouldPersistTaps="handled"
                      contentContainerStyle={[
                        styles.questionsForm,
                        {
                          paddingTop: FORM_TOP_INSET,
                          paddingBottom: formFooterClearance,
                        },
                      ]}
                      showsVerticalScrollIndicator={false}
                    >
                      <CustomText
                        textStyle="title"
                        style={styles.questionsIntro}
                      >
                        {firstName ? `${firstName}, ` : ""}one last thing
                        before your tour
                      </CustomText>
                      {CHECK_IN_QUESTIONS.map((question) => (
                        <CheckInQuestionField
                          key={question.id}
                          question={question}
                          value={answers[question.id] ?? ""}
                          onChange={(value) =>
                            setAnswers((current) => ({
                              ...current,
                              [question.id]: value,
                            }))
                          }
                        />
                      ))}
                      <Pressable
                        accessibilityRole="switch"
                        accessibilityState={{ checked: wantsSummary }}
                        onPress={() => setWantsSummary((value) => !value)}
                        style={styles.followUpCard}
                      >
                        <CustomText
                          textStyle="body"
                          style={styles.followUpText}
                        >
                          Send me follow up notes
                        </CustomText>
                        <View pointerEvents="none">
                          <Switch
                            accessible={false}
                            value={wantsSummary}
                            trackColor={{
                              false: "#d1d5db",
                              true: ACCENT,
                            }}
                            ios_backgroundColor="#d1d5db"
                          />
                        </View>
                      </Pressable>
                      {error && step === "questions" ? (
                        <CustomText
                          accessibilityRole="alert"
                          textStyle="caption"
                          style={styles.fieldError}
                        >
                          {error}
                        </CustomText>
                      ) : null}
                    </ScrollView>
                  </View>
                </Reanimated.View>
              </View>
              <View
                pointerEvents="box-none"
                style={[
                  styles.pageFooter,
                  {
                    bottom: keyboardHeight,
                    paddingBottom: formFooterPad,
                  },
                ]}
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
                  accessibilityState={{
                    disabled: checkInBusy,
                    busy: checkInBusy,
                  }}
                  onPress={
                    step === "questions"
                      ? () => void submitLead()
                      : nextFromContact
                  }
                  disabled={checkInBusy}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    checkInBusy && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  {step === "questions" && checkInBusy ? (
                    <LoadingDots size="small" color={CARD} />
                  ) : (
                    <Ionicons
                      name={
                        step === "questions" ? "checkmark" : "arrow-forward"
                      }
                      size={16}
                      color={CARD}
                    />
                  )}
                  <CustomText textStyle="title" style={styles.primaryBtnText}>
                    {step === "questions"
                      ? submitting
                        ? "Checking in..."
                        : bindingPending
                          ? "Preparing tour..."
                          : "Check in"
                      : bindingPending
                        ? "Preparing tour..."
                        : "Next"}
                  </CustomText>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </PageSheetModal>
  );
}

function CheckInField({
  label,
  value,
  onChangeText,
  keyboardType,
  autoComplete,
  autoFocus,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: "default" | "email-address" | "phone-pad";
  autoComplete?:
    | "given-name"
    | "family-name"
    | "email"
    | "tel"
    | "organization-title";
  autoFocus?: boolean;
}) {
  return (
    <View style={styles.fieldGroup}>
      <CustomText textStyle="caption" style={styles.fieldLabel}>
        {label}
      </CustomText>
      <View style={styles.floatingField}>
        <TextInput
          autoFocus={autoFocus}
          value={value}
          onChangeText={onChangeText}
          placeholder={label}
          placeholderTextColor={C.textMuted}
          keyboardType={keyboardType}
          autoComplete={autoComplete}
          autoCapitalize={keyboardType === "email-address" ? "none" : "words"}
          style={styles.floatingInput}
        />
      </View>
    </View>
  );
}

function CheckInQuestionField({
  question,
  value,
  onChange,
}: {
  question: MobileCheckInQuestion;
  value: string;
  onChange: (value: string) => void;
}) {
  if (question.type === "select") {
    return (
      <View style={styles.questionField}>
        <CustomText textStyle="caption" style={styles.fieldLabel}>
          {question.label}
        </CustomText>
        <View style={styles.questionOptions}>
          {(question.options ?? []).map((option) => {
            const active = value === option;
            return (
              <Pressable
                key={option}
                onPress={() => onChange(option)}
                style={[
                  styles.questionOption,
                  active && styles.questionOptionActive,
                ]}
              >
                <CustomText
                  textStyle="label"
                  style={[
                    styles.questionOptionText,
                    active && styles.questionOptionTextActive,
                  ]}
                >
                  {option}
                </CustomText>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }
  return (
    <CheckInField
      label={question.label}
      value={value}
      onChangeText={onChange}
    />
  );
}

const styles = StyleSheet.create({
  formSheet: {
    flex: 1,
  },
  formPager: {
    flex: 1,
    overflow: "hidden",
  },
  formPagerTrack: {
    height: "100%",
    width: "200%",
    flexDirection: "row",
  },
  formPagerPane: {
    width: "50%",
    height: "100%",
  },
  checkInForm: {
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  questionsForm: {
    gap: 22,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  questionsIntro: {
    marginBottom: 12,
  },
  formRow2: { flexDirection: "row", gap: 8 },
  fieldGroup: { flex: 1, gap: 6 },
  fieldLabel: {
    color: "rgba(0, 0, 0, 0.45)",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  floatingField: {
    flex: 1,
    height: 52,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  floatingInput: {
    color: TEXT,
    fontFamily: FONT.medium,
    fontSize: 15,
    paddingVertical: 0,
  },
  phoneRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  phoneCc: {
    width: 72,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  pageFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    paddingHorizontal: 16,
    paddingTop: FOOTER_FADE,
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
  questionField: { gap: 8 },
  questionOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  questionOption: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: CARD,
  },
  questionOptionActive: { backgroundColor: HINT },
  questionOptionText: { color: C.textSec },
  questionOptionTextActive: { color: ACCENT },
  followUpCard: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  followUpText: { flex: 1 },
  fieldError: { color: C.red },
  donePanel: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 16,
  },
  doneIcon: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
    backgroundColor: C.green,
  },
  centerTitle: { textAlign: "center" },
  flex1: { flex: 1 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.88 },
});
