import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * The Sanctum API token, encrypted at rest (Keychain on iOS, Keystore-backed
 * EncryptedSharedPreferences on Android) — never AsyncStorage, which is
 * plain text on disk. See docs/ARCHITECTURE.md for why token auth is used
 * here instead of the web app's cookie-session auth.
 */
const TOKEN_KEY = "nepal_lms_api_token";

/**
 * expo-secure-store ships no real web implementation (its web build is an
 * empty stub — see node_modules/expo-secure-store/build/ExpoSecureStore.web.js),
 * so calling it throws "getValueWithKeyAsync is not a function". This app
 * only ships to iOS/Android, but the browser preview target is still useful
 * for quick local iteration before a Development Build exists, so fall back
 * to localStorage on web rather than crash. This is a dev-convenience path
 * only — it is not used, and offers no security guarantee, on a real device.
 */
const isWeb = Platform.OS === "web";

export async function getToken(): Promise<string | null> {
  if (isWeb) return globalThis.localStorage?.getItem(TOKEN_KEY) ?? null;
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.removeItem(TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
