/**
 * Drops the cached public catalogue after a portal write.
 *
 * The public pages are served from a tagged 5–10 minute cache. Without this,
 * an administrator who published a course, changed a price or added a batch
 * saw no change on the public site — and, reloading to check, concluded the
 * save had silently failed.
 *
 * Best effort by design: a failure here must never turn a successful save into
 * an error the user sees.
 */
export async function refreshPublicCatalogue(options: { tags?: string[]; slug?: string } = {}): Promise<void> {
  const tags = options.tags ?? ["public-courses", "public-categories", "public-teachers"];

  try {
    await fetch("/api/internal/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags, slug: options.slug }),
      keepalive: true,
    });
  } catch {
    // Ignored on purpose — see above.
  }
}
