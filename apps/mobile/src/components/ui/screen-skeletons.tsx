import React from "react";
import { StyleSheet, View } from "react-native";

import { Skeleton } from "./skeleton";

function SkeletonGroup({ children }: { children: React.ReactNode }) {
  return <View>{children}</View>;
}

function SessionCardSkeleton({ description = true }: { description?: boolean }) {
  return (
    <View style={styles.sessionCard}>
      <View style={styles.sessionCopy}>
        <Skeleton style={styles.sessionTitle} />
        <Skeleton style={styles.sessionMeta} />
        {description ? <Skeleton style={styles.sessionDescription} /> : null}
      </View>
      <View style={styles.sessionAside}>
        <Skeleton style={styles.statusPill} />
        <Skeleton style={styles.score} />
      </View>
    </View>
  );
}

export function DashboardDataSkeleton() {
  return (
    <SkeletonGroup>
      <View accessibilityLabel="Loading dashboard" style={styles.dashboard}>
        <View style={styles.sectionHeading}>
          <Skeleton style={styles.sectionTitle} />
          <Skeleton style={styles.sectionAction} />
        </View>
        <SessionCardSkeleton />
        <View style={[styles.sectionHeading, styles.assetHeading]}>
          <Skeleton style={styles.assetTitle} />
          <Skeleton style={styles.sectionAction} />
        </View>
        <View style={styles.assetCard}>
          <Skeleton style={styles.assetIcon} />
          <View style={styles.assetCopy}>
            <Skeleton style={styles.assetLine} />
            <Skeleton style={styles.assetSubline} />
          </View>
          <Skeleton style={styles.chevron} />
        </View>
      </View>
    </SkeletonGroup>
  );
}

export function SessionsListSkeleton() {
  return (
    <SkeletonGroup>
      <View accessibilityLabel="Loading sessions" style={styles.list}>
        <View style={styles.filterRow}>
          <Skeleton style={styles.filterChip} />
          <Skeleton style={styles.filterChipWide} />
          <Skeleton style={styles.filterChip} />
        </View>
        <SessionCardSkeleton />
        <SessionCardSkeleton />
        <SessionCardSkeleton description={false} />
        <SessionCardSkeleton />
      </View>
    </SkeletonGroup>
  );
}

export function CalendarScreenSkeleton() {
  return (
    <SkeletonGroup>
      <View accessibilityLabel="Loading calendar" style={styles.calendar}>
        <Skeleton style={styles.pageTitle} />
        <Skeleton style={styles.pageSubtitle} />
        <View style={styles.integrationStrip}>
          <Skeleton style={styles.integrationIcon} />
          <View style={styles.integrationCopy}>
            <Skeleton style={styles.integrationTitle} />
            <Skeleton style={styles.integrationSubtitle} />
          </View>
          <Skeleton style={styles.livePill} />
        </View>
        <View style={styles.sectionHeading}>
          <Skeleton style={styles.sectionTitle} />
          <Skeleton style={styles.sectionAction} />
        </View>
        <SessionCardSkeleton description={false} />
        <View style={styles.calendarCard}>
          <View style={styles.calendarNav}>
            <Skeleton style={styles.calendarArrow} />
            <Skeleton style={styles.monthTitle} />
            <Skeleton style={styles.calendarArrow} />
          </View>
          <View style={styles.weekdays}>
            {Array.from({ length: 7 }, (_, index) => <Skeleton key={`week-${index}`} style={styles.weekday} />)}
          </View>
          {Array.from({ length: 5 }, (_, row) => (
            <View key={`week-row-${row}`} style={styles.days}>
              {Array.from({ length: 7 }, (_, day) => <Skeleton key={`day-${row}-${day}`} style={styles.day} />)}
            </View>
          ))}
        </View>
      </View>
    </SkeletonGroup>
  );
}

export function MaterialsGridSkeleton() {
  return (
    <SkeletonGroup>
      <View accessibilityLabel="Loading assets" style={styles.assetGrid}>
        {Array.from({ length: 6 }, (_, index) => (
          <View key={`asset-${index}`} style={styles.assetTile}>
            <Skeleton style={styles.assetThumbnail} />
            <Skeleton style={styles.assetName} />
            <Skeleton style={styles.assetMeta} />
          </View>
        ))}
      </View>
    </SkeletonGroup>
  );
}

export function ProfileEditorSkeleton({ showForm = true }: { showForm?: boolean }) {
  return (
    <SkeletonGroup>
      <View accessibilityLabel="Loading profile" style={styles.profile}>
        <View style={styles.profileCard}>
          <Skeleton style={styles.profileHeader} />
          <Skeleton style={styles.profileAvatar} />
          <Skeleton style={styles.profileName} />
          <Skeleton style={styles.profileRole} />
          <Skeleton style={styles.profileContact} />
          <Skeleton style={styles.profileContactShort} />
          <Skeleton style={styles.profileCta} />
        </View>
        {showForm ? (
          <View style={styles.profileForm}>
            <Skeleton style={styles.formTitle} />
            <Skeleton style={styles.formField} />
            <Skeleton style={styles.formField} />
            <Skeleton style={styles.formField} />
          </View>
        ) : null}
      </View>
    </SkeletonGroup>
  );
}

export function SessionAiChatSkeleton() {
  return (
    <SkeletonGroup>
      <View accessibilityLabel="Loading Tour AI" style={styles.chat}>
        <View style={styles.promptRow}>
          <Skeleton style={styles.promptPill} />
          <Skeleton style={styles.promptPillWide} />
          <Skeleton style={styles.promptPill} />
        </View>
        <View style={[styles.message, styles.assistantMessage]}>
          <Skeleton style={styles.messageLine} />
          <Skeleton style={styles.messageLineLong} />
          <Skeleton style={styles.messageLineMedium} />
        </View>
        <View style={[styles.message, styles.userMessage]}>
          <Skeleton style={styles.userLine} />
        </View>
        <View style={[styles.message, styles.assistantMessage]}>
          <Skeleton style={styles.messageLineLong} />
          <Skeleton style={styles.messageLine} />
        </View>
        <View style={styles.chatInput}>
          <Skeleton style={styles.inputLine} />
          <Skeleton style={styles.sendButton} />
        </View>
      </View>
    </SkeletonGroup>
  );
}

function CommentSkeleton({ reply = false }: { reply?: boolean }) {
  return (
    <View style={[styles.commentCard, reply && styles.commentReply]}>
      <View style={styles.commentHeader}>
        <Skeleton style={styles.commentAvatar} />
        <Skeleton style={styles.commentAuthor} />
        <Skeleton style={styles.commentKind} />
        <Skeleton style={styles.commentTime} />
      </View>
      <Skeleton style={styles.commentLineLong} />
      <Skeleton style={styles.commentLineMedium} />
    </View>
  );
}

export function CommentsSkeleton() {
  return (
    <SkeletonGroup>
      <View accessibilityLabel="Loading comments" style={styles.comments}>
        <View style={styles.commentComposer}>
          <Skeleton style={styles.commentInput} />
          <Skeleton style={styles.commentAction} />
        </View>
        <CommentSkeleton />
        <CommentSkeleton reply />
        <CommentSkeleton />
      </View>
    </SkeletonGroup>
  );
}

function RubricTileSkeleton() {
  return (
    <View style={styles.rubricTile}>
      <Skeleton style={styles.rubricTileIcon} />
      <View style={styles.rubricTileCopy}>
        <Skeleton style={styles.rubricTileTitle} />
        <Skeleton style={styles.rubricTileMeta} />
      </View>
      <Skeleton style={styles.rubricTileCount} />
    </View>
  );
}

export function RubricsSkeleton() {
  return (
    <SkeletonGroup>
      <View accessibilityLabel="Loading rubrics" style={styles.rubrics}>
        <View style={styles.rubricDefault}>
          <Skeleton style={styles.rubricDefaultIcon} />
          <View style={styles.rubricDefaultCopy}>
            <Skeleton style={styles.rubricDefaultTitle} />
            <Skeleton style={styles.rubricDefaultMeta} />
            <Skeleton style={styles.rubricDefaultMetaShort} />
          </View>
          <Skeleton style={styles.chevron} />
        </View>
        <Skeleton style={styles.rubricsLabel} />
        <View style={styles.rubricGrid}>
          <RubricTileSkeleton />
          <RubricTileSkeleton />
          <RubricTileSkeleton />
          <RubricTileSkeleton />
        </View>
      </View>
    </SkeletonGroup>
  );
}

export function SessionReportSkeleton() {
  return (
    <SkeletonGroup>
      <View accessibilityLabel="Loading session report" style={styles.report}>
        <Skeleton style={styles.reportEyebrow} />
        <Skeleton style={styles.reportTitle} />
        <Skeleton style={styles.reportTitleShort} />
        <Skeleton style={styles.reportCopy} />
        <Skeleton style={styles.reportCopyShort} />
        <View style={styles.reportPaper}>
          <View style={styles.reportPaperHeader}>
            <Skeleton style={styles.reportLogo} />
            <Skeleton style={styles.reportPrivatePill} />
          </View>
          <Skeleton style={styles.reportRule} />
          <Skeleton style={styles.reportKicker} />
          <Skeleton style={styles.reportHeading} />
          <Skeleton style={styles.reportMeta} />
          <View style={styles.reportScorePanel}>
            <Skeleton style={styles.reportScoreOrb} />
            <View style={styles.reportScoreCopy}>
              <Skeleton style={styles.reportScoreTitle} />
              <Skeleton style={styles.reportScoreLine} />
              <Skeleton style={styles.reportScoreLineShort} />
            </View>
          </View>
          <View style={styles.reportFacts}>
            <Skeleton style={styles.reportFact} />
            <Skeleton style={styles.reportFact} />
          </View>
        </View>
        <Skeleton style={styles.reportAction} />
      </View>
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  dashboard: { gap: 14 },
  list: { gap: 10, paddingTop: 4 },
  calendar: { gap: 14 },
  sectionHeading: { minHeight: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { width: 138, height: 18, borderRadius: 7 },
  sectionAction: { width: 38, height: 12, borderRadius: 6 },
  assetHeading: { marginTop: 10 },
  assetTitle: { width: 58, height: 18, borderRadius: 7 },
  sessionCard: { minHeight: 98, flexDirection: "row", gap: 12, padding: 14, borderWidth: 1, borderColor: "#e5eaf1", borderRadius: 16, backgroundColor: "#fff" },
  sessionCopy: { flex: 1, gap: 9 },
  sessionTitle: { width: "78%", height: 14, borderRadius: 6 },
  sessionMeta: { width: "54%", height: 10, borderRadius: 5 },
  sessionDescription: { width: "90%", height: 10, borderRadius: 5 },
  sessionAside: { width: 44, alignItems: "flex-end", gap: 14 },
  statusPill: { width: 42, height: 18, borderRadius: 9 },
  score: { width: 26, height: 18, borderRadius: 6 },
  assetCard: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderWidth: 1, borderColor: "#e5eaf1", borderRadius: 18, backgroundColor: "#fff" },
  assetIcon: { width: 42, height: 42, borderRadius: 13 },
  assetCopy: { flex: 1, gap: 8 },
  assetLine: { width: "58%", height: 13, borderRadius: 6 },
  assetSubline: { width: "78%", height: 10, borderRadius: 5 },
  chevron: { width: 16, height: 16, borderRadius: 8 },
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 2 },
  filterChip: { width: 54, height: 32, borderRadius: 16 },
  filterChipWide: { width: 96, height: 32, borderRadius: 16 },
  pageTitle: { width: 124, height: 30, borderRadius: 10 },
  pageSubtitle: { width: 176, height: 13, borderRadius: 6, marginTop: -8 },
  integrationStrip: { minHeight: 74, flexDirection: "row", alignItems: "center", gap: 12, padding: 13, borderWidth: 1, borderColor: "#e5eaf1", borderRadius: 16, backgroundColor: "#fff" },
  integrationIcon: { width: 38, height: 38, borderRadius: 12 },
  integrationCopy: { flex: 1, gap: 7 },
  integrationTitle: { width: 106, height: 12, borderRadius: 6 },
  integrationSubtitle: { width: "84%", height: 10, borderRadius: 5 },
  livePill: { width: 42, height: 19, borderRadius: 10 },
  calendarCard: { gap: 13, padding: 16, borderWidth: 1, borderColor: "#e5eaf1", borderRadius: 18, backgroundColor: "#fff" },
  calendarNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  calendarArrow: { width: 23, height: 23, borderRadius: 12 },
  monthTitle: { width: 114, height: 16, borderRadius: 7 },
  weekdays: { flexDirection: "row", justifyContent: "space-between" },
  weekday: { width: 22, height: 9, borderRadius: 5 },
  days: { flexDirection: "row", justifyContent: "space-between" },
  day: { width: 30, height: 30, borderRadius: 15 },
  assetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingTop: 2 },
  assetTile: { width: "48%", gap: 8 },
  assetThumbnail: { width: "100%", aspectRatio: 4 / 3, borderRadius: 14 },
  assetName: { width: "78%", height: 13, borderRadius: 6 },
  assetMeta: { width: "56%", height: 10, borderRadius: 5 },
  profile: { gap: 14 },
  profileCard: { alignItems: "center", gap: 9, overflow: "hidden", paddingBottom: 18, borderWidth: 1, borderColor: "#e5eaf1", borderRadius: 24, backgroundColor: "#fff" },
  profileHeader: { alignSelf: "stretch", height: 76, borderRadius: 0 },
  profileAvatar: { width: 64, height: 64, marginTop: -40, borderRadius: 32 },
  profileName: { width: 136, height: 20, borderRadius: 8 },
  profileRole: { width: 108, height: 12, borderRadius: 6 },
  profileContact: { width: "70%", height: 11, borderRadius: 5, marginTop: 3 },
  profileContactShort: { width: "52%", height: 11, borderRadius: 5 },
  profileCta: { width: "82%", height: 40, borderRadius: 12, marginTop: 7 },
  profileForm: { gap: 12, padding: 16, borderWidth: 1, borderColor: "#e5eaf1", borderRadius: 18, backgroundColor: "#fff" },
  formTitle: { width: 108, height: 16, borderRadius: 7 },
  formField: { width: "100%", height: 54, borderRadius: 12 },
  chat: { flex: 1, gap: 12, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 22 },
  promptRow: { flexDirection: "row", gap: 8 },
  promptPill: { width: 78, height: 30, borderRadius: 15 },
  promptPillWide: { width: 112, height: 30, borderRadius: 15 },
  message: { gap: 8, padding: 14, borderRadius: 16 },
  assistantMessage: { alignSelf: "flex-start", width: "86%", backgroundColor: "#fff" },
  userMessage: { alignSelf: "flex-end", width: "58%", backgroundColor: "#edf5ff" },
  messageLine: { width: "68%", height: 11, borderRadius: 5 },
  messageLineLong: { width: "94%", height: 11, borderRadius: 5 },
  messageLineMedium: { width: "80%", height: 11, borderRadius: 5 },
  userLine: { width: "82%", height: 11, borderRadius: 5, alignSelf: "flex-end" },
  chatInput: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: "auto", padding: 10, borderWidth: 1, borderColor: "#e5eaf1", borderRadius: 18, backgroundColor: "#fff" },
  inputLine: { flex: 1, height: 12, borderRadius: 6 },
  sendButton: { width: 32, height: 32, borderRadius: 16 },
  comments: { gap: 12 },
  commentComposer: { gap: 12, padding: 14, borderWidth: 1, borderColor: "#e5eaf1", borderRadius: 12, backgroundColor: "#fff" },
  commentInput: { width: "100%", height: 60, borderRadius: 8 },
  commentAction: { alignSelf: "stretch", height: 42, borderRadius: 8 },
  commentCard: { gap: 9, padding: 14, borderWidth: 1, borderColor: "#e5eaf1", borderRadius: 12, backgroundColor: "#fff" },
  commentReply: { marginLeft: 28, borderLeftWidth: 2, borderLeftColor: "#dbeafe" },
  commentHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  commentAvatar: { width: 28, height: 28, borderRadius: 14 },
  commentAuthor: { width: 64, height: 12, borderRadius: 6 },
  commentKind: { width: 54, height: 18, borderRadius: 9 },
  commentTime: { width: 38, height: 10, borderRadius: 5, marginLeft: "auto" },
  commentLineLong: { width: "92%", height: 12, borderRadius: 6 },
  commentLineMedium: { width: "68%", height: 12, borderRadius: 6 },
  rubrics: { gap: 14, paddingTop: 6 },
  rubricDefault: { minHeight: 118, flexDirection: "row", alignItems: "center", gap: 13, padding: 16, borderWidth: 1, borderColor: "#e9d5ff", borderRadius: 16, backgroundColor: "#fbf7ff" },
  rubricDefaultIcon: { width: 50, height: 50, borderRadius: 16 },
  rubricDefaultCopy: { flex: 1, gap: 8 },
  rubricDefaultTitle: { width: "80%", height: 17, borderRadius: 7 },
  rubricDefaultMeta: { width: "92%", height: 11, borderRadius: 5 },
  rubricDefaultMetaShort: { width: "48%", height: 11, borderRadius: 5 },
  rubricsLabel: { width: 76, height: 15, borderRadius: 6, marginTop: 4 },
  rubricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  rubricTile: { width: "48%", minHeight: 146, justifyContent: "space-between", gap: 12, padding: 13, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 14, backgroundColor: "#fff" },
  rubricTileIcon: { width: 40, height: 40, borderRadius: 8 },
  rubricTileCopy: { gap: 7 },
  rubricTileTitle: { width: "88%", height: 13, borderRadius: 6 },
  rubricTileMeta: { width: "65%", height: 10, borderRadius: 5 },
  rubricTileCount: { width: "46%", height: 10, borderRadius: 5 },
  report: { gap: 12 },
  reportEyebrow: { width: 88, height: 10, borderRadius: 5 },
  reportTitle: { width: "92%", height: 29, borderRadius: 9 },
  reportTitleShort: { width: "66%", height: 29, borderRadius: 9, marginTop: -6 },
  reportCopy: { width: "94%", height: 12, borderRadius: 6, marginTop: 2 },
  reportCopyShort: { width: "72%", height: 12, borderRadius: 6 },
  reportPaper: { minHeight: 430, gap: 13, marginTop: 6, padding: 22, borderWidth: 1, borderColor: "#e5eaf1", borderRadius: 18, backgroundColor: "#fff" },
  reportPaperHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  reportLogo: { width: 72, height: 18, borderRadius: 7 },
  reportPrivatePill: { width: 78, height: 20, borderRadius: 10 },
  reportRule: { width: "100%", height: 1, borderRadius: 0, marginVertical: 5 },
  reportKicker: { width: 88, height: 10, borderRadius: 5 },
  reportHeading: { width: "82%", height: 23, borderRadius: 8 },
  reportMeta: { width: "58%", height: 10, borderRadius: 5 },
  reportScorePanel: { minHeight: 108, flexDirection: "row", alignItems: "center", gap: 15, marginTop: 6, padding: 15, borderRadius: 14, backgroundColor: "#f8fafc" },
  reportScoreOrb: { width: 78, height: 78, borderRadius: 39 },
  reportScoreCopy: { flex: 1, gap: 8 },
  reportScoreTitle: { width: "48%", height: 16, borderRadius: 7 },
  reportScoreLine: { width: "96%", height: 10, borderRadius: 5 },
  reportScoreLineShort: { width: "70%", height: 10, borderRadius: 5 },
  reportFacts: { flexDirection: "row", gap: 9 },
  reportFact: { flex: 1, height: 98, borderRadius: 14 },
  reportAction: { width: "100%", height: 52, borderRadius: 10, marginTop: 2 },
});
