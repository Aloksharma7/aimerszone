import { ClipboardCheck, CreditCard, Headphones, MonitorPlay, PlayCircle, Users } from "lucide-react";
import { PublicPageHero } from "@/components/public-page";
import { ButtonLink, Panel, SectionHeading } from "@/components/ui";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Our Services",
  description: "Live batch classes, recordings, focused tests, manual and online payment options, and dedicated student support — everything Aimers Zone offers to help you prepare with confidence.",
});

export default function ServicesPage() {
  const services = [
    [MonitorPlay, "Live batch classes", "Scheduled Zoom classes with clear Nepal-time details and authorised joining."],
    [PlayCircle, "Recordings and learning resources", "Released recordings, notes and files organized by course module."],
    [ClipboardCheck, "Tests and progress", "Timed MCQ tests, saved attempts, released results and separate progress measures."],
    [CreditCard, "Manual payment verification", "QR or bank instructions, proof upload, review status, rejection reason and receipts."],
    [Users, "Enrollment assistance", "Staff can register students, submit supplied proofs and correct permitted account details."],
    [Headphones, "Student support", "Visible support paths for payment, access, account and learning questions."],
  ];
  return (
    <><PublicPageHero eyebrow="Learning services" title="Everything needed for a complete batch experience" description="Public discovery, enrollment, live learning, revision and support use one connected interface." />
    <section className="bg-canvas py-12 sm:py-16"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{services.map(([Icon,title,detail])=>{const C=Icon as typeof MonitorPlay;return <Panel key={String(title)}><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><C className="h-6 w-6" /></div><h2 className="mt-5 text-lg font-bold text-slate-950">{String(title)}</h2><p className="mt-2 text-sm leading-7 text-slate-600">{String(detail)}</p></Panel>})}</div></div></section>
    <section className="bg-white py-14"><div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8"><SectionHeading title="Ready to see the current batches?" description="Compare the practical information first, then contact support when you need help deciding." align="center" /><div className="flex flex-col justify-center gap-3 sm:flex-row"><ButtonLink href="/courses">Explore courses</ButtonLink><ButtonLink href="/contact" variant="outline">Contact support</ButtonLink></div></div></section></>
  );
}
