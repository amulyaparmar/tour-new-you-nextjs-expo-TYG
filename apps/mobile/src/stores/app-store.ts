import { create } from "zustand";

import type { SortOption, StatusFilter } from "../types/ui";

type AppUiState = {
  communityPickerOpen: boolean;
  communityQuery: string;
  sessionsSearch: string;
  sessionsStatusFilter: StatusFilter;
  sessionsSort: SortOption;
  showSessionsSort: boolean;
  setCommunityPickerOpen: (open: boolean) => void;
  setCommunityQuery: (query: string) => void;
  setSessionsSearch: (query: string) => void;
  setSessionsStatusFilter: (filter: StatusFilter) => void;
  setSessionsSort: (sort: SortOption) => void;
  setShowSessionsSort: (show: boolean | ((current: boolean) => boolean)) => void;
  resetCommunityPicker: () => void;
};

export const useAppStore = create<AppUiState>((set) => ({
  communityPickerOpen: false,
  communityQuery: "",
  sessionsSearch: "",
  sessionsStatusFilter: "all",
  sessionsSort: "newest",
  showSessionsSort: false,
  setCommunityPickerOpen: (communityPickerOpen) => set({ communityPickerOpen }),
  setCommunityQuery: (communityQuery) => set({ communityQuery }),
  setSessionsSearch: (sessionsSearch) => set({ sessionsSearch }),
  setSessionsStatusFilter: (sessionsStatusFilter) => set({ sessionsStatusFilter }),
  setSessionsSort: (sessionsSort) => set({ sessionsSort }),
  setShowSessionsSort: (showSessionsSort) =>
    set((state) => ({
      showSessionsSort:
        typeof showSessionsSort === "function"
          ? showSessionsSort(state.showSessionsSort)
          : showSessionsSort,
    })),
  resetCommunityPicker: () => set({ communityPickerOpen: false, communityQuery: "" }),
}));
