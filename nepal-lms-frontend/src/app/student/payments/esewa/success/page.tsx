import { EsewaCallbackHandler } from "@/components/student/esewa-callback";
import { PageHeader } from "@/components/ui";

/**
 * Where eSewa returns the student after a payment.
 *
 * The signed payload arrives as a query parameter and is handed straight to the
 * API for verification — nothing on this page decides whether the payment was
 * genuine.
 */
export default async function EsewaSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>;
}) {
  const { data } = await searchParams;

  return (
    <>
      <PageHeader eyebrow="Payment" title="Confirming your payment" description="Please wait while we verify this with eSewa." />
      <EsewaCallbackHandler payload={data ?? null} />
    </>
  );
}
