import { Ionicons } from "@expo/vector-icons";
import type { SessionLead } from "@tour/shared";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import QRCodeStyled from "react-native-qrcode-styled";
import Reanimated, {
  FadeIn,
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
import {
  useSessionParticipantRealtime,
  type SessionParticipantRealtimeStatus,
} from "../../session-participants-realtime";
import { LoadingDots } from "@/components/loading-dots";
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

function checkedInGuestKey(guest: SessionLead) {
  if (guest.createdAt) return `created:${guest.createdAt}`;
  const email = guest.email?.trim().toLowerCase();
  if (email) return `email:${email}`;
  const phone = guest.phone?.replace(/\D/g, "");
  if (phone) return `phone:${phone}`;
  return `name:${guest.name.trim().toLowerCase()}`;
}

function uniqueCheckedInGuests(guests: SessionLead[]) {
  const seen = new Set<string>();
  return guests.filter((guest) => {
    const key = checkedInGuestKey(guest);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function guestInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
}

export function CheckInSheet({
  visible,
  onClose,
  property,
  propertyId,
  agentName,
  repSlug,
  sessionId,
  checkInUrl: checkInUrlProp,
  onCheckedIn,
}: {
  visible: boolean;
  onClose: () => void;
  property: string;
  propertyId?: string | null;
  agentName?: string | null;
  repSlug?: string | null;
  /** Exact remote session that both QR and native check-in add to. */
  sessionId?: string | null;
  /** Personalized public check-in URL from property/member aliases. */
  checkInUrl?: string | null;
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
  const sessionQrReady = Boolean(sessionId);
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
  const [checkedInGuests, setCheckedInGuests] = useState<SessionLead[]>([]);
  const [realtimeStatus, setRealtimeStatus] = useState<SessionParticipantRealtimeStatus>("idle");
  const [guestPopupDismissed, setGuestPopupDismissed] = useState(false);

  const updateCheckedInGuests = useCallback((guests: SessionLead[]) => {
    setCheckedInGuests(uniqueCheckedInGuests(guests));
  }, []);

  useSessionParticipantRealtime({
    sessionId: visible ? sessionId ?? null : null,
    onParticipants: updateCheckedInGuests,
    onStatusChange: setRealtimeStatus,
  });

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

  useEffect(() => {
    if (!visible) return;
    setCheckedInGuests([]);
    setGuestPopupDismissed(false);
  }, [sessionId, visible]);

  useEffect(() => {
    if (checkedInGuests.length > 0) setGuestPopupDismissed(false);
  }, [checkedInGuests.length]);

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
    await Share.share({ title: "Tour check-in", message: checkInUrl, url: checkInUrl });
  }

  function finishAndRecord() {
    if (!resultSessionId) return;
    onClose();
    onCheckedIn(resultSessionId);
  }

  function startQrSession() {
    if (!sessionId) return;
    onClose();
    onCheckedIn(sessionId);
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
            !sessionQrReady ? (
              <CheckInPanelSkeleton mode="qr" />
            ) : (
            <View style={styles.qrPanel}>
              <View style={styles.qrCard}>
                <QRCodeStyled
                  data={checkInUrl}
                  size={220}
                  padding={10}
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
              <Text style={styles.qrTitle}>Scan to check in</Text>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Open check-in page"
                onPress={() => void Linking.openURL(checkInUrl)}
                style={({ pressed }) => [styles.qrLink, pressed && styles.pressed]}
              >
                <Text style={styles.qrLinkText} numberOfLines={2}>{checkInUrl}</Text>
                <Ionicons name="open-outline" size={13} color={C.brand} />
              </Pressable>
              <Pressable
                disabled={checkedInGuests.length === 0}
                onPress={() => setGuestPopupDismissed(false)}
                style={styles.realtimeStatusRow}
              >
                <View style={[
                  styles.realtimeDot,
                  (realtimeStatus === "live" || checkedInGuests.length > 0) && styles.realtimeDotLive,
                ]} />
                <Text style={styles.realtimeStatusText}>
                  {checkedInGuests.length > 0
                    ? `${checkedInGuests.length} ${checkedInGuests.length === 1 ? "guest" : "guests"} checked in`
                    : realtimeStatus === "live"
                      ? "Waiting for live check-ins"
                      : "Waiting for check-ins"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => void shareCheckInLink()}
                style={({ pressed }) => [styles.sheetPrimary, pressed && styles.pressed]}
              >
                <Ionicons name="share-social-outline" size={16} color="#fff" />
                <Text style={styles.sheetPrimaryText}>Share check-in link</Text>
              </Pressable>

              {checkedInGuests.length > 0 && !guestPopupDismissed ? (
                <Reanimated.View
                  entering={FadeIn.duration(180)}
                  style={styles.checkedInOverlay}
                >
                  <View pointerEvents="none" style={styles.checkedInOverlayWash} />
                  <View style={styles.checkedInPopup}>
                    <View style={styles.checkedInStatusPill}>
                      <Ionicons name="checkmark" size={14} color="#fff" />
                      <Text style={styles.checkedInStatusText}>
                        {checkedInGuests.length === 1 ? "Guest checked in" : `${checkedInGuests.length} guests checked in`}
                      </Text>
                    </View>
                    <View style={styles.checkedInHeadingRow}>
                      <View style={styles.checkedInHeadingIcon}>
                        <Ionicons name="person-add-outline" size={22} color={C.green} />
                      </View>
                      <View style={styles.flex1}>
                        <Text style={styles.checkedInTitle}>
                          {checkedInGuests.length === 1
                            ? `${checkedInGuests[0]?.firstName || checkedInGuests[0]?.name.split(" ")[0] || "Guest"} is ready`
                            : `${checkedInGuests.length} guests are ready`}
                        </Text>
                        <Text style={styles.checkedInSub}>
                          Checked in for {property}. Keep this QR open for anyone else joining the tour.
                        </Text>
                      </View>
                    </View>
                    <ScrollView
                      style={styles.checkedInListScroll}
                      contentContainerStyle={styles.checkedInList}
                      showsVerticalScrollIndicator={checkedInGuests.length > 2}
                      nestedScrollEnabled
                    >
                      {checkedInGuests.map((guest) => (
                        <View key={checkedInGuestKey(guest)} style={styles.checkedInRow}>
                          <View style={styles.checkedInAvatar}>
                            <Text style={styles.checkedInAvatarText}>{guestInitials(guest.name)}</Text>
                          </View>
                          <View style={styles.flex1}>
                            <Text style={styles.checkedInName}>{guest.name}</Text>
                            <Text style={styles.checkedInReady}>Ready for tour</Text>
                          </View>
                          <View style={styles.checkedInCheck}>
                            <Ionicons name="checkmark" size={17} color={C.green} />
                          </View>
                        </View>
                      ))}
                    </ScrollView>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Start live session with checked-in guests"
                      onPress={startQrSession}
                      style={({ pressed }) => [styles.startSessionButton, pressed && styles.pressed]}
                    >
                      <Ionicons name="mic-outline" size={19} color="#fff" />
                      <Text style={styles.startSessionButtonText}>Start live session</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setGuestPopupDismissed(true)}
                      style={({ pressed }) => [styles.notYetButton, pressed && styles.pressed]}
                    >
                      <Text style={styles.notYetButtonText}>Not yet</Text>
                    </Pressable>
                  </View>
                </Reanimated.View>
              ) : null}
            </View>
            )
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
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.floatingField}>
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
      <View style={mode === "qr" ? styles.skeletonQr : styles.skeletonFormHead} />
      <View style={styles.skeletonLineWide} />
      <View style={styles.skeletonLineShort} />
      <View style={styles.skeletonButton} />
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
  fieldGroup: { flex: 1, gap: 5 },
  fieldLabel: { color: C.text, fontSize: 12, lineHeight: 16, fontWeight: "800" },
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
    gap: 10,
    paddingTop: 4,
    paddingBottom: 6,
  },
  qrCard: {
    width: 248,
    height: 248,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
    backgroundColor: "#fff",
    shadowColor: "#101828",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 5,
  },
  qrCode: { backgroundColor: "#fff", borderRadius: 22 },
  qrTitle: { color: C.text, fontSize: 16, fontWeight: "800" },
  qrSub: {
    maxWidth: 280,
    color: C.textSec,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
    textAlign: "center",
  },
  qrLink: {
    maxWidth: 300,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  qrLinkText: {
    flexShrink: 1,
    color: C.brand,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    textAlign: "center",
    textDecorationLine: "underline",
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
  realtimeStatusRow: { minHeight: 24, flexDirection: "row", alignItems: "center", gap: 7 },
  realtimeDot: { width: 7, height: 7, borderRadius: 999, backgroundColor: C.textMuted },
  realtimeDotLive: { backgroundColor: C.green },
  realtimeStatusText: { color: C.textSec, fontSize: 11, fontWeight: "700" },
  checkedInOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
    justifyContent: "flex-end",
    marginHorizontal: -2,
    marginVertical: -2,
  },
  checkedInOverlayWash: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.72)",
  },
  checkedInPopup: {
    position: "relative",
    maxHeight: "76%",
    gap: 12,
    paddingHorizontal: 14,
    paddingTop: 25,
    paddingBottom: 10,
    borderWidth: 1,
    borderColor: "#d9e2ec",
    borderRadius: 20,
    backgroundColor: "#fff",
    shadowColor: "#101828",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 8,
  },
  checkedInStatusPill: {
    position: "absolute",
    top: -17,
    alignSelf: "center",
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 15,
    borderRadius: 999,
    backgroundColor: C.green,
  },
  checkedInStatusText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  checkedInHeadingRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  checkedInHeadingIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#ecfdf3",
  },
  checkedInTitle: { color: C.text, fontSize: 20, lineHeight: 25, fontWeight: "900" },
  checkedInSub: { marginTop: 2, color: C.textSec, fontSize: 12, lineHeight: 17, fontWeight: "600" },
  checkedInListScroll: { maxHeight: 152 },
  checkedInList: { gap: 7 },
  checkedInRow: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 15,
    backgroundColor: "#f8fafc",
  },
  checkedInAvatar: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "#e0f2fe",
  },
  checkedInAvatarText: { color: C.brand, fontSize: 14, fontWeight: "900" },
  checkedInName: { color: C.text, fontSize: 14, fontWeight: "900" },
  checkedInReady: { marginTop: 1, color: C.green, fontSize: 12, fontWeight: "800" },
  checkedInCheck: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: "#ecfdf3",
  },
  startSessionButton: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderRadius: 14,
    backgroundColor: C.brand,
  },
  startSessionButtonText: { color: "#fff", fontSize: 17, fontWeight: "900" },
  notYetButton: { minHeight: 32, alignItems: "center", justifyContent: "center" },
  notYetButtonText: { color: C.textSec, fontSize: 14, fontWeight: "800" },
  flex1: { flex: 1 },
  pressed: { opacity: 0.88 },
});
