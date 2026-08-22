import { QueryClient } from "@tanstack/react-query";
import { isNormalizedApiError } from "@/lib/api/contracts";

/**
 * staleTime > 0 is deliberate: the web app's whole caching story this year
 * was "don't refetch on every navigation, only when something actually
 * changed" (see nepal-lms-frontend's DashboardCache and cache-tag work).
 * Mobile gets the same principle for free from TanStack Query's cache, on
 * top of automatic refetch-on-reconnect for when a phone comes back online.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        if (isNormalizedApiError(error) && !error.retryable) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
