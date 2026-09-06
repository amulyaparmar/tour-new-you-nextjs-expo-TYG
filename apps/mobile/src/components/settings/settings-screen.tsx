import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { MobileAuthSession } from "@/auth";
import { getCurrentSession } from "@/auth";
import { deleteAccount, submitSupportRequest } from "@/api";
import { getSiteBaseUrl } from "@/config";
import { CustomText, customTextVariants } from "@/components/custom-text";
import {
  GlassNavHeader,
  glassNavContentInset,
} from "@/components/glass-nav-header";
import { BottomSheetModal } from "@/components/bottom-sheet-modal";
import { LiquidGlassIconButton } from "@/components/liquid-glass-icon-button";
import { SecondaryButton } from "@/components/secondary-button";
import { MotionPressable } from "@/components/ui/motion";
import { useProfileQuery, useUpdateProfileMutation } from "@/queries";
import { ACCENT, BACKGROUND, CARD, LARGE_CORNER, SMALL_CORNER, TEXT } from "@/theme/tokens";
import { tourColors as C } from "@/theme/tour-brand";

const FEEDBACK_SHEET_REST_HEIGHT = 430;
const FEEDBACK_SHEET_HEIGHT_RATIO = 0.74;
const FEEDBACK_BUTTON_HEIGHT = 58;
const FEEDBACK_BUTTON_GAP = 12;
const FEEDBACK_KEYBOARD_CLEARANCE = 12;

export function SettingsScreen({
  session,
  onBack,
  onRubrics,
  onSignOut,
  onSessionChange,
  onNotify,
}: {
  session: MobileAuthSession;
  onBack: () => void;
  onRubrics: () => void;
  onSignOut: () => void;
  onSessionChange: (session: MobileAuthSession) => void;
  onNotify: (message: string, type?: "error" | "success" | "info") => void;
}) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const profileQuery = useProfileQuery();
  const updateProfileMutation = useUpdateProfileMutation();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const feedbackInputRef = useRef<TextInput>(null);
  const sheetPad = Math.max(insets.bottom, 16);
  const buttonLift = keyboardHeight > 0
    ? Math.max(0, keyboardHeight - sheetPad + FEEDBACK_KEYBOARD_CLEARANCE)
    : 0;
  const feedbackSheetHeight = Math.min(
    windowHeight,
    Math.max(
      FEEDBACK_SHEET_REST_HEIGHT,
      Math.round(windowHeight * FEEDBACK_SHEET_HEIGHT_RATIO),
    ),
  );
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const aiTrainingDataFeedback =
    profileQuery.data?.aiTrainingDataFeedback ??
    session.workspace.user.aiTrainingDataFeedback ??
    false;

  function confirmSignOut() {
    Alert.alert("Log out of Tour?", "Your account will be removed from this device.", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: onSignOut },
    ]);
  }

  function confirmDeleteAccount() {
    if (deletingAccount) return;
    Alert.alert(
      "Delete your Tour account?",
      "This permanently deletes your login and removes you from every property team. Recordings your property already saved stay with that property. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Account",
          style: "destructive",
          onPress: () => {
            void performDeleteAccount();
          },
        },
      ],
    );
  }

  async function performDeleteAccount() {
    if (deletingAccount) return;
    setDeletingAccount(true);
    try {
      await deleteAccount();
      onSignOut();
    } catch (caught) {
      onNotify(
        caught instanceof Error ? caught.message : "Could not delete your account.",
        "error",
      );
    } finally {
      setDeletingAccount(false);
    }
  }

  useEffect(() => {
    if (!feedbackOpen) {
      setKeyboardHeight(0);
      return;
    }
    const focusTimer = setTimeout(() => feedbackInputRef.current?.focus(), 280);
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      clearTimeout(focusTimer);
      show.remove();
      hide.remove();
    };
  }, [feedbackOpen]);

  async function sendFeedback() {
    const message = feedbackText.trim();
    if (!message) {
      onNotify("Tell us what we can improve first.", "info");
      return;
    }
    try {
      await submitSupportRequest({
        name: session.workspace.user.fullName ?? "Tour mobile user",
        email: session.workspace.user.email,
        message,
      });
      setFeedbackText("");
      setFeedbackOpen(false);
      onNotify("Feedback sent to the Tour support team.", "success");
    } catch {
      onNotify("Could not send feedback. Please try again.", "error");
    }
  }

  async function toggleAiTrainingDataFeedback() {
    if (savingPrivacy) return;
    setSavingPrivacy(true);
    try {
      await updateProfileMutation.mutateAsync({
        aiTrainingDataFeedback: !aiTrainingDataFeedback,
      });
      const next = getCurrentSession();
      if (next) onSessionChange(next);
      onNotify(
        !aiTrainingDataFeedback
          ? "AI training data feedback enabled"
          : "AI training data feedback disabled",
        "success",
      );
    } catch (caught) {
      onNotify(
        caught instanceof Error
          ? caught.message
          : "Could not save privacy setting",
        "error",
      );
    } finally {
      setSavingPrivacy(false);
    }
  }

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: glassNavContentInset(insets.top),
            paddingBottom: Math.max(insets.bottom, 16) + 24,
          },
        ]}
      >
        <CustomText textStyle="caption" style={styles.sectionHeader}>
          Evaluation
        </CustomText>
        <SettingsRow
          icon="clipboard-outline"
          title="Rubrics"
          sub="Templates, criteria, and applied tours"
          onPress={onRubrics}
        />

        <CustomText textStyle="caption" style={styles.sectionHeader}>
          Support
        </CustomText>
        <SettingsRow
          icon="chatbubble-ellipses-outline"
          title="Share feedback"
          sub="Help us make the next Tour better"
          onPress={() => setFeedbackOpen(true)}
        />

        <CustomText textStyle="caption" style={styles.sectionHeader}>
          Privacy
        </CustomText>
        <View style={styles.group}>
          <SettingsRow
            grouped
            title="Use my data to improve AI"
            accessibilityRole="switch"
            accessibilityState={{ checked: aiTrainingDataFeedback }}
            disabled={savingPrivacy}
            onPress={() => void toggleAiTrainingDataFeedback()}
            trailing={
              <View pointerEvents="none">
                <Switch
                  accessible={false}
                  value={aiTrainingDataFeedback}
                  disabled={savingPrivacy}
                  trackColor={{ false: "#d1d5db", true: ACCENT }}
                  ios_backgroundColor="#d1d5db"
                />
              </View>
            }
          />
          <View style={styles.separator} />
          <SettingsRow
            grouped
            title="Privacy Policy"
            accessibilityRole="link"
            onPress={() =>
              void Linking.openURL(`${getSiteBaseUrl()}/privacy-policy`)
            }
            trailing={
              <View style={styles.policyLink}>
                <CustomText
                  textStyle="caption"
                  numberOfLines={1}
                  style={styles.policyLinkText}
                >
                  tour.you/privacy-policy
                </CustomText>
                <Feather name="arrow-up-right" size={14} color={ACCENT} />
              </View>
            }
          />
        </View>

        <SecondaryButton
          destructive
          icon="log-out-outline"
          label="Logout"
          accessibilityLabel="Log out"
          onPress={confirmSignOut}
          style={styles.logoutPill}
        />
        <SecondaryButton
          destructive
          icon="trash-outline"
          label={deletingAccount ? "Deleting account…" : "Delete account"}
          accessibilityLabel="Delete account"
          disabled={deletingAccount}
          onPress={confirmDeleteAccount}
          style={styles.deleteAccountPill}
        />
        <CustomText textStyle="caption" style={styles.version}>
          Tour mobile 0.1.0 · Host Your Voice
        </CustomText>
      </ScrollView>

      <GlassNavHeader title="Settings" onBack={onBack} />

      <BottomSheetModal
        visible={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        sheetHeight={feedbackSheetHeight}
        sheetStyle={styles.sheet}
        contentStyle={styles.sheetContent}
      >
        <View style={styles.sheetInner}>
          <View pointerEvents="box-none" style={styles.sheetHeaderWrap}>
            <LinearGradient
              colors={[BACKGROUND, "rgba(242, 242, 247, 0.62)", "rgba(242, 242, 247, 0)"]}
              locations={[0, 0.5, 1]}
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
            />
            <View pointerEvents="box-none" style={styles.sheetTitleRow}>
              <View style={styles.flex}>
                <CustomText textStyle="hero">Share Feedback</CustomText>
              </View>
              <LiquidGlassIconButton
                icon="close"
                accessibilityLabel="Close feedback"
                onPress={() => setFeedbackOpen(false)}
              />
            </View>
          </View>
          <View
            style={[
              styles.sheetBody,
              {
                paddingBottom:
                  FEEDBACK_BUTTON_HEIGHT + FEEDBACK_BUTTON_GAP + buttonLift,
              },
            ]}
          >
            <CustomText textStyle="title">What should we improve?</CustomText>
            <TextInput
              ref={feedbackInputRef}
              autoFocus
              multiline
              maxLength={4000}
              value={feedbackText}
              onChangeText={setFeedbackText}
              placeholder="What do you love, need help with, found, or feel is missing?"
              placeholderTextColor={C.textMuted}
              style={[customTextVariants.body, styles.input]}
              textAlignVertical="top"
            />
            <CustomText textStyle="micro" style={styles.counter}>
              {feedbackText.length}/4000
            </CustomText>
          </View>
          <View
            pointerEvents="box-none"
            style={[styles.sheetFooter, { bottom: buttonLift }]}
          >
            <MotionPressable
              accessibilityRole="button"
              haptic="medium"
              onPress={() => void sendFeedback()}
              style={styles.primaryButton}
            >
              <CustomText textStyle="title" style={styles.primaryButtonText}>
                Send feedback
              </CustomText>
            </MotionPressable>
          </View>
        </View>
      </BottomSheetModal>
    </View>
  );
}

function SettingsRow({
  icon,
  title,
  sub,
  onPress,
  trailing,
  grouped = false,
  disabled = false,
  accessibilityRole = "button",
  accessibilityState,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  sub?: string;
  onPress: () => void;
  trailing?: React.ReactNode;
  grouped?: boolean;
  disabled?: boolean;
  accessibilityRole?: "button" | "switch" | "link";
  accessibilityState?: { checked?: boolean };
}) {
  const row = (
    <>
      {icon ? (
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={20} color={ACCENT} />
        </View>
      ) : null}
      <View style={styles.flex}>
        <CustomText textStyle={grouped ? "body" : "title"}>{title}</CustomText>
        {sub ? (
          <CustomText textStyle="caption" style={styles.rowSub}>
            {sub}
          </CustomText>
        ) : null}
      </View>
      {trailing ?? (
        <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
      )}
    </>
  );

  if (grouped) {
    return (
      <Pressable
        accessibilityRole={accessibilityRole}
        accessibilityState={accessibilityState}
        disabled={disabled}
        onPress={onPress}
        style={styles.groupedRow}
      >
        {row}
      </Pressable>
    );
  }

  return (
    <MotionPressable
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      disabled={disabled}
      haptic="selection"
      onPress={onPress}
      style={styles.card}
    >
      {row}
    </MotionPressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BACKGROUND },
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: 16,
  },
  card: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 15,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  group: {
    backgroundColor: CARD,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  groupedRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 12,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
    backgroundColor: "rgba(60, 60, 67, 0.18)",
  },
  policyLink: {
    flexShrink: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  policyLinkText: { color: ACCENT, flexShrink: 1 },
  iconWrap: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: BACKGROUND,
  },
  rowSub: { marginTop: 3, color: C.textSec },
  sectionHeader: {
    color: "rgba(0, 0, 0, 0.45)",
    marginTop: 22,
    marginBottom: 8,
    paddingHorizontal: 16,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  logoutPill: {
    marginTop: 22,
  },
  deleteAccountPill: {
    marginTop: 10,
  },
  version: {
    marginTop: 8,
    color: C.textMuted,
    textAlign: "center",
  },
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
  sheetBody: { flex: 1, gap: 10, paddingTop: 52, paddingHorizontal: 18 },
  sheetFooter: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 0,
  },
  input: {
    flex: 1,
    minHeight: 120,
    padding: 14,
    borderRadius: LARGE_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
    color: TEXT,
    lineHeight: 20,
  },
  counter: {
    alignSelf: "flex-end",
    color: C.textMuted,
    fontVariant: ["tabular-nums"],
  },
  primaryButton: {
    minHeight: FEEDBACK_BUTTON_HEIGHT,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 29,
    backgroundColor: ACCENT,
    boxShadow: "0 6px 14px rgba(0, 108, 229, 0.28)",
  },
  primaryButtonText: { color: CARD },
});
