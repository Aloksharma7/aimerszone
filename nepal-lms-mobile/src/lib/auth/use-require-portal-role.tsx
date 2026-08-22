import { Redirect } from "expo-router";
import { useSessionStore } from "@/lib/auth/session-store";
import { hasPortalRole, preferredPortalHome, type PortalRole } from "@/lib/auth/roles";

/**
 * Used at the top of each (role)/_layout.tsx. Returns a <Redirect> element
 * when the viewer should not be here (no session, or the wrong role — e.g.
 * a teacher hitting /(admin)/*), or null when it is fine to render the
 * portal. Mirrors nepal-lms-frontend's requirePortalAccess(), minus the
 * required-action checks (change-password, 2FA, verify-email), which are
 * not built yet — see docs/ROADMAP.md.
 */
export function useRequirePortalRole(role: PortalRole) {
  const status = useSessionStore((state) => state.status);
  const user = useSessionStore((state) => state.user);

  if (status !== "authenticated" || !user) return <Redirect href="/(auth)/login" />;
  if (!hasPortalRole(user, role)) return <Redirect href={preferredPortalHome(user)} />;
  return null;
}
