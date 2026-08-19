import { PolicyPage } from "@/components/public-page";

export default function PrivacyPage() {
  return <PolicyPage title="Privacy notice" intro="This page explains how student, staff, payment and learning information should be handled." sections={[
    { heading: "Information collected", body: "The production system should collect only the information needed for registration, learning access, payment verification, support and platform security. Optional fields must remain clearly optional." },
    { heading: "How information is used", body: "Information may be used to operate the account, provide enrolled learning, verify payments, issue receipts, communicate important batch information and protect the service." },
    { heading: "Access and retention", body: "Role permissions, audit history and approved retention periods control access. Sensitive payment proofs and security information should not be exposed in ordinary page output." },
    { heading: "Your choices", body: "Users should be able to correct permitted profile information, change passwords, review active sessions and contact the institution about privacy questions." },
  ]} />;
}
