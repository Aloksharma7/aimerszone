import { PolicyPage } from "@/components/public-page";

export default function RefundPolicyPage() {
  return <PolicyPage title="Refund policy" intro="Refund eligibility, decisions and financial adjustments must be explicit and auditable." sections={[
    { heading: "Eligibility", body: "Replace this section with institution-approved eligibility rules, request windows and exclusions before accepting production payments." },
    { heading: "How to request", body: "A student should submit the payment reference, batch, reason and supporting information through the approved support channel." },
    { heading: "Review and outcome", body: "Authorized accounting staff review the request. Approval, rejection, refund and adjustment actions require a recorded reason." },
    { heading: "Access after refund", body: "Any effect on course access must follow the approved policy and be applied through an audited enrollment action." },
  ]} />;
}
