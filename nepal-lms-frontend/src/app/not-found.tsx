import { ArrowLeft, SearchX } from "lucide-react";
import { Brand } from "@/components/brand";
import { ButtonLink } from "@/components/ui";
import { getPublicSettings } from "@/lib/data/settings";

export default async function NotFound() {
  const settings = await getPublicSettings();
  return (
    <main id="main-content" className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-lg text-center">
        <div className="mb-8 flex justify-center"><Brand name={settings.name} tagline={settings.tagline} logoUrl={settings.logoUrl}/></div>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><SearchX className="h-8 w-8"/></div>
        <p className="mt-6 text-sm font-bold uppercase tracking-[0.16em] text-brand-700">404 · Page not found</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">This page is not available.</h1>
        <p className="mt-3 text-base leading-7 text-slate-600">The link may be outdated, the content may be unpublished, or your route may be incomplete.</p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><ButtonLink href="/" variant="outline"><ArrowLeft className="h-4 w-4"/>Return home</ButtonLink><ButtonLink href="/courses">Explore courses</ButtonLink></div>
      </div>
    </main>
  );
}
