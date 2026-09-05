import React, { useEffect, useMemo, useRef, useState } from "react";
import { Share, StyleSheet, useWindowDimensions, View } from "react-native";
import QRCodeStyled from "react-native-qrcode-styled";

import { createCheckInLink } from "../../api";
import { BottomSheetModal } from "@/components/bottom-sheet-modal";
import { CustomText } from "@/components/custom-text";
import { LiquidGlassIconButton } from "@/components/liquid-glass-icon-button";
import { LoadingDots } from "@/components/loading-dots";
import { SecondaryButton } from "@/components/secondary-button";
import { ACCENT, BACKGROUND, CARD, HINT, LARGE_CORNER, TEXT } from "@/theme/tokens";

const SHEET_HEIGHT_RATIO = 0.62;
const SHEET_MAX_HEIGHT = 560;
const SHEET_GUTTER = 18;

function slugify(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function fallbackCheckInUrl(
  property: string,
  sessionId: string | null | undefined,
  repSlug: string | null | undefined,
) {
  const propertySlug = slugify(property) || "property";
  const sessionQuery = sessionId ? `&sessionId=${encodeURIComponent(sessionId)}` : "";
  const memberPath = sessionId && slugify(repSlug)
    ? `/${encodeURIComponent(slugify(repSlug))}`
    : "";
  return `https://tour.you/p/${encodeURIComponent(propertySlug)}${memberPath}?check-in=true${sessionQuery}`;
}

export function ShowCheckInQrModal({
  visible,
  onClose,
  property,
  agentName,
  sessionId,
  bindingPending = false,
}: {
  visible: boolean;
  onClose: () => void;
  property: string;
  agentName?: string | null;
  sessionId?: string | null;
  bindingPending?: boolean;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const sheetHeight = Math.round(Math.min(windowHeight * SHEET_HEIGHT_RATIO, SHEET_MAX_HEIGHT));
  const resolvedRepSlug = slugify(agentName) || "check-in";
  const [boundUrl, setBoundUrl] = useState<string | null>(null);
  const [boundSessionId, setBoundSessionId] = useState<string | null>(null);
  const requestRef = useRef(0);

  const checkInUrl = useMemo(() => {
    const fromApi = (boundUrl ?? "").trim();
    if (fromApi && (!sessionId || boundSessionId === sessionId)) return fromApi;
    return fallbackCheckInUrl(property, sessionId, resolvedRepSlug);
  }, [boundSessionId, boundUrl, property, resolvedRepSlug, sessionId]);

  const qrReady = Boolean(sessionId) && !bindingPending;

  useEffect(() => {
    if (!visible) {
      requestRef.current += 1;
      setBoundUrl(null);
      setBoundSessionId(null);
      return;
    }
    if (!sessionId) return;

    const request = ++requestRef.current;
    void createCheckInLink({ sessionId })
      .then((binding) => {
        if (request !== requestRef.current) return;
        setBoundSessionId(binding.sessionId);
        setBoundUrl(binding.url);
      })
      .catch(() => {
        // Keep the constructed fallback URL so guests can still scan.
      });
  }, [sessionId, visible]);

  async function shareCheckInLink() {
    await Share.share({
      title: "Tour check-in",
      message: checkInUrl,
      url: checkInUrl,
    });
  }

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      sheetHeight={sheetHeight}
      sheetStyle={styles.sheet}
      dragHeader={
        <View style={styles.titleRow}>
          <View style={styles.headerCopy}>
            <CustomText textStyle="hero" style={styles.title} numberOfLines={2}>
              Show Check In QR/Link
            </CustomText>
          </View>
          <LiquidGlassIconButton
            icon="close"
            accessibilityLabel="Close check-in QR"
            onPress={onClose}
          />
        </View>
      }
    >
      <View style={styles.body}>
        {!qrReady ? (
          <View style={styles.loadingPanel} accessibilityLabel="Loading QR code">
            <View style={styles.skeletonQr} />
            <LoadingDots color={ACCENT} />
          </View>
        ) : (
          <>
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
          </>
        )}
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    overflow: "hidden",
    paddingTop: 2,
    paddingHorizontal: 0,
    borderTopLeftRadius: LARGE_CORNER,
    borderTopRightRadius: LARGE_CORNER,
    borderCurve: "continuous",
    backgroundColor: BACKGROUND,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: SHEET_GUTTER,
    overflow: "visible",
  },
  headerCopy: {
    flex: 1,
  },
  title: {},
  body: {
    flex: 1,
    gap: 16,
    paddingHorizontal: SHEET_GUTTER,
    paddingTop: 8,
    paddingBottom: 22,
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
  loadingPanel: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  skeletonQr: {
    width: 220,
    height: 220,
    borderRadius: 22,
    backgroundColor: HINT,
  },
});
