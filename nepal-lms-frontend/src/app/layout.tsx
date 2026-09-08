import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "@/providers/app-providers";
import { getPublicSettings } from "@/lib/data/settings";

// Dynamic (not a static `metadata` export) so the browser tab title follows
// the administrator-managed institution name instead of the compiled-in default.
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicSettings();
  return {
    title: {
      default: `${settings.name} — ${settings.tagline}`,
      template: `%s | ${settings.name}`,
    },
    description: settings.tagline,

    // Falls back to the bundled icon.png (app/icon.png) when no administrator
    // favicon is set — omitting `icons` entirely here lets that static file
    // convention apply instead of overriding it with nothing.
    icons: settings.faviconUrl ? { icon: settings.faviconUrl } : undefined,
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
