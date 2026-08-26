import { redirect } from "next/navigation";
import { portalPath } from "@/lib/portal-path";

/*
 * This used to be a second, less capable form for the same job as
 * /staff/enroll (plain student dropdown instead of search-or-create, and
 * missing the batch picker /staff/enroll now has) — two places doing one
 * piece of work. Redirects here, preserving which student was clicked
 * through from, rather than deleting the URL outright.
 */
export default async function StaffPaymentSubmissionNewRedirect({ searchParams }: { searchParams: Promise<{ student?: string }> }) {
  const [{ student }, target] = await Promise.all([searchParams, portalPath("/staff/enroll")]);
  redirect(student ? `${target}?student=${encodeURIComponent(student)}` : target);
}
