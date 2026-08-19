import { RecurringClassForm } from "@/components/teacher/recurring-class-form";
import { PageHeader } from "@/components/ui";
import { getTeacherBatches } from "@/lib/data/teacher";

export default async function RecurringClassPage() {
  const batches = await getTeacherBatches();

  return (
    <>
      <PageHeader
        eyebrow="Classes"
        title="Schedule a repeating class"
        description="Create a whole term of classes in one step. Each one is a real class you can reschedule or cancel individually afterwards."
      />
      <RecurringClassForm
        batches={batches.map((batch) => ({ id: batch.id, title: batch.batch, courseTitle: batch.course }))}
      />
    </>
  );
}
