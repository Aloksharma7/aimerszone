import Link from "next/link";
import { ArrowLeft, BookOpenCheck, CheckCircle2, Headphones, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/brand";
import { SessionIntegrity } from "@/components/auth/session-integrity";
import { getPublicSettings } from "@/lib/data/settings";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const settings = await getPublicSettings();
  return (
    <main id="main-content" className="min-h-screen bg-canvas lg:grid lg:grid-cols-[.9fr_1.1fr]">
      {/* change-password, two-factor-challenge and verify-email in this group show
          content tied to a specific signed-in account; guarding the whole group is
          simplest and costs the guest-only pages (login, register) nothing real. */}
      <SessionIntegrity />
      <aside className="relative hidden overflow-hidden bg-brand-950 p-10 text-white lg:flex lg:flex-col xl:p-14">
        <div className="dot-pattern absolute inset-0 opacity-25" />
        <div className="relative flex items-center justify-between gap-4">
          <Brand light name={settings.name} tagline={settings.tagline} logoUrl={settings.logoUrl} />
          <Link href="/" className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-slate-300 hover:text-white"><ArrowLeft className="h-4 w-4" />Back to website</Link>
        </div>
        <div className="relative my-auto max-w-lg py-14"><p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-200">One connected learning space</p><h2 className="mt-4 text-4xl font-bold leading-tight">The next class, recording or test is always clear.</h2><p className="mt-5 text-base leading-8 text-slate-300">A calm portal for batch schedules, learning progress, payment status and support.</p><div className="mt-8 grid gap-4">{[[BookOpenCheck,"Courses stay organized by batch"],[ShieldCheck,"Paid access follows verified approval"],[Headphones,"Support remains easy to reach"]].map(([Icon,label])=>{const C=Icon as typeof BookOpenCheck;return <div key={String(label)} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] p-4"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-blue-200"><C className="h-5 w-5" /></div><span className="font-semibold text-slate-100">{String(label)}</span><CheckCircle2 className="ml-auto h-5 w-5 text-green-400" /></div>})}</div></div>
        <p className="relative text-xs text-slate-500">Your sign-in is protected with secure, server-side session handling.</p>
      </aside>
      <section className="flex min-h-screen flex-col">
        <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-8 lg:hidden"><Brand name={settings.name} tagline={settings.tagline} logoUrl={settings.logoUrl} /><Link href="/" aria-label="Back to website" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"><ArrowLeft className="h-5 w-5" /></Link></header>
        <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8"><div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">{children}</div></div>
        <footer className="px-6 pb-8 text-center text-xs text-slate-400">Protected by server-side permissions when connected to the API.</footer>
      </section>
    </main>
  );
}
