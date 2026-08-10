import * as Haptics from "expo-haptics";

export function selectionHaptic() {
  void Haptics.selectionAsync().catch(() => undefined);
}

export function impactHaptic(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  void Haptics.impactAsync(style).catch(() => undefined);
}

function playQuickHapticPattern(count: number, intervalMs: number) {
  for (let index = 0; index < count; index += 1) {
    setTimeout(() => {
      void Haptics.selectionAsync().catch(() => undefined);
    }, index * intervalMs);
  }
}

/** Three light taps as Tour AI begins speaking. */
export function aiResponseStartHaptic() {
  playQuickHapticPattern(3, 58);
}

/** Two light taps after Tour AI has finished its reply. */
export function aiResponseCompleteHaptic() {
  playQuickHapticPattern(2, 82);
}
