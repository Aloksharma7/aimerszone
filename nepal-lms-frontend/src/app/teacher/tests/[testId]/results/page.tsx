import { notFound } from "next/navigation";
import { CheckCircle2, ClipboardList, Percent, Users } from "lucide-react";
import { DataTable } from "@/components/portal-components";
import { MetricCard, PageHeader, StatusBadge } from "@/components/ui";
import { requirePermission, requirePortalAccess } from "@/lib/auth/server";
import { getTeacherTestResults } from "@/lib/data/assessment";
import { portalPath } from "@/lib/portal-path";

export default async function TeacherTestResultsPage({ params }: { params: Promise<{ testId: string }> }) {
  const user = await requirePortalAccess("teacher");
  await requirePermission(user, "tests.manage");
  const { testId } = await params;
  const [results, backHref] = await Promise.all([getTeacherTestResults(testId), portalPath(`/teacher/tests/${testId}`)]);
  if (!results) notFound();

  return (
    <>
      <PageHeader
        back={{ href: backHref, label: "Test builder" }}
        eyebrow="Assessment results"
        title={results.test.title}
        description={`Pass mark ${results.test.passMark} of ${results.test.totalMarks}. Only submitted or graded attempts are shown.`}
      />
      <div className="grid gap-4 sm:grid-cols-4">
        <MetricCard label="Submissions" value={String(results.metrics.submissions)} icon={Users} tone="blue" />
        <MetricCard label="Graded" value={String(results.metrics.graded)} icon={ClipboardList} tone="violet" />
        <MetricCard label="Passed" value={String(results.metrics.passed)} icon={CheckCircle2} tone="green" />
        <MetricCard label="Average score" value={results.metrics.averageScore != null ? String(results.metrics.averageScore) : "—"} icon={Percent} tone="amber" />
      </div>
      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <DataTable
          rowKey="id"
          rows={results.attempts as unknown as Record<string, unknown>[]}
          columns={[
            { key: "studentName", label: "Student" },
            { key: "attemptNumber", label: "Attempt" },
            { key: "score", label: "Score", render: (row) => (row.score == null ? "—" : `${row.score} / ${row.maxScore}`) },
            { key: "passed", label: "Result", render: (row) => (row.passed == null ? <StatusBadge status="Pending" /> : <StatusBadge status={row.passed ? "Passed" : "Failed"} />) },
            { key: "status", label: "Status", render: (row) => <StatusBadge status={String(row.status)} /> },
            { key: "submittedAt", label: "Submitted" },
            { key: "autoSubmitted", label: "Auto-submitted", render: (row) => (row.autoSubmitted ? "Yes" : "No") },
          ]}
        />
        {results.attempts.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">No submissions yet.</p> : null}
      </div>
    </>
  );
}
