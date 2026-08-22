import type { SessionUser } from "@/lib/auth/session-store";

export type PortalRole = "student" | "teacher" | "staff" | "admin";

/**
 * super_admin and admin share the admin portal, same as the web app —
 * see nepal-lms-frontend's isAdminTier(). Staff and accounting are one
 * backend role too; there is no separate accounting portal here either.
 */
export function preferredPortalRole(user: SessionUser): PortalRole {
  if (user.roles.includes("super_admin") || user.roles.includes("admin")) return "admin";
  if (user.roles.includes("staff")) return "staff";
  if (user.roles.includes("teacher")) return "teacher";
  return "student";
}

export function preferredPortalHome(user: SessionUser): `/(${PortalRole})/dashboard` {
  return `/(${preferredPortalRole(user)})/dashboard`;
}

export function hasPortalRole(user: SessionUser, role: PortalRole): boolean {
  if (role === "admin") return user.roles.includes("admin") || user.roles.includes("super_admin");
  return user.roles.includes(role);
}
