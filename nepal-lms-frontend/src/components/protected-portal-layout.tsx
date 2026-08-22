import { PortalShell } from "@/components/portal-shell";
import { SessionIntegrity } from "@/components/auth/session-integrity";
import { SessionProvider } from "@/components/auth/session-provider";
import { requirePortalAccess } from "@/lib/auth/server";
import { isAdminTier } from "@/lib/auth/roles";
import { isMockDataEnabled } from "@/lib/data/config";
import { getPublicSettings } from "@/lib/data/settings";
import type { PortalRole } from "@/types/lms";

export async function ProtectedPortalLayout({
  role,
  children,
}: {
  role: PortalRole;
  children: React.ReactNode;
}) {
  const [user, settings] = await Promise.all([requirePortalAccess(role), getPublicSettings()]);

  /*
   * The chrome follows the person, not the URL.
   *
   * Administrators can reach teacher and staff screens, and the sidebar used to
   * swap to that portal's menu underneath them — so opening "Classes" from the
   * admin menu replaced the whole admin navigation with the teacher one and
   * left no way back except the browser button. An administrator keeps the
   * administrator menu wherever they are; everyone else only ever sees their
   * own portal anyway.
   */
  const chrome: PortalRole = isAdminTier(user) ? "admin" : role;

  return (
    <SessionProvider user={user}>
      {/* Back-button after sign-out must not reveal the previous session. */}
      <SessionIntegrity />
      <PortalShell role={chrome} user={user} mockMode={isMockDataEnabled()} institutionName={settings.name} institutionLogoUrl={settings.logoUrl}>
        {children}
      </PortalShell>
    </SessionProvider>
  );
}
