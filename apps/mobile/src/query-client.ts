import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 30 * 60_000,
      retry: 1,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
    },
    mutations: {
      retry: 0,
    },
  },
});
