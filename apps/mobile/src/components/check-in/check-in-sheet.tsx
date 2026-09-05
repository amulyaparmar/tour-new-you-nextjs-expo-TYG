import { Ionicons } from "@expo/vector-icons";
import type { SessionLead } from "@tour/shared";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import QRCodeStyled from "react-native-qrcode-styled";
import { LinearGradient } from "expo-linear-gradient";
import {
  View,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { createCheckInLink } from "../../api";
import { useSessionParticipantRealtime } from "../../session-participants-realtime";
import { CustomText } from "@/components/custom-text";
import {
  GlassNavHeader,
  glassNavContentInset,
} from "@/components/glass-nav-header";
import { InfoBox } from "@/components/info-box";
import { TourCheckInFormModal } from "@/components/check-in/tour-check-in-form-modal";
import { SecondaryButton } from "@/components/secondary-button";
import {
  ACCENT,
  BACKGROUND,
  CARD,
  HINT,
  LARGE_CORNER,
  TEXT,
} from "@/theme/tokens";
import { tourColors as C } from "@/theme/tour-brand";

const FOOTER_FADE = 56;

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
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

export function CheckInSheet({
  onBack,
  property,
  propertyId,
  agentName,
  repSlug,
  onCheckedIn,
  onSkipCheckIn,
}: {
  onBack: () => void;
  property: string;
  propertyId?: string | null;
  agentName?: string | null;
  repSlug?: string | null;
  onCheckedIn: (sessionId: string, guests?: SessionLead[]) => void;
  onSkipCheckIn: () => void;
  onRecordLater?: (sessionId: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const footerPad = Math.max(insets.bottom, 16);
  const footerClearance = FOOTER_FADE + 58 + footerPad;
  const resolvedRepSlug = (repSlug ?? "").trim() || slugifyRep(agentName);
  const [resultSessionId, setResultSessionId] = useState<string | null>(null);
  const [boundSessionId, setBoundSessionId] = useState<string | null>(null);
  const [boundCheckInUrl, setBoundCheckInUrl] = useState<string | null>(null);
  const [bindingPending, setBindingPending] = useState(true);
  const [bindingError, setBindingError] = useState<string | null>(null);
  const resolvedSessionId = resultSessionId ?? boundSessionId;
  const checkInUrl = useMemo(() => {
    const fromProp = (boundCheckInUrl ?? "").trim();
    if (fromProp && (!resultSessionId || resultSessionId === boundSessionId))
      return fromProp;
    const propertySlug =
      (property ?? "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "property";
    const sessionQuery = resolvedSessionId
      ? `&sessionId=${encodeURIComponent(resolvedSessionId)}`
      : "";
    const memberPath = resolvedSessionId
      ? `/${encodeURIComponent(resolvedRepSlug)}`
      : "";
    return `https://tour.you/p/${encodeURIComponent(propertySlug)}${memberPath}?check-in=true${sessionQuery}`;
  }, [
    boundCheckInUrl,
    boundSessionId,
    property,
    resolvedRepSlug,
    resolvedSessionId,
    resultSessionId,
  ]);
  const sessionQrReady = Boolean(resolvedSessionId);
  const [formOpen, setFormOpen] = useState(false);
  const [realtimeGuests, setRealtimeGuests] = useState<SessionLead[]>([]);
  const [nativeGuests, setNativeGuests] = useState<SessionLead[]>([]);
  const bindingRequest = useRef(0);
  const checkedInGuests = useMemo(
    () =>
      uniqueCheckedInGuests([
        ...realtimeGuests,
        ...nativeGuests.filter(
          (nativeGuest) =>
            !realtimeGuests.some(
              (remoteGuest) =>
                remoteGuest.email?.trim().toLowerCase() ===
                  nativeGuest.email?.trim().toLowerCase() &&
                remoteGuest.name.trim().toLowerCase() ===
                  nativeGuest.name.trim().toLowerCase(),
            ),
        ),
      ]),
    [nativeGuests, realtimeGuests],
  );
  const hasCheckedIn = checkedInGuests.length > 0;

  const updateCheckedInGuests = useCallback((guests: SessionLead[]) => {
    setRealtimeGuests(uniqueCheckedInGuests(guests));
  }, []);

  const loadBinding = useCallback(async () => {
    const request = ++bindingRequest.current;
    setBindingPending(true);
    setBindingError(null);
    try {
      const binding = await createCheckInLink();
      if (request !== bindingRequest.current) return;
      setBoundSessionId(binding.sessionId);
      setBoundCheckInUrl(binding.url);
    } catch {
      if (request !== bindingRequest.current) return;
      setBindingError(
        "Check-in is unavailable. Try again, or skip to recording.",
      );
    } finally {
      if (request === bindingRequest.current) setBindingPending(false);
    }
  }, []);

  useEffect(() => {
    void loadBinding();
    return () => {
      bindingRequest.current += 1;
    };
  }, [loadBinding]);

  useSessionParticipantRealtime({
    sessionId: resolvedSessionId,
    onParticipants: updateCheckedInGuests,
  });

  useEffect(() => {
    setRealtimeGuests([]);
  }, [resolvedSessionId]);

  async function shareCheckInLink() {
    await Share.share({
      title: "Tour check-in",
      message: checkInUrl,
      url: checkInUrl,
    });
  }

  function finishAndRecord() {
    if (!resolvedSessionId) return;
    setFormOpen(false);
    onCheckedIn(resolvedSessionId, checkedInGuests);
  }

  function closeCheckInForm() {
    setFormOpen(false);
  }

  function openCheckInForm() {
    setFormOpen(true);
  }

  function handleGuestSubmitted({
    sessionId,
    guest,
  }: {
    sessionId: string;
    guest: SessionLead;
  }) {
    setResultSessionId(sessionId);
    setNativeGuests((current) =>
      uniqueCheckedInGuests([
        ...current.filter(
          (existing) =>
            existing.email?.trim().toLowerCase() !==
              guest.email?.trim().toLowerCase() ||
            existing.name.trim().toLowerCase() !== guest.name.trim().toLowerCase(),
        ),
        guest,
      ]),
    );
  }
  return (
    <View style={styles.root}>
      <View style={styles.page}>
        <View style={styles.qrPanel}>
          {!sessionQrReady ? (
            bindingError && !bindingPending ? (
              <View
                style={[
                  styles.bindingErrorPanel,
                  {
                    paddingTop: glassNavContentInset(insets.top),
                    paddingBottom: footerClearance,
                  },
                ]}
              >
                <Ionicons
                  name="cloud-offline-outline"
                  size={32}
                  color={C.textMuted}
                />
                <CustomText textStyle="title" style={styles.centerTitle}>
                  Check-in isn't ready yet
                </CustomText>
                <CustomText
                  accessibilityRole="alert"
                  textStyle="caption"
                  style={styles.centerSub}
                >
                  {bindingError}
                </CustomText>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void loadBinding()}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    styles.stretch,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons name="refresh" size={17} color={CARD} />
                  <CustomText textStyle="title" style={styles.primaryBtnText}>
                    Try again
                  </CustomText>
                </Pressable>
              </View>
            ) : (
              <View
                style={{
                  flex: 1,
                  paddingTop: glassNavContentInset(insets.top),
                }}
              >
                <CheckInPanelSkeleton />
              </View>
            )
          ) : (
            <ScrollView
              key="qr"
              style={styles.flex1}
              contentContainerStyle={[
                styles.qrPanelContent,
                {
                  paddingTop: glassNavContentInset(insets.top),
                  paddingBottom: footerClearance,
                },
              ]}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.topStack}>
              <InfoBox>
                Guests can scan to check in, or you can enter their details
                manually by pressing "+"
              </InfoBox>
              <View style={styles.qrCard}>
                <QRCodeStyled
                  data={checkInUrl}
                  size={220}
                  padding={10}
                  color={TEXT}
                  pieceScale={0.82}
                  pieceCornerType="rounded"
                  pieceBorderRadius={4}
                  outerEyesOptions={{ borderRadius: 12, color: TEXT }}
                  innerEyesOptions={{ borderRadius: 10, color: ACCENT }}
                  errorCorrectionLevel="Q"
                  style={styles.qrCode}
                />
              </View>
              <SecondaryButton
                icon="share-social-outline"
                label="Share check-in link"
                onPress={() => void shareCheckInLink()}
              />
              </View>
              <View style={styles.peopleSection}>
                <CustomText textStyle="title" style={styles.peopleTitle}>
                  Checked-In
                </CustomText>
                <ScrollView
                  horizontal
                  keyboardShouldPersistTaps="handled"
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.peopleStrip}
                >
                  {checkedInGuests.map((guest) => (
                    <View
                      key={checkedInGuestKey(guest)}
                      style={styles.personBubbleWrap}
                    >
                      <View style={styles.personBubble}>
                        <CustomText
                          textStyle="label"
                          style={styles.personBubbleText}
                        >
                          {guestInitials(guest.name)}
                        </CustomText>
                      </View>
                      <CustomText
                        textStyle="micro"
                        style={styles.personBubbleName}
                        numberOfLines={1}
                      >
                        {guest.firstName || guest.name.split(" ")[0]}
                      </CustomText>
                    </View>
                  ))}
                  <Pressable
                    onPress={openCheckInForm}
                    style={({ pressed }) => [
                      styles.personBubbleWrap,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.addPersonBubble}>
                      <Ionicons name="add" size={28} color={ACCENT} />
                    </View>
                    <CustomText textStyle="micro" style={styles.addPersonLabel}>
                      Check in
                    </CustomText>
                  </Pressable>
                </ScrollView>
              </View>
            </ScrollView>
          )}
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
            accessibilityLabel={
              hasCheckedIn ? "Start Recording Tour" : "Skip Check-In"
            }
            accessibilityHint={
              hasCheckedIn
                ? "Start recording with checked-in guests"
                : "Continue to recording without adding guest details"
            }
            disabled={hasCheckedIn && !resolvedSessionId}
            onPress={hasCheckedIn ? finishAndRecord : onSkipCheckIn}
            style={({ pressed }) => [
              styles.primaryBtn,
              hasCheckedIn && !resolvedSessionId && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <CustomText textStyle="title" style={styles.primaryBtnText}>
              {hasCheckedIn ? "Start Recording Tour" : "Skip Check-In"}
            </CustomText>
          </Pressable>
        </View>
      </View>

      <GlassNavHeader title="Start New Tour" onBack={onBack} />

      <TourCheckInFormModal
        visible={formOpen}
        onClose={closeCheckInForm}
        property={property}
        propertyId={propertyId}
        agentName={agentName}
        repSlug={resolvedRepSlug}
        sessionId={resolvedSessionId}
        bindingPending={bindingPending}
        onSubmitted={handleGuestSubmitted}
      />
    </View>
  );
}

function CheckInPanelSkeleton() {
  return (
    <View style={styles.panelSkeleton} accessibilityLabel="Loading QR code">
      <View style={styles.skeletonQr} />
      <View style={styles.skeletonLineWide} />
      <View style={styles.skeletonLineShort} />
      <View style={styles.skeletonButton} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  page: {
    flex: 1,
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
  panelSkeleton: {
    flex: 1,
    gap: 10,
    paddingTop: 4,
    paddingHorizontal: 16,
  },
  skeletonQr: {
    alignSelf: "stretch",
    height: 240,
    borderRadius: LARGE_CORNER,
    borderCurve: "continuous",
    backgroundColor: HINT,
  },
  skeletonLineWide: {
    width: "72%",
    height: 14,
    borderRadius: 7,
    backgroundColor: HINT,
  },
  skeletonLineShort: {
    width: "48%",
    height: 12,
    borderRadius: 6,
    backgroundColor: CARD,
  },
  skeletonButton: {
    width: "100%",
    height: 58,
    marginTop: "auto",
    borderRadius: 29,
    backgroundColor: HINT,
  },
  bindingErrorPanel: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 16,
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
  qrPanel: {
    flex: 1,
    minHeight: 0,
  },
  qrPanelContent: {
    gap: 16,
    paddingBottom: 12,
  },
  topStack: {
    paddingHorizontal: 16,
    gap: 10,
  },
  qrCard: {
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    borderRadius: LARGE_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  qrCode: { backgroundColor: CARD, borderRadius: 22 },
  centerTitle: { textAlign: "center" },
  centerSub: {
    maxWidth: 280,
    color: C.textSec,
    textAlign: "center",
  },
  peopleSection: {
    gap: 10,
    marginTop: 6,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: CARD,
  },
  peopleTitle: {
    paddingHorizontal: 16,
  },
  peopleStrip: {
    gap: 14,
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  personBubbleWrap: {
    width: 62,
    alignItems: "center",
    gap: 6,
  },
  personBubble: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ACCENT,
  },
  personBubbleText: {
    color: CARD,
    fontSize: 15,
    fontWeight: "900",
  },
  personBubbleName: {
    width: 62,
    color: TEXT,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },
  addPersonBubble: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: HINT,
  },
  addPersonLabel: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: "900",
  },
  stretch: { alignSelf: "stretch" },
  flex1: { flex: 1 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.88 },
});
