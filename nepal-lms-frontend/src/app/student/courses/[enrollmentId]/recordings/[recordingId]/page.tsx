import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { CourseWorkspaceHeader } from "@/components/course-workspace";
import { ResourceLibrary } from "@/components/student/resource-library";
import { SecureRecordingPlayer } from "@/components/student/secure-learning-actions";
import { ButtonLink, Panel, ProgressBar } from "@/components/ui";
import { getStudentEnrollment, getStudentRecording, getStudentRecordings, getStudentResources } from "@/lib/data/student";

export default async function RecordingPlayerPage({ params }: { params: Promise<{ enrollmentId: string; recordingId: string }> }) {
  const { enrollmentId, recordingId } = await params;
  const [enrollment, recording] = await Promise.all([getStudentEnrollment(enrollmentId), getStudentRecording(recordingId, enrollmentId)]);
  if (!enrollment || !recording || (recording.enrollmentId && recording.enrollmentId !== enrollment.id)) notFound();
  const [recordings, resources] = await Promise.all([getStudentRecordings(enrollment.id), getStudentResources(enrollment.id)]);
  const index = recordings.findIndex((item) => item.id === recording.id);
  const previous = index > 0 ? recordings[index - 1] : null;
  const next = index >= 0 && index < recordings.length - 1 ? recordings[index + 1] : null;

  return (
    <>
      <CourseWorkspaceHeader enrollmentId={enrollment.id} course={enrollment.course} progress={enrollment.progress} accessExpiry={enrollment.accessExpiry} />
      <div className="grid gap-6 xl:grid-cols-[1fr_330px]">
        <div>
          <SecureRecordingPlayer recordingId={recording.id} title={recording.title} />
          <Panel className="mt-5"><p className="text-sm font-bold uppercase tracking-wider text-brand-700">{recording.module}</p><h1 className="mt-2 text-2xl font-bold text-slate-950">{recording.title}</h1><p className="mt-2 text-sm text-slate-500">{recording.teacher} · {recording.date} · {recording.duration}</p><div className="mt-5"><ProgressBar value={recording.progress} label="Watching progress" /></div><div className="mt-5 flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900"><Info className="mt-0.5 h-5 w-5 shrink-0" />Playback only starts once the server confirms your enrollment is active and the recording has been released.</div></Panel>
          <div className="mt-5 flex flex-col justify-between gap-3 sm:flex-row">{previous ? <ButtonLink href={`/student/courses/${enrollment.id}/recordings/${previous.id}`} variant="outline"><ChevronLeft className="h-4 w-4" />Previous</ButtonLink> : <span />}{next ? <ButtonLink href={`/student/courses/${enrollment.id}/recordings/${next.id}`} variant="outline">Next<ChevronRight className="h-4 w-4" /></ButtonLink> : null}</div>
        </div>
        <aside><Panel><h2 className="font-bold text-slate-950">This course</h2><p className="mt-2 text-sm leading-6 text-slate-500">{enrollment.course.title}</p><ButtonLink href={`/student/courses/${enrollment.id}/recordings`} variant="outline" className="mt-5 w-full">All course recordings</ButtonLink></Panel></aside>
      </div>
      {resources.length ? <div className="mt-6"><ResourceLibrary resources={resources.slice(0, 3)} /></div> : null}
    </>
  );
}
