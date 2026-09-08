import type { Metadata } from "next";

/**
 * Per-page SEO metadata, built consistently across the public site.
 *
 * Next.js does not deep-merge a page's `openGraph`/`twitter` objects with the
 * root layout's — a page that sets its own `title` but no `openGraph` would
 * keep the root's static, homepage-only Open Graph title on every share.
 * This keeps every page's title/description and its share preview in sync
 * with one call, while still using the one shared 1200x630 brand image.
 */
export function pageMetadata({ title, description }: { title: string; description: string }): Metadata {
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: "/images/brand/og-image.png", width: 1200, height: 630 }],
    },
    twitter: {
      title,
      description,
      images: ["/images/brand/og-image.png"],
    },
  };
}
