import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import type { CoachingItem } from "@tour/shared";
import { BottomSheetModal } from "@/components/bottom-sheet-modal";
import { CustomText } from "@/components/custom-text";
import { ACCENT, CARD, TEXT } from "@/theme/tokens";
import { tourColors as C } from "@/theme/tour-brand";

export function CoachGuidanceSheet({ item, onClose, onOpenChat }: {
  item: CoachingItem | null;
  onClose(): void;
  onOpenChat(item: CoachingItem): void;
}) {
  const { height } = useWindowDimensions();
  const detail = item?.preparedGuidance;
  const sections = item ? [
    detail?.feedback ? { label: "What I noticed", text: detail.feedback } : null,
    detail?.sayThis || item.sayIt ? { label: "Say this", text: detail?.sayThis ?? item.sayIt } : null,
    { label: detail?.feedback ? "Why it matters" : "Why now", text: detail?.whyNow ?? item.whyNow ?? item.text },
    detail?.keepInMind ? { label: "Keep in mind", text: detail.keepInMind } : null,
    detail?.nextMove ? { label: "Next", text: detail.nextMove } : null,
  ].filter((section): section is { label: string; text: string } => Boolean(section?.text?.trim())) : [];
  const options = detail?.options ?? [];

  return (
    <BottomSheetModal
      visible={Boolean(item)}
      onClose={onClose}
      sheetHeight={Math.min(560, Math.round(height * 0.68))}
      contentStyle={styles.content}
      sheetStyle={styles.sheet}
    >
      {item ? (
        <View style={styles.layout}>
          <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.sections}>
            {sections.map((section) => (
              <View key={section.label} style={styles.section}>
                <CustomText textStyle="title" style={styles.label}>{section.label}</CustomText>
                <CustomText textStyle="body" style={styles.copy}>{section.text}</CustomText>
              </View>
            ))}
            {options.length ? (
              <View style={styles.actionsSection}>
                <CustomText textStyle="title" style={styles.label}>Ways forward</CustomText>
                {options.map((option) => (
                  <View key={`${option.type}:${option.label}`} style={styles.action}>
                    <View style={styles.actionHeader}>
                      <CustomText textStyle="micro" style={styles.actionType}>{option.type}</CustomText>
                      <CustomText textStyle="label" style={styles.actionLabel}>{option.label}</CustomText>
                    </View>
                    <CustomText textStyle="body" style={styles.actionCopy}>{option.sayThis}</CustomText>
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View coaching in AI Chat"
            onPress={() => onOpenChat(item)}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <CustomText textStyle="title" style={styles.buttonText}>View in AI Chat</CustomText>
            <Ionicons name="arrow-forward" size={22} color={CARD} />
          </Pressable>
        </View>
      ) : null}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: CARD },
  content: { paddingHorizontal: 0 },
  layout: { flex: 1, paddingTop: 8, paddingBottom: 4 },
  sections: { paddingBottom: 16 },
  section: {
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 17,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(60, 60, 67, 0.14)",
  },
  label: { color: TEXT, fontSize: 17, lineHeight: 22 },
  copy: { color: C.textSec, fontSize: 16, lineHeight: 23, fontWeight: "600" },
  actionsSection: { gap: 10, paddingHorizontal: 12, paddingTop: 18, paddingBottom: 6 },
  action: { paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(60, 60, 67, 0.14)" },
  actionHeader: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 5 },
  actionType: { color: ACCENT, fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  actionLabel: { flex: 1, color: TEXT, fontSize: 14, fontWeight: "700" },
  actionCopy: { color: C.textSec, fontSize: 15, lineHeight: 22, fontWeight: "600" },
  button: {
    minHeight: 58,
    marginTop: 8,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    backgroundColor: ACCENT,
  },
  buttonPressed: { opacity: 0.84, transform: [{ scale: 0.99 }] },
  buttonText: { color: CARD, fontSize: 16 },
});
