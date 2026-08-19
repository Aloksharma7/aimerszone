/*
 * "Create adjustment" is now linked from the shared payment-detail page
 * (see /accounting/payments/[paymentId]), which is also served at
 * /admin/payments/[paymentId] — so this destination needs to exist under
 * /admin too, or an administrator following that link 404s. See
 * /admin/payments for the same reasoning.
 */
export { default } from "@/app/accounting/adjustments/new/page";
