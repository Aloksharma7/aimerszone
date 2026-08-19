import { RefreshCw, WifiOff } from "lucide-react";
import { ButtonLink } from "@/components/ui";

export default function OfflinePage() {
  return <main id="main-content" className="flex min-h-screen items-center justify-center bg-canvas px-4"><div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-card sm:p-10"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-600"><WifiOff className="h-8 w-8"/></div><p className="mt-6 text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Connection unavailable</p><h1 className="mt-3 text-3xl font-bold text-slate-950">Check your internet connection.</h1><p className="mt-3 leading-7 text-slate-600">Your submitted answers or payment proof should not be assumed saved until the server confirms success.</p><ButtonLink href="/" className="mt-7"><RefreshCw className="h-4 w-4"/>Retry from home</ButtonLink></div></main>;
}
