import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ApiResponse, AuthenticatedUser } from "@/lib/api/contracts";
import { isServerApiError, serverApiFetch } from "@/lib/api/server-client";
import { isMockDataEnabled } from "@/lib/data/config";
import { createMockSession } from "@/lib/auth/mock-session";
import { hasRole, portalRoleToMachineRole, preferredPortalHome } from "@/lib/auth/roles";
import { safeInternalPath } from "@/lib/auth/safe-return";
import type { MachineRole, PortalRole, SessionUser } from "@/types/lms";

const validRoles = new Set<MachineRole>(["student", "teacher", "staff", "admin", "super_admin"]);

function mapAuthUser(payload: AuthenticatedUser): SessionUser {
  return {
    id: payload.user.id,
    name: payload.user.name,
    email: payload.user.email ?? null,
    mobile: payload.user.mobile ?? null,
    studentCode: payload.user.student_code ?? null,
    avatarUrl: payload.user.avatar_url ?? null,
    status: payload.user.status,
    roles: payload.roles.filter((role): role is MachineRole => validRoles.has(role as MachineRole)),
    permissions: payload.permissions,
    requiredAction: payload.required_action ?? null,
    portalHome: safeInternalPath(payload.portal_home, "/unauthorized"),
  };
}

export const getSessionUser = cache(async (mockRole?: MachineRole): Promise<SessionUser | null> => {
  if (isMockDataEnabled()) return createMockSession(mockRole ?? "student");

  try {
    const response = await serverApiFetch<ApiResponse<AuthenticatedUser>>("/api/v1/auth/me");
    return mapAuthUser(response.data);
  } catch (error) {
    if (isServerApiError(error) && error.status === 401) return null;

    /*
     * "Who is looking at this page" is a question the public site asks in its
     * layout, and it must never be able to take the site down.
     *
     * This used to rethrow anything that was not a 401, so a database outage —
     * or the API simply not being started yet — turned every public page into
     * a 500, including the marketing site and the login page. The signed-out
     * view is the correct fallback: an unknown viewer is a guest.
     *
     * Protected areas are unaffected: requirePortalAccess() sends a null user
     * to /login, which is the right outcome when the session cannot be read.
     */
    if (isServerApiError(error) && error.status >= 500) {
      console.error("[auth] session lookup failed; treating the visitor as signed out.", {
        status: error.status,
        requestId: error.requestId,
      });
      return null;
    }

    throw error;
  }
});

function requiredActionPath(user: SessionUser): string | null {
  switch (user.requiredAction) {
    case "change_password":
      return "/change-password";
    case "two_factor_challenge":
      return "/two-factor-challenge";
    case "verify_email":
      return "/verify-email";
    default:
      return null;
  }
}

export async function requirePortalAccess(role: PortalRole): Promise<SessionUser> {
  const user = await getSessionUser(portalRoleToMachineRole[role]);
  const headerStore = await headers();
  const currentPath = safeInternalPath(headerStore.get("x-lms-path"), `/${role}/dashboard`);

  if (!user) {
    redirect(`/login?returnTo=${encodeURIComponent(currentPath)}`);
  }

  if (user.status === "suspended") {
    redirect("/unauthorized?reason=suspended");
  }

  const requiredPath = requiredActionPath(user);
  if (requiredPath) {
    redirect(`${requiredPath}?returnTo=${encodeURIComponent(currentPath)}`);
  }

  if (!hasRole(user, role)) {
    const home = preferredPortalHome(user);
    if (home !== currentPath) redirect(home);
    redirect("/unauthorized");
  }

  return user;
}

/**
 * Guest-only pages: login, register, forgot-password, reset-password.
 *
 * Sends an already-authenticated visitor to their portal instead of showing a
 * sign-in form they do not need. Pages that exist to resolve a required action
 * (change-password, two-factor-challenge, verify-email) must NOT use this —
 * those legitimately require a session.
 *
 * The check lives here rather than in proxy.ts because the middleware only
 * sees whether a session cookie exists, not whether it is still valid.
 * Redirecting on cookie presence alone would trap anyone holding a stale
 * cookie in a loop between /login and their portal.
 */
export async function redirectIfAuthenticated(): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;

  // A pending required action wins: finish that before entering the portal.
  const requiredPath = requiredActionPath(user);
  if (requiredPath) redirect(requiredPath);

  redirect(preferredPortalHome(user));
}

export async function requirePermission(user: SessionUser, permission: string): Promise<void> {
  if (user.roles.includes("admin") || user.permissions.includes("*") || user.permissions.includes(permission)) return;
  redirect("/unauthorized");
}
