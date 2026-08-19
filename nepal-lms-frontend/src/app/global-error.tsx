"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <html lang="en">
      <body>
        <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-card sm:p-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-700"><AlertTriangle className="h-8 w-8"/></div>
            <p className="mt-6 text-sm font-bold uppercase tracking-[0.16em] text-red-700">Something went wrong</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">The page could not be loaded.</h1>
            <p className="mt-3 text-base leading-7 text-slate-600">Retry the request. If the problem continues, return to a safe page and contact support with the time of the error.</p>
            {error.digest ? <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-500">Reference: {error.digest}</p> : null}
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><Button onClick={reset}><RefreshCw className="h-4 w-4"/>Try again</Button><ButtonLink href="/" variant="outline">Return home</ButtonLink></div>
          </div>
        </main>
      </body>
    </html>
  );
}
