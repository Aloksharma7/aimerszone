import { FaqList } from "@/components/faq-list";
import { PublicPageHero } from "@/components/public-page";
import { ButtonLink, Panel } from "@/components/ui";
import { getPublicFaqs } from "@/lib/data/public";

const extra = [
  { question: "When can I join a live class?", answer: "The Join button appears only inside the authorised window defined by the institution, commonly a few minutes before the scheduled class. The page shows Nepal time clearly." },
  { question: "Does an unlisted recording mean it cannot be shared?", answer: "No. Unlisted hosting reduces discovery but is not DRM. Students must follow the recording and account-sharing policy." },
  { question: "Can staff see my complete financial information?", answer: "The interface should show only the information needed to verify the submitted payment. Sensitive proof access remains permission-controlled and audited." },
  { question: "What happens after a batch ends?", answer: "The batch page and student workspace show the approved access-expiry rule. Recording access may continue for a defined period or end with the batch, depending on institution policy." },
];

export default async function FaqPage() {
  const faqs = await getPublicFaqs();
  return (
    <><PublicPageHero eyebrow="Frequently asked questions" title="Clear answers before and after enrollment" description="Understand batches, payments, access, live classes, recordings and support without searching through separate messages." />
    <section className="bg-canvas py-12 sm:py-16"><div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8"><FaqList items={[...faqs, ...extra]} /><Panel className="mt-6 text-center"><h2 className="text-xl font-bold text-slate-950">Still unsure?</h2><p className="mt-2 text-sm leading-6 text-slate-600">Contact the enrollment team with the course or batch name.</p><ButtonLink href="/contact" className="mt-5">Contact support</ButtonLink></Panel></div></section></>
  );
}
