import { headers } from "next/headers";

/**
 * Rewrites a portal-relative path onto whichever portal the request is in.
 *
 * Several screens are served under more than one portal — an administrator
 * sees the same enrolment and payment pages as staff and accounting, but under
 * /admin so they never leave their own workspace. A hardcoded "/staff/..."
 * link inside a shared page throws them back out.
 *
 * portalPath("/staff/payments") returns "/admin/payments" when the request
 * is under /admin, and the path unchanged everywhere else.
 */
export async function portalPath(path: string): Promise<string> {
  const headerStore = await headers();
  const current = headerStore.get("x-lms-path") || "";
  const portal = current.split("?")[0].split("/").filter(Boolean)[0];

  if (!portal) return path;

  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0 || segments[0] === portal) return path;

  return `/${[portal, ...segments.slice(1)].join("/")}`;
}
