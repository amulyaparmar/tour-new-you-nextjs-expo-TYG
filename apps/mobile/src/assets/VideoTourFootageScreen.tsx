import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CustomText } from "@/components/custom-text";
import { InfoBox } from "@/components/info-box";
import {
  GlassNavHeader,
  glassNavContentInset,
} from "@/components/glass-nav-header";
import {
  buildSections,
  shotId,
  type VideoTourShotListDraft,
} from "@/assets/VideoTourShotListScreen";
import { ACCENT, BACKGROUND, CARD, SMALL_CORNER } from "@/theme/tokens";

const MUTED = "rgba(0, 0, 0, 0.45)";
const FOOTER_FADE = 56;
const DISABLED_FILL = "rgba(60, 60, 67, 0.18)";

export type VideoTourFootageDraft = VideoTourShotListDraft & {
  selectedIds: string[];
};

export function VideoTourFootageScreen({
  draft,
  onBack,
  onOpenRecorder,
}: {
  draft: VideoTourFootageDraft;
  onBack: () => void;
  onOpenRecorder: (shotId: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const footerPad = Math.max(insets.bottom, 16);
  const footerClearance = FOOTER_FADE + 50 + footerPad;
  const selected = useMemo(() => new Set(draft.selectedIds), [draft.selectedIds]);
  const sections = useMemo(
    () =>
      buildSections(draft)
        .map((section) => ({
          ...section,
          shots: section.shots.filter((shot) =>
            selected.has(shotId(section.id, shot.key)),
          ),
        }))
        .filter((section) => section.shots.length > 0),
    [draft, selected],
  );

  return (
    <View style={styles.page}>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: glassNavContentInset(insets.top),
          paddingHorizontal: 18,
          paddingBottom: footerClearance,
        }}
      >
        <InfoBox style={styles.infoBox}>
          Film the footage for each shot, then press the button at the bottom
          when you’re finished.
        </InfoBox>
        {sections.map((section, index) => (
          <View
            key={section.id}
            style={[styles.section, index === 0 && styles.sectionFirst]}
          >
            <CustomText textStyle="title" style={styles.sectionTitle}>
              {section.title}
            </CustomText>
            <View style={styles.list}>
              {section.shots.map((shot) => (
                <Pressable
                  key={shot.key}
                  accessibilityRole="button"
                  accessibilityLabel={`${shot.label}. ${
                    shot.recordsAudio ? "Records audio" : "No audio"
                  }`}
                  onPress={() => onOpenRecorder(shotId(section.id, shot.key))}
                  style={({ pressed }) => [
                    styles.shotCard,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons name={shot.icon} size={22} color={MUTED} />
                  <View style={styles.shotCopy}>
                    <CustomText textStyle="body" numberOfLines={1}>
                      {shot.label}
                    </CustomText>
                    <CustomText
                      textStyle="caption"
                      numberOfLines={2}
                      style={styles.shotDescription}
                    >
                      {shot.description}
                    </CustomText>
                  </View>
                  <View style={styles.shotMeta}>
                    <Ionicons
                      name={shot.recordsAudio ? "mic" : "mic-off-outline"}
                      size={18}
                      color={shot.recordsAudio ? ACCENT : MUTED}
                      accessibilityLabel={
                        shot.recordsAudio ? "Records audio" : "No audio"
                      }
                    />
                    <Ionicons name="chevron-forward" size={18} color={MUTED} />
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

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
          accessibilityLabel="Next: Combine Shots"
          accessibilityState={{ disabled: true }}
          disabled
          style={styles.primaryBtn}
        >
          <CustomText textStyle="title" style={styles.primaryBtnText}>
            Next: Combine Shots
          </CustomText>
        </Pressable>
      </View>

      <GlassNavHeader title="Video Tour Footage" onBack={onBack} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: BACKGROUND },
  infoBox: { marginBottom: 4 },
  section: { marginTop: 26 },
  sectionFirst: { marginTop: 18 },
  sectionTitle: { marginBottom: 12 },
  list: { gap: 8 },
  shotCard: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderRadius: SMALL_CORNER,
    backgroundColor: CARD,
  },
  shotCopy: { flex: 1, minWidth: 0, gap: 2 },
  shotMeta: { flexDirection: "row", alignItems: "center", gap: 2 },
  shotDescription: { color: MUTED },
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
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 25,
    backgroundColor: DISABLED_FILL,
  },
  primaryBtnText: { color: MUTED },
  pressed: { opacity: 0.72 },
});
