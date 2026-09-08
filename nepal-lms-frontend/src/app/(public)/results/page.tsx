import { ShieldCheck } from "lucide-react";
import { PublicPageHero } from "@/components/public-page";
import { ButtonLink, Panel } from "@/components/ui";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Results",
  description: "Real, verified student results and success stories from Aimers Zone — no invented pass rates, rankings or student counts.",
});

export default function ResultsPage() {
  return <><PublicPageHero eyebrow="Results" title="Real results, shared honestly" description="We only publish results and success stories we can stand behind — no invented pass rates, rankings or student counts." /><section className="bg-canvas py-16"><div className="mx-auto max-w-2xl px-4 sm:px-6"><Panel className="text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><ShieldCheck className="h-7 w-7" /></div><h2 className="mt-5 text-xl font-bold text-slate-950">Verified results are on their way</h2><p className="mt-3 text-sm leading-7 text-slate-600">We&apos;re gathering verified outcomes from our students to share here soon. In the meantime, explore our courses and see how Aimers Zone can help you build strong concepts and achieve your goals.</p><ButtonLink href="/courses" className="mt-6">Explore courses</ButtonLink></Panel></div></section></>;
}
