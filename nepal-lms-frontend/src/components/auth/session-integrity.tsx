"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps Back/Forward honest about whether a session is actually still valid.
 * Two different caches can make that lie, so this guards against both:
 *
 * 1. The browser's own back-forward cache (bfcache) can restore this page as
 *    a fully rendered document from memory, with no request and no React
 *    re-render. `Cache-Control: no-store` is already set on protected
 *    routes, and Chrome mostly honours that for bfcache — but Safari and
 *    Firefox still restore it, and Chrome does not guarantee it either.
 *    `pageshow` with `event.persisted === true` fires only for that kind of
 *    restore, so a real `location.reload()` forces the server component to
 *    run again, see there is no session, and redirect to /login.
 *
 * 2. Separately, Next's own client-side router cache can replay a
 *    previously-rendered page for a back/forward navigation without a full
 *    document reload at all — no bfcache restore, so `pageshow` never fires
 *    for it either. That is the more common case in Chrome specifically,
 *    since Chrome is the one most likely to skip bfcache on a `no-store`
 *    page and fall through to this instead. `popstate` fires on every such
 *    navigation; `router.refresh()` re-runs the current route's server
 *    component against fresh data without a full page reload, which is
 *    enough to catch a session that no longer exists.
 *
 * Signing out, then pressing Back, then clicking something used to show the
 * previous user's dashboard — complete with their name and data — right up
 * until the click itself hit a 401. On a shared computer at an institution
 * that is exactly the wrong outcome, so both paths are closed here rather
 * than relying on whichever cache happens not to trigger.
 */
export function SessionIntegrity() {
  const router = useRouter();

  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) window.location.reload();
    }

    function handlePopState() {
      router.refresh();
    }

    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [router]);

  return null;
}
