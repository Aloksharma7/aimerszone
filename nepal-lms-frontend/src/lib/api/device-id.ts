/**
 * A stable identifier for this browser install.
 *
 * Sent as X-Device-Id so the API can enforce single-device login. It is not a
 * security token and is not trusted as one: it identifies a device so an
 * account can be held to one, and the server still authenticates the session
 * independently. A student who clears storage simply looks like a new device
 * and can be reset by the office.
 *
 * localStorage rather than a cookie: it must survive the session cookie being
 * cleared on sign-out, otherwise every sign-in would look like a new device and
 * the limit would lock people out of their own accounts.
 */
const STORAGE_KEY = "lms.device-id";

function generate(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }

  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

export function getDeviceId(): string | null {
  // Server-rendered passes have no device; the header is simply omitted and the
  // API falls back to a user-agent fingerprint.
  if (typeof window === "undefined") return null;

  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing && /^[A-Za-z0-9-_]{8,120}$/.test(existing)) return existing;

    const fresh = generate();
    window.localStorage.setItem(STORAGE_KEY, fresh);
    return fresh;
  } catch {
    // Private browsing can refuse storage. Losing the device id is not fatal:
    // the API falls back to fingerprinting the user agent.
    return null;
  }
}
