"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { safeInternalPath } from "@/lib/auth/safe-return";
import { ToastProvider } from "@/providers/toast-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: (failureCount: number, error: unknown) => {
              const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 0;
              if ([401, 403, 404, 409, 422].includes(status)) return false;
              return failureCount < 2;
            },
            refetchOnWindowFocus: false,
          },
          mutations: { retry: false },
        },
      }),
  );

  useEffect(() => {
    const handleUnauthenticated = () => {
      queryClient.clear();
      const current = safeInternalPath(`${window.location.pathname}${window.location.search}`, "/");
      window.location.assign(`/login?returnTo=${encodeURIComponent(current)}`);
    };
    window.addEventListener("lms:unauthenticated", handleUnauthenticated);
    return () => window.removeEventListener("lms:unauthenticated", handleUnauthenticated);
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
