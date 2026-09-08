import { PolicyPage } from "@/components/public-page";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Privacy Policy",
  description: "How Aimers Zone collects, uses and protects your personal information.",
});

export default function PrivacyPage() {
  return <PolicyPage title="Privacy Policy" intro="This policy explains what information Aimers Zone collects from students, how it is used, and how you can review or correct it." sections={[
    { heading: "Information we collect", body: "We collect only what is needed to register you, run your learning account, verify your payments and provide support — your name, contact details, enrollment records and payment confirmations. Optional information, like a profile photo, always stays optional." },
    { heading: "How we use it", body: "Your information is used to give you access to your enrolled courses and classes, verify and record payments, issue receipts, send you important updates about your batch, and respond to support requests. We do not sell or share your information with anyone outside Aimers Zone." },
    { heading: "Access and retention", body: "Only authorized Aimers Zone staff can view your account and payment details, and every access is recorded. Payment proofs and account security information are never shown on ordinary pages — they stay behind a verified staff review." },
    { heading: "Your choices", body: "You can update your profile details, change your password and review your active login sessions at any time from your account. For any privacy question, contact us at info.aimerszone@gmail.com or +977 984-4445200." },
  ]} />;
}
