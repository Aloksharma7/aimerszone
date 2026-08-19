"use client";

import { useState } from "react";
import { Download, LoaderCircle, MonitorPlay, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui";
import { browserRequest, createIdempotencyKey, type NormalizedApiError } from "@/lib/api/browser-client";
import type { ApiResponse } from "@/lib/api/contracts";
import { trustedDestination } from "@/lib/security/trusted-destination";
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
        setError("Preview mode: Laravel will return a short-lived authorised meeting link here.");
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
        setError("Preview mode: the protected PDF download will be requested from Laravel.");
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

export function SecureRecordingPlayer({ recordingId, title }: { recordingId: string; title: string }) {
  const [busy, setBusy] = useState(false);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [watermark, setWatermark] = useState<WatermarkPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mockMode = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

  async function load() {
    if (busy || embedUrl) return;
    setBusy(true);
    setError(null);
    try {
      if (mockMode) {
        setError("Preview mode: Laravel will verify enrollment and return the authorised video embed.");
        return;
      }
      const response = await browserRequest<ApiResponse<LinkPayload>>({
        url: `/api/v1/student/recordings/${encodeURIComponent(recordingId)}/playback`,
        method: "POST",
        headers: { "Idempotency-Key": createIdempotencyKey("recording-playback") },
      });
      const destination = trustedDestination(response.data.playback_url || response.data.url || "", { currentOrigin: window.location.origin, purpose: "youtube_embed" });
      if (!destination) throw new Error("The playback link returned by the server is not trusted.");
      setEmbedUrl(destination);
      setWatermark(response.data.watermark ?? null);
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    // `relative` anchors the watermark overlay to the player.
    <div className="relative aspect-video overflow-hidden rounded-2xl bg-slate-950 shadow-card">
      {embedUrl ? <VideoWatermark watermark={watermark} /> : null}
      {embedUrl ? (
        <iframe
          src={embedUrl}
          title={title}
          className="h-full w-full"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation"
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center px-6 text-center text-white">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10"><PlayCircle className="h-8 w-8" /></div>
          <h2 className="mt-5 text-xl font-bold">{title}</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">The video is loaded only after the server confirms your active course access.</p>
          <Button type="button" onClick={load} disabled={busy} className="mt-5">
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            {busy ? "Checking access…" : "Load recording"}
          </Button>
          {error ? <p role="status" className="mt-3 max-w-md text-xs leading-5 text-amber-200">{error}</p> : null}
        </div>
      )}
    </div>
  );
}
