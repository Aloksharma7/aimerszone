import { notFound } from "next/navigation";
import { TestBuilder } from "@/components/test-builder";
import { requirePermission, requirePortalAccess } from "@/lib/auth/server";
import { getTeacherTestBuilder } from "@/lib/data/assessment";

export default async function TeacherTestBuilderPage({ params }: { params: Promise<{ testId: string }> }) {
  const user = await requirePortalAccess("teacher");
  await requirePermission(user, "tests.manage");
  const { testId } = await params;
  const data = await getTeacherTestBuilder(testId);
  if (!data) notFound();
  return <TestBuilder initialData={data} />;
}
