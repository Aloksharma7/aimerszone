import { notFound } from "next/navigation";
import { TestRunner } from "@/components/test-runner";
import { getStudentTestLaunch } from "@/lib/data/assessment";

export default async function TestPage({ params }: { params: Promise<{ testId: string }> }) {
  const { testId } = await params;
  const launch = await getStudentTestLaunch(testId);
  if (!launch) notFound();
  return <TestRunner launch={launch} />;
}
