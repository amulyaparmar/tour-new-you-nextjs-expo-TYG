import { Feather, Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { MobileAuthSession } from "@/auth";
import { getCurrentSession } from "@/auth";
import { submitSupportRequest } from "@/api";
import { getSiteBaseUrl } from "@/config";
import { CustomText, customTextVariants } from "@/components/custom-text";
import {
  GlassNavHeader,
  glassNavContentInset,
} from "@/components/glass-nav-header";
import { BottomSheetModal } from "@/components/bottom-sheet-modal";
import { MotionPressable } from "@/components/ui/motion";
import { useProfileQuery, useUpdateProfileMutation } from "@/queries";
import { ACCENT, BACKGROUND, CARD, SMALL_CORNER, TEXT } from "@/theme/tokens";
import { tourColors as C } from "@/theme/tour-brand";

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
  const profileQuery = useProfileQuery();
  const updateProfileMutation = useUpdateProfileMutation();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const aiTrainingDataFeedback =
    profileQuery.data?.aiTrainingDataFeedback ??
    session.workspace.user.aiTrainingDataFeedback ??
    false;

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
          sub="Templates, criteria, and session applications"
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

        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel="Log out"
          haptic="selection"
          onPress={() => setLogoutOpen(true)}
          style={styles.logoutPill}
        >
          <Ionicons name="log-out-outline" size={18} color={C.red} />
          <CustomText textStyle="title" style={styles.logoutPillText}>
            Logout
          </CustomText>
        </MotionPressable>
        <CustomText textStyle="caption" style={styles.version}>
          Tour mobile 0.1.0 · Host Your Voice
        </CustomText>
      </ScrollView>

      <GlassNavHeader title="Settings" onBack={onBack} />

      <BottomSheetModal
        visible={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        sheetHeight={430}
        keyboardAvoiding
        dragHeader={
          <View style={styles.sheetHeader}>
            <View style={styles.iconWrap}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={20}
                color={ACCENT}
              />
            </View>
            <View style={styles.flex}>
              <CustomText textStyle="title">Share Feedback</CustomText>
              <CustomText textStyle="caption" style={styles.rowSub}>
                Tell us what would make the next Tour better.
              </CustomText>
            </View>
          </View>
        }
      >
        <View style={styles.sheetBody}>
          <CustomText textStyle="title">What should we improve?</CustomText>
          <TextInput
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
          <MotionPressable
            accessibilityRole="button"
            haptic="medium"
            onPress={() => void sendFeedback()}
            style={styles.primaryButton}
          >
            <Ionicons name="send-outline" size={17} color={CARD} />
            <CustomText textStyle="title" style={styles.primaryButtonText}>
              Send feedback
            </CustomText>
          </MotionPressable>
          <MotionPressable
            accessibilityRole="button"
            haptic="selection"
            onPress={() => setFeedbackOpen(false)}
            style={styles.cancelButton}
          >
            <CustomText textStyle="label" style={styles.cancelText}>
              Not now
            </CustomText>
          </MotionPressable>
        </View>
      </BottomSheetModal>
      <BottomSheetModal
        visible={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        sheetHeight={310}
        dragHeader={
          <View style={styles.sheetHeader}>
            <View style={[styles.iconWrap, styles.iconWrapDestructive]}>
              <Ionicons name="log-out-outline" size={20} color={C.red} />
            </View>
            <View style={styles.flex}>
              <CustomText textStyle="title">Log out of Tour?</CustomText>
              <CustomText textStyle="caption" style={styles.rowSub}>
                Your account will be removed from this device.
              </CustomText>
            </View>
          </View>
        }
      >
        <View style={styles.sheetBody}>
          <CustomText textStyle="caption" style={styles.sheetNote}>
            You’ll need a new email verification code the next time you sign in.
          </CustomText>
          <MotionPressable
            accessibilityRole="button"
            haptic="medium"
            onPress={onSignOut}
            style={styles.logoutButton}
          >
            <CustomText textStyle="title" style={styles.primaryButtonText}>
              Log out
            </CustomText>
          </MotionPressable>
          <MotionPressable
            accessibilityRole="button"
            haptic="selection"
            onPress={() => setLogoutOpen(false)}
            style={styles.cancelButton}
          >
            <CustomText textStyle="label" style={styles.cancelText}>
              Cancel
            </CustomText>
          </MotionPressable>
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
  iconWrapDestructive: { backgroundColor: C.redBg },
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
    height: 50,
    marginTop: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 25,
    backgroundColor: CARD,
  },
  logoutPillText: { color: C.red },
  version: {
    marginTop: 8,
    color: C.textMuted,
    textAlign: "center",
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  sheetBody: { flex: 1, gap: 10, paddingTop: 16 },
  sheetNote: { color: C.textSec, lineHeight: 19 },
  input: {
    flex: 1,
    minHeight: 120,
    padding: 14,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: BACKGROUND,
    color: TEXT,
    lineHeight: 20,
  },
  counter: {
    alignSelf: "flex-end",
    color: C.textMuted,
    fontVariant: ["tabular-nums"],
  },
  primaryButton: {
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
  primaryButtonText: { color: CARD },
  logoutButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 25,
    backgroundColor: C.red,
  },
  cancelButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { color: C.textSec },
});
