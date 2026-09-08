import { HelpCircle, Headphones, MessageCircle, Phone } from "lucide-react";
import { StudentSupportManager } from "@/components/support/support-forms";
import { ButtonLink, PageHeader, Panel } from "@/components/ui";
import { getStudentSupportData } from "@/lib/data/support";
import { getPublicSettings, type PublicSettings } from "@/lib/data/settings";

function buildSupportOptions(settings: PublicSettings) {
  return [
    { Icon: MessageCircle, title: "WhatsApp", detail: "Best for quick course and payment questions", action: "Open WhatsApp", href: `https://wa.me/${settings.whatsapp.replace(/\D/g, "")}` },
    { Icon: Phone, title: "Call support", detail: settings.phone, action: "Call now", href: `tel:${settings.phone.replace(/[^+\d]/g, "")}` },
    { Icon: Headphones, title: "Create ticket", detail: "Track a support request in your account", action: "Use form below", href: "#support-ticket-form" },
    { Icon: HelpCircle, title: "Read FAQs", detail: "Find answers about access and recordings", action: "Open FAQs", href: "/faq" },
  ];
}

export default async function StudentSupportPage() {
  // Was reading the compiled-in siteConfig directly, so an administrator's
  // phone/WhatsApp edit in Settings never reached the one page a logged-in
  // student actually goes to for help.
  const [data, settings] = await Promise.all([getStudentSupportData(), getPublicSettings()]);
  const supportOptions = buildSupportOptions(settings);
  return <><PageHeader eyebrow="Help" title="Student Support" description="Get help with payments, enrollment, access, account security or learning content." /><div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{supportOptions.map(({ Icon, title, detail, action, href }) => <Panel key={title}><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Icon className="h-5 w-5" /></div><h2 className="mt-5 font-bold text-slate-950">{title}</h2><p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">{detail}</p>{href.startsWith("http") || href.startsWith("tel:") ? <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined} className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50">{action}</a> : <ButtonLink href={href} variant="outline" className="mt-5 w-full">{action}</ButtonLink>}</Panel>)}</div><div id="support-ticket-form" className="mt-6 scroll-mt-24"><StudentSupportManager initialData={data} /></div></>;
}
