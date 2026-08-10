import * as Haptics from "expo-haptics";

export function selectionHaptic() {
  void Haptics.selectionAsync().catch(() => undefined);
}

export function impactHaptic(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  void Haptics.impactAsync(style).catch(() => undefined);
}

let lastTypingHapticAt = 0;

/** A quiet typing response that cannot overwhelm the device during fast input. */
export function typingHaptic() {
  const now = Date.now();
  if (now - lastTypingHapticAt < 80) return;
  lastTypingHapticAt = now;
  void Haptics.selectionAsync().catch(() => undefined);
}
