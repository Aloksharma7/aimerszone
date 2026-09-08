"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Loader2 } from "lucide-react";
import { browserRequest } from "@/lib/api/browser-client";

type Notification = {
  id: string;
  title: string;
  summary: string | null;
  published_at: string | null;
  read: boolean;
  href: string | null;
};

const POLL_MS = 60_000;

/**
 * Notification bell with a preview panel.
 *
 * The bell was a plain link that navigated away from whatever the user was
 * doing — an unusual pattern, and it meant glancing at a notice cost you your
 * place. This shows the most recent few in place, with a link through to the
 * full page for anything longer.
 *
 * Fetches on mount and polls periodically, rather than only fetching the
 * first time the panel opens: a badge that only starts counting once you've
 * already clicked it can never show you anything before you look, which
 * defeats the entire point of a badge — the count was always 0 until opened,
 * at which point load() immediately marked everything it just fetched as
 * seen, so it went straight back to 0. Since this lives in the persistent
 * portal layout rather than being remounted per page, polling is also the
 * only way anything created after the page first loaded is ever noticed for
 * the rest of the session.
 */
export function NotificationBell({ href, endpoint = "/api/v1/student/notifications" }: { href: string; endpoint?: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  // Teacher/staff/admin feeds surface outstanding work rather than dismissible
  // messages, so the API always reports `read: false` for them — otherwise
  // the badge would never clear even after the panel was opened and looked at.
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  // Read from inside load(), which is called from a mount effect and a
  // setInterval callback — both close over whatever `open` was when they
  // were created unless this is a ref, so a background poll would otherwise
  // never know the panel had since been opened.
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const unread = items?.filter((item) => !item.read && !dismissedIds.has(item.id)).length ?? 0;

  function markSeen(list: Notification[]) {
    if (!list.length) return;
    setDismissedIds((current) => new Set([...current, ...list.map((item) => item.id)]));
  }

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setBusy(true);
      setError(false);
    }

    try {
      const response = await browserRequest<{ data: Notification[] }>({
        url: endpoint,
        method: "GET",
      });

      const fetched = response.data.slice(0, 6);
      setItems(fetched);

      // Only actually "seen" once the panel showing them is genuinely open —
      // a background poll while it's closed must not silently clear the
      // badge for something the user never looked at.
      if (openRef.current) markSeen(fetched);
    } catch {
      // Distinct from "genuinely nothing new" — an empty list from a failed
      // fetch used to look identical to zero real notifications, so a real
      // outage was invisible. A silent background poll failing just leaves
      // the last good list in place instead of replacing it with an error.
      if (!options?.silent) {
        setItems([]);
        setError(true);
      }
    } finally {
      if (!options?.silent) setBusy(false);
    }
  }, [endpoint]);

  useEffect(() => {
    // The standard fetch-on-mount pattern: setBusy(true) runs synchronously
    // at the top of load() before its first await, which is what this rule
    // is (over-)cautious about for a plain data fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const timer = window.setInterval(() => void load({ silent: true }), POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  // Close on an outside click or Escape, the behaviour a dropdown is expected
  // to have and the reason this is a panel rather than a page.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);

    if (!next) return;

    // Opening is exactly the moment a fresh look is worth it, and the
    // moment whatever is currently shown counts as seen.
    if (items) markSeen(items);
    void load();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 ? (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-bold text-slate-900">Notifications</p>
            <Link href={href} onClick={() => setOpen(false)} className="text-xs font-semibold text-brand-700 hover:underline">
              See all
            </Link>
          </div>

          {busy ? (
            <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : items && items.length > 0 ? (
            <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href || href}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-3 hover:bg-slate-50"
                  >
                    <p className={`text-sm ${item.read ? "font-medium text-slate-700" : "font-bold text-slate-900"}`}>
                      {item.title}
                    </p>
                    {item.summary ? <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{item.summary}</p> : null}
                  </Link>
                </li>
              ))}
            </ul>
          ) : error ? (
            <div className="px-4 py-6 text-sm text-red-700">
              <p className="font-semibold">Couldn&apos;t load notifications.</p>
              <button type="button" onClick={() => void load()} className="mt-1 font-semibold underline">Try again</button>
            </div>
          ) : (
            <p className="px-4 py-6 text-sm text-slate-500">Nothing new right now.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
