import { notFound } from "next/navigation";
import { CourseWorkspaceHeader } from "@/components/course-workspace";
import { AnnouncementFeed } from "@/components/portal-components";
import { EmptyState, Panel } from "@/components/ui";
import { getStudentAnnouncements, getStudentEnrollment } from "@/lib/data/student";

export default async function CourseAnnouncementsPage({ params }: { params: Promise<{ enrollmentId: string }> }) {
  const { enrollmentId } = await params;
  const enrollment = await getStudentEnrollment(enrollmentId);
  if (!enrollment) notFound();
  const announcements = await getStudentAnnouncements(enrollment.id);
  return <><CourseWorkspaceHeader enrollmentId={enrollment.id} course={enrollment.course} progress={enrollment.progress} accessExpiry={enrollment.accessExpiry} /><Panel><h1 className="text-xl font-bold text-slate-950">Batch announcements</h1><p className="mt-1 text-sm text-slate-500">Pinned and recent updates from teachers and the institution.</p>{announcements.length ? <div className="mt-6"><AnnouncementFeed items={announcements} /></div> : <div className="mt-6"><EmptyState title="No announcements" description="New batch updates will appear here." /></div>}</Panel></>;
}
