import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import QRCodeStyled from "react-native-qrcode-styled";
import Reanimated, {
  FadeIn,
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import {
  Dimensions,
  Linking,
  View,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";

import { submitCheckInLead } from "../../api";
import { LoadingDots } from "@/components/loading-dots";
import { Skeleton } from "@/components/ui/skeleton";
import { TourMark } from "../TourLogo";

// Keep the check-in form compact on tall devices. The form itself scrolls when
// the keyboard is visible instead of making the entire sheet rise excessively.
const SHEET_HEIGHT = Math.min(Math.round(Dimensions.get("window").height * 0.78), 720);

const C = {
  text: "#101828",
  textSec: "#667085",
  textMuted: "#98A2B3",
  brand: "#006CE5",
  green: "#12B76A",
  red: "#D92D20",
} as const;

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
    options: ["Google", "Apartments.com", "Drive by", "Referral", "Social media", "Other"],
    placeholder: "Select one",
  },
  {
    id: "move_in",
    label: "When are you looking to move in?",
    type: "select",
    options: ["ASAP", "Within 1 month", "1-3 months", "3-6 months", "Just browsing"],
    placeholder: "Select a timeframe",
  },
  {
    id: "floor_plan",
    label: "Which floor plan interests you most?",
    type: "select",
    options: ["1 bedroom", "2 bedroom", "3 bedroom", "4 bedroom", "Not sure yet"],
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

function firstNameOf(fullName: string | null | undefined) {
  const part = (fullName ?? "").trim().split(/\s+/).filter(Boolean)[0];
  return part || "your agent";
}

function slugifyRep(name: string | null | undefined) {
  const slug = (name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "check-in";
}

export function CheckInSheet({
  visible,
  onClose,
  property,
  propertyId,
  agentName,
  agentTitle,
  repSlug,
  sessionId,
  checkInUrl: checkInUrlProp,
  checkedInGuest,
  onContinueWithQr,
  onCheckedIn,
}: {
  visible: boolean;
  onClose: () => void;
  property: string;
  propertyId?: string | null;
  agentName?: string | null;
  agentTitle?: string | null;
  repSlug?: string | null;
  /** Exact remote session that both QR and native check-in add to. */
  sessionId?: string | null;
  /** Personalized public check-in URL from property/member aliases. */
  checkInUrl?: string | null;
  /** A guest checked in from the public QR link while this sheet is open. */
  checkedInGuest?: { sessionId: string; prospectName: string } | null;
  /** Returns from the live arrival state to the QR. */
  onContinueWithQr?: () => void;
  /** After check-in, open the session and start recording. */
  onCheckedIn: (sessionId: string) => void;
}) {
  const repFirst = firstNameOf(agentName);
  const resolvedRepSlug = (repSlug ?? "").trim() || slugifyRep(agentName);
  const checkInUrl = useMemo(() => {
    const fromProp = (checkInUrlProp ?? "").trim();
    if (fromProp) return fromProp;
    // Show a property-level QR immediately. Once the server creates a
    // session binding, checkInUrlProp replaces this with the session URL.
    const propertySlug = (property ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "property";
    const sessionQuery = sessionId ? `&sessionId=${encodeURIComponent(sessionId)}` : "";
    const memberPath = sessionId ? `/${encodeURIComponent(resolvedRepSlug)}` : "";
    return `https://tour.you/p/${encodeURIComponent(propertySlug)}${memberPath}?check-in=true${sessionQuery}`;
  }, [checkInUrlProp, property, resolvedRepSlug, sessionId]);
  const [mode, setMode] = useState<"checkin" | "qr">("qr");
  const [tabSwitching, setTabSwitching] = useState(false);
  const [tabSegmentWidth, setTabSegmentWidth] = useState(0);
  const tabPosition = useSharedValue(1);
  const [step, setStep] = useState<"contact" | "questions" | "done">("contact");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState(`Tour ${property}`);
  const [wantsSummary, setWantsSummary] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultSessionId, setResultSessionId] = useState<string | null>(null);
  const showGuestArrival = mode === "qr" && Boolean(checkedInGuest);

  const tabIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tabPosition.value * (tabSegmentWidth + 6) }],
  }), [tabSegmentWidth]);

  useEffect(() => {
    tabPosition.value = withSpring(mode === "checkin" ? 0 : 1, {
      damping: 20,
      stiffness: 240,
      mass: 0.72,
    });
  }, [mode, tabPosition]);

  useEffect(() => {
    if (!tabSwitching) return;
    const timeout = setTimeout(() => setTabSwitching(false), 140);
    return () => clearTimeout(timeout);
  }, [mode, tabSwitching]);

  useEffect(() => {
    if (!visible) return;
    setMode("qr");
    setTabSwitching(false);
    setStep("contact");
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setReason(`Tour ${property}`);
    setWantsSummary(false);
    setAnswers({});
    setSubmitting(false);
    setError(null);
    setResultSessionId(null);
  }, [visible, property]);

  async function submitLead() {
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
        repSlug: resolvedRepSlug,
        repName: agentName?.trim() || null,
        propertyName: property,
        propertyId: propertyId ?? null,
        sessionId,
      });
      setResultSessionId(result.sessionId ?? null);
      setStep("done");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function nextFromContact() {
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

  async function shareCheckInLink() {
    const host = agentName?.trim() || "the leasing team";
    await Share.share({
      title: `Check in with ${host}`,
      message: `Check in for your tour with ${host} at ${property}:\n${checkInUrl}`,
      url: checkInUrl,
    });
  }

  function finishAndRecord() {
    if (!resultSessionId) return;
    onClose();
    onCheckedIn(resultSessionId);
  }

  function addAnotherPerson() {
    const sharedHowHeard = answers.hear_about;
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setWantsSummary(false);
    setAnswers(sharedHowHeard ? { hear_about: sharedHowHeard } : {});
    setError(null);
    setResultSessionId(null);
    setStep("contact");
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetScrim} onPress={onClose} />
      <View style={styles.sheetKeyboard}>
        <Pressable onPress={(event) => event.stopPropagation()} style={styles.checkInSheet}>
          <View style={styles.sheetHandle} />
          <View
            style={styles.sheetTabs}
            onLayout={(event) => setTabSegmentWidth((event.nativeEvent.layout.width - 12) / 2)}
          >
            {tabSegmentWidth > 0 ? (
              <Reanimated.View
                pointerEvents="none"
                style={[styles.sheetTabIndicator, { width: tabSegmentWidth }, tabIndicatorStyle]}
              />
            ) : null}
            <Pressable
              onPress={() => {
                if (mode === "checkin") return;
                setTabSwitching(true);
                setMode("checkin");
              }}
              style={styles.sheetTab}
            >
              <Ionicons name="send-outline" size={14} color={mode === "checkin" ? C.brand : C.textMuted} />
              <Text style={[styles.sheetTabText, mode === "checkin" && styles.sheetTabTextActive]}>
                Check in
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (mode === "qr") return;
                setTabSwitching(true);
                setMode("qr");
              }}
              style={styles.sheetTab}
            >
              <BrandedQrIcon size={15} />
              <Text style={[styles.sheetTabText, mode === "qr" && styles.sheetTabTextActive]}>QR</Text>
            </Pressable>
          </View>

          <Reanimated.View
            key={mode}
            entering={FadeIn.duration(160)}
            layout={LinearTransition.duration(180)}
            style={styles.sheetBody}
          >
          {tabSwitching ? (
            <CheckInPanelSkeleton mode={mode} />
          ) : mode === "qr" ? (
            <View style={styles.qrStage}>
              <View pointerEvents={showGuestArrival ? "none" : "auto"} style={[styles.qrPanel, showGuestArrival && styles.qrPanelDimmed]}>
                <View style={styles.qrIntro}>
                  <Text style={styles.qrTitle}>Scan to check in</Text>
                  <Text style={styles.qrSub} numberOfLines={1}>
                    {property} · with {repFirst}
                  </Text>
                </View>
                <View style={styles.qrCard}>
                  <QRCodeStyled
                    data={checkInUrl}
                    size={180}
                    padding={8}
                    color={C.text}
                    pieceScale={0.82}
                    pieceCornerType="rounded"
                    pieceBorderRadius={4}
                    outerEyesOptions={{ borderRadius: 12, color: C.text }}
                    innerEyesOptions={{ borderRadius: 10, color: C.brand }}
                    errorCorrectionLevel="Q"
                    style={styles.qrCode}
                  />
                </View>
                <View style={styles.hostCard}>
                  <View style={styles.hostAvatar}>
                    <Text style={styles.hostInitial}>{(agentName ?? repFirst).trim().slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <View style={styles.hostCopy}>
                    <Text style={styles.hostName} numberOfLines={1}>{agentName?.trim() || repFirst}</Text>
                    <Text style={styles.hostRole} numberOfLines={1}>{agentTitle?.trim() || "Leasing Consultant"}</Text>
                    <Text style={styles.hostMessage} numberOfLines={2}>
                      Welcome to {property}. Check in here and I'll be ready for your tour.
                    </Text>
                  </View>
                </View>
                <View style={styles.qrActions}>
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel="Open check-in page"
                    accessibilityHint={checkInUrl}
                    onPress={() => void Linking.openURL(checkInUrl)}
                    style={({ pressed }) => [styles.qrAction, pressed && styles.pressed]}
                  >
                    <Ionicons name="open-outline" size={15} color={C.brand} />
                    <Text style={styles.qrActionText}>Open link</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Share check-in link"
                    onPress={() => void shareCheckInLink()}
                    style={({ pressed }) => [styles.qrAction, pressed && styles.pressed]}
                  >
                    <Ionicons name="share-social-outline" size={15} color={C.brand} />
                    <Text style={styles.qrActionText}>Share</Text>
                  </Pressable>
                </View>
              </View>
              {showGuestArrival && checkedInGuest ? (
                <GuestArrivalOverlay
                  guest={checkedInGuest}
                  property={property}
                  onStart={() => onCheckedIn(checkedInGuest.sessionId)}
                  onContinue={() => onContinueWithQr?.()}
                />
              ) : null}
            </View>
          ) : step === "done" ? (
            <View style={styles.donePanel}>
              <View style={styles.doneIcon}>
                <Ionicons name="checkmark" size={26} color="#fff" />
              </View>
              <Text style={styles.qrTitle}>You're checked in</Text>
              <Text style={styles.qrSub}>
                Thanks for visiting {property}. {repFirst} has the guest details and can start the tour.
              </Text>
              {resultSessionId ? (
                <Pressable
                  onPress={finishAndRecord}
                  style={({ pressed }) => [styles.sheetPrimary, pressed && styles.pressed]}
                >
                  <Ionicons name="mic" size={16} color="#fff" />
                  <Text style={styles.sheetPrimaryText}>Start recording</Text>
                </Pressable>
              ) : null}
              <View style={styles.buttonRow}>
                <Pressable
                  onPress={addAnotherPerson}
                  style={({ pressed }) => [styles.backBtn, styles.addAnotherBtn, pressed && styles.pressed]}
                >
                  <Ionicons name="person-add-outline" size={16} color={C.text} />
                  <Text style={styles.backBtnText}>Add another person</Text>
                </Pressable>
                <Pressable
                  onPress={onClose}
                  style={({ pressed }) => [styles.backBtn, styles.doneBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.backBtnText}>Done</Text>
                </Pressable>
              </View>
            </View>
          ) : step === "questions" ? (
            <ScrollView
              style={styles.flex1}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.checkInForm}
            >
              <Text style={styles.questionTitle}>
                {firstName ? `${firstName}, ` : ""}one last thing before your tour
              </Text>
              {CHECK_IN_QUESTIONS.map((question) => (
                <CheckInQuestionField
                  key={question.id}
                  question={question}
                  value={answers[question.id] ?? ""}
                  onChange={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))}
                />
              ))}
              <Pressable onPress={() => setWantsSummary((value) => !value)} style={styles.toggleRow}>
                <Text style={styles.toggleText}>Send me follow-up notes after the tour</Text>
                <Ionicons
                  name={wantsSummary ? "checkbox" : "square-outline"}
                  size={18}
                  color={wantsSummary ? C.brand : C.textMuted}
                />
              </Pressable>
              {error ? <Text style={styles.fieldError}>{error}</Text> : null}
              <View style={styles.buttonRow}>
                <Pressable
                  onPress={() => setStep("contact")}
                  style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.backBtnText}>Back</Text>
                </Pressable>
                <Pressable
                  onPress={() => void submitLead()}
                  disabled={submitting}
                  style={({ pressed }) => [
                    styles.nextButton,
                    { flex: 1 },
                    submitting && { opacity: 0.64 },
                    pressed && styles.pressed,
                  ]}
                >
                  {submitting ? (
                    <LoadingDots size="small" color="#fff" />
                  ) : (
                    <Ionicons name="send-outline" size={16} color="#fff" />
                  )}
                  <Text style={styles.nextButtonText}>{submitting ? "Checking in..." : "Check in"}</Text>
                </Pressable>
              </View>
            </ScrollView>
          ) : (
            <ScrollView
              style={styles.flex1}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.checkInForm}
            >
              <View style={styles.checkInHead}>
                <View style={styles.formHeadAvatar}>
                  <Ionicons name="person-outline" size={18} color="#fff" />
                </View>
                <Text style={styles.formHeadText}>
                  Check in for your tour{"\n"}with {repFirst}
                </Text>
              </View>
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
              <View style={styles.phoneRow}>
                <View style={styles.phoneCc}>
                  <Text style={styles.phoneFlag}>🇺🇸</Text>
                  <Text style={styles.phoneCcText}>+1</Text>
                </View>
                <View style={styles.flex1}>
                  <CheckInField
                    label="Phone number"
                    value={phone}
                    onChangeText={(value) => setPhone(formatCheckInPhone(value))}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                  />
                </View>
              </View>
              <CheckInField label="Reason for visit" value={reason} onChangeText={setReason} />
              {error ? <Text style={styles.fieldError}>{error}</Text> : null}
              <Pressable
                onPress={nextFromContact}
                disabled={submitting}
                style={({ pressed }) => [styles.nextButton, pressed && styles.pressed]}
              >
                <Ionicons name="send-outline" size={16} color="#fff" />
                <Text style={styles.nextButtonText}>Next</Text>
              </Pressable>
              <Text style={styles.checkInDestination}>QR opens {checkInUrl}</Text>
            </ScrollView>
          )}
          </Reanimated.View>
        </Pressable>
      </View>
    </Modal>
  );
}

function GuestArrivalOverlay({
  guest,
  property,
  onStart,
  onContinue,
}: {
  guest: { sessionId: string; prospectName: string };
  property: string;
  onStart: () => void;
  onContinue: () => void;
}) {
  const firstName = firstNameOf(guest.prospectName);
  const guestInitial = guest.prospectName.trim().slice(0, 1).toUpperCase() || "G";
  const namedGuest = guest.prospectName.trim().toLowerCase() !== "a guest";

  return (
    <Reanimated.View entering={FadeInDown.duration(220)} style={styles.arrivalOverlay}>
      <View style={styles.arrivalToast}>
        <View style={styles.arrivalToastIcon}>
          <Ionicons name="checkmark" size={12} color="#fff" />
        </View>
        <Text style={styles.arrivalToastText}>Check-in successful</Text>
      </View>
      <View style={styles.arrivalCard}>
        <View style={styles.arrivalHeading}>
          <View style={styles.arrivalIcon}>
            <Ionicons name="person-add-outline" size={20} color={C.green} />
          </View>
          <View style={styles.arrivalHeadingCopy}>
            <Text style={styles.arrivalTitle}>{namedGuest ? `${firstName} is ready` : "Your guest is ready"}</Text>
            <Text style={styles.arrivalCopy}>
              {namedGuest ? `${guest.prospectName} checked in for ${property}.` : `A guest checked in for ${property}.`}
            </Text>
          </View>
        </View>

        <View style={styles.arrivalGuestRow}>
          <View style={styles.arrivalGuestAvatar}>
            <Text style={styles.arrivalGuestInitial}>{guestInitial}</Text>
          </View>
          <View style={styles.arrivalGuestCopy}>
            <Text style={styles.arrivalGuestName}>{namedGuest ? guest.prospectName : "Guest checked in"}</Text>
            <Text style={styles.arrivalGuestStatus}>Ready for tour · Just now</Text>
          </View>
          <View style={styles.arrivalGuestState}>
            <Ionicons name="checkmark" size={13} color={C.green} />
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start tour"
          onPress={onStart}
          style={({ pressed }) => [styles.arrivalPrimary, pressed && styles.pressed]}
        >
          <Ionicons name="play" size={17} color="#fff" />
          <Text style={styles.arrivalPrimaryText}>Start Tour</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Admit another guest with this QR code"
          onPress={onContinue}
          style={({ pressed }) => [styles.arrivalSecondary, pressed && styles.pressed]}
        >
          <Ionicons name="person-add-outline" size={16} color={C.brand} />
          <Text style={styles.arrivalSecondaryText}>Admit another guest</Text>
        </Pressable>
      </View>
    </Reanimated.View>
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
  autoComplete?: "given-name" | "family-name" | "email" | "tel" | "organization-title";
  autoFocus?: boolean;
}) {
  return (
    <View style={styles.floatingField}>
      {value.length > 0 ? <Text style={styles.floatingLabel}>{label}</Text> : null}
      <TextInput
        autoFocus={autoFocus}
        value={value}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor="#6b7280"
        keyboardType={keyboardType}
        autoComplete={autoComplete}
        autoCapitalize={keyboardType === "email-address" ? "none" : "words"}
        style={styles.floatingInput}
      />
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
        <Text style={styles.questionLabel}>{question.label}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.questionOptions}
        >
          {(question.options ?? []).map((option) => {
            const active = value === option;
            return (
              <Pressable
                key={option}
                onPress={() => onChange(option)}
                style={[styles.questionOption, active && styles.questionOptionActive]}
              >
                <Text style={[styles.questionOptionText, active && styles.questionOptionTextActive]}>
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    );
  }
  return <CheckInField label={question.label} value={value} onChangeText={onChange} />;
}

function BrandedQrIcon({ size = 32 }: { size?: number }) {
  const markSize = Math.max(8, Math.round(size * 0.38));
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name="qr-code-outline" size={size} color={C.text} />
      <View style={[styles.qrBrandCenter, { width: markSize + 3, height: markSize + 3 }]}>
        <TourMark size={markSize} />
      </View>
    </View>
  );
}

function CheckInPanelSkeleton({ mode }: { mode: "checkin" | "qr" }) {
  return (
    <View style={styles.panelSkeleton} accessibilityLabel={`Loading ${mode === "qr" ? "QR code" : "check-in form"}`}>
      {mode === "qr" ? (
        <>
          <Skeleton style={styles.skeletonQr} />
          <Skeleton style={styles.skeletonLineWide} />
          <Skeleton style={styles.skeletonLineShort} />
        </>
      ) : (
        <>
          <Skeleton style={styles.skeletonFormHead} />
          <View style={styles.skeletonFieldRow}>
            <Skeleton style={styles.skeletonField} />
            <Skeleton style={styles.skeletonField} />
          </View>
          <Skeleton style={styles.skeletonFieldWide} />
          <Skeleton style={styles.skeletonFieldWide} />
        </>
      )}
      <Skeleton style={styles.skeletonButton} />
    </View>
  );
}

const styles = StyleSheet.create({
  sheetScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.42)" },
  sheetKeyboard: { flex: 1, justifyContent: "flex-end" },
  checkInSheet: {
    height: SHEET_HEIGHT,
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 28 : 16,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: "#fff",
  },
  sheetBody: {
    flex: 1,
    minHeight: 0,
  },
  panelSkeleton: {
    flex: 1,
    alignItems: "center",
    gap: 14,
    paddingTop: 24,
  },
  skeletonQr: {
    width: 220,
    height: 220,
    borderRadius: 16,
    backgroundColor: "#eef1f5",
  },
  skeletonFormHead: {
    alignSelf: "stretch",
    height: 48,
    borderRadius: 12,
    backgroundColor: "#eef1f5",
  },
  skeletonFieldRow: { alignSelf: "stretch", flexDirection: "row", gap: 10 },
  skeletonField: { flex: 1, height: 52, borderRadius: 12 },
  skeletonFieldWide: { alignSelf: "stretch", height: 52, borderRadius: 12 },
  skeletonLineWide: {
    width: "72%",
    height: 14,
    borderRadius: 7,
    backgroundColor: "#eef1f5",
  },
  skeletonLineShort: {
    width: "48%",
    height: 12,
    borderRadius: 6,
    backgroundColor: "#f3f4f6",
  },
  skeletonButton: {
    width: "100%",
    height: 46,
    marginTop: "auto",
    borderRadius: 13,
    backgroundColor: "#eef1f5",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#d1d5db",
    marginBottom: 2,
  },
  sheetTabs: {
    position: "relative",
    flexDirection: "row",
    gap: 6,
    padding: 3,
    borderRadius: 14,
    backgroundColor: "#f3f4f6",
    marginBottom: 2,
  },
  sheetTab: {
    zIndex: 1,
    flex: 1,
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 11,
  },
  sheetTabIndicator: {
    position: "absolute",
    left: 3,
    top: 3,
    bottom: 3,
    borderRadius: 11,
    backgroundColor: "#fff",
    shadowColor: "#101828",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  sheetTabText: { color: C.textMuted, fontSize: 12, fontWeight: "800" },
  sheetTabTextActive: { color: C.brand },
  checkInForm: { gap: 10, paddingBottom: 6 },
  checkInHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  formHeadAvatar: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "#111827",
  },
  formHeadText: { flex: 1, color: "#111318", fontSize: 16, lineHeight: 21, fontWeight: "800" },
  formRow2: { flexDirection: "row", gap: 8 },
  floatingField: {
    flex: 1,
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#d7dae3",
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  floatingLabel: {
    position: "absolute",
    left: 12,
    top: -8,
    paddingHorizontal: 4,
    color: "#4b5563",
    fontSize: 11,
    fontWeight: "800",
    backgroundColor: "#fff",
  },
  floatingInput: { color: "#111318", fontSize: 15, fontWeight: "500", paddingVertical: 0 },
  phoneRow: { flexDirection: "row", gap: 8 },
  phoneCc: {
    width: 72,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "#d7dae3",
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  phoneFlag: { fontSize: 14 },
  phoneCcText: { color: "#111318", fontSize: 14, fontWeight: "700" },
  addJobButton: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: "#d7d7d7",
    borderRadius: 999,
    backgroundColor: "#fff",
  },
  addJobText: { color: "#111318", fontSize: 13, fontWeight: "800" },
  nextButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    backgroundColor: "#111",
  },
  nextButtonText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  checkInDestination: { color: C.textMuted, fontSize: 10, fontWeight: "600", textAlign: "center" },
  questionTitle: { color: C.text, fontSize: 17, lineHeight: 22, fontWeight: "800" },
  questionField: { gap: 6 },
  questionLabel: { color: C.text, fontSize: 13, fontWeight: "800" },
  questionOptions: { gap: 6, paddingRight: 8 },
  questionOption: {
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#d7dae3",
    borderRadius: 999,
    backgroundColor: "#fff",
  },
  questionOptionActive: { borderColor: C.brand, backgroundColor: "#eff6ff" },
  questionOptionText: { color: C.textSec, fontSize: 12, fontWeight: "700" },
  questionOptionTextActive: { color: C.brand },
  toggleRow: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 2,
  },
  toggleText: { flex: 1, color: C.text, fontSize: 12, fontWeight: "700" },
  fieldError: { color: C.red, fontSize: 12, fontWeight: "700" },
  buttonRow: { flexDirection: "row", gap: 8 },
  addAnotherBtn: { flex: 1.7, flexDirection: "row", gap: 6 },
  doneBtn: { flex: 0.8 },
  backBtn: {
    minWidth: 80,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#d7dae3",
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  backBtnText: { color: C.text, fontSize: 14, fontWeight: "800" },
  donePanel: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 8,
  },
  doneIcon: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
    backgroundColor: C.green,
  },
  sheetPrimary: {
    minHeight: 48,
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 2,
    borderRadius: 12,
    backgroundColor: "#111",
  },
  sheetPrimaryText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  qrPanel: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingTop: 4,
    paddingBottom: 6,
  },
  qrStage: { flex: 1, position: "relative" },
  qrPanelDimmed: { opacity: 0.2 },
  arrivalOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 4,
    paddingBottom: 10,
  },
  arrivalToast: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: C.green,
  },
  arrivalToastIcon: { width: 16, height: 16, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: "rgba(255,255,255,0.24)" },
  arrivalToastText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  arrivalCard: {
    alignSelf: "stretch",
    gap: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#dfe7ef",
    borderRadius: 16,
    backgroundColor: "#fff",
    shadowColor: "#101828",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.13,
    shadowRadius: 26,
    elevation: 8,
  },
  arrivalHeading: { flexDirection: "row", alignItems: "center", gap: 10 },
  arrivalIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#e7f8ee",
  },
  arrivalHeadingCopy: { flex: 1, gap: 3 },
  arrivalTitle: { color: C.text, fontSize: 17, fontWeight: "900" },
  arrivalCopy: {
    color: C.textSec,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  arrivalGuestRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#f7faf8",
  },
  arrivalGuestAvatar: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#e3f3ff",
  },
  arrivalGuestInitial: { color: C.brand, fontSize: 14, fontWeight: "900" },
  arrivalGuestCopy: { flex: 1 },
  arrivalGuestName: { color: C.text, fontSize: 14, fontWeight: "800" },
  arrivalGuestStatus: { marginTop: 2, color: C.green, fontSize: 12, fontWeight: "700" },
  arrivalGuestState: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#e1f7e9",
  },
  arrivalPrimary: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 10,
    backgroundColor: C.brand,
  },
  arrivalPrimaryText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  arrivalSecondary: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: "#d9e1ec", borderRadius: 13, backgroundColor: "#fff" },
  arrivalSecondaryText: { color: C.brand, fontSize: 13, fontWeight: "900" },
  qrCard: {
    width: 204,
    height: 204,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: "#fff",
    shadowColor: "#101828",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 5,
  },
  qrCode: { backgroundColor: "#fff", borderRadius: 18 },
  qrIntro: { alignItems: "center", gap: 2, paddingHorizontal: 18 },
  qrTitle: { color: C.text, fontSize: 16, fontWeight: "800" },
  qrSub: {
    maxWidth: 280,
    color: C.textSec,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
    textAlign: "center",
  },
  hostCard: {
    alignSelf: "stretch",
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#e4e7ec",
    borderRadius: 14,
    backgroundColor: "#fff",
  },
  hostAvatar: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: "#eaf3ff" },
  hostInitial: { color: C.brand, fontSize: 15, fontWeight: "900" },
  hostCopy: { flex: 1, minWidth: 0 },
  hostName: { color: C.text, fontSize: 13, fontWeight: "900" },
  hostRole: { marginTop: 1, color: C.textSec, fontSize: 10, fontWeight: "700" },
  hostMessage: { marginTop: 5, color: C.textSec, fontSize: 11, lineHeight: 15, fontWeight: "600" },
  qrActions: {
    alignSelf: "stretch",
    flexDirection: "row",
    gap: 8,
  },
  qrAction: {
    flex: 1,
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#dbe6f4",
    borderRadius: 10,
    backgroundColor: "#f8fbff",
  },
  qrActionText: {
    color: C.brand,
    fontSize: 12,
    fontWeight: "800",
  },
  qrBrandCenter: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  flex1: { flex: 1 },
  pressed: { opacity: 0.88 },
});
