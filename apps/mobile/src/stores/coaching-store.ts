import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CoachingEagerness } from "@tour/shared";

export const useCoachingStore = create<{
  enabled: boolean;
  eagerness: CoachingEagerness;
  hydrated: boolean;
  setEnabled(value: boolean): void;
  setEagerness(value: CoachingEagerness): void;
  setHydrated(): void;
}>()(persist((set) => ({
  enabled: false,
  eagerness: "balanced",
  hydrated: false,
  setEnabled: (enabled) => set({ enabled }),
  setEagerness: (eagerness) => set({ eagerness }),
  setHydrated: () => set({ hydrated: true }),
}), {
  name: "tour.coaching.preference",
  storage: createJSONStorage(() => AsyncStorage),
  partialize: ({ enabled, eagerness }) => ({ enabled, eagerness }),
  onRehydrateStorage: (state) => () => state.setHydrated(),
}));
