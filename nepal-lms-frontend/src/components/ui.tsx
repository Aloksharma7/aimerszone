import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function ButtonLink({
  href,
  children,
  variant = "primary",
  size = "md",
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const variants = {
    primary: "bg-brand-700 text-white hover:bg-brand-800 border-brand-700",
    secondary: "bg-brand-50 text-brand-800 hover:bg-brand-100 border-brand-100",
    outline: "bg-white text-slate-800 hover:bg-slate-50 border-slate-300",
    ghost: "bg-transparent text-slate-700 hover:bg-slate-100 border-transparent",
    danger: "bg-red-700 text-white hover:bg-red-800 border-red-700",
  };
  const sizes = {
    sm: "h-9 px-3 text-sm",
    md: "h-11 px-4 text-sm",
    lg: "h-12 px-5 text-base",
  };

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg border font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function Button({
  children,
  type = "button",
  variant = "primary",
  size = "md",
  className,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  type?: "button" | "submit" | "reset";
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const variants = {
    primary: "bg-brand-700 text-white hover:bg-brand-800 border-brand-700",
    secondary: "bg-brand-50 text-brand-800 hover:bg-brand-100 border-brand-100",
    outline: "bg-white text-slate-800 hover:bg-slate-50 border-slate-300",
    ghost: "bg-transparent text-slate-700 hover:bg-slate-100 border-transparent",
    danger: "bg-red-700 text-white hover:bg-red-800 border-red-700",
  };
  const sizes = {
    sm: "h-9 px-3 text-sm",
    md: "h-11 px-4 text-sm",
    lg: "h-12 px-5 text-base",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg border font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  tone = "slate",
  className,
}: {
  children: React.ReactNode;
  tone?: "slate" | "blue" | "green" | "amber" | "red" | "violet";
  className?: string;
}) {
  const tones = {
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
    green: "bg-green-50 text-green-700 ring-green-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    violet: "bg-violet-50 text-violet-700 ring-violet-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  let tone: "slate" | "blue" | "green" | "amber" | "red" | "violet" = "slate";
  if (["active", "approved", "completed", "open", "present", "ongoing", "available", "live now"].some((value) => normalized.includes(value))) tone = "green";
  if (["upcoming", "submitted", "under review", "pending", "in progress"].some((value) => normalized.includes(value))) tone = "blue";
  if (["late", "flagged", "limited", "warning"].some((value) => normalized.includes(value))) tone = "amber";
  if (["rejected", "expired", "cancelled", "absent", "failed"].some((value) => normalized.includes(value))) tone = "red";
  if (["free", "draft", "paused"].some((value) => normalized.includes(value))) tone = "violet";
  return <Badge tone={tone}>{status}</Badge>;
}

export function ProgressBar({
  value,
  label,
  showValue = true,
  compact = false,
}: {
  value: number;
  label?: string;
  showValue?: boolean;
  compact?: boolean;
}) {
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div>
      {(label || showValue) && (
        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
          {label ? <span className="font-medium text-slate-700">{label}</span> : <span />}
          {showValue ? <span className="font-semibold tabular-nums text-slate-700">{safe}%</span> : null}
        </div>
      )}
      <div className={cn("overflow-hidden rounded-full bg-slate-100", compact ? "h-1.5" : "h-2.5")}>
        <div
          className="h-full rounded-full bg-brand-600 transition-[width] duration-500"
          style={{ width: `${safe}%` }}
          role="progressbar"
          aria-valuenow={safe}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label || "Progress"}
        />
      </div>
    </div>
  );
}

export function Panel({
  children,
  className,
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]",
        padded && "p-5 sm:p-6",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  align = "left",
  theme = "light",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  align?: "left" | "center";
  theme?: "light" | "dark";
}) {
  return (
    <div className={cn("mb-8", align === "center" && "mx-auto max-w-2xl text-center")}>
      <div className={cn("flex items-end justify-between gap-5", align === "center" && "justify-center")}>
        <div>
          {eyebrow ? <p className={cn("mb-2 text-sm font-bold uppercase tracking-[0.16em]", theme === "dark" ? "text-blue-200" : "text-brand-700")}>{eyebrow}</p> : null}
          <h2 className={cn("text-balance text-2xl font-bold tracking-tight sm:text-3xl", theme === "dark" ? "text-white" : "text-slate-950")}>{title}</h2>
          {description ? <p className={cn("mt-3 max-w-2xl text-base leading-7", theme === "dark" ? "text-slate-300" : "text-slate-600")}>{description}</p> : null}
        </div>
        {action ? <div className="hidden shrink-0 sm:block">{action}</div> : null}
      </div>
    </div>
  );
}

/*
 * Canonical form-control classes.
 *
 * Seven separate `inputClass` constants had grown across the codebase, each
 * subtly different — focus:ring-2 against focus:ring-4, brand-500 against
 * brand-600, h-10/h-11/h-12 for the same kind of control, some with a white
 * fill and some without. Thirty more fields carried a border and no focus
 * style at all, which is invisible to a mouse user and a dead end for a
 * keyboard one (WCAG 2.4.7).
 *
 * Import these instead of writing the classes again. `fieldClass` has no
 * margin so it composes; `labelledFieldClass` adds the mt-2 used under a label.
 */
export const fieldClass =
  "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100 disabled:text-slate-500";

export const labelledFieldClass = `mt-2 ${fieldClass} font-normal`;

export const compactFieldClass =
  "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100 disabled:text-slate-500";

export const textareaClass =
  "mt-2 min-h-32 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm font-normal text-slate-900 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  back,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;

  /*
   * Route back to the list this record came from.
   *
   * Every detail and "new" page needs one. Several were reached through
   * router.replace after a save, which leaves the browser's back button
   * pointing at the form that was just submitted rather than at the list —
   * so without an explicit link there is no way out except the sidebar,
   * and on a record like a payment that reads as the record being lost.
   */
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:mb-8 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        {back ? (
          <Link
            href={back.href}
            className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 transition hover:text-brand-700"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {back.label}
          </Link>
        ) : null}
        {eyebrow ? <p className="mb-1 text-sm font-bold uppercase tracking-[0.14em] text-brand-700">{eyebrow}</p> : null}
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "blue",
}: {
  label: string;
  value: string;
  detail?: string;
  icon: LucideIcon;
  tone?: "blue" | "green" | "amber" | "violet" | "slate" | "red";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    amber: "bg-amber-50 text-amber-700",
    violet: "bg-violet-50 text-violet-700",
    slate: "bg-slate-100 text-slate-700",
    red: "bg-red-50 text-red-700",
  };
  return (
    <Panel className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{value}</p>
          {detail ? <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p> : null}
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", tones[tone])}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
    </Panel>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
        <Inbox className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function AlertBox({
  title,
  children,
  tone = "info",
}: {
  title: string;
  children: React.ReactNode;
  tone?: "info" | "success" | "warning" | "danger";
}) {
  const tones = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    success: "border-green-200 bg-green-50 text-green-900",
    warning: "border-amber-200 bg-amber-50 text-amber-950",
    danger: "border-red-200 bg-red-50 text-red-900",
  };
  const Icon = tone === "success" ? CheckCircle2 : AlertCircle;
  return (
    <div className={cn("flex gap-3 rounded-xl border p-4", tones[tone])}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-semibold">{title}</p>
        <div className="mt-1 text-sm leading-6 opacity-90">{children}</div>
      </div>
    </div>
  );
}

export function InlineLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:text-brand-900">
      {children}
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}
