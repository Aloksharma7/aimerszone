import Image from "next/image";
import Link from "next/link";
import { BookOpenCheck } from "lucide-react";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

export function Brand({
  href = "/",
  compact = false,
  light = false,
  className,
  name,
  tagline,
  logoUrl,
}: {
  href?: string;
  compact?: boolean;
  light?: boolean;
  className?: string;
  /** Administrator-managed name; falls back to the compiled-in default. */
  name?: string;
  tagline?: string;
  /** Administrator-uploaded logo; falls back to the built-in mark when unset. */
  logoUrl?: string | null;
}) {
  const displayName = name || siteConfig.name;
  return (
    <Link href={href} className={cn("inline-flex min-w-0 items-center gap-3", className)} aria-label={`${displayName} home`}>
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border shadow-sm",
          light ? "border-white/15 bg-white/10 text-white" : "border-brand-800 bg-brand-900 text-white",
        )}
      >
        {logoUrl ? (
          <Image src={logoUrl} alt="" width={40} height={40} className="h-full w-full object-cover" unoptimized />
        ) : (
          <BookOpenCheck className="h-5 w-5" aria-hidden="true" />
        )}
      </span>
      {!compact ? (
        <span className="min-w-0">
          <span className={cn("block truncate text-[15px] font-bold leading-5", light ? "text-white" : "text-slate-950")}>{displayName}</span>
          <span className={cn("block truncate text-[11px] font-medium", light ? "text-blue-100" : "text-slate-500")}>{tagline || "Learn with a clear plan"}</span>
        </span>
      ) : null}
    </Link>
  );
}
