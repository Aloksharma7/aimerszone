import { PolicyPage } from "@/components/public-page";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Refund Policy",
  description: "Aimers Zone's policy on refunds for course and batch payments.",
});

export default function RefundPolicyPage() {
  return <PolicyPage title="Refund Policy" intro="We want every student to feel confident before enrolling. This policy explains when a refund is possible and how to request one." sections={[
    { heading: "Eligibility", body: "A refund may be considered if you request it before your batch's classes begin, or in the case of a genuine payment error, such as a duplicate payment. Refunds are not available once you have started attending live classes or accessing recordings for a batch, except at Aimers Zone's discretion." },
    { heading: "How to request a refund", body: "Contact us at info.aimerszone@gmail.com or +977 984-4445200 with your payment reference, the batch name, and the reason for your request." },
    { heading: "Review and decision", body: "Our team reviews every refund request individually and will let you know the outcome, along with the reason, within a few working days." },
    { heading: "Access after a refund", body: "If a refund is approved, access to the related batch or course is removed as part of processing the refund." },
  ]} />;
}
