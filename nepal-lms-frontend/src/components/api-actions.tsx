"use client";

import { Download, ExternalLink, LoaderCircle, Printer, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { browserRequest, createIdempotencyKey, normalizeApiError } from "@/lib/api/browser-client";
import type { ApiResponse } from "@/lib/api/contracts";
import { trustedDestination } from "@/lib/security/trusted-destination";
import { cn } from "@/lib/utils";

const outlineClass = "inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50";

function trustedApiHref(href: string): string | null {
  return href.startsWith("/api/") && !href.startsWith("//") ? href : null;
}

export function ApiExportLink({ href, label = "Export CSV", className }: { href: string; label?: string; className?: string }) {
  const destination = trustedApiHref(href);
  if (!destination) return null;
  return <a href={destination} className={cn(outlineClass, className)}><Download className="h-4 w-4" />{label}</a>;
}

export function PrintButton({ label = "Print" }: { label?: string }) {
  return <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" />{label}</Button>;
}

export function RefreshPageButton({ label = "Refresh" }: { label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  function refresh() {
    setBusy(true);
    router.refresh();
    window.setTimeout(() => setBusy(false), 500);
  }
  return <Button variant="outline" onClick={refresh} disabled={busy}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{busy ? "Refreshing…" : label}</Button>;
}

export function ApiMutationButton({
  endpoint,
  label,
  successMessage,
  confirmation,
  className,
}: {
  endpoint: string;
  label: string;
  successMessage: string;
  confirmation?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mockMode = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

  async function run() {
    if (busy || !trustedApiHref(endpoint)) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      if (!mockMode) {
        await browserRequest({
          url: endpoint,
          method: "POST",
          headers: { "Idempotency-Key": createIdempotencyKey("portal-action") },
        });
      }
      setMessage(mockMode ? "Preview validated. Laravel will perform this authorized action." : successMessage);
    } catch (caught) {
      setError(normalizeApiError(caught).message);
      throw caught;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      {confirmation ? (
        <ConfirmAction
          label={label}
          title={confirmation}
          confirmLabel={label}
          tone="primary"
          disabled={busy}
          triggerClassName={outlineClass}
          onConfirm={run}
        />
      ) : (
        <Button variant="outline" className="w-full" onClick={run} disabled={busy}>
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}{busy ? "Processing…" : label}
        </Button>
      )}
      {message ? <p role="status" className="text-xs leading-5 text-green-700">{message}</p> : null}
      {error ? <p role="alert" className="text-xs leading-5 text-red-700">{error}</p> : null}
    </div>
  );
}

type DownloadPayload = { url?: string; download_url?: string };

export function AuthorizedDownloadButton({ endpoint, label = "Download", className }: { endpoint: string; label?: string; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mockMode = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

  async function download() {
    if (busy || !trustedApiHref(endpoint)) return;
    setBusy(true);
    setError(null);
    try {
      if (mockMode) {
        setError("Preview mode: Laravel will issue a short-lived authorized download.");
        return;
      }
      const response = await browserRequest<ApiResponse<DownloadPayload>>({
        url: endpoint,
        method: "POST",
        headers: { "Idempotency-Key": createIdempotencyKey("authorized-download") },
      });
      const destination = trustedDestination(response.data.download_url || response.data.url || "", { currentOrigin: window.location.origin });
      if (!destination) throw new Error("The download destination returned by the server is not trusted.");
      window.location.assign(destination);
    } catch (caught) {
      setError(normalizeApiError(caught).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Button onClick={download} disabled={busy}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{busy ? "Preparing…" : label}</Button>
      {error ? <p role="status" className="max-w-xs text-xs leading-5 text-amber-700">{error}</p> : null}
    </div>
  );
}


type ViewPayload = { url?: string; view_url?: string; redirect_url?: string };

export function AuthorizedViewButton({ endpoint, label = "Open secure file", className }: { endpoint: string; label?: string; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mockMode = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

  async function open() {
    if (busy || !trustedApiHref(endpoint)) return;
    setBusy(true); setError(null);
    try {
      if (mockMode) {
        setError("Preview mode: Laravel will issue a short-lived authorized viewer URL.");
        return;
      }
      const response = await browserRequest<ApiResponse<ViewPayload>>({
        url: endpoint,
        method: "POST",
        headers: { "Idempotency-Key": createIdempotencyKey("authorized-view") },
      });
      const destination = trustedDestination(response.data.view_url || response.data.redirect_url || response.data.url || "", { currentOrigin: window.location.origin });
      if (!destination) throw new Error("The viewer destination returned by the server is not trusted.");
      window.open(destination, "_blank", "noopener,noreferrer");
    } catch (caught) { setError(normalizeApiError(caught).message); } finally { setBusy(false); }
  }

  return <div className={cn("space-y-2", className)}><Button variant="outline" className="w-full" onClick={open} disabled={busy}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}{busy ? "Authorizing…" : label}</Button>{error ? <p role="status" className="text-xs leading-5 text-amber-700">{error}</p> : null}</div>;
}
