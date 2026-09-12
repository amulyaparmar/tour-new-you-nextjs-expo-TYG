import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CustomText } from "@/components/custom-text";
import {
  GlassNavHeader,
  glassNavContentInset,
} from "@/components/glass-nav-header";
import type { VideoTourFootageDraft } from "@/assets/VideoTourFootageScreen";
import { ACCENT, BACKGROUND, CARD, HINT, SMALL_CORNER } from "@/theme/tokens";

export function VideoTourFootageRecorderScreen({
  onBack,
}: {
  draft: VideoTourFootageDraft;
  shotId: string;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.page}>
      <View
        style={[
          styles.body,
          { paddingTop: glassNavContentInset(insets.top) },
        ]}
      >
        <View style={styles.icon}>
          <CustomText textStyle="title" style={styles.iconText}>
            Rec
          </CustomText>
        </View>
        <CustomText textStyle="hero" style={styles.centered}>
          Record footage in the mobile app
        </CustomText>
        <CustomText textStyle="body" style={styles.copy}>
          Camera recording is available in the iOS and Android app.
        </CustomText>
        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
        >
          <CustomText textStyle="title" style={styles.primaryBtnText}>
            Close
          </CustomText>
        </Pressable>
      </View>
      <GlassNavHeader title="Footage Recorder" onBack={onBack} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: BACKGROUND },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 28,
  },
  icon: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: SMALL_CORNER,
    backgroundColor: HINT,
  },
  iconText: { color: ACCENT },
  centered: { textAlign: "center" },
  copy: { color: "rgba(0, 0, 0, 0.45)", textAlign: "center", lineHeight: 20 },
  primaryBtn: {
    alignSelf: "stretch",
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    borderRadius: 25,
    backgroundColor: ACCENT,
    boxShadow: "0 6px 14px rgba(0, 108, 229, 0.28)",
  },
  primaryBtnText: { color: CARD },
  pressed: { opacity: 0.72 },
});
