/**
 * Pure path-rewriting logic shared by the server-side portalPath() (reads
 * the portal from request headers) and the client-side usePortalPath() hook
 * (reads it from the current pathname). Kept free of both "next/headers" and
 * "next/navigation" so either caller can import it without pulling the
 * other's runtime into its bundle.
 */
export function rewritePortalSegment(currentPortal: string | null | undefined, path: string): string {
  if (!currentPortal) return path;

  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0 || segments[0] === currentPortal) return path;

  return `/${[currentPortal, ...segments.slice(1)].join("/")}`;
}
