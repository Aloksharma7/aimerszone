import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { api } from "@/lib/api/client";

/** A native call or network request here must never hang the caller forever — see the incident this guards against below. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Push operation timed out")), ms)),
  ]);
}

/**
 * A device that never grants permission, or never gets a token, must not
 * block sign-in or sign-out — every step here is best effort and swallows
 * its own errors. There is no web push target; this is a no-op there.
 */
async function resolveProjectId(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  return Constants.expoConfig?.extra?.eas?.projectId ?? null;
}

export async function registerDeviceForPush(): Promise<void> {
  try {
    const projectId = await resolveProjectId();
    if (!projectId) return;

    const existing = await withTimeout(Notifications.getPermissionsAsync(), 5000);
    let status = existing.status;

    if (status !== "granted") {
      const requested = await withTimeout(Notifications.requestPermissionsAsync(), 15000);
      status = requested.status;
    }

    if (status !== "granted") return;

    const { data: token } = await withTimeout(Notifications.getExpoPushTokenAsync({ projectId }), 8000);

    await api.post("/api/v1/account/device-tokens", {
      expo_push_token: token,
      platform: Platform.OS === "ios" ? "ios" : "android",
    });
  } catch {
    // Silently skip — see the docblock above.
  }
}

/**
 * Never requests permission — sign-out must not pop a fresh "allow
 * notifications?" prompt. If permission was never granted there was never a
 * token to unregister either, so there is nothing to do.
 *
 * This is always called fire-and-forget (see session-store.ts's signOut) —
 * the timeouts below are a second, independent safety net, not the only one.
 */
export async function unregisterDeviceForPush(): Promise<void> {
  try {
    const projectId = await resolveProjectId();
    if (!projectId) return;

    const { status } = await withTimeout(Notifications.getPermissionsAsync(), 5000);
    if (status !== "granted") return;

    const { data: token } = await withTimeout(Notifications.getExpoPushTokenAsync({ projectId }), 8000);
    await api.delete("/api/v1/account/device-tokens", { body: { expo_push_token: token } });
  } catch {
    // Best effort: a stale token on the server is harmless (it just gets
    // pruned on the next failed send — see PushNotificationClient).
  }
}
