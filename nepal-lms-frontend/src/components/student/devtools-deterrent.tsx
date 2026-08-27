"use client";

import { useEffect } from "react";

/**
 * A deterrent against the average casual student, not a real access control
 * — it cannot stop the browser's own Network tab, a different browser,
 * incognito mode, or anyone who disables JavaScript for the page, all of
 * which reveal the video id regardless of this component. It only raises
 * the bar for right-click / F12 / view-source on whichever page mounts it.
 * Scoped to the recording player specifically rather than the whole student
 * portal, since blocking it everywhere would add friction with no benefit
 * on pages that carry nothing sensitive.
 */
export function DevToolsDeterrent() {
  useEffect(() => {
    function blockContextMenu(event: MouseEvent) {
      event.preventDefault();
    }

    function blockShortcuts(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      const isDevToolsCombo =
        key === "f12" ||
        (event.ctrlKey && event.shiftKey && ["i", "j", "c"].includes(key)) ||
        (event.metaKey && event.altKey && ["i", "j", "c"].includes(key)) ||
        ((event.ctrlKey || event.metaKey) && key === "u");
      if (isDevToolsCombo) event.preventDefault();
    }

    document.addEventListener("contextmenu", blockContextMenu);
    document.addEventListener("keydown", blockShortcuts);
    return () => {
      document.removeEventListener("contextmenu", blockContextMenu);
      document.removeEventListener("keydown", blockShortcuts);
    };
  }, []);

  return null;
}
