/**
 * Compatibility exports. New browser code should import from browser-client.ts;
 * Server Components should import from server-client.ts.
 */
export {
  browserApi,
  browserRequest,
  ensureCsrfCookie,
  normalizeApiError,
  type NormalizedApiError,
} from "@/lib/api/browser-client";
