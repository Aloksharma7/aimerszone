"use client";

import { usePathname } from "next/navigation";
import { rewritePortalSegment } from "./portal-segment";

/**
 * Client-component equivalent of portalPath() — for shared client components
 * (e.g. TestBuilder) that navigate to another portal-relative route after a
 * mutation, and need the destination to stay under whichever portal the page
 * is currently rendered in.
 */
export function usePortalPath(): (path: string) => string {
  const pathname = usePathname();
  const portal = pathname.split("/").filter(Boolean)[0];

  return (path: string) => rewritePortalSegment(portal, path);
}
