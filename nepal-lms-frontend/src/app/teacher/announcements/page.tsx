import { Megaphone, Plus } from "lucide-react";
import { Pagination } from "@/components/pagination";
import { AnnouncementFeed } from "@/components/portal-components";
import { TeacherAnnouncementForm } from "@/components/teacher/teacher-actions";
import { ButtonLink, PageHeader, Panel } from "@/components/ui";
import { getSessionUser, requirePermission } from "@/lib/auth/server";
import { getTeacherAnnouncements, getTeacherBatches } from "@/lib/data/teacher";
import { buildQueryString, pageParam, type PageSearchParams } from "@/lib/search-params";

export default async function TeacherAnnouncementsPage({ searchParams }: { searchParams: PageSearchParams }) {
  const user = await getSessionUser("teacher");
  if (user) await requirePermission(user, "announcements.manage");
  const raw = await searchParams;
  const page = pageParam(raw);
  const [{ items, meta }, batches] = await Promise.all([getTeacherAnnouncements({ page }), getTeacherBatches()]);
  return <><PageHeader eyebrow="Communication" title="Announcements" description="Publish academic updates only to assigned batches." actions={<ButtonLink href="/teacher/announcements#new-announcement"><Plus className="h-4 w-4" />New announcement</ButtonLink>} /><div className="grid gap-6 xl:grid-cols-[1fr_380px]"><Panel><h2 className="text-xl font-bold text-slate-950">Published announcements</h2><div className="mt-6"><AnnouncementFeed items={items} /></div><Pagination meta={meta} buildHref={(target) => `/teacher/announcements${buildQueryString({ page: String(target) })}`} /></Panel><div id="new-announcement"><Panel className="h-fit"><div className="flex items-center gap-3"><Megaphone className="h-6 w-6 text-brand-700" /><h2 className="text-xl font-bold text-slate-950">Create announcement</h2></div><TeacherAnnouncementForm batches={batches} /></Panel></div></div></>;
}
