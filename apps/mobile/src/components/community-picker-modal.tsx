import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import { BottomSheetModal } from "@/components/bottom-sheet-modal";
import { LoadingDots } from "@/components/loading-dots";
import { Skeleton } from "@/components/ui/skeleton";
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
import { queryCacheTime, queryKeys } from "@/queries";

const SHEET_HEIGHT_RATIO = 0.72;
const SHEET_MAX_HEIGHT = 650;
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
  title = "Properties",
  subtitle = "Choose where you’re working in Tour.",
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
  const enrichmentQuery = useQuery({
    queryKey: [...queryKeys.all(), "community-enrichment", session.workspace.user.id],
    queryFn: listCommunityEnrichment,
    enabled: visible,
    staleTime: queryCacheTime.reference,
    retry: 1,
  });
  const enrichmentByCommunity = useMemo(
    () => new Map(
      (enrichmentQuery.data ?? []).map((item) => [item.communityId, item] as const)
    ),
    [enrichmentQuery.data]
  );
  const propertySearchQuery = useQuery({
    queryKey: [...queryKeys.all(), "property-onboarding-search", debouncedAddSearch],
    queryFn: () => searchPropertiesForOnboarding(debouncedAddSearch),
    enabled: visible && mode === "add" && debouncedAddSearch.length >= 2,
    staleTime: queryCacheTime.reference,
    placeholderData: (previous) => previous,
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
    queryKey: [...queryKeys.all(), "assigned-property-search", session.workspace.user.id, debouncedAssignedSearch],
    queryFn: () => listBusinesses(debouncedAssignedSearch, {
      email: session.workspace.user.email,
      limit: 50,
    }),
    enabled: visible && mode === "assigned",
    initialData: debouncedAssignedSearch ? undefined : initialAssignedProperties,
    initialDataUpdatedAt: 0,
    staleTime: queryCacheTime.reference,
    placeholderData: (previous) => previous,
    retry: 1,
  });
  const activeCommunityId = session.workspace.community.id;
  const switchLocked = Boolean(switchingId);
  const interactionLocked = switchLocked || Boolean(joiningPlaceId) || dismissDisabled;

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
      const metadataLabels = [item.companyName]
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
          <View style={[styles.row, active && styles.rowActive]}>
            <View style={[styles.rowIcon, active && styles.rowIconActive]}>
              <Ionicons
                name="business-outline"
                size={18}
                color={tourColors.brand}
              />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowName} numberOfLines={1}>
                {propertyDisplayName(item.name)}
              </Text>
              <View style={styles.rowMetadata}>
                {metadataLabels.map((label) => (
                  <Text key={label} style={styles.rowAlias} numberOfLines={1}>
                    {label}
                  </Text>
                ))}
                {enrichment ? <EnrichmentBadge enrichment={enrichment} /> : null}
              </View>
            </View>
            {loading ? (
              <LoadingDots size="small" color={tourColors.brand} />
            ) : active ? (
              <View style={styles.activeCheck}>
                <Ionicons name="checkmark" size={13} color="#fff" />
              </View>
            ) : (
              <View style={styles.rowAction} />
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
              <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.candidateAddress} numberOfLines={2}>{item.address || "Google business listing"}</Text>
              <View style={styles.rowMetadata}>
                <CandidateBadge state={item.state} />
                {item.alreadyAssigned ? (
                  <Text style={styles.assignedText}>Already on your team</Text>
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
      keyboardAvoiding
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
              style={styles.backBtn}
            >
              <Ionicons name="arrow-back" size={20} color={tourColors.text} />
            </Pressable>
          ) : null}
          <View style={styles.headerCopy}>
            <Text style={styles.title}>
              {mode === "add" ? (selectedCandidate ? "Confirm property" : "Add a property") : title}
            </Text>
            <Text style={styles.subtitle}>
              {mode === "add"
                ? selectedCandidate
                  ? "Review the Google listing before joining this property team."
                  : "Search Google, add yourself to its property team, and start enrichment."
                : subtitle}
            </Text>
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
      header={selectedCandidate ? undefined : (
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={tourColors.textMuted} />
          <TextInput
            value={mode === "add" ? addSearch : query}
            onChangeText={mode === "add" ? setAddSearch : onQueryChange}
            placeholder={mode === "add" ? "Property name or location" : "Search assigned properties"}
            placeholderTextColor={tourColors.textMuted}
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>
      )}
      contentStyle={styles.listContent}
    >
      <>
        {mode === "add" ? (
          <>
            {joinError ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={18} color="#b42318" />
                <Text style={styles.errorText}>{joinError}</Text>
              </View>
            ) : null}
            {selectedCandidate ? (
              <View style={styles.confirmWrap}>
                <View style={styles.confirmIcon}>
                  <Ionicons name="business" size={25} color={tourColors.brand} />
                </View>
                <Text style={styles.confirmTitle}>{selectedCandidate.name}</Text>
                <Text style={styles.confirmAddress}>
                  {selectedCandidate.address || "Google business listing"}
                </Text>
                <View style={styles.confirmBadges}>
                  <CandidateBadge state={selectedCandidate.state} />
                  {selectedCandidate.alreadyAssigned ? (
                    <View style={styles.alreadyAssignedBadge}>
                      <Ionicons name="checkmark-circle" size={13} color={tourColors.green} />
                      <Text style={styles.alreadyAssignedBadgeText}>Already assigned</Text>
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
                      <Text style={styles.confirmStepText}>{label}</Text>
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
                  <Text style={styles.confirmButtonText}>
                    {joiningPlaceId
                      ? "Preparing property…"
                      : selectedCandidate.alreadyAssigned
                        ? "Open this property"
                        : "Add property and continue"}
                  </Text>
                </Pressable>
                <Text style={styles.confirmFootnote}>New team entries begin unverified and can be reviewed on Tour.report.</Text>
              </View>
            ) : debouncedAddSearch.length < 2 ? (
              <View style={styles.searchPrompt}>
                <View style={styles.searchPromptIcon}>
                  <Ionicons name="sparkles-outline" size={25} color={tourColors.brand} />
                </View>
                <Text style={styles.emptyTitle}>Find any property</Text>
                <Text style={styles.searchPromptText}>
                  Search by name and city. Tour will check whether it is already indexed or enriched before adding it.
                </Text>
              </View>
            ) : propertySearchQuery.isLoading ? (
              <PropertyRowsSkeleton candidate />
            ) : propertySearchQuery.error ? (
              <View style={styles.empty}>
                <Ionicons name="cloud-offline-outline" size={28} color={tourColors.textMuted} />
                <Text style={styles.emptyTitle}>Couldn’t search properties</Text>
                <Text style={styles.emptySub}>
                  {propertySearchQuery.error instanceof Error ? propertySearchQuery.error.message : "Try again."}
                </Text>
                <Pressable onPress={() => void propertySearchQuery.refetch()} style={styles.retryButton}>
                  <Text style={styles.retryText}>Try again</Text>
                </Pressable>
              </View>
            ) : (propertySearchQuery.data?.length ?? 0) === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="search-outline" size={28} color={tourColors.textMuted} />
                <Text style={styles.emptyTitle}>No properties found</Text>
                <Text style={styles.emptySub}>Try the full property name and city.</Text>
              </View>
            ) : (
              <FlatList
                data={propertySearchQuery.data ?? []}
                renderItem={renderCandidate}
                keyExtractor={(item) => item.placeId}
                style={styles.list}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
              />
            )}
            <View style={styles.securityNote}>
              <Ionicons name="shield-checkmark-outline" size={15} color={tourColors.green} />
              <Text style={styles.securityNoteText}>Your exact email is added to PropertiesTYG.property_team.</Text>
            </View>
          </>
        ) : !listReady || assignedSearchQuery.isLoading ? (
          <PropertyRowsSkeleton />
        ) : assignedSearchQuery.error ? (
          <View style={styles.empty}>
            <Ionicons name="cloud-offline-outline" size={28} color={tourColors.textMuted} />
            <Text style={styles.emptyTitle}>Couldn’t search properties</Text>
            <Text style={styles.emptySub}>
              {assignedSearchQuery.error instanceof Error ? assignedSearchQuery.error.message : "Try again."}
            </Text>
            <Pressable onPress={() => void assignedSearchQuery.refetch()} style={styles.retryButton}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : (assignedSearchQuery.data?.length ?? 0) === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="business-outline" size={28} color={tourColors.textMuted} />
            <Text style={styles.emptyTitle}>No assigned properties found</Text>
            <Text style={styles.emptySub}>Try another search or add a property below.</Text>
          </View>
        ) : (
          <FlatList
            data={assignedSearchQuery.data ?? []}
            renderItem={renderCommunity}
            keyExtractor={(item) => item.id}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            initialNumToRender={16}
            maxToRenderPerBatch={14}
            updateCellsBatchingPeriod={30}
            windowSize={7}
            removeClippedSubviews
            getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
          />
        )}
        {mode === "assigned" && onPropertyAdded ? (
          <Pressable
            accessibilityRole="button"
            onPress={beginAddProperty}
            style={({ pressed }) => [styles.addPropertyButton, pressed && styles.addPropertyPressed]}
          >
            <View style={styles.addPropertyIcon}>
              <Ionicons name="add" size={18} color={tourColors.brand} />
            </View>
            <View style={styles.addPropertyCopy}>
              <Text style={styles.addPropertyTitle}>Find or add a property</Text>
              <Text style={styles.addPropertySubtitle}>Search Tour property intelligence</Text>
            </View>
            <Ionicons name="arrow-forward" size={17} color={tourColors.textMuted} />
          </Pressable>
        ) : null}
      </>
    </BottomSheetModal>
  );
}

function PropertyRowsSkeleton({ candidate = false }: { candidate?: boolean }) {
  return (
    <View accessibilityLabel={`Loading ${candidate ? "properties" : "assigned properties"}`} style={styles.list}>
      {Array.from({ length: candidate ? 5 : SKELETON_ROWS }).map((_, index) => (
        <View key={index} style={styles.skeletonRow}>
          <Skeleton style={styles.skeletonIcon} />
          <View style={styles.skeletonBody}>
            <Skeleton style={styles.skeletonLine} />
            <Skeleton style={styles.skeletonLineShort} />
            {candidate ? <Skeleton style={styles.skeletonBadge} /> : null}
          </View>
          <Skeleton style={styles.skeletonChevron} />
        </View>
      ))}
    </View>
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
      <Text
        style={[
          styles.enrichmentText,
          enriched ? styles.enrichmentTextReady : indexed ? styles.enrichmentTextIndexed : null,
        ]}
      >
        {enriched ? "Enriched" : indexed ? "Indexed" : "Not linked"}
      </Text>
    </View>
  );
}

function CandidateBadge({ state }: { state: PropertyOnboardingCandidate["state"] }) {
  const enriched = state === "enriched";
  const indexed = state === "indexed";
  return (
    <View style={[styles.enrichmentBadge, enriched ? styles.enrichmentBadgeReady : indexed ? styles.enrichmentBadgeIndexed : null]}>
      <View style={[styles.enrichmentDot, enriched ? styles.enrichmentDotReady : indexed ? styles.enrichmentDotIndexed : null]} />
      <Text style={[styles.enrichmentText, enriched ? styles.enrichmentTextReady : indexed ? styles.enrichmentTextIndexed : null]}>
        {enriched ? "Enriched" : indexed ? "Indexed" : "New property"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: tourColors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  subtitle: {
    color: tourColors.textSec,
    fontSize: 12,
    lineHeight: 17,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f2f4f7",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f2f4f7",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    marginBottom: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#f2f4f7",
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
  listContent: {
    paddingBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    height: ROW_HEIGHT,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 11,
  },
  rowActive: {
    backgroundColor: "#eef5ff",
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
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",
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
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "800",
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
    backgroundColor: "#dbeafe",
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  rowName: {
    color: tourColors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  rowAlias: {
    color: tourColors.textSec,
    fontSize: 12,
    fontWeight: "600",
  },
  rowMetadata: {
    minHeight: 17,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 2,
  },
  rowAction: { width: 24, height: 24 },
  activeCheck: { width: 24, height: 24, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: tourColors.brand },
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
  enrichmentText: { color: "#667085", fontSize: 9, lineHeight: 12, fontWeight: "800" },
  enrichmentTextReady: { color: "#067647" },
  enrichmentTextIndexed: { color: "#175cd3" },
  empty: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 32,
  },
  emptyTitle: {
    color: tourColors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  emptySub: {
    color: tourColors.textSec,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 17,
  },
  searchPrompt: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 28,
    paddingBottom: 20,
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
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  confirmAddress: {
    maxWidth: 340,
    marginTop: 5,
    color: tourColors.textSec,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
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
  alreadyAssignedBadgeText: { color: "#067647", fontSize: 9, fontWeight: "800" },
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
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700",
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
  confirmButtonText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  confirmFootnote: {
    marginTop: 9,
    color: tourColors.textMuted,
    fontSize: 9,
    lineHeight: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  searchPromptIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef4ff",
  },
  searchPromptText: {
    maxWidth: 320,
    color: tourColors.textSec,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    fontWeight: "600",
  },
  loadingSearch: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingSearchText: {
    color: tourColors.textSec,
    fontSize: 12,
    fontWeight: "700",
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
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700",
  },
  retryButton: {
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 9,
    backgroundColor: "#eef4ff",
  },
  retryText: { color: tourColors.brand, fontSize: 12, fontWeight: "800" },
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
    fontSize: 10,
    fontWeight: "700",
  },
  addPropertyButton: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginTop: 8,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: "#e9edf3",
    backgroundColor: tourColors.card,
  },
  addPropertyPressed: { opacity: 0.72 },
  addPropertyIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: "#e6efff",
  },
  addPropertyCopy: { flex: 1, gap: 2 },
  addPropertyTitle: { color: tourColors.text, fontSize: 13, fontWeight: "800" },
  addPropertySubtitle: { color: tourColors.textSec, fontSize: 11, fontWeight: "600" },
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
  skeletonBadge: {
    width: 52,
    height: 16,
    borderRadius: 8,
  },
  skeletonChevron: {
    width: 16,
    height: 16,
    marginLeft: 10,
    borderRadius: 8,
  },
});
