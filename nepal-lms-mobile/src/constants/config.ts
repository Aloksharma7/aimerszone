/**
 * EXPO_PUBLIC_-prefixed vars are inlined at build time by Expo — same
 * mechanism as Next.js's NEXT_PUBLIC_*, and just as visible to anyone who
 * decompiles the app, so nothing secret belongs here (matches the backend's
 * assumption that every /api/v1 route is a public network boundary already
 * guarded by auth, not by the URL being secret).
 *
 * A physical device cannot reach the dev machine via 127.0.0.1/localhost —
 * that resolves to the phone itself. Use the dev machine's LAN IP
 * (e.g. http://192.168.1.20:8000) in .env for device testing; localhost only
 * works from an emulator/simulator or Expo web. See README.md.
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

/** Neutral gray blur shown while any network image (thumbnail, avatar) is loading — see docs/CODING-STANDARDS.md. */
export const IMAGE_PLACEHOLDER_BLURHASH = "L6PZfSi_.AyE_3t7t7R**0o#DgR4";
