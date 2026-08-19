import { ArrowLeft } from "lucide-react";
import { BatchEditor } from "@/components/admin-controls";
import { ButtonLink, PageHeader } from "@/components/ui";
import { getAdminCourses, getAdminTeachers } from "@/lib/data/admin";

export default async function NewBatchPage() {
  const [courses, teachers] = await Promise.all([getAdminCourses(), getAdminTeachers()]);
  return <><PageHeader eyebrow="Learning operations" title="Create a new batch" description="Configure scheduled delivery, teacher assignment, capacity, live classes and enrollment policy." actions={<ButtonLink href="/admin/batches" variant="outline"><ArrowLeft className="h-4 w-4"/>Back to batches</ButtonLink>}/><BatchEditor courses={courses} teachers={teachers}/></>;
}
