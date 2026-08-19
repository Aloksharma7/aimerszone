/*
 * The payment review queue, under an admin URL.
 *
 * The admin portal previously had a read-only finance view that linked out to
 * /accounting/payments to actually decide anything — which both threw the
 * administrator into another portal and contradicted how the API works. The
 * backend grants administrators every role gate (EnsureRole and Gate::before
 * both let them through), so nothing was being enforced by hiding this; the UI
 * was the only thing standing in the way.
 */
export { default } from "@/app/accounting/payments/page";
