import { Sparkles } from "lucide-react-native";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { selectionHaptic } from "@/lib/haptics";
import { tourColors } from "@/theme/tour-brand";

const FAB_HEIGHT = 40;
const EDGE_PAD = 18;

export function SessionAiFab({
  onPress,
  bottomOffset,
}: {
  onPress: () => void;
  bottomOffset: number;
}) {
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: bottomOffset }]}>
      <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ask Tour AI about this session"
          onPress={() => {
            selectionHaptic();
            onPress();
          }}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
        <Icon as={Sparkles} size={15} color={tourColors.ai} />
        <Text style={styles.text}>Ask Tour AI</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    right: EDGE_PAD,
    zIndex: 20,
  },
  button: {
    minHeight: FAB_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 11,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: tourColors.aiBorder,
    backgroundColor: tourColors.aiBg,
  },
  text: {
    color: tourColors.ai,
    fontSize: 12,
    fontWeight: "900",
  },
  pressed: { opacity: 0.72 },
});
