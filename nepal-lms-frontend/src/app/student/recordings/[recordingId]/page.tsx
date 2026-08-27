import { notFound } from "next/navigation";
import { Info } from "lucide-react";
import { ResourceLibrary } from "@/components/student/resource-library";
import { SecureRecordingPlayer } from "@/components/student/secure-learning-actions";
import { ButtonLink, PageHeader, Panel, ProgressBar } from "@/components/ui";
import { getStudentRecording, getStudentResources } from "@/lib/data/student";

export default async function GlobalRecordingPlayerPage({ params }: { params: Promise<{ recordingId: string }> }) {
  const { recordingId } = await params;
  const recording = await getStudentRecording(recordingId);
  if (!recording) notFound();
  // Deliberately does not redirect into the course-scoped detail page even
  // though this recording belongs to one — the global library is meant to
  // play a video right where you clicked it, in whatever order you're
  // browsing in, rather than dropping you into that course's structured
  // (syllabus-ordered) view. That view is what /student/courses/*/recordings
  // is for.
  const resources = await getStudentResources();
  return (
    <>
      <PageHeader back={{ href: "/student/recordings", label: "All recordings" }} eyebrow={recording.course || "Recorded class"} title={recording.title} description={`${recording.module} · ${recording.teacher} · ${recording.duration}`} actions={<ButtonLink href="/student/recordings" variant="outline">Back to recordings</ButtonLink>} />
      <SecureRecordingPlayer recordingId={recording.id} title={recording.title} />
      <Panel className="mt-5"><ProgressBar value={recording.progress} label="Watching progress" /><div className="mt-5 flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900"><Info className="mt-0.5 h-5 w-5 shrink-0" />Playback is released only after the API confirms your enrollment and access expiry.</div></Panel>
      <div className="mt-6"><ResourceLibrary resources={resources.slice(0, 3)} global /></div>
    </>
  );
}
