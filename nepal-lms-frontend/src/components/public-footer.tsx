import Link from "next/link";
import { Facebook, Instagram, Mail, MapPin, MessageCircle, Phone, Youtube } from "lucide-react";
import { Brand } from "@/components/brand";
import { siteConfig } from "@/lib/site";
import type { PublicSettings } from "@/lib/data/settings";

const courseLinks = ["Management", "Entrance Preparation", "Banking & Loksewa", "Free Learning"];
const supportLinks = [
  { label: "Contact Support", href: "/contact" },
  { label: "Payment Instructions", href: "/payment-instructions" },
  { label: "Frequently Asked Questions", href: "/faq" },
  { label: "Student Login", href: "/login" },
];
const policyLinks = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Refund Policy", href: "/refund-policy" },
  { label: "Recording Policy", href: "/recording-policy" },
];

export function PublicFooter({ settings }: { settings?: PublicSettings }) {
  // Administrator-managed values when the caller resolved them, otherwise the
  // compiled-in defaults so the component still renders standalone.
  const site = settings ?? siteConfig;
  return (
    <footer className="border-t border-slate-800 bg-slate-950 text-slate-300">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Brand light name={site.name} tagline={site.tagline} logoUrl={settings?.logoUrl ?? null} />
            <p className="mt-5 max-w-md text-sm leading-7 text-slate-400">{site.tagline} Built for batch-based learning, mobile access and clear human support.</p>
            <div className="mt-6 space-y-3 text-sm">
              <p className="flex items-start gap-3"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-300" />{site.address}</p>
              <p className="flex items-center gap-3"><Phone className="h-4 w-4 shrink-0 text-blue-300" />{site.phone}</p>
              <p className="flex items-center gap-3"><Mail className="h-4 w-4 shrink-0 text-blue-300" />{site.email}</p>
              <p className="flex items-center gap-3"><MessageCircle className="h-4 w-4 shrink-0 text-blue-300" />WhatsApp support available</p>
            </div>
            <div className="mt-6 flex items-center gap-3">
              {site.facebookUrl ? (
                <a href={site.facebookUrl} target="_blank" rel="noopener noreferrer" aria-label="Aimers Zone on Facebook" className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-800 text-slate-300 transition-colors hover:border-brand-700 hover:text-brand-500">
                  <Facebook className="h-4 w-4" />
                </a>
              ) : null}
              {site.instagramUrl ? (
                <a href={site.instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Aimers Zone on Instagram" className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-800 text-slate-300 transition-colors hover:border-brand-700 hover:text-brand-500">
                  <Instagram className="h-4 w-4" />
                </a>
              ) : null}
              {site.youtubeUrl ? (
                <a href={site.youtubeUrl} target="_blank" rel="noopener noreferrer" aria-label="Aimers Zone on YouTube" className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-800 text-slate-300 transition-colors hover:border-brand-700 hover:text-brand-500">
                  <Youtube className="h-4 w-4" />
                </a>
              ) : null}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">Courses</h3>
            <ul className="mt-4 space-y-3 text-sm">
              {courseLinks.map((label) => <li key={label}><Link href="/courses" className="hover:text-white">{label}</Link></li>)}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">Support</h3>
            <ul className="mt-4 space-y-3 text-sm">
              {supportLinks.map((link) => <li key={link.href}><Link href={link.href} className="hover:text-white">{link.label}</Link></li>)}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">Policies</h3>
            <ul className="mt-4 space-y-3 text-sm">
              {policyLinks.map((link) => <li key={link.href}><Link href={link.href} className="hover:text-white">{link.label}</Link></li>)}
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-slate-800 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 {site.name}. All rights reserved.</p>
          <p>English-first · Nepali-ready · Nepal Time (NPT)</p>
        </div>
      </div>
    </footer>
  );
}
