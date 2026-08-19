"use client";

import { useEffect, useState } from "react";

export type WatermarkPayload = {
  enabled: boolean;
  text: string;
  opacity: number;
  interval_seconds: number;
  issued_at: string;
};

const positions = [
  "top-[8%] left-[6%]",
  "top-[14%] right-[6%]",
  "bottom-[22%] left-[10%]",
  "bottom-[12%] right-[8%]",
  "top-[46%] left-[38%]",
];

/**
 * Draws the viewer's identity across a recording.
 *
 * This is deterrence rather than protection. Anyone determined can still film
 * the screen with a second phone — what changes is that the resulting copy
 * carries the name and part-number of the account it came from, which is enough
 * to stop the casual sharing that actually costs an institute money.
 *
 * Two details matter:
 *  - `pointer-events-none` so it never blocks the player controls underneath.
 *  - the position rotates on a timer, so one cropped screenshot does not yield
 *    a clean frame.
 *
 * The payload is issued per playback request by the API, so it cannot be
 * fetched once, cached, and stripped from later views.
 */
export function VideoWatermark({ watermark }: { watermark: WatermarkPayload | null }) {
  const [index, setIndex] = useState(0);

  const interval = watermark?.interval_seconds ?? 12;
  const active = Boolean(watermark?.enabled);

  useEffect(() => {
    if (!active) return;

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % positions.length);
    }, Math.max(4, interval) * 1000);

    return () => window.clearInterval(timer);
  }, [active, interval]);

  if (!watermark?.enabled) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none overflow-hidden" aria-hidden="true">
      <div
        className={`absolute ${positions[index]} transition-all duration-1000 ease-in-out`}
        style={{ opacity: Math.min(0.6, Math.max(0.05, watermark.opacity / 100)) }}
      >
        <p className="whitespace-nowrap text-sm font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
          {watermark.text}
        </p>
        <p className="whitespace-nowrap text-[11px] font-medium text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
          {watermark.issued_at}
        </p>
      </div>
    </div>
  );
}
