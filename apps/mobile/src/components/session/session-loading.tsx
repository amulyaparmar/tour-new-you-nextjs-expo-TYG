import { ArrowLeft } from "lucide-react-native";
import React from "react";
import { StyleSheet, View } from "react-native";
import Reanimated, { FadeIn } from "react-native-reanimated";

import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

import { UIColors } from "@/lib/ui-colors";

import { SESSION_PAGE_PADDING } from "./session-layout";

export function SessionReviewSkeleton({ onBack }: { onBack?: () => void }) {
  return (
    <Reanimated.View entering={FadeIn.duration(220)} style={styles.root}>
      <View style={styles.header}>
        <View style={styles.navRow}>
          {onBack ? (
            <Button variant="outline" size="icon" onPress={onBack} style={styles.backBtn}>
              <Icon as={ArrowLeft} size={20} color={UIColors.foreground} />
            </Button>
          ) : (
            <Skeleton style={styles.iconSkeleton} />
          )}
          <Skeleton style={styles.brandSkeleton} />
          <View style={styles.iconSkeleton} />
        </View>

        <Skeleton style={styles.titleSkeleton} />
        <Skeleton style={styles.subtitleSkeleton} />
        <View style={styles.reportRow}>
          <Skeleton style={styles.reportIcon} />
          <View style={styles.reportCopy}>
            <Skeleton style={styles.reportTitle} />
            <Skeleton style={styles.reportSubline} />
            <Skeleton style={styles.reportSublineShort} />
          </View>
          <Skeleton style={styles.reportArrow} />
        </View>
      </View>

      <View style={styles.tabs}>
        <Skeleton style={styles.tabShort} />
        <Skeleton style={styles.tabMedium} />
        <Skeleton style={styles.tabActive} />
        <Skeleton style={styles.tabShort} />
      </View>

      <View style={styles.body}>
        <View style={styles.guidanceCard}>
          <Skeleton style={styles.guidanceIcon} />
          <View style={styles.guidanceCopy}>
            <Skeleton style={styles.guidanceLine} />
            <Skeleton style={styles.guidanceLineShort} />
          </View>
        </View>

        <View style={styles.segmentHeader}>
          <Skeleton style={styles.segmentRail} />
          <Skeleton style={styles.segmentLabel} />
          <Skeleton style={styles.segmentTime} />
        </View>

        <TranscriptTurnSkeleton first />
        <TranscriptTurnSkeleton />
        <TranscriptTurnSkeleton long />
      </View>

      <View style={styles.player}>
        <Skeleton style={styles.playerProgress} />
        <View style={styles.playerControls}>
          <Skeleton style={styles.playerSpeed} />
          <Skeleton style={styles.playerTime} />
          <Skeleton style={styles.playerButton} />
        </View>
      </View>
    </Reanimated.View>
  );
}

/** Mirrors a newly created or live session before its session record arrives. */
export function SessionLiveSkeleton({ onBack }: { onBack?: () => void }) {
  return (
    <Reanimated.View entering={FadeIn.duration(180)} style={styles.root}>
      <View style={styles.liveHeader}>
        <View style={styles.navRow}>
          {onBack ? (
            <Button variant="outline" size="icon" onPress={onBack} style={styles.backBtn}>
              <Icon as={ArrowLeft} size={20} color={UIColors.foreground} />
            </Button>
          ) : (
            <Skeleton style={styles.iconSkeleton} />
          )}
          <Skeleton style={styles.liveStatus} />
        </View>
        <Skeleton style={styles.liveTitle} />
        <Skeleton style={styles.liveTitleShort} />
        <View style={styles.liveMetaList}>
          <Skeleton style={styles.liveMetaLine} />
          <Skeleton style={styles.liveMetaLineMedium} />
          <Skeleton style={styles.liveMetaLineShort} />
        </View>
      </View>

      <View style={styles.liveBody}>
        <View style={styles.liveGuestRow}>
          <View style={styles.liveGuestAvatars}>
            <Skeleton style={styles.liveGuestAvatar} />
            <Skeleton style={styles.liveGuestAvatarOverlap} />
          </View>
          <View style={styles.liveGuestCopy}>
            <Skeleton style={styles.liveGuestName} />
            <Skeleton style={styles.liveGuestContact} />
          </View>
          <Skeleton style={styles.liveGuestState} />
        </View>

        <Skeleton style={styles.liveSectionLabel} />
        <View style={styles.liveRecordingLead}>
          <Skeleton style={styles.liveRecordingIcon} />
          <Skeleton style={styles.liveRecordingTitle} />
          <Skeleton style={styles.liveRecordingSubline} />
        </View>
        <View style={styles.liveSettingsList}>
          <View style={styles.liveSettingRow}>
            <Skeleton style={styles.liveSettingIcon} />
            <View style={styles.liveRecordingCopy}>
              <Skeleton style={styles.liveSettingTitle} />
              <Skeleton style={styles.liveSettingMeta} />
            </View>
            <Skeleton style={styles.liveSettingArrow} />
          </View>
          <View style={styles.liveSettingDivider} />
          <View style={styles.liveSettingRow}>
            <Skeleton style={styles.liveSettingIcon} />
            <View style={styles.liveRecordingCopy}>
              <Skeleton style={styles.liveSettingTitleWide} />
              <Skeleton style={styles.liveSettingMetaWide} />
            </View>
            <Skeleton style={styles.liveSettingArrow} />
          </View>
        </View>
        <Skeleton style={styles.liveSecondaryAction} />
      </View>
    </Reanimated.View>
  );
}

function TranscriptTurnSkeleton({ first = false, long = false }: { first?: boolean; long?: boolean }) {
  return (
    <View style={styles.turn}>
      <View style={styles.turnHeading}>
        <Skeleton style={styles.turnAvatar} />
        <Skeleton style={styles.turnSpeaker} />
        <Skeleton style={styles.turnTime} />
      </View>
      <Skeleton style={long ? styles.turnLineLong : styles.turnLine} />
      {long ? <Skeleton style={styles.turnLineMedium} /> : null}
      {first ? (
        <View style={styles.signalRow}>
          <Skeleton style={styles.signalPill} />
          <Skeleton style={styles.signalPillWide} />
        </View>
      ) : null}
    </View>
  );
}

/** @deprecated Use SessionReviewSkeleton */
export function SessionLoading({ label: _label = "Loading session…" }: { label?: string }) {
  return <SessionLiveSkeleton />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#f4f7fb",
    paddingTop: 50,
  },
  header: {
    gap: 14,
    paddingHorizontal: SESSION_PAGE_PADDING,
    paddingBottom: 16,
  },
  navRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: { width: 40, height: 40, borderRadius: 12 },
  iconSkeleton: { width: 40, height: 40, borderRadius: 12 },
  brandSkeleton: {
    width: 72,
    height: 18,
    borderRadius: 8,
  },
  titleSkeleton: {
    width: "84%",
    height: 48,
    borderRadius: 10,
  },
  subtitleSkeleton: {
    width: "54%",
    height: 17,
    borderRadius: 8,
  },
  reportRow: {
    minHeight: 92,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: "#cfe3ff",
    borderRadius: 24,
    backgroundColor: "#f7fbff",
  },
  reportIcon: { width: 52, height: 52, borderRadius: 18 },
  reportCopy: { flex: 1, gap: 8 },
  reportTitle: { width: "48%", height: 16, borderRadius: 7 },
  reportSubline: { width: "94%", height: 12, borderRadius: 6 },
  reportSublineShort: { width: "68%", height: 12, borderRadius: 6 },
  reportArrow: { width: 23, height: 23, borderRadius: 12 },
  tabs: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 20,
    minHeight: 56,
    paddingHorizontal: SESSION_PAGE_PADDING,
    borderBottomWidth: 1,
    borderBottomColor: "#dfe6ef",
  },
  tabShort: { width: 64, height: 18, borderRadius: 7, marginBottom: 16 },
  tabMedium: { width: 80, height: 18, borderRadius: 7, marginBottom: 16 },
  tabActive: { width: 94, height: 18, borderRadius: 7, marginBottom: 16 },
  body: {
    flex: 1,
    gap: 22,
    paddingHorizontal: SESSION_PAGE_PADDING,
    paddingTop: 16,
    paddingBottom: 160,
  },
  guidanceCard: {
    minHeight: 96,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#b9d8ff",
    borderRadius: 22,
    backgroundColor: "#eef7ff",
  },
  guidanceIcon: { width: 32, height: 32, borderRadius: 12 },
  guidanceCopy: { flex: 1, gap: 10 },
  guidanceLine: { width: "94%", height: 15, borderRadius: 7 },
  guidanceLineShort: { width: "64%", height: 15, borderRadius: 7 },
  segmentHeader: { minHeight: 28, flexDirection: "row", alignItems: "center", gap: 12 },
  segmentRail: { width: 8, height: 28, borderRadius: 4 },
  segmentLabel: { flex: 1, height: 16, borderRadius: 7 },
  segmentTime: { width: 52, height: 16, borderRadius: 7 },
  turn: { gap: 12, paddingLeft: 36 },
  turnHeading: { flexDirection: "row", alignItems: "center", gap: 12, marginLeft: -36 },
  turnAvatar: { width: 28, height: 28, borderRadius: 14 },
  turnSpeaker: { width: 72, height: 16, borderRadius: 7 },
  turnTime: { width: 46, height: 14, borderRadius: 6, marginLeft: "auto" },
  turnLine: { width: "46%", height: 25, borderRadius: 10 },
  turnLineLong: { width: "94%", height: 22, borderRadius: 10 },
  turnLineMedium: { width: "72%", height: 22, borderRadius: 10 },
  signalRow: { flexDirection: "row", gap: 8 },
  signalPill: { width: 82, height: 28, borderRadius: 14 },
  signalPillWide: { width: 126, height: 28, borderRadius: 14 },
  player: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    gap: 20,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 26,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#fff",
  },
  playerProgress: { width: "100%", height: 8, borderRadius: 4 },
  playerControls: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  playerSpeed: { width: 32, height: 22, borderRadius: 8 },
  playerTime: { width: 116, height: 22, borderRadius: 8 },
  playerButton: { width: 58, height: 58, borderRadius: 29 },
  liveHeader: {
    gap: 14,
    paddingHorizontal: SESSION_PAGE_PADDING,
    paddingBottom: 18,
  },
  liveStatus: { width: 94, height: 28, borderRadius: 14 },
  liveTitle: { width: "94%", height: 42, borderRadius: 10 },
  liveTitleShort: { width: "63%", height: 42, borderRadius: 10, marginTop: -4 },
  liveMetaList: { gap: 10, paddingTop: 2 },
  liveMetaLine: { width: "58%", height: 16, borderRadius: 7 },
  liveMetaLineMedium: { width: "46%", height: 16, borderRadius: 7 },
  liveMetaLineShort: { width: "70%", height: 16, borderRadius: 7 },
  liveBody: {
    flex: 1,
    gap: 14,
    paddingHorizontal: SESSION_PAGE_PADDING,
    paddingTop: 10,
  },
  liveSectionLabel: { width: 76, height: 13, borderRadius: 6, marginTop: 6 },
  liveGuestRow: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#e7edf5",
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  liveGuestAvatars: { flexDirection: "row", alignItems: "center", paddingRight: 2 },
  liveGuestAvatar: { width: 34, height: 34, borderRadius: 17 },
  liveGuestAvatarOverlap: { width: 34, height: 34, borderRadius: 17, marginLeft: -10, borderWidth: 2, borderColor: "#fff" },
  liveGuestCopy: { flex: 1, gap: 7 },
  liveGuestName: { width: "58%", height: 15, borderRadius: 7 },
  liveGuestContact: { width: "68%", height: 12, borderRadius: 6 },
  liveGuestState: { width: 26, height: 26, borderRadius: 13 },
  liveRecordingLead: { alignItems: "center", gap: 10, paddingVertical: 12 },
  liveRecordingIcon: { width: 88, height: 88, borderRadius: 44 },
  liveRecordingCopy: { flex: 1, gap: 7 },
  liveRecordingTitle: { width: 118, height: 18, borderRadius: 7 },
  liveRecordingSubline: { width: 214, height: 13, borderRadius: 6 },
  liveSettingsList: { overflow: "hidden", borderWidth: 1, borderColor: "#e7edf5", borderRadius: 12, backgroundColor: "#fff" },
  liveSettingRow: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 13, paddingVertical: 9 },
  liveSettingIcon: { width: 34, height: 34, borderRadius: 10 },
  liveSettingTitle: { width: "38%", height: 14, borderRadius: 6 },
  liveSettingTitleWide: { width: "68%", height: 14, borderRadius: 6 },
  liveSettingMeta: { width: "72%", height: 11, borderRadius: 5 },
  liveSettingMetaWide: { width: "86%", height: 11, borderRadius: 5 },
  liveSettingArrow: { width: 17, height: 17, borderRadius: 8 },
  liveSettingDivider: { height: 1, marginLeft: 58, backgroundColor: "#e7edf5" },
  liveSecondaryAction: { width: "32%", height: 14, borderRadius: 7, alignSelf: "center", marginTop: 2 },
});
