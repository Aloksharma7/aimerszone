import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "@/providers/app-providers";
import { getPublicSettings } from "@/lib/data/settings";

const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

// Dynamic (not a static `metadata` export) so the browser tab title follows
// the administrator-managed institution name instead of the compiled-in default.
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicSettings();
  const title = `${settings.name} — ${settings.tagline}`;

  return {
    // Required for relative openGraph/twitter image URLs below to resolve to
    // an absolute one — without it Next silently defaults to localhost.
    metadataBase: new URL(siteUrl),
    title: {
      default: title,
      template: `%s | ${settings.name}`,
    },
    description: settings.tagline,

    // Falls back to the bundled icon.png (app/icon.png) when no administrator
    // favicon is set — omitting `icons` entirely here lets that static file
    // convention apply instead of overriding it with nothing.
    icons: settings.faviconUrl ? { icon: settings.faviconUrl } : undefined,

    // A page-level generateMetadata (e.g. a course or teacher page) merges
    // over this rather than replacing it, so most pages get a correct,
    // branded share preview for free just by setting their own title.
    //
    // Deliberately not settings.logoUrl here even when an administrator has
    // set one: that logo is a square icon meant for a 40x40 header slot, and
    // Facebook/Twitter/WhatsApp render a share image at roughly 1200x630 —
    // stretching a square icon into that box looks distorted. This bundled
    // image is built at the right aspect ratio from the same brand mark.
    openGraph: {
      type: "website",
      locale: "en_US",
      siteName: settings.name,
      title,
      description: settings.tagline,
      url: siteUrl,
      images: [{ url: "/images/brand/og-image.png", width: 1200, height: 630, alt: settings.name }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: settings.tagline,
      images: ["/images/brand/og-image.png"],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a
          href="#main-content"
          className="sr-only z-[100] rounded-lg bg-white px-4 py-3 font-semibold text-brand-900 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
