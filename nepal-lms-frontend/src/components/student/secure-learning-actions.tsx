"use client";

import { useEffect, useState } from "react";
import { Download, LoaderCircle, MonitorPlay, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui";
import { browserRequest, createIdempotencyKey, type NormalizedApiError } from "@/lib/api/browser-client";
import type { ApiResponse } from "@/lib/api/contracts";
import { trustedDestination, trustedYoutubeVideoId } from "@/lib/security/trusted-destination";
import { CustomYoutubePlayer, type PlayerProgress } from "@/components/student/custom-youtube-player";
import { DevToolsDeterrent } from "@/components/student/devtools-deterrent";
import { VideoWatermark, type WatermarkPayload } from "@/components/student/video-watermark";
import { cn } from "@/lib/utils";

type LinkPayload = {
  url?: string;
  join_url?: string;
  download_url?: string;
  playback_url?: string;
  expires_at?: string;

  // Issued per playback request so it cannot be fetched once and stripped.
  watermark?: WatermarkPayload | null;
};

function messageFrom(error: unknown): string {
  const apiError = error as Partial<NormalizedApiError>;
  return apiError.message || "The action could not be completed. Please try again.";
}

export function JoinClassButton({
  sessionId,
  disabled,
  label = "Join class",
  className,
}: {
  sessionId: string;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mockMode = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

  async function join() {
    if (disabled || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mockMode) {
        setError("Preview mode: joining uses a secure, one-time link and is disabled here.");
        return;
      }
      const response = await browserRequest<ApiResponse<LinkPayload>>({
        url: `/api/v1/student/classes/${encodeURIComponent(sessionId)}/join`,
        method: "POST",
        headers: { "Idempotency-Key": createIdempotencyKey("join-class") },
      });
      const destination = trustedDestination(response.data.join_url || response.data.url || "", { currentOrigin: window.location.origin });
      if (!destination) throw new Error("The meeting link returned by the server is not trusted.");
      window.location.assign(destination);
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Button type="button" size="lg" onClick={join} disabled={disabled || busy} className="w-full border-white bg-white text-brand-900 hover:bg-blue-50 sm:w-auto">
        {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <MonitorPlay className="h-5 w-5" />}
        {busy ? "Authorising…" : label}
      </Button>
      {error ? <p role="status" className="max-w-sm text-xs leading-5 text-amber-100">{error}</p> : null}
    </div>
  );
}

export function SecureDownloadButton({ resourceId, label = "Download", className }: { resourceId: string; label?: string; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mockMode = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

  async function download() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mockMode) {
        setError("Preview mode: downloads use a secure, one-time link and are disabled here.");
        return;
      }
      const response = await browserRequest<ApiResponse<LinkPayload>>({
        url: `/api/v1/student/resources/${encodeURIComponent(resourceId)}/download`,
        method: "POST",
        headers: { "Idempotency-Key": createIdempotencyKey("resource-download") },
      });
      const destination = trustedDestination(response.data.download_url || response.data.url || "", { currentOrigin: window.location.origin });
      if (!destination) throw new Error("The download link returned by the server is not trusted.");
      window.location.assign(destination);
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("sm:text-right", className)}>
      <Button type="button" variant="outline" size="sm" onClick={download} disabled={busy} className="w-full sm:w-auto">
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {busy ? "Preparing…" : label}
      </Button>
      {error ? <p role="status" className="mt-2 max-w-xs text-xs leading-5 text-amber-700">{error}</p> : null}
    </div>
  );
}

export function SecureRecordingPlayer({ recordingId, title, orientation = "landscape" }: { recordingId: string; title: string; orientation?: "landscape" | "portrait" }) {
  // Starts true: the mount effect below fires the load immediately, and
  // starting false would flash the manual "Load recording" button for one
  // frame before that kicks in.
  const [busy, setBusy] = useState(true);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [watermark, setWatermark] = useState<WatermarkPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mockMode = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

  async function load() {
    if (videoId) return;
    setBusy(true);
    setError(null);
    try {
      if (mockMode) {
        setError("Preview mode: video playback is disabled here since it needs your real enrollment.");
        return;
      }
      const response = await browserRequest<ApiResponse<LinkPayload>>({
        url: `/api/v1/student/recordings/${encodeURIComponent(recordingId)}/playback`,
        method: "POST",
        headers: { "Idempotency-Key": createIdempotencyKey("recording-playback") },
      });
      const id = trustedYoutubeVideoId(response.data.playback_url || response.data.url || "", { currentOrigin: window.location.origin });
      if (!id) throw new Error("The playback link returned by the server is not trusted.");
      setVideoId(id);
      setWatermark(response.data.watermark ?? null);
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setBusy(false);
    }
  }

  // Fire-and-forget: a dropped progress ping must never interrupt playback
  // with an error the student can't do anything about. mockMode is skipped
  // entirely since there's no real enrollment behind it to record against.
  function reportProgress({ seconds, duration, ended }: PlayerProgress) {
    if (mockMode || duration <= 0) return;
    const percent = ended ? 100 : Math.min(99, Math.round((seconds / duration) * 100));
    browserRequest({
      url: `/api/v1/student/recordings/${encodeURIComponent(recordingId)}/progress`,
      method: "PATCH",
      data: { progress_percent: percent, position_seconds: Math.round(seconds) },
    }).catch(() => {});
  }

  useEffect(() => {
    // This page exists only to show this one recording — landing on it is
    // already the deliberate action a "Load recording" button used to make
    // the student click again for. Re-runs only if the recording itself
    // changes (e.g. the Previous/Next links), not on every render. The
    // standard fetch-on-mount pattern: setBusy(true) runs synchronously at
    // the top of load() before its first await, which is what both of the
    // rules below are (over-)cautious about for a plain data fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordingId]);

  return (
    // `relative` anchors the watermark overlay to the player. Landscape (the
    // default — a normal Zoom capture) fills the width like before. Portrait
    // (a vertically-shot clip) previously still got forced into that same
    // wide 16:9 box, so the actual video played as a narrow strip in the
    // middle of a lot of empty black space — this caps the width and uses a
    // tall, narrow box sized for that shape instead.
    <div className={cn("relative overflow-hidden rounded-2xl bg-slate-950 shadow-card", orientation === "portrait" ? "mx-auto aspect-9/16 max-w-sm" : "aspect-video")}>
      <DevToolsDeterrent />
      {videoId ? <VideoWatermark watermark={watermark} /> : null}
      {videoId ? (
        <CustomYoutubePlayer videoId={videoId} title={title} onProgress={reportProgress} />
      ) : (
        <div className="flex h-full flex-col items-center justify-center px-6 text-center text-white">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">{busy ? <LoaderCircle className="h-8 w-8 animate-spin" /> : <PlayCircle className="h-8 w-8" />}</div>
          <h2 className="mt-5 text-xl font-bold">{title}</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">{busy ? "Confirming your active course access…" : error ? "The recording could not be loaded." : "The video is loaded only after the server confirms your active course access."}</p>
          {!busy ? (
            <Button type="button" onClick={load} className="mt-5">
              <PlayCircle className="h-4 w-4" />
              {error ? "Try again" : "Load recording"}
            </Button>
          ) : null}
          {error ? <p role="status" className="mt-3 max-w-md text-xs leading-5 text-amber-200">{error}</p> : null}
        </div>
      )}
    </div>
  );
}
