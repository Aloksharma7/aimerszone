import { CircleHelp } from "lucide-react";
import { FaqManager } from "@/components/admin/faq-manager";
import { PageHeader } from "@/components/ui";
import { getAdminFaqs } from "@/lib/data/admin";

export default async function AdminFaqsPage() {
  const faqs = await getAdminFaqs();

  return (
    <>
      <PageHeader
        eyebrow="Public site"
        title="FAQs"
        description="Shown on the public FAQ page and the student support page. Unpublished entries stay hidden from both."
        actions={
          <div className="flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700">
            <CircleHelp className="h-4 w-4" />
            {faqs.length} {faqs.length === 1 ? "entry" : "entries"}
          </div>
        }
      />
      <FaqManager faqs={faqs} />
    </>
  );
}
