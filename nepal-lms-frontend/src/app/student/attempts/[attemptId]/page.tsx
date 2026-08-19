import { CheckCircle2, CircleX, Clock3, HelpCircle, RotateCcw, Trophy } from "lucide-react";
import { notFound } from "next/navigation";
import { AlertBox, ButtonLink, MetricCard, PageHeader, Panel, ProgressBar } from "@/components/ui";
import { getAttemptResult } from "@/lib/data/assessment";

function timeLabel(seconds: number | null): string {
  if (seconds == null) return "—";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

export default async function TestResultPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const result = await getAttemptResult(attemptId);
  if (!result) notFound();
  if (result.releaseState !== "released") {
    return <><PageHeader back={{ href: "/student/tests", label: "All tests" }} eyebrow="Assessment submitted" title={result.title} description={`${result.course} · Submitted ${result.submittedAt}`} actions={<ButtonLink href="/student/tests" variant="outline">Back to tests</ButtonLink>} /><Panel><AlertBox title="Result not released yet" tone="info">Your attempt was received. The score and answer review will appear here when the configured release condition is met.</AlertBox></Panel></>;
  }
  const score = result.score ?? 0;
  const percent = result.totalMarks ? Math.round((score / result.totalMarks) * 100) : 0;
  const passed = score >= result.passMarks;
  return <><PageHeader eyebrow="Result released" title={result.title} description={`${result.course} · Submitted ${result.submittedAt}`} actions={<ButtonLink href="/student/tests" variant="outline">Back to tests</ButtonLink>} /><Panel className="overflow-hidden border-0 bg-brand-950 text-white"><div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center"><div><p className="text-sm font-semibold text-blue-200">Your score</p><div className="mt-2 flex items-end gap-3"><p className="text-5xl font-bold">{score}/{result.totalMarks}</p><span className={`pb-1 text-lg font-semibold ${passed ? "text-green-300" : "text-amber-300"}`}>{passed ? "Passed" : "Review required"}</span></div><p className="mt-3 text-sm leading-6 text-slate-300">This score is shown only because the backend marked the result as released.</p></div><div className="flex h-24 w-24 items-center justify-center rounded-full border-8 border-white/10 bg-white/5 text-2xl font-bold">{percent}%</div></div></Panel><div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Correct" value={String(result.correct ?? "—")} icon={CheckCircle2} tone="green"/><MetricCard label="Incorrect" value={String(result.incorrect ?? "—")} icon={CircleX} tone="amber"/><MetricCard label="Unanswered" value={String(result.unanswered ?? "—")} icon={HelpCircle} tone="slate"/><MetricCard label="Time used" value={timeLabel(result.timeUsedSeconds)} icon={Clock3} tone="blue"/></div><div className="mt-6 grid gap-6 xl:grid-cols-[1fr_320px]"><Panel><h2 className="text-xl font-bold text-slate-950">Performance by topic</h2>{result.topicPerformance.length ? <div className="mt-6 space-y-5">{result.topicPerformance.map((topic) => <ProgressBar key={topic.label} label={topic.label} value={topic.percent} />)}</div> : <p className="mt-4 text-sm text-slate-500">Topic-level analysis was not released for this attempt.</p>}</Panel><Panel><Trophy className="h-7 w-7 text-brand-700"/><h2 className="mt-4 text-lg font-bold text-slate-950">Attempts remaining</h2><p className="mt-3 text-sm leading-6 text-slate-600">{result.attemptsRemaining} additional attempt{result.attemptsRemaining === 1 ? "" : "s"} available according to the test rules.</p>{result.reattemptTestId && result.attemptsRemaining > 0 ? <ButtonLink href={`/student/tests/${encodeURIComponent(result.reattemptTestId)}`} variant="outline" className="mt-5 w-full"><RotateCcw className="h-4 w-4"/>Start another attempt</ButtonLink> : null}</Panel></div></>;
}
