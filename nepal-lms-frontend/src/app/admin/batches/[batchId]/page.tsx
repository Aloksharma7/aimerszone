import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ArchiveControl } from "@/components/admin/archive-control";
import { BatchEditor } from "@/components/admin-controls";
import { ButtonLink, PageHeader, StatusBadge } from "@/components/ui";
import { getAdminBatch, getAdminCourses, getAdminTeachers } from "@/lib/data/admin";

export default async function BatchDetailPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const [batch, courses, teachers] = await Promise.all([getAdminBatch(batchId), getAdminCourses(), getAdminTeachers()]);
  if (!batch) notFound();
  return <><PageHeader eyebrow={`Learning operations · ${batch.status}`} title={batch.name} description="Edit batch schedule, teacher, delivery controls, capacity and enrollment policy." actions={<><StatusBadge status={batch.status}/><ButtonLink href="/admin/batches" variant="outline"><ArrowLeft className="h-4 w-4"/>Batches</ButtonLink></>}/><BatchEditor mode="edit" batch={batch} courses={courses} teachers={teachers}/><div className="mt-6"><ArchiveControl kind="batch" id={batch.id} name={batch.name} redirectTo="/admin/batches"/></div></>;
}
