import type { LucideIcon } from "lucide-react-native";
import React from "react";

import { GlassNavHeader } from "@/components/glass-nav-header";
import { LiquidGlassIconButton } from "@/components/liquid-glass-icon-button";

export function TourScreenHeader({
  onBack,
  title = "",
  onMorePress,
  moreAccessibilityLabel = "More options",
  backButton,
  headerGesture,
}: {
  onBack: () => void;
  title?: string;
  subtitle?: string;
  meta?: Array<{ icon: LucideIcon; label: string }>;
  onMorePress?: () => void;
  moreAccessibilityLabel?: string;
  backButton?: React.ReactNode;
  headerGesture?: React.ComponentProps<typeof GlassNavHeader>["headerGesture"];
}) {
  return (
    <GlassNavHeader
      title={title}
      onBack={onBack}
      backButton={backButton}
      headerGesture={headerGesture}
      right={
        onMorePress ? (
          <LiquidGlassIconButton
            icon="ellipsis-horizontal"
            accessibilityLabel={moreAccessibilityLabel}
            onPress={onMorePress}
          />
        ) : undefined
      }
    />
  );
}
