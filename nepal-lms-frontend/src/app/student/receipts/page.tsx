import { redirect } from "next/navigation";

/*
 * A receipt is just the fixed snapshot of an approved payment — not a
 * separate thing to browse. This list duplicated /student/payments (same
 * rows, filtered to Approved, different column labels), so it's no longer
 * in the sidebar; each receipt is reached from its own payment's detail
 * page instead. This redirect only exists for old bookmarks/links.
 */
export default function StudentReceiptsRedirect() {
  redirect("/student/payments");
}
