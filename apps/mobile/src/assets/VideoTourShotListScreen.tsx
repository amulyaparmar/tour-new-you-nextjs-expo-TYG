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

export type ShotType = {
  key: string;
  label: string;
  description: string;
  detail: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  recordsAudio: boolean;
};

export type SelectedShot = ShotType & {
  id: string;
  sectionId: string;
  sectionTitle: string;
};

export type ShotSection = {
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
  {
    key: "a-roll",
    label: "A-Roll Shots",
    description: "You introducing the property.",
    detail:
      "Look at the camera and introduce the community by name. Say who you are, what makes the property special, and invite the viewer to come along on the tour.",
    icon: "videocam-outline",
    recordsAudio: true,
  },
  {
    key: "b-roll",
    label: "B-Roll (Property/Welcome Area)",
    description: "Exterior, lobby, and arrival shots.",
    detail:
      "Film the exterior, main entrance, and lobby in slow, steady moves. These clips will cover your spoken introduction.",
    icon: "film-outline",
    recordsAudio: false,
  },
  {
    key: "interviews",
    label: "Neighbor/Resident Interviews",
    description: "Residents sharing why they live here.",
    detail:
      "Ask a resident why they chose this community and what they love about living here. Keep the mic close and let them speak in their own words.",
    icon: "mic-outline",
    recordsAudio: true,
  },
  {
    key: "testimonials",
    label: "Resident Testimonials",
    description: "Residents talking about community life.",
    detail:
      "Capture a resident talking about daily life here—neighbors, amenities, or a favorite moment. Film them in a real setting, not a blank wall.",
    icon: "chatbubbles-outline",
    recordsAudio: true,
  },
];

const MISC_SHOTS: ShotType[] = [
  {
    key: "fun",
    label: "Fun Property Shots",
    description: "Playful community personality shots.",
    detail:
      "Grab playful personality shots around the property—signs, pets, murals, or anything that feels like this community.",
    icon: "happy-outline",
    recordsAudio: false,
  },
  {
    key: "seasonal",
    label: "Seasonal/Marketing",
    description: "Holiday or seasonal curb appeal.",
    detail:
      "Film holiday decor, seasonal landscaping, or current marketing moments that show the property at this time of year.",
    icon: "calendar-outline",
    recordsAudio: false,
  },
  {
    key: "events",
    label: "Resident Events",
    description: "People at community gatherings.",
    detail:
      "Capture people at a community gathering. Get wide coverage of the event, then a few closer shots of conversation and energy.",
    icon: "people-outline",
    recordsAudio: false,
  },
  {
    key: "offers",
    label: "Special Offers",
    description: "Current specials and promotions.",
    detail:
      "Film current specials, signage, or leasing desk details so prospects can see what’s available right now.",
    icon: "pricetag-outline",
    recordsAudio: false,
  },
  {
    key: "security",
    label: "Security",
    description: "Access, cameras, and safety features.",
    detail:
      "Show access control, cameras, lighting, and other safety features. Keep the shots factual and easy to understand.",
    icon: "shield-checkmark-outline",
    recordsAudio: false,
  },
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

function spaceShots(kind: "interior" | "exterior", spaceName: string): ShotType[] {
  return [
    {
      key: "a-roll",
      label: "A-Roll Shots",
      description: "Walk-and-talk through the space.",
      detail: `Walk through ${spaceName} while talking about the layout, finishes, and who this space is for.`,
      icon: "videocam-outline",
      recordsAudio: true,
    },
    {
      key: "wide",
      label: "Wide Angle Shots",
      description: "Full view of the room or area.",
      detail: `Hold a wide, level shot of ${spaceName} so the full room or area is easy to read. Pan slowly if you need more coverage.`,
      icon: "scan-outline",
      recordsAudio: false,
    },
    {
      key: "detail",
      label: "Detail Shots",
      description: "Close-ups of finishes and features.",
      detail: `Get close on finishes and features in ${spaceName}—counters, fixtures, views, and anything that feels premium.`,
      icon: "aperture-outline",
      recordsAudio: false,
    },
    {
      key: "lifestyle",
      label:
        kind === "exterior" ? "Lifestyle (Exterior)" : "Lifestyle (Interior)",
      description:
        kind === "exterior"
          ? "People enjoying the outdoor space."
          : "People using the space naturally.",
      detail:
        kind === "exterior"
          ? `Film people using ${spaceName} naturally—arriving, sitting, or enjoying the outdoor space.`
          : `Film people using ${spaceName} the way residents would—working, relaxing, or gathering.`,
      icon: kind === "exterior" ? "sunny-outline" : "people-outline",
      recordsAudio: false,
    },
  ];
}

function floorPlanPlaceholder(index: number) {
  const letter = String.fromCharCode(65 + (index % 26));
  return `Plan ${index + 1}${letter}`;
}

export function buildSections(draft: VideoTourShotListDraft): ShotSection[] {
  const floorPlanSections = draft.floorPlans.map((plan, index) => {
    const name = (plan.name.trim() || floorPlanPlaceholder(index)).replace(
      /^floor\s*plans?\s*:?\s*/i,
      "",
    );
    return {
      id: `floor:${plan.id}`,
      title: `Floor Plan: ${name}`,
      shots: spaceShots("interior", name),
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
        known?.title ?? amenity,
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

export function shotId(sectionId: string, shotKey: string) {
  return `${sectionId}:${shotKey}`;
}

export function listSelectedShots(
  draft: VideoTourShotListDraft,
  selectedIds: string[],
): SelectedShot[] {
  const selected = new Set(selectedIds);
  return buildSections(draft).flatMap((section) =>
    section.shots
      .filter((shot) => selected.has(shotId(section.id, shot.key)))
      .map((shot) => ({
        ...shot,
        id: shotId(section.id, shot.key),
        sectionId: section.id,
        sectionTitle: section.title,
      })),
  );
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
  onNext,
}: {
  draft: VideoTourShotListDraft;
  onBack: () => void;
  onNext: (selectedIds: string[]) => void;
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
          onPress={() => onNext([...selected])}
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
