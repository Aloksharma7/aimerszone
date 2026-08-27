import { notFound } from "next/navigation";
import { Edit3, KeyRound, Phone, UserRound } from "lucide-react";
import { ButtonLink, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { getStaffStudent } from "@/lib/data/staff";
import { portalPath } from "@/lib/portal-path";
import { initials } from "@/lib/utils";

export default async function StaffStudentDetailPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const [student, studentsBase, supportActionsBase, enrollBase] = await Promise.all([
    getStaffStudent(studentId),
    portalPath("/staff/students"),
    portalPath("/staff/support-actions"),
    portalPath("/staff/enroll"),
  ]);
  if (!student) notFound();
  const supportBase = `${supportActionsBase}?student=${encodeURIComponent(student.id)}`;
  return <><PageHeader back={{ href: studentsBase, label: "All students" }} eyebrow="Student record" title={student.name} description={`${student.id} · ${student.phone}`} actions={<ButtonLink href={`${supportBase}&action=contact-correction`}><Edit3 className="h-4 w-4" />Correct permitted fields</ButtonLink>} /><div className="grid gap-6 xl:grid-cols-[1fr_350px]"><div className="space-y-6"><Panel><div className="flex items-center gap-4"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-lg font-bold text-brand-900">{initials(student.name)}</div><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold text-slate-950">{student.name}</h2><StatusBadge status={student.status} /></div><p className="mt-1 text-sm text-slate-500">Student record created {student.joined}</p></div></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Mobile</p><p className="mt-2 text-sm font-semibold text-slate-900">{student.phone}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Email</p><p className="mt-2 text-sm font-semibold text-slate-900">{student.email || "Not provided"}</p></div></div></Panel><Panel><h2 className="text-xl font-bold text-slate-950">Current learning interest</h2><div className="mt-5 rounded-xl border border-slate-200 p-4"><p className="font-bold text-slate-950">{student.course}</p><p className="mt-1 text-sm text-slate-500">Detailed enrollments are fetched from the dedicated enrollment endpoint.</p></div></Panel></div><aside className="space-y-5"><Panel><h2 className="text-lg font-bold text-slate-950">Account assistance</h2><div className="mt-5 grid gap-3"><ButtonLink href={`${supportBase}&action=password-reset`} variant="outline" className="w-full"><KeyRound className="h-4 w-4" />Password setup</ButtonLink><ButtonLink href={`${supportBase}&action=contact-correction`} variant="outline" className="w-full"><Phone className="h-4 w-4" />Correct contact</ButtonLink><ButtonLink href={`${supportBase}&action=revoke-sessions`} variant="outline" className="w-full"><UserRound className="h-4 w-4" />Review sessions</ButtonLink></div></Panel><Panel><h2 className="font-bold text-slate-950">Permission note</h2><p className="mt-3 text-sm leading-6 text-slate-600">Staff can review and approve payments from the payments list, and can capture a payment on this student&apos;s behalf below. Attaching staff or admin roles to an account stays admin-only.</p></Panel><ButtonLink href={`${enrollBase}?student=${encodeURIComponent(student.id)}`} className="w-full">Create payment submission</ButtonLink></aside></div></>;
}
