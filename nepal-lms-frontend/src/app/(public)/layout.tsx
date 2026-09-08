import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { preferredPortalHome } from "@/lib/auth/roles";
import { getSessionUser } from "@/lib/auth/server";
import { getPublicSettings } from "@/lib/data/settings";

const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  // Both resolved server-side: the header must not flash a Login button to
  // someone already signed in, and branding comes from /admin/settings rather
  // than build-time environment variables.
  const [user, settings] = await Promise.all([getSessionUser(), getPublicSettings()]);

  // EducationalOrganization structured data — read by search engines, not
  // rendered. Gives Google enough to potentially show a knowledge panel and
  // to attribute the Facebook/Instagram/YouTube pages to this same business.
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: settings.name,
    description: settings.tagline,
    url: siteUrl,
    logo: settings.logoUrl ? new URL(settings.logoUrl, siteUrl).toString() : `${siteUrl}/images/brand/logo-512.png`,
    address: settings.address ? { "@type": "PostalAddress", addressLocality: settings.address, addressCountry: "NP" } : undefined,
    telephone: settings.phone || undefined,
    email: settings.email || undefined,
    sameAs: [settings.facebookUrl, settings.instagramUrl, settings.youtubeUrl].filter((url): url is string => Boolean(url)),
  };

  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
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
