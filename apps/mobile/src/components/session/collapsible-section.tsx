import { ChevronDown } from "lucide-react-native";
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Reanimated, { FadeInDown } from "react-native-reanimated";

import { CustomText } from "@/components/custom-text";
import { Icon } from "@/components/ui/icon";
import { CARD, SMALL_CORNER } from "@/theme/tokens";
import { tourColors as C } from "@/theme/tour-brand";

export function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => setOpen((value) => !value)}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
      >
        <CustomText textStyle="title" style={styles.title}>
          {title}
        </CustomText>
        <Icon
          as={ChevronDown}
          size={18}
          color={C.textMuted}
          style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}
        />
      </Pressable>
      {open ? (
        <Reanimated.View entering={FadeInDown.duration(180)} style={styles.body}>
          {children}
        </Reanimated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  header: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  title: {
    flex: 1,
  },
  body: {
    gap: 10,
    padding: 14,
    paddingTop: 0,
  },
  pressed: {
    opacity: 0.78,
  },
});
