import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { tourColors } from "@/theme/tour-brand";
import { LoadingDots } from "@/components/loading-dots";

type CommunityListRowProps = {
  name: string;
  subtitle?: string | null;
  active?: boolean;
  loading?: boolean;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  showBorder?: boolean;
  accessory?: React.ReactNode;
};

export function CommunityListRow({
  name,
  subtitle,
  active = false,
  loading = false,
  onPress,
  disabled,
  style,
  showBorder = true,
  accessory,
}: CommunityListRowProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.72}
      disabled={disabled}
      onPress={onPress}
      style={[styles.hit, style]}
    >
      <View style={[styles.row, showBorder && styles.rowBorder]}>
        <View style={[styles.icon, active && styles.iconActive]}>
          <Ionicons name="business-outline" size={18} color={active ? tourColors.green : tourColors.brand} />
        </View>
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {accessory}
        {loading ? (
          <LoadingDots size="small" color={tourColors.brand} />
        ) : active ? (
          <Ionicons name="checkmark-circle" size={20} color={tourColors.green} />
        ) : (
          <Ionicons name="chevron-forward" size={17} color={tourColors.textMuted} />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  hit: { width: "100%" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    minHeight: 58,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  icon: {
    width: 34,
    height: 34,
    marginRight: 11,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef2ff",
  },
  iconActive: {
    backgroundColor: tourColors.greenBg,
  },
  body: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  name: {
    color: tourColors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 2,
    color: tourColors.textSec,
    fontSize: 12,
    fontWeight: "600",
  },
});
