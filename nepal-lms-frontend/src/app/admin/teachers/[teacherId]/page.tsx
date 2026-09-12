import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { TeacherProfileForm } from "@/components/admin/teacher-profile-form";
import { ButtonLink, PageHeader, StatusBadge } from "@/components/ui";
import { getAdminTeacher } from "@/lib/data/admin";

export default async function AdminTeacherDetailPage({ params }: { params: Promise<{ teacherId: string }> }) {
  const { teacherId } = await params;
  const teacher = await getAdminTeacher(teacherId);
  if (!teacher) notFound();

  return (
    <>
      <PageHeader
        eyebrow="Faculty directory"
        title={teacher.name}
        description="Editing the public /teachers page profile — this teacher's own account is managed separately."
        actions={<>
          <StatusBadge status={teacher.isPublic ? "Published" : "Hidden"} />
          <ButtonLink href="/admin/teachers" variant="outline"><ArrowLeft className="h-4 w-4" />Teachers</ButtonLink>
          <ButtonLink href={`/teachers/${teacher.slug}`} variant="outline"><ExternalLink className="h-4 w-4" />Public page</ButtonLink>
        </>}
      />
      <TeacherProfileForm teacher={teacher} />
    </>
  );
}
