import { Ionicons } from "@expo/vector-icons";
import { rubricItemCount, rubricTotalPoints, type Rubric } from "@tour/shared";
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

import { BottomSheetModal } from "@/components/bottom-sheet-modal";
import { CustomText } from "@/components/custom-text";
import { LiquidGlassIconButton } from "@/components/liquid-glass-icon-button";
import { ACCENT, BACKGROUND, CARD, HINT, LARGE_CORNER, SMALL_CORNER } from "@/theme/tokens";

const SHEET_HEIGHT_RATIO = 0.72;
const SHEET_MAX_HEIGHT = 650;
const SHEET_GUTTER = 18;

type RubricPickerModalProps = {
  visible: boolean;
  rubrics: Rubric[];
  value: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
};

export function RubricPickerModal({
  visible,
  rubrics,
  value,
  onClose,
  onSelect,
}: RubricPickerModalProps) {
  const { height: windowHeight } = useWindowDimensions();
  const sheetHeight = Math.round(
    Math.min(windowHeight * SHEET_HEIGHT_RATIO, SHEET_MAX_HEIGHT),
  );

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      sheetHeight={sheetHeight}
      sheetStyle={styles.sheet}
      contentStyle={styles.listContent}
      dragHeader={
        <View style={styles.titleRow}>
          <View style={styles.headerCopy}>
            <CustomText textStyle="hero">Choose a Rubric</CustomText>
          </View>
          <LiquidGlassIconButton
            icon="close"
            accessibilityLabel="Close rubric picker"
            onPress={onClose}
          />
        </View>
      }
    >
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listStack}
        showsVerticalScrollIndicator
      >
        {rubrics.map((rubric) => {
          const selected = rubric.id === value;
          return (
            <Pressable
              key={rubric.id}
              accessibilityRole="button"
              accessibilityLabel={rubric.name}
              accessibilityState={{ selected }}
              onPress={() => onSelect(rubric.id)}
              style={({ pressed }) => [
                styles.row,
                selected && styles.rowActive,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.rowIcon, selected && styles.rowIconActive]}>
                <Ionicons
                  name="clipboard-outline"
                  size={18}
                  color={selected ? ACCENT : "rgba(0, 0, 0, 0.45)"}
                />
              </View>
              <View style={styles.rowBody}>
                <CustomText textStyle="title" numberOfLines={1}>
                  {rubric.name}
                </CustomText>
                <CustomText textStyle="caption" style={styles.rowMeta}>
                  {rubric.definition.sections.length} sections ·{" "}
                  {rubricItemCount(rubric.definition)} items ·{" "}
                  {rubricTotalPoints(rubric.definition)} pts
                </CustomText>
              </View>
              {selected ? (
                <Ionicons name="checkmark-circle" size={20} color={ACCENT} />
              ) : (
                <Ionicons
                  name="chevron-forward"
                  size={17}
                  color="rgba(0, 0, 0, 0.28)"
                />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    overflow: "hidden",
    paddingTop: 2,
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
    paddingBottom: 14,
    overflow: "visible",
  },
  headerCopy: {
    flex: 1,
  },
  listContent: {
    overflow: "visible",
  },
  list: {
    flex: 1,
  },
  listStack: {
    gap: 8,
    paddingHorizontal: SHEET_GUTTER,
    paddingBottom: 22,
  },
  row: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 13,
    paddingVertical: 15,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    borderWidth: 1.5,
    borderColor: "transparent",
    backgroundColor: CARD,
  },
  rowActive: {
    borderColor: ACCENT,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef4ff",
  },
  rowIconActive: {
    backgroundColor: HINT,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowMeta: {
    marginTop: 2,
    color: "rgba(0, 0, 0, 0.45)",
  },
  pressed: {
    opacity: 0.72,
  },
});
