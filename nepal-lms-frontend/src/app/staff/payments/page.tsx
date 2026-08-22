/*
 * Payment review, under a staff URL.
 *
 * Staff already merges the enrollment-officer and accountant roles and the API
 * already grants the same access either way — this used to only exist at
 * /accounting/payments, so a staff member's own sidebar sent them to a URL
 * that named a portal they were never told they were in.
 */
export { default } from "@/app/accounting/payments/page";
