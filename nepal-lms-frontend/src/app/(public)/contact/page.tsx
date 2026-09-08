import { Clock3, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { PublicPageHero } from "@/components/public-page";
import { PublicSupportRequestForm } from "@/components/support/support-forms";
import { Panel } from "@/components/ui";
import { getPublicSettings, type PublicSettings } from "@/lib/data/settings";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Contact Us",
  description: "Get in touch with Aimers Zone in Birgunj by phone, WhatsApp or email for help with courses, enrollment and payments.",
});

function buildSupportCards(settings: PublicSettings) {
  return [
    { Icon: MessageCircle, title: "WhatsApp support", detail: "Fastest for course and payment questions", action: "Open WhatsApp", href: `https://wa.me/${settings.whatsapp.replace(/\D/g, "")}` },
    { Icon: Phone, title: "Phone", detail: settings.phone, action: "Call support", href: `tel:${settings.phone.replace(/[^+\d]/g, "")}` },
    { Icon: Mail, title: "Email", detail: settings.email, action: "Send email", href: `mailto:${settings.email}` },
    { Icon: MapPin, title: "Address", detail: settings.address, action: "View location", href: settings.mapUrl },
  ];
}

export default async function ContactPage() {
  // Was reading the compiled-in siteConfig directly, so this page — the one
  // literally called "Contact" — was the one place an administrator's phone,
  // WhatsApp, email or address edit in Settings never actually reached,
  // unlike the footer, header and every other surface that calls this.
  const settings = await getPublicSettings();
  const supportCards = buildSupportCards(settings);
  return <><PublicPageHero eyebrow="Contact" title="Get clear help without guessing" description="Use the channel that fits your question. Payment approval and enrollment access always follow the institution's verified process." /><section className="bg-canvas py-12 sm:py-16"><div className="mx-auto grid max-w-6xl gap-7 px-4 sm:px-6 lg:grid-cols-[380px_1fr] lg:px-8"><div className="space-y-4">{supportCards.map(({ Icon, title, detail, action, href }) => <Panel key={title} className="flex gap-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Icon className="h-5 w-5" /></div><div><h2 className="font-bold text-slate-950">{title}</h2><p className="mt-1 text-sm leading-6 text-slate-600">{detail}</p><a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined} className="mt-2 inline-flex text-sm font-bold text-brand-700 hover:text-brand-900">{action}</a></div></Panel>)}<Panel className="flex gap-4"><Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" /><div><h2 className="font-bold text-slate-950">Support hours</h2><p className="mt-1 text-sm leading-6 text-slate-600">{settings.supportHours}</p></div></Panel></div><PublicSupportRequestForm /></div></section></>;
}
