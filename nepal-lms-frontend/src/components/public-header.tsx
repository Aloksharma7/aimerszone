"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Search, X } from "lucide-react";
import { useState } from "react";
import { Brand } from "@/components/brand";
import { ButtonLink } from "@/components/ui";
import { cn } from "@/lib/utils";

const links = [
  { href: "/courses", label: "Courses" },
  { href: "/free-learning", label: "Free Learning" },
  { href: "/teachers", label: "Teachers" },

  // This page existed with nothing anywhere linking to it.
  { href: "/services", label: "Services" },

  // Not in the nav: the page has no real pass-rate or testimonial data to
  // show yet, and never fabricates any. The route stays reachable directly
  // for whenever there is real data to publish.
  { href: "/about", label: "About" },
  { href: "/contact", label: "Support" },
];

/**
 * `session` is resolved on the server by the public layout and passed down, so
 * the header renders the correct state on first paint rather than flashing a
 * Login button to someone who is already signed in.
 */
export type HeaderSession = { name: string; portalHome: string } | null;
export type HeaderBranding = { name: string } | undefined;

export function PublicHeader({ session = null, branding }: { session?: HeaderSession; branding?: HeaderBranding }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Brand name={branding?.name} />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
          {links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                  active ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/courses" className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100" aria-label="Search courses">
            <Search className="h-5 w-5" />
          </Link>
          {session ? (
            <ButtonLink href={session.portalHome} variant="ghost" size="sm">
              <span className="max-w-[10rem] truncate">{session.name}</span>
            </ButtonLink>
          ) : (
            <ButtonLink href="/login" variant="ghost" size="sm">Login</ButtonLink>
          )}
          <ButtonLink href={session ? session.portalHome : "/courses"} size="sm">
            {session ? "My workspace" : "Explore Courses"}
          </ButtonLink>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-700 lg:hidden"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-slate-200 bg-white px-4 pb-5 pt-3 lg:hidden">
          <nav className="mx-auto grid max-w-7xl gap-1" aria-label="Mobile navigation">
            <Link href="/" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Home</Link>
            {links.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                {link.label}
              </Link>
            ))}
            <Link href="/payment-instructions" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Payment Instructions</Link>
          </nav>
          <div className="mx-auto mt-4 grid max-w-7xl grid-cols-2 gap-3 border-t border-slate-100 pt-4">
            {session ? (
              <ButtonLink href={session.portalHome} className="col-span-2 w-full">My workspace</ButtonLink>
            ) : (
              <>
                <ButtonLink href="/login" variant="outline" className="w-full">Login</ButtonLink>
                <ButtonLink href="/register" className="w-full">Register</ButtonLink>
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
