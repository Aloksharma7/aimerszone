"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const POLL_MS = 60_000;

/**
 * Keeps a class/schedule page from going stale while it sits open.
 *
 * These pages are server-rendered once per navigation, so a class a teacher
 * schedules — or starts — after a student opens the page never appears until
 * something forces a new request. This mounts nothing visible; it just calls
 * `router.refresh()` (re-runs the server component against fresh data,
 * without losing client-side state) on a short interval, plus immediately
 * whenever the tab regains focus, which is the moment a student is most
 * likely to actually look at it again. Polling pauses while the tab is
 * hidden so a backgrounded tab doesn't keep hitting the server forever.
 */
export function LiveClassWatcher() {
  const router = useRouter();

  useEffect(() => {
    function refreshIfVisible() {
      if (document.visibilityState === "visible") router.refresh();
    }

    const interval = window.setInterval(refreshIfVisible, POLL_MS);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [router]);

  return null;
}
