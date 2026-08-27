import { notFound } from "next/navigation";
import { ResourceManager } from "@/components/teacher/resource-manager";
import { PageHeader } from "@/components/ui";
import { getBatchResources, getBatchSyllabusOutline, getTeacherBatch } from "@/lib/data/teacher";

export default async function BatchResourcesPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const [detail, resources, syllabusOutline] = await Promise.all([getTeacherBatch(batchId), getBatchResources(batchId), getBatchSyllabusOutline(batchId)]);
  if (!detail) notFound();

  return (
    <>
      <PageHeader
        eyebrow={`${detail.batch.course} · ${detail.batch.batch}`}
        title="Notes and resources"
        description="Upload PDFs and notes for this batch. Staged files stay hidden until you release them."
      />
      <ResourceManager batchId={batchId} resources={resources} syllabusOutline={syllabusOutline} />
    </>
  );
}
