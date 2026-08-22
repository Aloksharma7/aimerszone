import { create } from "zustand";
import { clearToken, getToken, setToken } from "@/lib/auth/secure-token";
import { registerDeviceForPush, unregisterDeviceForPush } from "@/lib/push/register-device";

/**
 * The token lives here in memory as the source of truth for every request —
 * reading SecureStore (async, hits the OS keychain) on every API call would
 * add real latency to every screen. SecureStore is only touched at startup
 * (hydrate) and on login/logout, not per request.
 */
export type SessionUser = {
  id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  studentCode: string | null;
  avatarUrl: string | null;
  status: string;
  roles: string[];
  permissions: string[];
};

type SessionStatus = "hydrating" | "guest" | "authenticated";

type SessionState = {
  status: SessionStatus;
  token: string | null;
  user: SessionUser | null;
  hydrate: () => Promise<void>;
  signIn: (token: string, user: SessionUser) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: SessionUser) => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  status: "hydrating",
  token: null,
  user: null,

  hydrate: async () => {
    const token = await getToken();
    if (!token) {
      set({ token: null, status: "guest" });
      return;
    }

    // The user profile is not persisted locally — it is re-fetched from
    // /auth/me on every cold start so a role change, permission change or
    // suspension made elsewhere takes effect immediately instead of
    // trusting a stale local copy. `status` stays "hydrating" (not yet
    // "authenticated") until this resolves, so index.tsx never redirects
    // on a token whose user has not actually loaded.
    set({ token });
    try {
      // Imported lazily to avoid a require cycle: api.ts imports the client,
      // which imports this store for the token.
      const { fetchCurrentUser } = await import("@/lib/auth/api");
      const user = await fetchCurrentUser();
      set({ user, status: "authenticated" });

      // Fire-and-forget: a device that already granted permission gets its
      // token re-registered (harmless no-op via updateOrCreate on the
      // backend) on every cold start, so a token Expo rotated doesn't go
      // stale silently.
      void registerDeviceForPush();
    } catch {
      await clearToken();
      set({ token: null, user: null, status: "guest" });
    }
  },

  signIn: async (token, user) => {
    await setToken(token);
    set({ token, user, status: "authenticated" });
    void registerDeviceForPush();
  },

  signOut: async () => {
    // Fire-and-forget, deliberately not awaited: signing out must be instant
    // and must never depend on a network round-trip to Expo's push service
    // succeeding (or even returning at all) — a stale device_tokens row is
    // harmless (see PushNotificationClient's DeviceNotRegistered pruning).
    void unregisterDeviceForPush();
    await clearToken();
    set({ token: null, user: null, status: "guest" });
  },

  setUser: (user) => set({ user }),
}));

/** Non-hook accessor for the API client, which runs outside React. */
export function getSessionToken(): string | null {
  return useSessionStore.getState().token;
}
