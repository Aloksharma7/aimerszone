import { API_BASE_URL } from "@/constants/config";

/**
 * The backend's PublicAssetUrl / MediaLinkService return origin-relative
 * paths (e.g. "/storage/thumb.jpg" or "/media/xyz?signature=...") meant to be
 * resolved against whatever host actually served them — the web app does
 * that via a Next.js rewrite, but Laravel serves both routes directly on its
 * own origin too, so the mobile app just needs to prefix API_BASE_URL.
 * Already-absolute URLs (a pasted external thumbnail, a CDN link) pass
 * through unchanged, matching the backend's own passthrough behavior.
 */
export function resolveAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path}`;
}
