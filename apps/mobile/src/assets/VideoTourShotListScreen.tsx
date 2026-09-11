import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CustomText } from "@/components/custom-text";
import { InfoBox } from "@/components/info-box";
import {
  GlassNavHeader,
  GLASS_NAV_BAR_HEIGHT,
} from "@/components/glass-nav-header";
import { getLiquidGlassView } from "@/components/liquid-glass";
import { ACCENT, BACKGROUND, CARD, LARGE_CORNER, SMALL_CORNER } from "@/theme/tokens";
import { tourColors as C } from "@/theme/tour-brand";

const MUTED = "rgba(0, 0, 0, 0.45)";
const FOOTER_FADE = 56;
const GRID_GAP = 8;
const SECONDS_PER_SHOT = 12;
const SUGGESTED_MIN_SECONDS = 60;
const SUGGESTED_MAX_SECONDS = 120;
const LENGTH_BANNER_HEIGHT = 72;

const EXTERIOR_AMENITIES = new Set([
  "pool",
  "parking garage",
  "pet park",
  "courtyard",
]);

type ShotType = {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
};

type ShotSection = {
  id: string;
  title: string;
  shots: ShotType[];
};

export type VideoTourShotListDraft = {
  tourName: string;
  floorPlans: { id: string; name: string }[];
  amenities: string[];
};

const INTRO_SHOTS: ShotType[] = [
  { key: "a-roll", label: "A-Roll Shots", icon: "videocam-outline" },
  {
    key: "b-roll",
    label: "B-Roll (Property/Welcome Area)",
    icon: "film-outline",
  },
  {
    key: "interviews",
    label: "Neighbor/Resident Interviews",
    icon: "mic-outline",
  },
  {
    key: "testimonials",
    label: "Resident Testimonials",
    icon: "chatbubbles-outline",
  },
];

const MISC_SHOTS: ShotType[] = [
  { key: "fun", label: "Fun Property Shots", icon: "happy-outline" },
  { key: "seasonal", label: "Seasonal/Marketing", icon: "calendar-outline" },
  { key: "events", label: "Resident Events", icon: "people-outline" },
  { key: "offers", label: "Special Offers", icon: "pricetag-outline" },
  { key: "security", label: "Security", icon: "shield-checkmark-outline" },
];

const DESIGN_AMENITIES: {
  title: string;
  match: string[];
  exterior: boolean;
}[] = [
  { title: "Gym", match: ["gym"], exterior: false },
  { title: "Pool", match: ["pool"], exterior: true },
  { title: "Clubhouse", match: ["clubhouse"], exterior: false },
  { title: "Fitness Center", match: ["fitness center"], exterior: false },
  {
    title: "Entertainment Lounge",
    match: ["entertainment lounge"],
    exterior: false,
  },
  { title: "Parking Garage", match: ["parking garage"], exterior: true },
  { title: "Study Area", match: ["study area"], exterior: false },
  { title: "Pet Park", match: ["pet park"], exterior: true },
  { title: "Courtyard", match: ["courtyard"], exterior: true },
];

function spaceShots(kind: "interior" | "exterior"): ShotType[] {
  return [
    { key: "a-roll", label: "A-Roll Shots", icon: "videocam-outline" },
    { key: "wide", label: "Wide Angle Shots", icon: "scan-outline" },
    { key: "detail", label: "Detail Shots", icon: "aperture-outline" },
    {
      key: "lifestyle",
      label:
        kind === "exterior" ? "Lifestyle (Exterior)" : "Lifestyle (Interior)",
      icon: kind === "exterior" ? "sunny-outline" : "people-outline",
    },
  ];
}

function floorPlanPlaceholder(index: number) {
  const letter = String.fromCharCode(65 + (index % 26));
  return `Plan ${index + 1}${letter}`;
}

function buildSections(draft: VideoTourShotListDraft): ShotSection[] {
  const floorPlanSections = draft.floorPlans.map((plan, index) => {
    const name = (plan.name.trim() || floorPlanPlaceholder(index)).replace(
      /^floor\s*plans?\s*:?\s*/i,
      "",
    );
    return {
      id: `floor:${plan.id}`,
      title: `Floor Plan: ${name}`,
      shots: spaceShots("interior"),
    };
  });

  const amenitySections = draft.amenities.map((amenity) => {
    const key = amenity.toLowerCase();
    const known = DESIGN_AMENITIES.find(
      (item) => item.match.includes(key) || item.title.toLowerCase() === key,
    );
    return {
      id: `amenity:${key}`,
      title: known?.title ?? amenity,
      shots: spaceShots(
        (known?.exterior ?? EXTERIOR_AMENITIES.has(key))
          ? "exterior"
          : "interior",
      ),
    };
  });

  return [
    { id: "intro", title: "Introduction", shots: INTRO_SHOTS },
    ...floorPlanSections,
    ...amenitySections,
    { id: "misc", title: "Miscellaneous", shots: MISC_SHOTS },
  ];
}

function shotId(sectionId: string, shotKey: string) {
  return `${sectionId}:${shotKey}`;
}

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function lengthGuidance(totalSeconds: number) {
  if (totalSeconds <= 0) {
    return {
      tone: "empty" as const,
      suggestion: "You need at least one shot",
    };
  }
  if (totalSeconds < SUGGESTED_MIN_SECONDS) {
    return {
      tone: "warn" as const,
      suggestion: "We suggest adding more shots",
    };
  }
  if (totalSeconds > SUGGESTED_MAX_SECONDS) {
    return {
      tone: "warn" as const,
      suggestion: "We suggest removing some shots",
    };
  }
  return {
    tone: "ok" as const,
    suggestion: "This length looks great",
  };
}

export function VideoTourShotListScreen({
  draft,
  onBack,
}: {
  draft: VideoTourShotListDraft;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const GlassView = useMemo(() => getLiquidGlassView(), []);
  const footerPad = Math.max(insets.bottom, 16);
  const footerClearance = FOOTER_FADE + 58 + footerPad;
  const cardWidth = (windowWidth - 36 - GRID_GAP) / 2;
  const bannerTop = insets.top + GLASS_NAV_BAR_HEIGHT;
  const sections = useMemo(() => buildSections(draft), [draft]);
  const [selected, setSelected] = useState(() => {
    const next = new Set<string>();
    next.add(shotId("intro", "a-roll"));
    next.add(shotId("intro", "b-roll"));
    return next;
  });

  const estimatedSeconds = selected.size * SECONDS_PER_SHOT;
  const guidance = lengthGuidance(estimatedSeconds);
  const lengthColor =
    guidance.tone === "ok"
      ? C.green
      : guidance.tone === "empty"
        ? C.red
        : C.amber;

  function toggleShot(sectionId: string, shotKey: string) {
    const id = shotId(sectionId, shotKey);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <View style={styles.page}>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: bannerTop + LENGTH_BANNER_HEIGHT + 16,
          paddingHorizontal: 18,
          paddingBottom: footerClearance,
        }}
      >
        <InfoBox style={styles.infoBox}>
          Select the shots you want to include in your tour video.
        </InfoBox>
        {sections.map((section, index) => (
          <View
            key={section.id}
            style={[styles.section, index === 0 && styles.sectionFirst]}
          >
            <CustomText textStyle="title" style={styles.sectionTitle}>
              {section.title}
            </CustomText>
            <View style={styles.grid}>
              {section.shots.map((shot) => {
                const active = selected.has(shotId(section.id, shot.key));
                return (
                  <Pressable
                    key={shot.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={
                      active ? `Remove ${shot.label}` : `Add ${shot.label}`
                    }
                    onPress={() => toggleShot(section.id, shot.key)}
                    style={({ pressed }) => [
                      styles.shotCard,
                      { width: cardWidth },
                      active && styles.shotCardSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    {active ? (
                      <View style={styles.check}>
                        <Ionicons name="checkmark" size={12} color={CARD} />
                      </View>
                    ) : null}
                    <Ionicons
                      name={shot.icon}
                      size={22}
                      color={active ? ACCENT : MUTED}
                    />
                    <CustomText
                      textStyle="caption"
                      numberOfLines={2}
                      style={
                        active ? styles.shotLabelSelected : styles.shotLabel
                      }
                    >
                      {shot.label}
                    </CustomText>
                  </Pressable>
                );
              })}
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
          accessibilityLabel="Next: Record Tour"
          onPress={() => undefined}
          style={({ pressed }) => [
            styles.primaryBtn,
            pressed && styles.pressed,
          ]}
        >
          <CustomText textStyle="title" style={styles.primaryBtnText}>
            Next: Record Tour
          </CustomText>
        </Pressable>
      </View>

      <View
        pointerEvents="box-none"
        style={[styles.lengthWrap, { top: bannerTop }]}
      >
        <View style={styles.lengthCard}>
          {GlassView ? (
            <GlassView
              glassEffectStyle="regular"
              colorScheme="light"
              tintColor="rgba(255, 255, 255, 0.82)"
              borderRadius={LARGE_CORNER}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.lengthFallback]} />
          )}
          <View style={styles.lengthInner}>
            <View>
              <CustomText textStyle="caption" style={styles.lengthLabel}>
                Estimated video length
              </CustomText>
              <CustomText textStyle="hero" style={{ color: lengthColor }}>
                {formatClock(estimatedSeconds)}
              </CustomText>
            </View>
            <CustomText
              textStyle="micro"
              numberOfLines={2}
              style={[styles.lengthSuggestion, { color: lengthColor }]}
            >
              {guidance.suggestion}
            </CustomText>
          </View>
        </View>
      </View>

      <GlassNavHeader title="Tour Shot List" onBack={onBack} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: BACKGROUND },
  lengthWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 19,
  },
  lengthCard: {
    minHeight: LENGTH_BANNER_HEIGHT,
    overflow: "visible",
    borderRadius: LARGE_CORNER,
  },
  lengthFallback: {
    borderRadius: LARGE_CORNER,
    backgroundColor: CARD,
  },
  lengthInner: {
    minHeight: LENGTH_BANNER_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 22,
    paddingVertical: 16,
  },
  lengthLabel: { color: MUTED },
  lengthSuggestion: {
    flexGrow: 0,
    flexShrink: 1,
    maxWidth: 96,
    fontSize: 10,
    textAlign: "right",
  },
  infoBox: { marginBottom: 4 },
  section: { marginTop: 26 },
  sectionFirst: { marginTop: 18 },
  sectionTitle: { marginBottom: 12 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
  },
  shotCard: {
    minHeight: 92,
    padding: 14,
    paddingRight: 28,
    gap: 10,
    borderRadius: SMALL_CORNER,
    backgroundColor: CARD,
  },
  shotCardSelected: {
    backgroundColor: CARD,
  },
  check: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: ACCENT,
  },
  shotLabel: { color: MUTED },
  shotLabelSelected: { color: ACCENT },
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
    backgroundColor: ACCENT,
    boxShadow: "0 6px 14px rgba(0, 108, 229, 0.28)",
  },
  primaryBtnText: { color: CARD },
  pressed: { opacity: 0.72 },
});
