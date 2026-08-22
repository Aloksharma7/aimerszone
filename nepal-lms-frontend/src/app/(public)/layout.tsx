import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { preferredPortalHome } from "@/lib/auth/roles";
import { getSessionUser } from "@/lib/auth/server";
import { getPublicSettings } from "@/lib/data/settings";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  // Both resolved server-side: the header must not flash a Login button to
  // someone already signed in, and branding comes from /admin/settings rather
  // than build-time environment variables.
  const [user, settings] = await Promise.all([getSessionUser(), getPublicSettings()]);

  return (
    <div className="min-h-screen bg-white">
      <PublicHeader
        session={user ? { name: user.name, portalHome: preferredPortalHome(user) } : null}
        branding={{ name: settings.name, logoUrl: settings.logoUrl }}
      />
      <main id="main-content">{children}</main>
      <PublicFooter settings={settings} />
      <WhatsAppButton whatsapp={settings.whatsapp} />
    </div>
  );
}
