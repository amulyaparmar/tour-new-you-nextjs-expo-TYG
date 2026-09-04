import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Reanimated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { BottomSheetModal } from "@/components/bottom-sheet-modal";
import { CustomText } from "@/components/custom-text";
import { LoadingDots } from "@/components/loading-dots";
import {
  authorizedCommunitiesForSession,
  listBusinesses,
  listCommunityEnrichment,
  onboardProperty,
  searchPropertiesForOnboarding,
  type BusinessOption,
  type CommunityEnrichment,
  type MobileAuthSession,
  type PropertyOnboardingCandidate,
} from "../auth";
import { tourColors } from "@/theme/tour-brand";
import { ACCENT, BACKGROUND, CARD, LARGE_CORNER } from "@/theme/tokens";

const SHEET_HEIGHT_RATIO = 0.72;
const SHEET_MAX_HEIGHT = 650;
const SHEET_GUTTER = 18;
const ROW_HEIGHT = 59;
const SKELETON_ROWS = 9;

type Community = MobileAuthSession["workspace"]["communities"][number];
type AssignedProperty = BusinessOption | Community;

const isEntrataSyncLabel = (value: string | null | undefined) => {
  const label = value?.trim().toLowerCase() ?? "";
  return label.includes("entrata") || /\bsync(?:ed|ing)?\b/.test(label);
};

const propertyDisplayName = (value: string) =>
  value
    .replace(/\s*(?:[·|—-]\s*)?entrata\s+sync(?:ed|ing)?\b/gi, "")
    .trim() || value;

type CommunityPickerModalProps = {
  visible: boolean;
  session: MobileAuthSession;
  query: string;
  switchingId: string | null;
  title?: string;
  subtitle?: string;
  closeButtonVisible?: boolean;
  dismissDisabled?: boolean;
  onPropertyAdded?: (session: MobileAuthSession) => void;
  onQueryChange: (query: string) => void;
  onClose: () => void;
  onSelect: (communityId: string) => void;
};

export function CommunityPickerModal({
  visible,
  session,
  query,
  switchingId,
  title = "Choose a property",
  closeButtonVisible = true,
  dismissDisabled = false,
  onPropertyAdded,
  onQueryChange,
  onClose,
  onSelect,
}: CommunityPickerModalProps) {
  const { height: windowHeight } = useWindowDimensions();
  const [listReady, setListReady] = useState(false);
  const [mode, setMode] = useState<"assigned" | "add">("assigned");
  const [debouncedAssignedSearch, setDebouncedAssignedSearch] = useState("");
  const [addSearch, setAddSearch] = useState("");
  const [debouncedAddSearch, setDebouncedAddSearch] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState<PropertyOnboardingCandidate | null>(null);
  const [joiningPlaceId, setJoiningPlaceId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const enrichmentQuery = useQuery({
    queryKey: ["community-enrichment", session.workspace.user.email],
    queryFn: listCommunityEnrichment,
    enabled: visible,
    staleTime: 60_000,
    retry: 1,
  });
  const enrichmentByCommunity = useMemo(
    () => new Map(
      (enrichmentQuery.data ?? []).map((item) => [item.communityId, item] as const)
    ),
    [enrichmentQuery.data]
  );
  const propertySearchQuery = useQuery({
    queryKey: ["property-onboarding-search", debouncedAddSearch],
    queryFn: () => searchPropertiesForOnboarding(debouncedAddSearch),
    enabled: visible && mode === "add" && debouncedAddSearch.length >= 2,
    staleTime: 60_000,
    retry: 1,
  });
  const sheetHeight = Math.round(Math.min(windowHeight * SHEET_HEIGHT_RATIO, SHEET_MAX_HEIGHT));
  const authorizedCommunities = useMemo(
    () => authorizedCommunitiesForSession(session),
    [session]
  );
  const initialAssignedProperties = useMemo<AssignedProperty[]>(
    () => authorizedCommunities.map((community) => ({
      id: community.id,
      name: community.name,
      companyName: community.companyName ?? "Property team",
      gmbId: community.gmbId,
      alias: community.alias,
      calendarConnected: false,
    })),
    [authorizedCommunities]
  );
  const assignedSearchQuery = useQuery({
    queryKey: ["assigned-property-search", session.workspace.user.email, debouncedAssignedSearch],
    queryFn: () => listBusinesses(debouncedAssignedSearch, {
      email: session.workspace.user.email,
      limit: 50,
    }),
    enabled: visible && mode === "assigned",
    initialData: debouncedAssignedSearch ? undefined : initialAssignedProperties,
    staleTime: 30_000,
    retry: 1,
  });
  const activeCommunityId = session.workspace.community.id;
  const assignedProperties = useMemo(() => {
    const items = assignedSearchQuery.data ?? [];
    const selected = items.filter((item) => item.id === activeCommunityId);
    const rest = items.filter((item) => item.id !== activeCommunityId);
    return selected.length ? [...selected, ...rest] : items;
  }, [activeCommunityId, assignedSearchQuery.data]);
  const switchLocked = Boolean(switchingId);
  const interactionLocked = switchLocked || Boolean(joiningPlaceId) || dismissDisabled;
  const pagerWidth = useSharedValue(0);
  const pagerProgress = useSharedValue(0);
  const pagerTrackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -pagerProgress.value * pagerWidth.value }],
  }));

  useEffect(() => {
    if (!visible) {
      setListReady(false);
      setMode("assigned");
      setDebouncedAssignedSearch("");
      setAddSearch("");
      setDebouncedAddSearch("");
      setSelectedCandidate(null);
      setJoiningPlaceId(null);
      setJoinError(null);
      return;
    }
    const frame = requestAnimationFrame(() => setListReady(true));
    return () => cancelAnimationFrame(frame);
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      pagerProgress.value = 0;
      return;
    }
    pagerProgress.value = withTiming(mode === "add" ? 1 : 0, {
      duration: 340,
      easing: Easing.out(Easing.cubic),
    });
  }, [mode, pagerProgress, visible]);

  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      return;
    }
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [visible]);

  useEffect(() => {
    if (mode !== "assigned") return;
    const timer = setTimeout(() => setDebouncedAssignedSearch(query.trim()), query.trim() ? 280 : 0);
    return () => clearTimeout(timer);
  }, [mode, query]);

  useEffect(() => {
    if (mode !== "add") return;
    const timer = setTimeout(() => setDebouncedAddSearch(addSearch.trim()), addSearch.trim() ? 320 : 0);
    return () => clearTimeout(timer);
  }, [addSearch, mode]);

  const beginAddProperty = useCallback(() => {
    setAddSearch(query.trim());
    setDebouncedAddSearch(query.trim());
    setSelectedCandidate(null);
    setJoinError(null);
    setMode("add");
  }, [query]);

  const joinProperty = useCallback(async (candidate: PropertyOnboardingCandidate) => {
    if (joiningPlaceId) return;
    setJoiningPlaceId(candidate.placeId);
    setJoinError(null);
    try {
      const result = await onboardProperty(candidate.placeId);
      onPropertyAdded?.(result.session);
    } catch (caught) {
      setJoinError(caught instanceof Error ? caught.message : "Could not add this property.");
    } finally {
      setJoiningPlaceId(null);
    }
  }, [joiningPlaceId, onPropertyAdded]);

  const renderCommunity = useCallback(
    ({ item }: { item: AssignedProperty }) => {
      const active = item.id === activeCommunityId;
      const loading = switchingId === item.id;
      const enrichment = enrichmentByCommunity.get(item.id);
      const metadataLabels = [item.alias, item.companyName]
        .filter((label): label is string => Boolean(label?.trim()) && !isEntrataSyncLabel(label))
        .filter((label, index, labels) => labels.indexOf(label) === index);
      return (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`${propertyDisplayName(item.name)}${active ? ", active property" : ""}`}
          activeOpacity={0.72}
          disabled={switchLocked}
          onPress={() => onSelect(item.id)}
        >
          <View style={styles.row}>
            <View style={[styles.rowIcon, active && styles.rowIconActive]}>
              <Ionicons
                name="business-outline"
                size={18}
                color={active ? tourColors.green : tourColors.brand}
              />
            </View>
            <View style={styles.rowBody}>
              <CustomText textStyle="label" numberOfLines={1} style={styles.rowName}>
                {propertyDisplayName(item.name)}
              </CustomText>
              <View style={styles.rowMetadata}>
                {metadataLabels.map((label) => (
                  <CustomText key={label} textStyle="caption" numberOfLines={1} style={styles.rowAlias}>
                    {label}
                  </CustomText>
                ))}
                {enrichment ? <EnrichmentBadge enrichment={enrichment} /> : null}
              </View>
            </View>
            {loading ? (
              <LoadingDots size="small" color={tourColors.brand} />
            ) : active ? (
              <Ionicons name="checkmark-circle" size={20} color={tourColors.green} />
            ) : (
              <Ionicons name="chevron-forward" size={17} color={tourColors.textMuted} />
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [activeCommunityId, enrichmentByCommunity, onSelect, switchLocked, switchingId]
  );

  const renderCandidate = useCallback(
    ({ item }: { item: PropertyOnboardingCandidate }) => {
      return (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`${item.name}, ${item.address || "Google business listing"}`}
          activeOpacity={0.72}
          disabled={Boolean(joiningPlaceId)}
          onPress={() => { setSelectedCandidate(item); setJoinError(null); }}
        >
          <View style={styles.candidateRow}>
            <View style={styles.candidateIcon}>
              <Ionicons name="location-outline" size={19} color={tourColors.brand} />
            </View>
            <View style={styles.rowBody}>
              <CustomText textStyle="label" numberOfLines={1} style={styles.rowName}>{item.name}</CustomText>
              <CustomText textStyle="micro" numberOfLines={2} style={styles.candidateAddress}>{item.address || "Google business listing"}</CustomText>
              <View style={styles.rowMetadata}>
                <CandidateBadge state={item.state} />
                {item.alreadyAssigned ? (
                  <CustomText textStyle="micro" style={styles.assignedText}>Already on your team</CustomText>
                ) : null}
              </View>
            </View>
            <View style={styles.addCircle}>
              <Ionicons name="arrow-forward" size={17} color={tourColors.brand} />
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [joiningPlaceId]
  );

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      sheetHeight={sheetHeight}
      dismissDisabled={interactionLocked}
      sheetStyle={styles.sheet}
      dragHeader={
        <View style={styles.titleRow}>
          {mode === "add" ? (
            <Pressable
              accessibilityLabel="Back to assigned properties"
              disabled={Boolean(joiningPlaceId)}
              onPress={() => {
                if (selectedCandidate) setSelectedCandidate(null);
                else setMode("assigned");
                setJoinError(null);
              }}
              style={styles.closeBtn}
            >
              <Ionicons name="arrow-back" size={20} color={tourColors.text} />
            </Pressable>
          ) : null}
          <View style={styles.headerCopy}>
            <CustomText textStyle="hero" style={styles.title}>
              {mode === "add" ? (selectedCandidate ? "Confirm property" : "Add a property") : title}
            </CustomText>
          </View>
          {closeButtonVisible ? (
            <Pressable
              accessibilityLabel="Close properties"
              disabled={switchLocked || Boolean(joiningPlaceId)}
              onPress={onClose}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={20} color={tourColors.text} />
            </Pressable>
          ) : null}
        </View>
      }
      contentStyle={styles.listContent}
    >
      <View
        style={styles.pager}
        onLayout={(event) => {
          pagerWidth.value = event.nativeEvent.layout.width;
        }}
      >
        <Reanimated.View style={[styles.pagerTrack, pagerTrackStyle]}>
          <View style={styles.pagerPane} pointerEvents={mode === "add" ? "none" : "auto"}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color={tourColors.textMuted} />
              <TextInput
                value={query}
                onChangeText={onQueryChange}
                placeholder="Search assigned properties"
                placeholderTextColor={tourColors.textMuted}
                style={styles.searchInput}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>
            {!listReady ? (
              <View style={styles.list}>
                {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
                  <View key={index} style={styles.skeletonRow}>
                    <View style={styles.skeletonIcon} />
                    <View style={styles.skeletonBody}>
                      <View style={styles.skeletonLine} />
                      <View style={styles.skeletonLineShort} />
                    </View>
                  </View>
                ))}
              </View>
            ) : assignedSearchQuery.isLoading ? (
              <View style={styles.loadingSearch}>
                <LoadingDots color={tourColors.brand} />
                <CustomText textStyle="caption" style={styles.loadingSearchText}>Searching your assigned properties…</CustomText>
              </View>
            ) : assignedSearchQuery.error ? (
              <View style={styles.empty}>
                <Ionicons name="cloud-offline-outline" size={28} color={tourColors.textMuted} />
                <CustomText textStyle="title" style={styles.emptyTitle}>Couldn’t search properties</CustomText>
                <CustomText textStyle="caption" style={styles.emptySub}>
                  {assignedSearchQuery.error instanceof Error ? assignedSearchQuery.error.message : "Try again."}
                </CustomText>
                <Pressable onPress={() => void assignedSearchQuery.refetch()} style={styles.retryButton}>
                  <CustomText textStyle="caption" style={styles.retryText}>Try again</CustomText>
                </Pressable>
              </View>
            ) : assignedProperties.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="business-outline" size={28} color={tourColors.textMuted} />
                <CustomText textStyle="title" style={styles.emptyTitle}>No assigned properties found</CustomText>
                <CustomText textStyle="caption" style={styles.emptySub}>Try another search or add a property below.</CustomText>
              </View>
            ) : (
              <FlatList
                data={assignedProperties}
                extraData={activeCommunityId}
                renderItem={renderCommunity}
                keyExtractor={(item) => item.id}
                style={styles.list}
                contentContainerStyle={{ paddingBottom: keyboardHeight }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator
                initialNumToRender={16}
                maxToRenderPerBatch={14}
                updateCellsBatchingPeriod={30}
                windowSize={7}
                removeClippedSubviews
                getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
              />
            )}
            {onPropertyAdded ? (
              <Pressable
                accessibilityRole="button"
                onPress={beginAddProperty}
                style={({ pressed }) => [styles.findPropertyButton, pressed && styles.findPropertyPressed]}
              >
                <Ionicons name="add" size={21} color={CARD} />
                <CustomText textStyle="title" style={styles.findPropertyText}>Find/Add A Property</CustomText>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.pagerPane} pointerEvents={mode === "add" ? "auto" : "none"}>
            {selectedCandidate ? null : (
              <View style={styles.searchBar}>
                <Ionicons name="search" size={18} color={tourColors.textMuted} />
                <TextInput
                  value={addSearch}
                  onChangeText={setAddSearch}
                  placeholder="Property name or location"
                  placeholderTextColor={tourColors.textMuted}
                  style={styles.searchInput}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
              </View>
            )}
            {joinError ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={18} color="#b42318" />
                <CustomText textStyle="micro" style={styles.errorText}>{joinError}</CustomText>
              </View>
            ) : null}
            {selectedCandidate ? (
              <View style={styles.confirmWrap}>
                <View style={styles.confirmIcon}>
                  <Ionicons name="business" size={25} color={tourColors.brand} />
                </View>
                <CustomText textStyle="hero" style={styles.confirmTitle}>{selectedCandidate.name}</CustomText>
                <CustomText textStyle="caption" style={styles.confirmAddress}>
                  {selectedCandidate.address || "Google business listing"}
                </CustomText>
                <View style={styles.confirmBadges}>
                  <CandidateBadge state={selectedCandidate.state} />
                  {selectedCandidate.alreadyAssigned ? (
                    <View style={styles.alreadyAssignedBadge}>
                      <Ionicons name="checkmark-circle" size={13} color={tourColors.green} />
                      <CustomText textStyle="micro" style={styles.alreadyAssignedBadgeText}>Already assigned</CustomText>
                    </View>
                  ) : null}
                </View>
                <View style={styles.confirmSteps}>
                  {[
                    ["person-add-outline", "Add your exact email to the property team"],
                    ["sparkles-outline", selectedCandidate.state === "enriched" ? "Keep the existing enriched data" : "Start Tour.report enrichment"],
                    ["clipboard-outline", "Create the property’s editable Tour rubric if needed"],
                  ].map(([icon, label]) => (
                    <View key={label} style={styles.confirmStep}>
                      <View style={styles.confirmStepIcon}>
                        <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={16} color={tourColors.brand} />
                      </View>
                      <CustomText textStyle="micro" style={styles.confirmStepText}>{label}</CustomText>
                    </View>
                  ))}
                </View>
                <Pressable
                  accessibilityRole="button"
                  disabled={Boolean(joiningPlaceId)}
                  onPress={() => void joinProperty(selectedCandidate)}
                  style={({ pressed }) => [styles.confirmButton, pressed && styles.addPropertyPressed]}
                >
                  {joiningPlaceId ? (
                    <LoadingDots size="small" color="#fff" />
                  ) : (
                    <Ionicons name={selectedCandidate.alreadyAssigned ? "arrow-forward" : "add"} size={19} color="#fff" />
                  )}
                  <CustomText textStyle="title" style={styles.confirmButtonText}>
                    {joiningPlaceId
                      ? "Preparing property…"
                      : selectedCandidate.alreadyAssigned
                        ? "Open this property"
                        : "Add property and continue"}
                  </CustomText>
                </Pressable>
                <CustomText textStyle="micro" style={styles.confirmFootnote}>New team entries begin unverified and can be reviewed on Tour.report.</CustomText>
              </View>
            ) : debouncedAddSearch.length < 2 ? (
              <View style={styles.searchPromptCard}>
                <View style={styles.searchPromptIcon}>
                  <Ionicons name="sparkles-outline" size={34} color={tourColors.brand} />
                </View>
                <CustomText textStyle="title" style={styles.emptyTitle}>Find any property</CustomText>
                <CustomText textStyle="caption" style={styles.searchPromptText}>
                  Search by name and city. Tour will check whether it is already indexed or enriched before adding it.
                </CustomText>
              </View>
            ) : propertySearchQuery.isLoading ? (
              <View style={styles.loadingSearch}>
                <LoadingDots color={tourColors.brand} />
                <CustomText textStyle="caption" style={styles.loadingSearchText}>Checking Tour property intelligence…</CustomText>
              </View>
            ) : propertySearchQuery.error ? (
              <View style={styles.empty}>
                <Ionicons name="cloud-offline-outline" size={28} color={tourColors.textMuted} />
                <CustomText textStyle="title" style={styles.emptyTitle}>Couldn’t search properties</CustomText>
                <CustomText textStyle="caption" style={styles.emptySub}>
                  {propertySearchQuery.error instanceof Error ? propertySearchQuery.error.message : "Try again."}
                </CustomText>
                <Pressable onPress={() => void propertySearchQuery.refetch()} style={styles.retryButton}>
                  <CustomText textStyle="caption" style={styles.retryText}>Try again</CustomText>
                </Pressable>
              </View>
            ) : (propertySearchQuery.data?.length ?? 0) === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="search-outline" size={28} color={tourColors.textMuted} />
                <CustomText textStyle="title" style={styles.emptyTitle}>No properties found</CustomText>
                <CustomText textStyle="caption" style={styles.emptySub}>Try the full property name and city.</CustomText>
              </View>
            ) : (
              <FlatList
                data={propertySearchQuery.data ?? []}
                renderItem={renderCandidate}
                keyExtractor={(item) => item.placeId}
                style={styles.list}
                contentContainerStyle={{ paddingBottom: keyboardHeight }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator
              />
            )}
            <View style={styles.securityNote}>
              <Ionicons name="shield-checkmark-outline" size={15} color={tourColors.green} />
              <CustomText textStyle="micro" style={styles.securityNoteText}>Your exact email is added to PropertiesTYG.property_team.</CustomText>
            </View>
          </View>
        </Reanimated.View>
      </View>
    </BottomSheetModal>
  );
}

function EnrichmentBadge({ enrichment }: { enrichment: CommunityEnrichment }) {
  const enriched = enrichment.state === "enriched";
  const indexed = enrichment.state === "indexed";
  return (
    <View
      style={[
        styles.enrichmentBadge,
        enriched ? styles.enrichmentBadgeReady : indexed ? styles.enrichmentBadgeIndexed : null,
      ]}
    >
      <View
        style={[
          styles.enrichmentDot,
          enriched ? styles.enrichmentDotReady : indexed ? styles.enrichmentDotIndexed : null,
        ]}
      />
      <CustomText
        textStyle="micro"
        style={[
          styles.enrichmentText,
          enriched ? styles.enrichmentTextReady : indexed ? styles.enrichmentTextIndexed : null,
        ]}
      >
        {enriched ? "Enriched" : indexed ? "Indexed" : "Not linked"}
      </CustomText>
    </View>
  );
}

function CandidateBadge({ state }: { state: PropertyOnboardingCandidate["state"] }) {
  const enriched = state === "enriched";
  const indexed = state === "indexed";
  return (
    <View style={[styles.enrichmentBadge, enriched ? styles.enrichmentBadgeReady : indexed ? styles.enrichmentBadgeIndexed : null]}>
      <View style={[styles.enrichmentDot, enriched ? styles.enrichmentDotReady : indexed ? styles.enrichmentDotIndexed : null]} />
      <CustomText textStyle="micro" style={[styles.enrichmentText, enriched ? styles.enrichmentTextReady : indexed ? styles.enrichmentTextIndexed : null]}>
        {enriched ? "Enriched" : indexed ? "Indexed" : "New property"}
      </CustomText>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    overflow: "hidden",
    paddingTop: 10,
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
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    color: tourColors.text,
  },
  closeBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: CARD,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    marginTop: 14,
    marginBottom: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: CARD,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: tourColors.text,
    paddingVertical: 8,
  },
  list: {
    flex: 1,
  },
  pager: {
    flex: 1,
    overflow: "hidden",
  },
  pagerTrack: {
    height: "100%",
    width: "200%",
    flexDirection: "row",
  },
  pagerPane: {
    width: "50%",
    height: "100%",
    paddingHorizontal: SHEET_GUTTER,
    paddingBottom: 22,
  },
  listContent: {
    overflow: "visible",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    height: ROW_HEIGHT,
    paddingHorizontal: 4,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  candidateRow: {
    minHeight: 86,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  candidateIcon: {
    width: 38,
    height: 38,
    marginRight: 11,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef4ff",
  },
  candidateAddress: {
    marginTop: 3,
    color: tourColors.textSec,
    lineHeight: 15,
  },
  addCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eaf1ff",
  },
  assignedText: {
    color: tourColors.green,
  },
  rowIcon: {
    width: 34,
    height: 34,
    marginRight: 11,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef2ff",
  },
  rowIconActive: {
    backgroundColor: tourColors.greenBg,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  rowName: {
    color: tourColors.text,
  },
  rowAlias: {
    color: tourColors.textSec,
  },
  rowMetadata: {
    minHeight: 17,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 2,
  },
  enrichmentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#f2f4f7",
  },
  enrichmentBadgeReady: { backgroundColor: "#ecfdf3" },
  enrichmentBadgeIndexed: { backgroundColor: "#eff8ff" },
  enrichmentDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#98a2b3" },
  enrichmentDotReady: { backgroundColor: "#17b26a" },
  enrichmentDotIndexed: { backgroundColor: tourColors.brand },
  enrichmentText: { color: "#667085" },
  enrichmentTextReady: { color: "#067647" },
  enrichmentTextIndexed: { color: "#175cd3" },
  empty: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 32,
  },
  emptyTitle: {
    color: tourColors.text,
  },
  emptySub: {
    color: tourColors.textSec,
    textAlign: "center",
    lineHeight: 17,
  },
  searchPromptCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginVertical: 12,
    paddingHorizontal: 28,
    borderRadius: LARGE_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  confirmWrap: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 12,
  },
  confirmIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eaf1ff",
  },
  confirmTitle: {
    marginTop: 13,
    color: tourColors.text,
    textAlign: "center",
  },
  confirmAddress: {
    maxWidth: 340,
    marginTop: 5,
    color: tourColors.textSec,
    lineHeight: 18,
    textAlign: "center",
  },
  confirmBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 10,
  },
  alreadyAssignedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#ecfdf3",
  },
  alreadyAssignedBadgeText: { color: "#067647" },
  confirmSteps: {
    alignSelf: "stretch",
    gap: 9,
    marginTop: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e6ebf2",
    borderRadius: 13,
    backgroundColor: "#f9fafb",
  },
  confirmStep: { flexDirection: "row", alignItems: "center", gap: 10 },
  confirmStepIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eaf1ff",
  },
  confirmStepText: {
    flex: 1,
    color: tourColors.text,
    lineHeight: 16,
  },
  confirmButton: {
    alignSelf: "stretch",
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 14,
    borderRadius: 12,
    backgroundColor: tourColors.brand,
  },
  confirmButtonText: { color: "#fff" },
  confirmFootnote: {
    marginTop: 9,
    color: tourColors.textMuted,
    lineHeight: 13,
    textAlign: "center",
  },
  searchPromptIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef4ff",
  },
  searchPromptText: {
    maxWidth: 320,
    color: tourColors.textSec,
    lineHeight: 18,
    textAlign: "center",
  },
  loadingSearch: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingSearchText: {
    color: tourColors.textSec,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#fef3f2",
  },
  errorText: {
    flex: 1,
    color: "#b42318",
    lineHeight: 16,
  },
  retryButton: {
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 9,
    backgroundColor: "#eef4ff",
  },
  retryText: { color: tourColors.brand },
  securityNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 34,
    paddingTop: 8,
  },
  securityNoteText: {
    color: tourColors.textSec,
  },
  addPropertyPressed: { opacity: 0.72 },
  findPropertyButton: {
    alignSelf: "stretch",
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 8,
    paddingHorizontal: 14,
    borderRadius: 29,
    backgroundColor: ACCENT,
    boxShadow: "0 6px 14px rgba(0, 108, 229, 0.28)",
  },
  findPropertyPressed: { boxShadow: "none", transform: [{ scale: 0.975 }] },
  findPropertyText: { color: CARD },
  skeletonRow: {
    height: ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 10,
  },
  skeletonIcon: {
    width: 34,
    height: 34,
    marginRight: 11,
    borderRadius: 8,
    backgroundColor: "#eef2f7",
  },
  skeletonBody: {
    flex: 1,
    gap: 7,
  },
  skeletonLine: {
    width: "58%",
    height: 12,
    borderRadius: 6,
    backgroundColor: "#eef2f7",
  },
  skeletonLineShort: {
    width: "34%",
    height: 10,
    borderRadius: 5,
    backgroundColor: "#f3f5f8",
  },
});
