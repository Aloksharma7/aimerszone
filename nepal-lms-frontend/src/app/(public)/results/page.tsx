import { ShieldCheck } from "lucide-react";
import { PublicPageHero } from "@/components/public-page";
import { ButtonLink, Panel } from "@/components/ui";

export default function ResultsPage() {
  return <><PublicPageHero eyebrow="Verified outcomes" title="Results will appear only after verification" description="The platform does not publish invented pass rates, rankings, testimonials or student counts." /><section className="bg-canvas py-16"><div className="mx-auto max-w-2xl px-4 sm:px-6"><Panel className="text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><ShieldCheck className="h-7 w-7" /></div><h2 className="mt-5 text-xl font-bold text-slate-950">No verified result content has been supplied</h2><p className="mt-3 text-sm leading-7 text-slate-600">This page is intentionally honest. Administrators can publish approved outcomes later with clear source and context.</p><ButtonLink href="/courses" className="mt-6">Explore courses</ButtonLink></Panel></div></section></>;
}
