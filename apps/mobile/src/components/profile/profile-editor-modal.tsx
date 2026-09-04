import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import { Keyboard, Modal, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { MobileAuthSession } from "../../auth";
import { CustomText } from "@/components/custom-text";
import { LiquidGlassTextButton } from "@/components/liquid-glass-text-button";
import { ProfileEditorForm } from "@/components/profile/profile-editor-screen";
import { BACKGROUND, TEXT } from "@/theme/tokens";

const SHEET_GUTTER = 12;
const HEADER_TOP = 6;
const BAR_HEIGHT = 56;
const FADE_HEIGHT = 56;
const FADE_COLORS = [
  BACKGROUND,
  "rgba(242, 242, 247, 0.62)",
  "rgba(242, 242, 247, 0)",
] as const;
const FADE_LOCATIONS = [0, 0.5, 1] as const;

export function ProfileEditorModal({
  visible,
  session,
  onClose,
  onSaved,
}: {
  visible: boolean;
  session: MobileAuthSession;
  onClose: () => void;
  onSaved: (next: MobileAuthSession) => void;
}) {
  const insets = useSafeAreaInsets();
  const saveActionRef = useRef<(() => Promise<boolean>) | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [saveState, setSaveState] = useState({ dirty: false, saving: false });
  const headerHeight = HEADER_TOP + BAR_HEIGHT + FADE_HEIGHT;
  const saveDisabled = !saveState.dirty || saveState.saving;

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

  async function handleSave() {
    const ok = await saveActionRef.current?.();
    if (ok) onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      allowSwipeDismissal
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: HEADER_TOP + BAR_HEIGHT + 8,
              paddingBottom: Math.max(insets.bottom, 16) + keyboardHeight,
            },
          ]}
        >
          {visible ? (
            <ProfileEditorForm
              session={session}
              onSaved={onSaved}
              appearance="modal"
              showPreview={false}
              showStartTour={false}
              showSaveButton={false}
              saveActionRef={saveActionRef}
              onSaveStateChange={setSaveState}
            />
          ) : null}
        </ScrollView>
        <View pointerEvents="box-none" style={[styles.headerWrap, { height: headerHeight }]}>
          <LinearGradient
            colors={[...FADE_COLORS]}
            locations={[...FADE_LOCATIONS]}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
          />
          <View pointerEvents="box-none" style={styles.titleRow}>
            <View pointerEvents="box-none" style={styles.side}>
              <LiquidGlassTextButton label="Cancel" onPress={onClose} />
            </View>
            <CustomText textStyle="title" numberOfLines={1} style={styles.title}>
              Your profile
            </CustomText>
            <View pointerEvents="box-none" style={[styles.side, styles.sideEnd]}>
              <LiquidGlassTextButton
                label="Save"
                variant="accent"
                disabled={saveDisabled}
                loading={saveState.saving}
                accessibilityLabel="Save profile"
                onPress={() => void handleSave()}
              />
            </View>
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
    zIndex: 20,
    overflow: "visible",
    backgroundColor: "transparent",
  },
  titleRow: {
    minHeight: BAR_HEIGHT,
    marginTop: HEADER_TOP,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SHEET_GUTTER,
    overflow: "visible",
    zIndex: 2,
  },
  side: {
    minWidth: 88,
    overflow: "visible",
  },
  sideEnd: {
    alignItems: "flex-end",
  },
  title: {
    flex: 1,
    color: TEXT,
    textAlign: "center",
  },
  scroll: {
    flexGrow: 1,
  },
});
