import { Ionicons } from "@expo/vector-icons";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React, { useCallback, useState } from "react";
import {
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  formatSessionCardMeta,
  rubricItemCount,
  rubricTotalPoints,
  type Rubric,
  type SessionSummary,
} from "@tour/shared";

import type { MobileAuthSession } from "@/auth";
import { CustomText } from "@/components/custom-text";
import { EmptyStateCard } from "@/components/empty-state-card";
import {
  GlassNavHeader,
  glassNavContentInset,
} from "@/components/glass-nav-header";
import { LoadingDots } from "@/components/loading-dots";
import { MotionPressable } from "@/components/ui/motion";
import { getSiteBaseUrl } from "@/config";
import { useRubricsQuery, useSessionsQuery } from "@/queries";
import { ACCENT, BACKGROUND, CARD, HINT, SMALL_CORNER } from "@/theme/tokens";
import { tourColors as C } from "@/theme/tour-brand";

type RubricsStackParamList = {
  List: undefined;
  Detail: { rubricId: string };
};

const RubricsStack = createNativeStackNavigator<RubricsStackParamList>();

export function RubricsScreen({
  onBack,
  onSession,
}: {
  session: MobileAuthSession;
  onBack: () => void;
  onSession: (id: string) => void;
}) {
  const rubricsQuery = useRubricsQuery();
  const sessionsQuery = useSessionsQuery({ limit: 100 });
  const rubrics = rubricsQuery.data?.rubrics ?? [];
  const sessions = sessionsQuery.data?.sessions ?? [];

  function applicationsFor(rubricId: string) {
    return sessions.filter((item) => item.rubricId === rubricId);
  }

  return (
    <RubricsStack.Navigator
      initialRouteName="List"
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        gestureEnabled: true,
        contentStyle: { backgroundColor: BACKGROUND },
      }}
    >
      <RubricsStack.Screen name="List">
        {({ navigation }) => (
          <RubricsListScreen
            rubrics={rubrics}
            sessions={sessions}
            loading={rubricsQuery.isLoading || sessionsQuery.isLoading}
            error={rubricsQuery.error ?? sessionsQuery.error ?? null}
            onRefresh={async () => {
              await Promise.all([rubricsQuery.refetch(), sessionsQuery.refetch()]);
            }}
            onOpen={(rubric) => navigation.navigate("Detail", { rubricId: rubric.id })}
            onBack={onBack}
          />
        )}
      </RubricsStack.Screen>
      <RubricsStack.Screen name="Detail">
        {({ navigation, route }) => {
          const rubric = rubrics.find((item) => item.id === route.params.rubricId);
          if (!rubric) return <View style={styles.root} />;
          return (
            <RubricDetailScreen
              rubric={rubric}
              sessions={applicationsFor(rubric.id)}
              onBack={() => navigation.goBack()}
              onSession={onSession}
            />
          );
        }}
      </RubricsStack.Screen>
    </RubricsStack.Navigator>
  );
}

function RubricsListScreen({
  rubrics,
  sessions,
  loading,
  error,
  onRefresh,
  onOpen,
  onBack,
}: {
  rubrics: Rubric[];
  sessions: SessionSummary[];
  loading: boolean;
  error: unknown;
  onRefresh: () => Promise<void>;
  onOpen: (rubric: Rubric) => void;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    await onRefresh();
  }, [onRefresh]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function openRubricSettings() {
    const url = `${getSiteBaseUrl()}/rubrics`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        "Could not open Tour.you",
        `Open ${url} in your browser to manage rubric settings.`,
      );
    }
  }

  function applicationsFor(rubricId: string) {
    return sessions.filter((item) => item.rubricId === rubricId);
  }

  const defaultRubric =
    rubrics.find((rubric) => rubric.isDefault) ?? rubrics[0] ?? null;
  const listedRubrics = defaultRubric
    ? [defaultRubric, ...rubrics.filter((rubric) => rubric.id !== defaultRubric.id)]
    : rubrics;

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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={ACCENT}
          />
        }
      >
        {error ? (
          <View style={styles.error}>
            <Ionicons name="alert-circle-outline" size={18} color={C.red} />
            <CustomText textStyle="caption" style={styles.errorText}>
              {error instanceof Error ? error.message : "Could not load rubrics"}
            </CustomText>
            <MotionPressable
              accessibilityRole="button"
              haptic="selection"
              onPress={() => void load()}
              style={styles.retry}
            >
              <CustomText textStyle="label" style={styles.retryText}>
                Retry
              </CustomText>
            </MotionPressable>
          </View>
        ) : null}

        <CustomText textStyle="caption" style={styles.sectionHeader}>
          Library
        </CustomText>
        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel="Manage rubric settings on Tour.you"
          haptic="selection"
          onPress={() => void openRubricSettings()}
          style={styles.card}
        >
          <View style={styles.iconWrap}>
            <Ionicons name="open-outline" size={20} color={ACCENT} />
          </View>
          <View style={styles.flex}>
            <CustomText textStyle="title">Manage on Tour.you</CustomText>
            <CustomText textStyle="caption" style={styles.rowSub}>
              Clone templates, edit criteria, and update this property’s rubrics.
            </CustomText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
        </MotionPressable>

        {loading ? (
          <View style={styles.loading}>
            <LoadingDots color={ACCENT} />
          </View>
        ) : rubrics.length === 0 ? (
          <EmptyStateCard
            icon="clipboard-outline"
            title="No rubrics"
            subtitle="Evaluation templates will appear here."
          />
        ) : (
          <>
            <CustomText textStyle="caption" style={styles.sectionHeader}>
              All rubrics
            </CustomText>
            <View style={styles.stack}>
              {listedRubrics.map((rubric) => (
                <RubricRow
                  key={rubric.id}
                  rubric={rubric}
                  sessions={applicationsFor(rubric.id)}
                  showDefault={rubric.id === defaultRubric?.id}
                  onPress={() => onOpen(rubric)}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <GlassNavHeader title="Rubrics" onBack={onBack} />
    </View>
  );
}

function RubricDetailScreen({
  rubric,
  sessions,
  onBack,
  onSession,
}: {
  rubric: Rubric;
  sessions: SessionSummary[];
  onBack: () => void;
  onSession: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const items = rubricItemCount(rubric.definition);
  const points = rubricTotalPoints(rubric.definition);

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
        <View style={styles.stats}>
          <View style={styles.stat}>
            <CustomText textStyle="title" style={styles.statValue}>
              {items}
            </CustomText>
            <CustomText textStyle="micro" style={styles.statLabel}>
              {items === 1 ? "criterion" : "criteria"}
            </CustomText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <CustomText textStyle="title" style={styles.statValue}>
              {points}
            </CustomText>
            <CustomText textStyle="micro" style={styles.statLabel}>
              {points === 1 ? "point" : "points"}
            </CustomText>
          </View>
        </View>

        {rubric.definition.sections.map((section) => {
          const sectionPoints = section.items.reduce(
            (sum, item) => sum + item.points,
            0,
          );
          return (
            <View key={section.name}>
              <View style={styles.sectionHeading}>
                <CustomText textStyle="caption" style={styles.sectionHeaderText}>
                  {section.name}
                </CustomText>
                <CustomText textStyle="micro" style={styles.points}>
                  {sectionPoints} pts
                </CustomText>
              </View>
              <View style={styles.group}>
                {section.items.map((item, index) => (
                  <View key={item.id}>
                    {index > 0 ? <View style={styles.separator} /> : null}
                    <View style={styles.itemRow}>
                      <View style={styles.itemNumber}>
                        <CustomText textStyle="micro" style={styles.itemNumberText}>
                          {index + 1}
                        </CustomText>
                      </View>
                      <View style={styles.flex}>
                        <CustomText textStyle="body">{item.text}</CustomText>
                        {item.note ? (
                          <CustomText textStyle="caption" style={styles.itemNote}>
                            {item.note}
                          </CustomText>
                        ) : null}
                      </View>
                      <CustomText textStyle="micro" style={styles.points}>
                        {item.points}
                      </CustomText>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          );
        })}

        {rubric.definition.compliance && rubric.definition.compliance.length > 0 ? (
          <View>
            <CustomText textStyle="caption" style={styles.sectionHeader}>
              Compliance
            </CustomText>
            <View style={styles.group}>
              {rubric.definition.compliance.map((item, index) => (
                <View key={item.id}>
                  {index > 0 ? <View style={styles.separator} /> : null}
                  <View style={styles.itemRow}>
                    <View style={styles.iconWrap}>
                      <Ionicons name="shield-checkmark-outline" size={18} color={ACCENT} />
                    </View>
                    <View style={styles.flex}>
                      <CustomText textStyle="body">{item.text}</CustomText>
                      {item.note ? (
                        <CustomText textStyle="caption" style={styles.itemNote}>
                          {item.note}
                        </CustomText>
                      ) : null}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <CustomText textStyle="caption" style={styles.sectionHeader}>
          Applied tours
        </CustomText>
        {sessions.length === 0 ? (
          <EmptyStateCard
            icon="albums-outline"
            title="No applications yet"
            subtitle="Choose this rubric when starting or opening a scheduled tour."
          />
        ) : (
          <View style={styles.stack}>
            {sessions.map((item) => (
              <MotionPressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`Open ${item.title}`}
                haptic="selection"
                onPress={() => onSession(item.id)}
                style={styles.card}
              >
                <View style={styles.flex}>
                  <CustomText textStyle="title" numberOfLines={1}>
                    {item.title}
                  </CustomText>
                  <CustomText textStyle="caption" style={styles.rowSub} numberOfLines={1}>
                    {formatSessionCardMeta(item)}
                  </CustomText>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
              </MotionPressable>
            ))}
          </View>
        )}
      </ScrollView>

      <GlassNavHeader
        title={rubric.name}
        onBack={onBack}
        right={rubric.isDefault ? <DefaultBadge /> : undefined}
      />
    </View>
  );
}

function RubricRow({
  rubric,
  sessions,
  showDefault = false,
  onPress,
}: {
  rubric: Rubric;
  sessions: SessionSummary[];
  showDefault?: boolean;
  onPress: () => void;
}) {
  const count = sessions.length;
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${rubric.name}`}
      haptic="selection"
      onPress={onPress}
      style={styles.card}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="clipboard-outline" size={20} color={ACCENT} />
      </View>
      <View style={styles.flex}>
        <View style={styles.titleRow}>
          <CustomText textStyle="title" numberOfLines={2} style={styles.flex}>
            {rubric.name}
          </CustomText>
          {showDefault ? <DefaultBadge /> : null}
        </View>
        <CustomText textStyle="caption" style={styles.rowSub}>
          {rubric.definition.sections.length} sections · {rubricItemCount(rubric.definition)}{" "}
          items · {rubricTotalPoints(rubric.definition)} pts
        </CustomText>
        <CustomText textStyle="micro" style={styles.applied}>
          {count} tour{count === 1 ? "" : "s"}
        </CustomText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
    </MotionPressable>
  );
}

function DefaultBadge() {
  return (
    <View style={styles.badge}>
      <CustomText textStyle="micro" style={styles.badgeText}>
        Default
      </CustomText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BACKGROUND },
  flex: { flex: 1, minWidth: 0 },
  scroll: { paddingHorizontal: 16, gap: 0 },
  stack: { gap: 10 },
  stats: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    paddingVertical: 14,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statValue: { color: ACCENT, fontVariant: ["tabular-nums"] },
  statLabel: {
    color: C.textSec,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    marginVertical: 4,
    backgroundColor: "rgba(60, 60, 67, 0.18)",
  },
  sectionHeader: {
    color: "rgba(0, 0, 0, 0.45)",
    marginTop: 22,
    marginBottom: 8,
    paddingHorizontal: 16,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  sectionHeading: {
    marginTop: 22,
    marginBottom: 8,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionHeaderText: {
    flex: 1,
    color: "rgba(0, 0, 0, 0.45)",
    textTransform: "uppercase",
    letterSpacing: 0.4,
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
  iconWrap: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: BACKGROUND,
  },
  rowSub: { marginTop: 3, color: C.textSec },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  applied: { marginTop: 6, color: ACCENT },
  loading: { paddingVertical: 36, alignItems: "center" },
  error: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: C.redBg,
  },
  errorText: { flex: 1, color: C.red },
  retry: { paddingHorizontal: 4, paddingVertical: 4 },
  retryText: { color: ACCENT },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: HINT,
  },
  badgeText: { color: ACCENT, textTransform: "uppercase", letterSpacing: 0.3 },
  itemRow: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  itemNumber: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: HINT,
  },
  itemNumberText: { color: ACCENT, fontVariant: ["tabular-nums"] },
  itemNote: { marginTop: 4, color: C.textSec, lineHeight: 17 },
  points: { color: ACCENT, fontVariant: ["tabular-nums"] },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
    backgroundColor: "rgba(60, 60, 67, 0.18)",
  },
});
