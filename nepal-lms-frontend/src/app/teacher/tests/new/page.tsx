import { notFound } from "next/navigation";
import { TestBuilder } from "@/components/test-builder";
import { requirePermission, requirePortalAccess } from "@/lib/auth/server";
import { getTeacherTestBuilder } from "@/lib/data/assessment";

export default async function NewTeacherTestPage({ searchParams }: { searchParams: Promise<{ batchId?: string }> }) {
  const user = await requirePortalAccess("teacher");
  await requirePermission(user, "tests.manage");
  const { batchId } = await searchParams;
  const data = await getTeacherTestBuilder(null, batchId || null);
  if (!data) notFound();
  return <TestBuilder initialData={data} />;
}
