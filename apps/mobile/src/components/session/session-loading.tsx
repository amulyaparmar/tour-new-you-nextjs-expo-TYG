import React from "react";
import { StyleSheet, View } from "react-native";
import Reanimated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GlassNavHeader, glassNavContentInset } from "@/components/glass-nav-header";
import { Skeleton } from "@/components/ui/skeleton";
import { BACKGROUND, SMALL_CORNER } from "@/theme/tokens";

import { SESSION_PAGE_PADDING, SESSION_SECTION_GAP } from "./session-layout";

export function SessionReviewSkeleton({ onBack }: { onBack?: () => void }) {
  const insets = useSafeAreaInsets();

  return (
    <Reanimated.View entering={FadeIn.duration(220)} style={styles.root}>
      <View
        style={[
          styles.body,
          { paddingTop: glassNavContentInset(insets.top) },
        ]}
      >
        <Skeleton style={styles.cardSkeleton} />
        <Skeleton style={styles.cardSkeletonTall} />
        <Skeleton style={styles.cardSkeleton} />
        <Skeleton style={styles.cardSkeletonTall} />
      </View>
      <GlassNavHeader title="Session" onBack={onBack} />
    </Reanimated.View>
  );
}

/** @deprecated Use SessionReviewSkeleton */
export function SessionLoading({ label: _label = "Loading session…" }: { label?: string }) {
  return <SessionReviewSkeleton />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  body: {
    flex: 1,
    gap: SESSION_SECTION_GAP,
    paddingHorizontal: SESSION_PAGE_PADDING,
    paddingBottom: 120,
  },
  cardSkeleton: {
    width: "100%",
    height: 96,
    borderRadius: SMALL_CORNER,
  },
  cardSkeletonTall: {
    width: "100%",
    height: 168,
    borderRadius: SMALL_CORNER,
  },
});
