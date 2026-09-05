import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Modal, StyleSheet, View } from "react-native";

import { CustomText } from "@/components/custom-text";
import { LiquidGlassIconButton } from "@/components/liquid-glass-icon-button";
import { BACKGROUND } from "@/theme/tokens";

const HEADER_TOP = 6;
const BAR_HEIGHT = 56;
const FADE_HEIGHT = 56;

export const PAGE_SHEET_HEADER_INSET = HEADER_TOP + BAR_HEIGHT + 8;

export function PageSheetModal({
  visible,
  title,
  onClose,
  leading,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  leading?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      allowSwipeDismissal
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        {children}
        <View pointerEvents="box-none" style={styles.headerWrap}>
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
          <View pointerEvents="box-none" style={styles.header}>
            {leading}
            <CustomText textStyle="hero" numberOfLines={1} style={styles.title}>
              {title}
            </CustomText>
            <LiquidGlassIconButton
              icon="close"
              accessibilityLabel={`Close ${title}`}
              onPress={onClose}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: "visible",
    backgroundColor: BACKGROUND,
  },
  headerWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_TOP + BAR_HEIGHT + FADE_HEIGHT,
    zIndex: 20,
    overflow: "visible",
    backgroundColor: "transparent",
  },
  header: {
    minHeight: BAR_HEIGHT,
    marginTop: HEADER_TOP,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    overflow: "visible",
    zIndex: 2,
  },
  title: {
    flex: 1,
  },
});
