import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React, { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CustomText, customTextVariants } from "@/components/custom-text";
import {
  GlassNavHeader,
  glassNavContentInset,
} from "@/components/glass-nav-header";
import { LiquidGlassIconButton } from "@/components/liquid-glass-icon-button";
import { BottomSheetModal } from "@/components/bottom-sheet-modal";
import {
  VideoTourShotListScreen,
  type VideoTourShotListDraft,
} from "@/assets/VideoTourShotListScreen";
import { VideoTourFootageScreen } from "@/assets/VideoTourFootageScreen";
import { VideoTourFootageRecorderScreen } from "@/assets/VideoTourFootageRecorderScreen";
import {
  ACCENT,
  BACKGROUND,
  CARD,
  HINT,
  LARGE_CORNER,
  SMALL_CORNER,
  TEXT,
} from "@/theme/tokens";
import { tourColors as C } from "@/theme/tour-brand";

const MUTED = "rgba(0, 0, 0, 0.45)";
const FOOTER_FADE = 56;
const COUNT_STEP = 1;
const COUNT_MAX = 10;
const ADD_AMENITY_BUTTON_HEIGHT = 58;
const ADD_AMENITY_BUTTON_GAP = 12;
const ADD_AMENITY_KEYBOARD_CLEARANCE = 12;
const ADD_AMENITY_SHEET_REST_HEIGHT = 400;

const AMENITY_OPTIONS = [
  { label: "Gym", icon: "barbell-outline" },
  { label: "Pool", icon: "water-outline" },
  { label: "Clubhouse", icon: "business-outline" },
  { label: "Fitness Center", icon: "fitness-outline" },
  { label: "Entertainment Lounge", icon: "tv-outline" },
  { label: "Parking Garage", icon: "car-outline" },
  { label: "Study Area", icon: "book-outline" },
  { label: "Pet Park", icon: "paw-outline" },
  { label: "Courtyard", icon: "leaf-outline" },
] as const;

type AmenityIcon =
  | (typeof AMENITY_OPTIONS)[number]["icon"]
  | "sparkles-outline";

type FloorPlanDraft = {
  id: string;
  name: string;
  bedrooms: number;
  bathrooms: number;
};

type VideoTourStackParamList = {
  Details: undefined;
  ShotList: VideoTourShotListDraft;
  Footage: VideoTourShotListDraft & { selectedIds: string[] };
  Recorder: VideoTourShotListDraft & { selectedIds: string[]; shotId: string };
};

const VideoTourStack = createNativeStackNavigator<VideoTourStackParamList>();

function newFloorPlan(): FloorPlanDraft {
  return {
    id: `floor-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: "",
    bedrooms: 1,
    bathrooms: 1,
  };
}

function clampCount(value: number) {
  return Math.min(COUNT_MAX, Math.max(0, Math.round(value)));
}

function floorPlanPlaceholder(index: number) {
  const letter = String.fromCharCode(65 + (index % 26));
  return `Plan ${index + 1}${letter}`;
}

export function VideoTourDetailsScreen({ onBack }: { onBack: () => void }) {
  return (
    <VideoTourStack.Navigator
      initialRouteName="Details"
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        gestureEnabled: true,
        contentStyle: { backgroundColor: BACKGROUND },
      }}
    >
      <VideoTourStack.Screen name="Details">
        {({ navigation }) => (
          <VideoTourDetailsForm
            onBack={onBack}
            onNext={(draft) => navigation.navigate("ShotList", draft)}
          />
        )}
      </VideoTourStack.Screen>
      <VideoTourStack.Screen name="ShotList">
        {({ navigation, route }) => (
          <VideoTourShotListScreen
            draft={route.params}
            onBack={() => navigation.goBack()}
            onNext={(selectedIds) =>
              navigation.navigate("Footage", {
                ...route.params,
                selectedIds,
              })
            }
          />
        )}
      </VideoTourStack.Screen>
      <VideoTourStack.Screen name="Footage">
        {({ navigation, route }) => (
          <VideoTourFootageScreen
            draft={route.params}
            onBack={() => navigation.goBack()}
            onOpenRecorder={(nextShotId: string) =>
              navigation.navigate("Recorder", {
                ...route.params,
                shotId: nextShotId,
              })
            }
          />
        )}
      </VideoTourStack.Screen>
      <VideoTourStack.Screen name="Recorder">
        {({ navigation, route }) => (
          <VideoTourFootageRecorderScreen
            draft={route.params}
            shotId={route.params.shotId}
            onBack={() => navigation.goBack()}
          />
        )}
      </VideoTourStack.Screen>
    </VideoTourStack.Navigator>
  );
}

function VideoTourDetailsForm({
  onBack,
  onNext,
}: {
  onBack: () => void;
  onNext: (draft: VideoTourShotListDraft) => void;
}) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const footerPad = Math.max(insets.bottom, 16);
  const footerClearance = FOOTER_FADE + 58 + footerPad;
  const amenityInputRef = useRef<TextInput>(null);
  const [tourName, setTourName] = useState("");
  const [floorPlans, setFloorPlans] = useState<FloorPlanDraft[]>([
    newFloorPlan(),
  ]);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [customAmenity, setCustomAmenity] = useState("");
  const [addingAmenity, setAddingAmenity] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const sheetPad = Math.max(insets.bottom, 16);
  const amenityButtonLift =
    keyboardHeight > 0
      ? Math.max(0, keyboardHeight - sheetPad + ADD_AMENITY_KEYBOARD_CLEARANCE)
      : 0;
  const amenitySheetHeight = Math.min(
    windowHeight,
    Math.max(ADD_AMENITY_SHEET_REST_HEIGHT, Math.round(windowHeight * 0.66)),
  );

  const selectedAmenities = new Set(
    amenities.map((item) => item.toLowerCase()),
  );
  const customAmenities = amenities.filter(
    (amenity) =>
      !AMENITY_OPTIONS.some(
        (option) => option.label.toLowerCase() === amenity.toLowerCase(),
      ),
  );

  function updateFloorPlan(id: string, patch: Partial<FloorPlanDraft>) {
    setFloorPlans((current) =>
      current.map((plan) => (plan.id === id ? { ...plan, ...patch } : plan)),
    );
  }

  function selectAmenity(value: string) {
    const clean = value.trim().slice(0, 80);
    if (!clean || selectedAmenities.has(clean.toLowerCase())) return;
    setAmenities((current) => [...current, clean]);
  }

  function closeAmenitySheet() {
    setAddingAmenity(false);
    setCustomAmenity("");
  }

  function addCustomAmenity() {
    const clean = customAmenity.trim();
    if (!clean) return;
    selectAmenity(clean);
    closeAmenitySheet();
  }

  useEffect(() => {
    if (!addingAmenity) {
      setKeyboardHeight(0);
      return;
    }
    const focusTimer = setTimeout(() => amenityInputRef.current?.focus(), 280);
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      clearTimeout(focusTimer);
      show.remove();
      hide.remove();
    };
  }, [addingAmenity]);

  function toggleAmenity(value: string) {
    if (selectedAmenities.has(value.toLowerCase())) {
      setAmenities((current) =>
        current.filter((item) => item.toLowerCase() !== value.toLowerCase()),
      );
      return;
    }
    selectAmenity(value);
  }

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: glassNavContentInset(insets.top),
          paddingHorizontal: 18,
          paddingBottom: footerClearance,
        }}
      >
        <View style={styles.group}>
          <GroupedField
            label="Tour name"
            value={tourName}
            onChangeText={setTourName}
            placeholder="Property Tour"
            autoCapitalize="words"
          />
        </View>

        <CustomText textStyle="title" style={styles.sectionTitle}>
          Floor Plans
        </CustomText>
        {floorPlans.map((plan, index) => (
          <View
            key={plan.id}
            style={[styles.card, index > 0 && styles.cardFollow]}
          >
            <View style={styles.cardHeader}>
              <CustomText textStyle="body">{index + 1}. Floor Plan</CustomText>
              {floorPlans.length > 1 ? (
                <LiquidGlassIconButton
                  icon="trash-outline"
                  iconColor={C.red}
                  accessibilityLabel={`Remove floor plan ${index + 1}`}
                  onPress={() =>
                    setFloorPlans((current) =>
                      current.filter((item) => item.id !== plan.id),
                    )
                  }
                />
              ) : null}
            </View>
            <View style={styles.nameField}>
              <GroupedField
                label="Name"
                value={plan.name}
                onChangeText={(name) => updateFloorPlan(plan.id, { name })}
                placeholder={floorPlanPlaceholder(index)}
                autoCapitalize="words"
              />
            </View>
            <StepperRow
              icon="bathtub-outline"
              label="Bathroom"
              value={plan.bathrooms}
              onChange={(bathrooms) => updateFloorPlan(plan.id, { bathrooms })}
            />
            <StepperRow
              icon="bed-outline"
              label="Bedroom"
              value={plan.bedrooms}
              onChange={(bedrooms) => updateFloorPlan(plan.id, { bedrooms })}
            />
          </View>
        ))}
        <AddPill
          label="Add Floor Plan"
          onPress={() =>
            setFloorPlans((current) => [...current, newFloorPlan()])
          }
        />

        <CustomText textStyle="title" style={styles.sectionTitle}>
          Amenities
        </CustomText>
        <View style={styles.chipWrap}>
          {AMENITY_OPTIONS.map((option) => (
            <AmenityChip
              key={option.label}
              label={option.label}
              icon={option.icon}
              selected={selectedAmenities.has(option.label.toLowerCase())}
              onPress={() => toggleAmenity(option.label)}
            />
          ))}
          {customAmenities.map((amenity) => (
            <AmenityChip
              key={amenity}
              label={amenity}
              icon="sparkles-outline"
              selected
              onPress={() => toggleAmenity(amenity)}
            />
          ))}
        </View>
        <AddPill label="Add Amenity" onPress={() => setAddingAmenity(true)} />
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
          accessibilityLabel="Next: Edit Shot List"
          onPress={() =>
            onNext({
              tourName: tourName.trim(),
              floorPlans: floorPlans.map((plan) => ({
                id: plan.id,
                name: plan.name,
              })),
              amenities,
            })
          }
          style={({ pressed }) => [
            styles.primaryBtn,
            pressed && styles.pressed,
          ]}
        >
          <CustomText textStyle="title" style={styles.primaryBtnText}>
            Next: Edit Shot List
          </CustomText>
        </Pressable>
      </View>

      <GlassNavHeader title="Video Tour Details" onBack={onBack} />

      <BottomSheetModal
        visible={addingAmenity}
        onClose={closeAmenitySheet}
        sheetHeight={amenitySheetHeight}
        sheetStyle={styles.sheet}
        contentStyle={styles.sheetContent}
      >
        <View style={styles.sheetInner}>
          <View pointerEvents="box-none" style={styles.sheetHeaderWrap}>
            <LinearGradient
              colors={[
                BACKGROUND,
                "rgba(242, 242, 247, 0.62)",
                "rgba(242, 242, 247, 0)",
              ]}
              locations={[0, 0.5, 1]}
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
            />
            <View pointerEvents="box-none" style={styles.sheetTitleRow}>
              <View style={styles.sheetTitleCopy}>
                <CustomText textStyle="hero">Add Amenity</CustomText>
              </View>
              <LiquidGlassIconButton
                icon="close"
                accessibilityLabel="Close add amenity"
                onPress={closeAmenitySheet}
              />
            </View>
          </View>
          <View
            style={[
              styles.sheetBody,
              {
                paddingBottom:
                  ADD_AMENITY_BUTTON_HEIGHT +
                  ADD_AMENITY_BUTTON_GAP +
                  amenityButtonLift,
              },
            ]}
          >
            <View style={styles.group}>
              <GroupedField
                label="Amenity"
                value={customAmenity}
                onChangeText={setCustomAmenity}
                placeholder="Pool"
                autoCapitalize="words"
                inputRef={amenityInputRef}
                returnKeyType="done"
                onSubmitEditing={addCustomAmenity}
              />
            </View>
          </View>
          <View
            pointerEvents="box-none"
            style={[styles.sheetFooter, { bottom: amenityButtonLift }]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add Amenity"
              disabled={!customAmenity.trim()}
              onPress={addCustomAmenity}
              style={({ pressed }) => [
                styles.primaryBtn,
                !customAmenity.trim() && styles.addButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              <CustomText textStyle="title" style={styles.primaryBtnText}>
                Add Amenity
              </CustomText>
            </Pressable>
          </View>
        </View>
      </BottomSheetModal>
    </KeyboardAvoidingView>
  );
}

function StepperRow({
  icon,
  label,
  value,
  onChange,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const atMin = value <= 0;
  const atMax = value >= COUNT_MAX;

  return (
    <View style={styles.stepperRow}>
      <MaterialCommunityIcons name={icon} size={18} color={TEXT} />
      <CustomText textStyle="body" style={styles.stepperLabel}>
        {label}
      </CustomText>
      <View style={styles.stepperControls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
          disabled={atMin}
          onPress={() => onChange(clampCount(value - COUNT_STEP))}
          style={({ pressed }) => [
            styles.stepperHit,
            atMin && styles.stepperHitDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="remove" size={16} color={atMin ? MUTED : ACCENT} />
        </Pressable>
        <CustomText textStyle="body" style={styles.stepperValue}>
          {value}
        </CustomText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
          disabled={atMax}
          onPress={() => onChange(clampCount(value + COUNT_STEP))}
          style={({ pressed }) => [
            styles.stepperHit,
            atMax && styles.stepperHitDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="add" size={16} color={atMax ? MUTED : ACCENT} />
        </Pressable>
      </View>
    </View>
  );
}

function AmenityChip({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon: AmenityIcon;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={selected ? `Remove ${label}` : `Add ${label}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={14} color={selected ? CARD : MUTED} />
      <CustomText
        textStyle="caption"
        style={selected ? styles.chipTextSelected : styles.chipText}
      >
        {label}
      </CustomText>
    </Pressable>
  );
}

function GroupedField({
  label,
  value,
  onChangeText,
  placeholder,
  autoCapitalize,
  inputRef,
  returnKeyType,
  onSubmitEditing,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  autoCapitalize?: "none" | "sentences" | "words";
  inputRef?: React.Ref<TextInput>;
  returnKeyType?: "done";
  onSubmitEditing?: () => void;
}) {
  return (
    <View style={styles.groupedRow}>
      <CustomText textStyle="body">{label}</CustomText>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={MUTED}
        autoCapitalize={autoCapitalize}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        style={[customTextVariants.title, styles.nativeInput]}
      />
    </View>
  );
}

function AddPill({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.addPill, pressed && styles.pressed]}
    >
      <Ionicons name="add" size={16} color={ACCENT} />
      <CustomText textStyle="label" style={styles.addPillText}>
        {label}
      </CustomText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: BACKGROUND },
  group: {
    backgroundColor: CARD,
    borderRadius: SMALL_CORNER,
    overflow: "hidden",
  },
  groupedRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 12,
  },
  nativeInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
    textAlign: "right",
  },
  sectionTitle: {
    marginTop: 26,
    marginBottom: 12,
  },
  card: {
    padding: 14,
    gap: 10,
    borderRadius: SMALL_CORNER,
    backgroundColor: CARD,
  },
  cardFollow: { marginTop: 10 },
  cardHeader: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  nameField: {
    marginHorizontal: -14,
  },
  stepperRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 14,
    paddingRight: 10,
    borderRadius: SMALL_CORNER,
    backgroundColor: BACKGROUND,
  },
  stepperLabel: { flex: 1 },
  stepperControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  stepperHit: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: CARD,
  },
  stepperHitDisabled: { opacity: 0.55 },
  stepperValue: {
    minWidth: 20,
    textAlign: "center",
  },
  addPill: {
    alignSelf: "center",
    minHeight: 36,
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(0, 108, 229, 0.25)",
    borderRadius: 999,
    backgroundColor: HINT,
  },
  addPillText: { color: ACCENT },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: CARD,
  },
  chipSelected: {
    backgroundColor: ACCENT,
  },
  chipText: { color: MUTED },
  chipTextSelected: { color: CARD },
  addButtonDisabled: { opacity: 0.4 },
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
  sheetTitleCopy: { flex: 1 },
  sheetBody: { flex: 1, gap: 10, paddingTop: 52, paddingHorizontal: 18 },
  sheetFooter: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 0,
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
