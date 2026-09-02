import NetInfo from "@react-native-community/netinfo";
import { focusManager, onlineManager, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@react-navigation/native";
import { PortalHost } from "@rn-primitives/portal";
import React, { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { NAV_THEME } from "@/lib/theme";
import { queryClient } from "@/query-client";

function QueryLifecycle() {
  useEffect(() => onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(state.isConnected !== false && state.isInternetReachable !== false);
    })
  ), []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (Platform.OS !== "web") focusManager.setFocused(state === "active");
    });
    return () => subscription.remove();
  }, []);

  return null;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <QueryLifecycle />
        <SafeAreaProvider>
          <ThemeProvider value={NAV_THEME.light}>
            {children}
            <PortalHost />
          </ThemeProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
