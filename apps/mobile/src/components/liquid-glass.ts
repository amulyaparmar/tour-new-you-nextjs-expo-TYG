import { requireNativeViewManager, requireOptionalNativeModule } from "expo-modules-core";

type ExpoGlassEffectNative = {
  isLiquidGlassAvailable?: boolean;
  isGlassEffectAPIAvailable?: boolean;
};

export function getLiquidGlassView() {
  const native = requireOptionalNativeModule("ExpoGlassEffect") as ExpoGlassEffectNative | null;
  if (!native?.isLiquidGlassAvailable || !native?.isGlassEffectAPIAvailable) return null;
  try {
    return requireNativeViewManager("ExpoGlassEffect", "GlassView");
  } catch {
    return null;
  }
}
