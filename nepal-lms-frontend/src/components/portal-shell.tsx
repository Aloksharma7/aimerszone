"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NotificationBell } from "@/components/notification-bell";
import {
  Bell,
  BookOpen,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  CreditCard,
  FileBarChart,
  FileText,
  FolderTree,
  GraduationCap,
  Headphones,
  Home,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  MessageSquare,
  MonitorPlay,
  ReceiptText,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  Users,
  Video,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Brand } from "@/components/brand";
import { Badge } from "@/components/ui";
import { browserRequest } from "@/lib/api/browser-client";
import { can, portalHomeByMachineRole } from "@/lib/auth/roles";
import { cn, initials } from "@/lib/utils";
import type { PortalRole, SessionUser } from "@/types/lms";

type NavItem = { label: string; href: string; icon: LucideIcon; permission?: string };

const navByRole: Record<PortalRole, NavItem[]> = {
  student: [
    { label: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
    /*
     * Deliberately ungated. Course discovery is the entry point to enrolling,
     * and it shows the same public catalogue as the marketing site — there is
     * nothing here to protect. Gating it on a permission row meant that a
     * single missing grant silently removed the only in-portal way to find a
     * course, with no error anywhere.
     */
    { label: "Explore Courses", href: "/student/explore", icon: Search },
    { label: "My Courses", href: "/student/courses", icon: BookOpen },
    { label: "Recorded Classes", href: "/student/recordings", icon: MonitorPlay, permission: "recordings.view" },
    { label: "PDFs & Resources", href: "/student/resources", icon: FileText, permission: "resources.view" },
    { label: "Tests", href: "/student/tests", icon: ClipboardCheck, permission: "tests.view" },
    { label: "Payments", href: "/student/payments", icon: CreditCard, permission: "payments.view" },
    { label: "Notifications", href: "/student/notifications", icon: Bell },
    { label: "Profile & Security", href: "/student/profile", icon: UserRound },
    { label: "Support", href: "/student/support", icon: Headphones },
  ],
  teacher: [
    { label: "Dashboard", href: "/teacher/dashboard", icon: LayoutDashboard },
    { label: "My Batches", href: "/teacher/batches", icon: BookOpen, permission: "batches.view" },
    { label: "Classes", href: "/teacher/classes", icon: CalendarDays, permission: "sessions.view" },
    { label: "Attendance", href: "/teacher/attendance", icon: CheckSquare, permission: "attendance.view" },
    { label: "Tests & Content", href: "/teacher/content", icon: Library },
    { label: "Announcements", href: "/teacher/announcements", icon: MessageSquare, permission: "announcements.manage" },
    { label: "Profile & Security", href: "/teacher/profile", icon: UserRound },
  ],
  /*
   * Staff merges the former enrollment-officer and accountant roles into
   * one, so the sidebar shows every capability regardless of which URL
   * prefix (/staff or /accounting) is currently open — see `accounting`
   * below, which reuses this exact array rather than a shorter one.
   *
   * Every href stays under /staff — the underlying pages are shared with
   * /accounting (portalPath() keeps internal links in whichever portal the
   * request came from), but a staff member's own sidebar should never show
   * them a URL for a portal nobody told them they were in.
   *
   * Financial Reports and Outstanding are deliberately not here: those are
   * institution-wide figures, kept to admin only (reports.financial), not
   * part of the day-to-day enrollment-and-payments work this role does.
   */
  staff: [
    { label: "Dashboard", href: "/staff/dashboard", icon: LayoutDashboard },
    { label: "Courses", href: "/staff/courses", icon: BookOpen, permission: "courses.view" },
    { label: "Categories", href: "/staff/categories", icon: FolderTree, permission: "categories.manage" },
    { label: "Students", href: "/staff/students", icon: Users, permission: "students.view" },
    { label: "Payment Submissions", href: "/staff/payment-submissions", icon: WalletCards, permission: "payments.view" },
    { label: "Enrollments", href: "/staff/enrollments", icon: GraduationCap, permission: "enrollments.view" },
    { label: "Account Assistance", href: "/staff/support-actions", icon: Headphones, permission: "students.manage" },
    { label: "Support Inbox", href: "/staff/support", icon: MessageSquare, permission: "support.view" },
    { label: "Review Payments", href: "/staff/payments", icon: CreditCard, permission: "payments.review" },
    { label: "Receipts", href: "/staff/receipts", icon: ReceiptText, permission: "payments.view" },
    { label: "Adjustments", href: "/staff/adjustments", icon: CreditCard, permission: "payments.adjust" },
    { label: "Refunds", href: "/staff/refunds", icon: RotateCcw, permission: "payments.refund" },
  ],
  get accounting() {
    return navByRole.staff;
  },
  admin: [
    { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { label: "Courses", href: "/admin/courses", icon: BookOpen, permission: "courses.view" },
    { label: "Categories", href: "/admin/categories", icon: FolderTree, permission: "courses.view" },
    { label: "FAQs", href: "/admin/faqs", icon: CircleHelp, permission: "faqs.manage" },
    { label: "Batches", href: "/admin/batches", icon: CalendarDays, permission: "batches.view" },
    { label: "Users & Roles", href: "/admin/users", icon: Users, permission: "users.view" },
    { label: "Finance Oversight", href: "/admin/finance", icon: WalletCards, permission: "payments.view" },

    /*
     * Payment review and enrolment, under /admin.
     *
     * These existed only in the accounting and staff portals, so an
     * administrator had to leave their own portal — or sign in as another
     * user — to approve the money a student had already paid. The API grants
     * administrators every role gate, so hiding these enforced nothing.
     */
    { label: "Payment Review", href: "/admin/payments", icon: CreditCard, permission: "payments.view" },
    { label: "Enrollments", href: "/admin/enrollments", icon: GraduationCap, permission: "enrollments.view" },
    { label: "Announcements", href: "/admin/announcements", icon: MessageSquare, permission: "announcements.manage" },
    { label: "Reports", href: "/admin/reports/academic", icon: FileBarChart, permission: "reports.view" },
    { label: "Platform", href: "/admin/platform", icon: SlidersHorizontal, permission: "settings.manage" },
    /*
     * Oversight screens, served under /admin so an administrator never leaves
     * their own portal. These used to point at /teacher/... and /staff/...,
     * which swapped both the URL and the entire sidebar mid-session.
     */
    { label: "Classes", href: "/admin/classes", icon: Video, permission: "sessions.view" },
    { label: "Attendance", href: "/admin/attendance", icon: ClipboardCheck, permission: "attendance.view" },
    { label: "Content & PDFs", href: "/admin/content", icon: FileText },
    { label: "Students", href: "/admin/students", icon: Users, permission: "students.view" },
    { label: "Support Inbox", href: "/admin/support", icon: Headphones, permission: "support.view" },
    { label: "Integrations", href: "/admin/integrations/zoom", icon: ShieldCheck, permission: "settings.manage" },
    { label: "Settings & Audit", href: "/admin/settings", icon: Settings, permission: "settings.manage" },
    { label: "Roles & Permissions", href: "/admin/roles", icon: ShieldCheck, permission: "roles.manage" },
  ],
};

/**
 * Where the header search goes for each portal.
 *
 * A single global search index does not exist, and pretending otherwise was the
 * previous behaviour — a box that looked functional and did nothing. Each
 * portal instead searches the list its user actually looks people or content up
 * in, using the same ?q= filter those pages already support.
 */
/*
 * The parameter name is `search` everywhere — the public catalogue, the audit
 * log and every list filter already use it. This box was the only place
 * sending `q`, so on two portals it navigated to a page that read a different
 * key and the query silently evaporated.
 */
const searchTarget: Record<PortalRole, string> = {
  student: "/student/explore",
  teacher: "/teacher/batches",
  staff: "/staff/students",
  accounting: "/accounting/payments",
  admin: "/admin/users",
};

const searchPlaceholder: Record<PortalRole, string> = {
  student: "Search courses",
  teacher: "Search your batches",
  staff: "Search students",
  accounting: "Search payments",
  admin: "Search users",
};

/**
 * Every role now gets a working bell, not just students — teacher, staff
 * and admin previously got a plain dashboard-link icon with no feed at all.
 * "accounting" shares staff's backend role and feed; there is no separate
 * accounting notification endpoint.
 */
const notificationRouteByRole: Record<PortalRole, { href: string; endpoint: string }> = {
  student: { href: "/student/notifications", endpoint: "/api/v1/student/notifications" },
  teacher: { href: "/teacher/notifications", endpoint: "/api/v1/teacher/notifications" },
  staff: { href: "/staff/notifications", endpoint: "/api/v1/staff/notifications" },
  accounting: { href: "/staff/notifications", endpoint: "/api/v1/staff/notifications" },
  admin: { href: "/admin/notifications", endpoint: "/api/v1/admin/notifications" },
};

const roleLabels: Record<PortalRole, string> = {
  student: "Student",
  teacher: "Teacher",
  staff: "Staff",
  accounting: "Staff",
  admin: "Administrator",
};

const machineRoleLabels = {
  student: "Student",
  teacher: "Teacher",
  staff: "Staff",
  admin: "Admin",
  super_admin: "Super Admin",
} as const;

const mobileNavByRole: Record<PortalRole, NavItem[]> = {
  student: [
    { label: "Home", href: "/student/dashboard", icon: Home },
    { label: "Explore", href: "/student/explore", icon: Search, permission: "courses.view" },
    { label: "Courses", href: "/student/courses", icon: BookOpen },
    { label: "Recordings", href: "/student/recordings", icon: MonitorPlay, permission: "recordings.view" },
    { label: "PDFs", href: "/student/resources", icon: FileText, permission: "resources.view" },
  ],
  teacher: [
    { label: "Home", href: "/teacher/dashboard", icon: Home },
    { label: "Batches", href: "/teacher/batches", icon: BookOpen, permission: "batches.view" },
    { label: "Classes", href: "/teacher/classes", icon: CalendarDays, permission: "sessions.view" },
    { label: "Attendance", href: "/teacher/attendance", icon: CheckSquare, permission: "attendance.view" },
    { label: "Profile", href: "/teacher/profile", icon: UserRound },
  ],
  staff: [
    { label: "Home", href: "/staff/dashboard", icon: Home },
    { label: "Courses", href: "/staff/courses", icon: BookOpen, permission: "courses.view" },
    { label: "Students", href: "/staff/students", icon: Users, permission: "students.view" },
    { label: "Payments", href: "/staff/payment-submissions", icon: WalletCards, permission: "payments.view" },
    { label: "Enrollments", href: "/staff/enrollments", icon: GraduationCap, permission: "enrollments.view" },
  ],
  // A shorter set on this URL specifically, so the first five items on
  // mobile are the payment-review shortcuts, not a repeat of /staff's.
  accounting: [
    { label: "Home", href: "/accounting/dashboard", icon: Home },
    { label: "Review", href: "/accounting/payments", icon: WalletCards, permission: "payments.review" },
    { label: "Receipts", href: "/accounting/receipts", icon: ReceiptText, permission: "payments.view" },
    { label: "Adjustments", href: "/accounting/adjustments", icon: CreditCard, permission: "payments.adjust" },
    { label: "Refunds", href: "/accounting/refunds", icon: RotateCcw, permission: "payments.refund" },
  ],
  admin: navByRole.admin.slice(0, 5),
};

function userDetail(user: SessionUser, role: PortalRole): string {
  if (role === "student" && user.studentCode) return `Student ID ${user.studentCode}`;
  return user.email || user.mobile || roleLabels[role];
}

function isAllowed(user: SessionUser, item: NavItem): boolean {
  if (!item.permission) return true;
  return can(user, item.permission);
}

export function PortalShell({
  role,
  user,
  mockMode,
  institutionName,
  institutionLogoUrl,
  children,
}: {
  role: PortalRole;
  user: SessionUser;
  mockMode: boolean;
  institutionName?: string;
  institutionLogoUrl?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const nav = navByRole[role].filter((item) => isAllowed(user, item));
  const mobileNav = mobileNavByRole[role].filter((item) => isAllowed(user, item)).slice(0, 5);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  // Closes the menu whenever the route changes (a workspace-switch link was
  // clicked, or the user navigated some other way while it was open). Adjusted
  // during render rather than in an effect, per React's own guidance for
  // resetting state when a value changes — it takes effect the same render
  // instead of flashing the open menu on the new page for one frame first.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    if (profileOpen) setProfileOpen(false);
  }

  // The profile menu previously only closed by clicking its own toggle again —
  // clicking anywhere else on the page left it open until the user noticed
  // and clicked the toggle a second time.
  useEffect(() => {
    if (!profileOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setProfileOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [profileOpen]);

  async function logout() {
    if (mockMode) {
      router.push("/");
      return;
    }
    setLoggingOut(true);
    try {
      await browserRequest<void>({ url: "/api/v1/auth/logout", method: "POST" });
    } finally {
      window.location.assign("/login");
    }
  }

  const navigation = (onNavigate?: () => void) =>
    nav.map((item) => {
      const Icon = item.icon;
      const active = isActive(item.href);
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
            active ? "bg-white text-brand-950 shadow-sm" : "text-slate-300 hover:bg-white/10 hover:text-white",
          )}
        >
          <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          <span>{item.label}</span>
        </Link>
      );
    });

  return (
    <div className="min-h-screen bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[268px] border-r border-slate-800 bg-brand-950 lg:flex lg:flex-col">
        <div className="border-b border-white/10 px-5 py-5">
          <Brand href={`/${role}/dashboard`} light name={institutionName} logoUrl={institutionLogoUrl} />
        </div>
        <div className="px-5 pt-5">
          <div className="rounded-xl border border-white/10 bg-white/[0.06] p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-xs font-bold text-brand-900">{initials(user.name)}</div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{user.name}</p>
                <p className="truncate text-xs text-blue-200">{roleLabels[role]}</p>
              </div>
            </div>
          </div>
        </div>
        <nav className="soft-scrollbar mt-4 flex-1 overflow-y-auto px-3 pb-5" aria-label={`${roleLabels[role]} navigation`}>
          <p className="px-3 pb-2 pt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Workspace</p>
          <div className="space-y-1">{navigation()}</div>
        </nav>
        <div className="border-t border-white/10 p-4">
          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-60"
          >
            <LogOut className="h-[18px] w-[18px]" />{loggingOut ? "Signing out…" : mockMode ? "Exit preview" : "Sign out"}
          </button>
        </div>
      </aside>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-slate-950/55" onClick={() => setDrawerOpen(false)} aria-label="Close navigation" />
          <aside className="relative flex h-full w-[300px] max-w-[86vw] flex-col bg-brand-950 shadow-float">
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <Brand href={`/${role}/dashboard`} light name={institutionName} logoUrl={institutionLogoUrl} />
              <button type="button" onClick={() => setDrawerOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-lg text-white hover:bg-white/10" aria-label="Close menu"><X className="h-5 w-5" /></button>
            </div>
            <div className="border-b border-white/10 p-4">
              <p className="font-semibold text-white">{user.name}</p>
              <p className="mt-1 text-xs text-blue-200">{userDetail(user, role)}</p>
            </div>
            <nav className="flex-1 overflow-y-auto p-3"><div className="space-y-1">{navigation(() => setDrawerOpen(false))}</div></nav>
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-[268px]">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setDrawerOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 lg:hidden" aria-label="Open navigation"><Menu className="h-5 w-5" /></button>
            {/*
              * Matches the filter fields used on every list page:
              * h-11, slate-300 border, white fill, brand focus ring. It was the
              * only control in the app with no focus state at all, which is
              * both an inconsistency and a keyboard-accessibility failure.
              */}
            <form
              action={searchTarget[role]}
              method="get"
              role="search"
              className="hidden h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 transition focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-100 md:flex md:w-72"
            >
              <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                name="search"
                maxLength={160}
                placeholder={searchPlaceholder[role]}
                aria-label={searchPlaceholder[role]}
                className="w-full min-w-0 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 [&::-webkit-search-cancel-button]:appearance-none"
              />
            </form>
            <div className="md:hidden">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{roleLabels[role]}</p>
              <p className="text-sm font-bold text-slate-900">{user.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {mockMode ? <Badge tone="blue" className="hidden sm:inline-flex">Preview data</Badge> : null}
            <NotificationBell href={notificationRouteByRole[role].href} endpoint={notificationRouteByRole[role].endpoint} />
            <div className="relative" ref={profileMenuRef}>
              <button type="button" onClick={() => setProfileOpen((value) => !value)} className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-slate-100" aria-expanded={profileOpen} aria-haspopup="menu">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-xs font-bold text-brand-900">{initials(user.name)}</span>
                <span className="hidden text-left xl:block"><span className="block max-w-36 truncate text-sm font-semibold text-slate-900">{user.name}</span><span className="block max-w-44 truncate text-xs text-slate-500">{userDetail(user, role)}</span></span>
                <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
              </button>
              {profileOpen ? (
                <div className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-float" role="menu">
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-bold text-slate-950">{user.name}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">{userDetail(user, role)}</p>
                  </div>
                  {user.roles.length > 1 ? (
                    <>
                      <div className="my-2 border-t border-slate-100" />
                      <p className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-400">Switch workspace</p>
                      {user.roles.map((machineRole) => (
                        <Link key={machineRole} href={portalHomeByMachineRole[machineRole]} onClick={() => setProfileOpen(false)} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                          {machineRoleLabels[machineRole]}<ShieldCheck className="h-4 w-4 text-slate-400" />
                        </Link>
                      ))}
                    </>
                  ) : null}
                  <div className="my-2 border-t border-slate-100" />
                  <button type="button" onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><LogOut className="h-4 w-4" />{mockMode ? "Exit preview" : "Sign out"}</button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main id="main-content" className="mx-auto max-w-[1500px] px-4 py-6 pb-24 sm:px-6 sm:py-8 lg:px-8 lg:pb-10">
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid h-[70px] border-t border-slate-200 bg-white px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(15,23,42,0.06)] lg:hidden" style={{ gridTemplateColumns: `repeat(${mobileNav.length}, minmax(0, 1fr))` }} aria-label="Mobile navigation">
        {mobileNav.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("flex min-w-0 flex-col items-center justify-center gap-1 px-1 text-[10px] font-semibold", active ? "text-brand-700" : "text-slate-500")}>
              <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
