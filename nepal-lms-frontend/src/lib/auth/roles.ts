import type { MachineRole, PortalRole, SessionUser } from "@/types/lms";

// "staff" and "accounting" are the same role (Staff merges the former
// enrollment-officer and accountant capabilities), just two existing URL
// prefixes kept as-is to avoid an unnecessary route rename.
export const portalRoleToMachineRole: Record<PortalRole, MachineRole> = {
  student: "student",
  teacher: "teacher",
  staff: "staff",
  accounting: "staff",
  admin: "admin",
};

export const portalHomeByMachineRole: Record<MachineRole, string> = {
  student: "/student/dashboard",
  teacher: "/teacher/dashboard",
  staff: "/staff/dashboard",
  admin: "/admin/dashboard",
  super_admin: "/admin/dashboard",
};

const profilePathByMachineRole: Record<MachineRole, string> = {
  student: "/student/profile",
  teacher: "/teacher/profile",
  staff: "/staff/profile",
  admin: "/admin/profile",
  super_admin: "/admin/profile",
};

/**
 * Administrators reach every portal — both admin tiers, mirroring the
 * Laravel `EnsureRole` middleware, which lets admin and super_admin through
 * any role gate. Without the same rule here the frontend disagreed with the
 * backend: an admin opening /staff/students was bounced back to
 * /admin/dashboard even though the API would have served them.
 */
export function hasRole(user: SessionUser, role: PortalRole): boolean {
  if (isAdminTier(user)) return true;
  return user.roles.includes(portalRoleToMachineRole[role]);
}

export function isAdminTier(user: Pick<SessionUser, "roles">): boolean {
  return user.roles.includes("admin") || user.roles.includes("super_admin");
}

/**
 * Only Super Admin bypasses permission checks unconditionally — mirroring
 * the backend, where Admin now relies on its real (broad, but not
 * unlimited) permission grant like everyone else, so settings, integrations
 * and role management stay out of its reach.
 */
export function can(user: SessionUser, permission: string): boolean {
  return user.roles.includes("super_admin") || user.permissions.includes(permission);
}

export function preferredPortalHome(user: Pick<SessionUser, "portalHome" | "roles">): string {
  // An admin visiting another portal is allowed to stay there; this is only
  // the landing page used after sign-in or when a route is genuinely denied.
  if (user.portalHome?.startsWith("/")) return user.portalHome;
  const priority: MachineRole[] = ["super_admin", "admin", "staff", "teacher", "student"];
  const role = priority.find((candidate) => user.roles.includes(candidate));
  return role ? portalHomeByMachineRole[role] : "/unauthorized";
}

/**
 * Deliberately ignores portalHome (unlike preferredPortalHome above): "go to
 * my profile" always means the same fixed destination regardless of
 * whichever page a user last happened to be on.
 */
export function preferredProfilePath(user: Pick<SessionUser, "roles">): string {
  const priority: MachineRole[] = ["super_admin", "admin", "staff", "teacher", "student"];
  const role = priority.find((candidate) => user.roles.includes(candidate));
  return role ? profilePathByMachineRole[role] : "/unauthorized";
}
