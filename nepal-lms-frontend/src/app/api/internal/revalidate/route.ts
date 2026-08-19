import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

/*
 * Cache invalidation for the public catalogue.
 *
 * getPublicCourses/getPublicCourse and friends are fetched with
 * `next: { revalidate: 300, tags: [...] }`, and nothing ever invalidated those
 * tags. Publishing a course, changing a price, adding a batch or assigning a
 * teacher therefore did not appear on the public site for up to ten minutes,
 * and an administrator who reloaded to check their own change saw the old one
 * and reasonably concluded the save had failed.
 *
 * Called by the portal after any catalogue write. It only ever drops cache
 * entries, but it is still restricted to same-origin requests so it cannot be
 * used as a cache-busting amplifier from outside.
 */
const TAGS = new Set([
  "public-courses",
  "public-categories",
  "public-teachers",
  "public-faqs",
  "public-payment-methods",
]);

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (origin && host && new URL(origin).host !== host) {
    return NextResponse.json({ error: "cross_origin" }, { status: 403 });
  }

  let body: { tags?: unknown; slug?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const requested = Array.isArray(body.tags) ? body.tags.filter((tag): tag is string => typeof tag === "string") : [];
  const cleared: string[] = [];

  for (const tag of requested) {
    if (!TAGS.has(tag)) continue;
    revalidateTag(tag, "max");
    cleared.push(tag);
  }

  if (typeof body.slug === "string" && body.slug.length > 0 && body.slug.length < 200) {
    const tag = `public-course:${body.slug}`;
    revalidateTag(tag, "max");
    cleared.push(tag);
  }

  return NextResponse.json({ cleared });
}
